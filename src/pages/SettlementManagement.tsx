import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, CheckCircle, Pause, RotateCcw, CalendarPlus, StickyNote, ChevronDown, ChevronRight } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { fetchSettlements, setSettlementStatus, setSettlementMemo, generateSettlements } from '../lib/api';
import type { Settlement, SettlementStatus } from '../types';

const PAGE_SIZE = 6;

/** 로컬(KST 기준 브라우저) 오늘 날짜 YYYY-MM-DD */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** n일 전/후 날짜 YYYY-MM-DD */
function shiftDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 지난주 월~일 (정산 생성 모달 기본값) */
function lastWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0=일
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon - 7);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(mon), end: shiftDays(fmt(mon), 6) };
}

const won = (n: number) => `${n.toLocaleString()}원`;

const HOLD_REASONS = [
  '환불 분쟁 확인 필요',
  '계좌 정보 확인 필요',
  '신고 건 처리 필요',
  '직접 입력',
];

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 목록: api.fetchSettlements() — `admin_settlements` 뷰를 판매자×기간 그룹으로 집계
 *   (id=그룹키, settlementIds=원본 행 id 배열, orders=주문 단위 원본 행).
 * - 확정/보류/해제: api.setSettlementStatus(ids, 상태, memo?, settledOn?)
 *   → `admin_set_settlement_status` RPC(감사 로그 + 판매자 알림 자동 발송, 20260818 마이그레이션).
 * - 정산 생성(기간 지정): api.generateSettlements(start, end, payDate?)
 *   → `admin_generate_settlements` RPC. 이미 정산된 주문은 건너뛰므로 재실행해도 중복 생성되지 않는다.
 * - platformFee/pgFee/couponBurden 은 정산 배치가 계산해 내려주는 값이라 관리자는 조회만 한다.
 *   adjustment(정산 조정액)는 본사 쿠폰 보전분 + 환불 회계 잔차로, 상세의 금액식이 항상 맞아떨어지게 하는 파생값이다.
 */
export default function SettlementManagement() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SettlementStatus | '전체'>('전체');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 확정 모달(정산예정일 지정)
  const [confirmTargets, setConfirmTargets] = useState<Settlement[] | null>(null);
  const [payDate, setPayDate] = useState(todayStr());

  // 확정 취소 모달 — 되돌리면 판매자에게 다시 알림이 나가므로 반드시 한 번 확인받는다.
  const [unconfirmTargets, setUnconfirmTargets] = useState<Settlement[] | null>(null);

  // 보류 모달 — 사유 선택과 직접입력 텍스트를 분리(예전엔 한 state 를 공유해 입력 즉시 창이 닫혔다)
  const [holdTargets, setHoldTargets] = useState<Settlement[] | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [holdCustom, setHoldCustom] = useState('');

  // 메모 편집
  const [memoTarget, setMemoTarget] = useState<Settlement | null>(null);
  const [memoText, setMemoText] = useState('');

  // 정산 생성 모달
  const [genModal, setGenModal] = useState(false);
  const [genRange, setGenRange] = useState(lastWeekRange);
  const [genPay, setGenPay] = useState('');

  // 상세의 주문 내역 펼침
  const [ordersOpen, setOrdersOpen] = useState(false);

  const { download, isLoading, toast, canDownload } = useExcelDownload();

  const showNotice = useCallback((message: string, type: 'success' | 'error') => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3500);
  }, []);

  const load = useCallback(async () => {
    const rows = await fetchSettlements();
    setSettlements(rows);
    return rows;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSettlements()
      .then(rows => { if (!cancelled) setSettlements(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => settlements.filter(s => {
    const q = search.trim();
    const matchSearch = !q || s.sellerName.includes(q) || s.bizNumber.includes(q);
    const matchStatus = statusFilter === '전체' || s.status === statusFilter;
    const periodStart = s.period.split(' ~ ')[0]?.trim() ?? '';
    const periodEnd = s.period.split(' ~ ')[1]?.trim() ?? '';
    const matchDateFrom = !dateFrom || periodStart >= dateFrom;
    const matchDateTo = !dateTo || periodEnd <= dateTo;
    return matchSearch && matchStatus && matchDateFrom && matchDateTo;
  }), [settlements, search, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selected = selectedId ? settlements.find(s => s.id === selectedId) ?? null : null;

  // 선택 건 — 필터에서 사라진 항목은 자동으로 제외한다.
  const checkedRows = useMemo(
    () => filtered.filter(s => checked.has(s.id)),
    [filtered, checked],
  );
  const pageAllChecked = paginated.length > 0 && paginated.every(s => checked.has(s.id));

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleCheckPage = () => {
    setChecked(prev => {
      const next = new Set(prev);
      if (pageAllChecked) paginated.forEach(s => next.delete(s.id));
      else paginated.forEach(s => next.add(s.id));
      return next;
    });
  };

  /** 상태 변경 실행 — 서버 반영 후 목록을 다시 읽어 로컬/서버 값 불일치를 없앤다. */
  const applyStatus = async (
    targets: Settlement[], status: SettlementStatus, memo?: string, settledOn?: string,
  ): Promise<boolean> => {
    const ids = targets.flatMap(t => t.settlementIds);
    if (ids.length === 0) {
      showNotice('대상 정산 건이 없습니다.', 'error');
      return false;
    }
    setBusy(true);
    try {
      const count = await setSettlementStatus(ids, status, memo, settledOn);
      await load();
      setChecked(new Set());
      showNotice(
        `${targets.length}개 정산 그룹(${count || ids.length}건)을 "${status}" 처리했습니다. 판매자 알림·감사 로그가 기록되었습니다.`,
        'success',
      );
      return true;
    } catch (e) {
      showNotice('처리 실패: ' + (e as Error).message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openConfirm = (targets: Settlement[]) => {
    const blocked = targets.filter(t => t.status === '보류');
    if (blocked.length > 0) {
      showNotice(`보류 상태에서는 정산 확정이 불가합니다. (${blocked.map(b => b.sellerName).join(', ')})`, 'error');
      return;
    }
    if (targets.length === 0) {
      showNotice('확정 가능한(정산예정) 건이 없습니다.', 'error');
      return;
    }
    setPayDate(todayStr());
    setConfirmTargets(targets);
  };

  const handleConfirm = async () => {
    if (!confirmTargets) return;
    if (!payDate) return showNotice('정산예정일을 선택하세요.', 'error');
    const ok = await applyStatus(confirmTargets, '정산완료', undefined, payDate);
    if (ok) setConfirmTargets(null);
  };

  const openUnconfirm = (targets: Settlement[]) => {
    if (targets.length === 0) return showNotice('확정 취소할 건이 없습니다.', 'error');
    setUnconfirmTargets(targets);
  };

  const handleUnconfirm = async () => {
    if (!unconfirmTargets) return;
    const ok = await applyStatus(unconfirmTargets, '정산예정');
    if (ok) setUnconfirmTargets(null);
  };

  const handleRelease = async (targets: Settlement[]) => {
    await applyStatus(targets, '정산예정');
  };

  const handleHold = async () => {
    if (!holdTargets) return;
    const reason = holdReason === '직접 입력' ? holdCustom.trim() : holdReason;
    if (!reason) return showNotice('보류 사유를 선택하거나 입력하세요.', 'error');
    const ok = await applyStatus(holdTargets, '보류', reason);
    if (ok) { setHoldTargets(null); setHoldReason(''); setHoldCustom(''); }
  };

  /** 메모 저장 — 상태 변경 RPC 를 쓰면 판매자에게 잘못된 상태 알림이 나가므로 전용 RPC 를 쓴다. */
  const handleSaveMemo = async () => {
    if (!memoTarget) return;
    setBusy(true);
    try {
      await setSettlementMemo(memoTarget.settlementIds, memoText.trim());
      await load();
      setMemoTarget(null);
      showNotice('관리자 메모를 저장했습니다.', 'success');
    } catch (e) {
      showNotice('메모 저장 실패: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!genRange.start || !genRange.end) return showNotice('정산 대상 기간을 입력하세요.', 'error');
    if (genRange.end < genRange.start) return showNotice('종료일이 시작일보다 빠릅니다.', 'error');
    setBusy(true);
    try {
      const count = await generateSettlements(genRange.start, genRange.end, genPay || undefined);
      await load();
      setGenModal(false);
      showNotice(count > 0
        ? `정산 ${count}건을 생성했습니다.`
        : '새로 생성된 정산이 없습니다. (해당 기간 주문이 이미 모두 정산되었거나 완료 주문이 없습니다)', count > 0 ? 'success' : 'error');
    } catch (e) {
      showNotice('정산 생성 실패: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExcelDownload = () => {
    const filters = [
      search && `검색: ${search}`,
      statusFilter !== '전체' && `상태: ${statusFilter}`,
      (dateFrom || dateTo) && `기간: ${dateFrom || '시작'} ~ ${dateTo || '종료'}`,
    ].filter(Boolean).join(', ');

    download({
      filename: 'settlements',
      menu: '정산 관리',
      filters,
      sheets: [
        {
          name: '정산내역',
          data: filtered.map(s => ({
            '정산기간': s.period,
            '판매자명': s.sellerName,
            '사업자번호': s.bizNumber,
            '주문건수': s.orderCount,
            '총판매금액(원)': s.totalSales,
            '플랫폼수수료(원)': s.platformFee,
            'PG수수료(원)': s.pgFee,
            '수수료합계(원)': s.commission,
            '환불금액(원)': s.refundAmount,
            '쿠폰판매자부담(원)': s.couponBurden,
            '정산조정액(원)': s.adjustment,
            '최종정산금액(원)': s.finalAmount,
            '정산상태': s.status,
            '정산예정일': s.scheduledDate,
            '은행': s.bankName,
            '계좌번호': s.accountNumber,
            '예금주': s.accountHolder,
            '관리자메모': s.memo ?? '',
          })),
        },
        {
          name: '주문상세',
          data: filtered.flatMap(s => s.orders.map(o => ({
            '정산기간': s.period,
            '판매자명': s.sellerName,
            '정산코드': o.settlementCode,
            '주문번호': o.orderCode,
            '상품명': o.productName,
            '판매금액(원)': o.amount,
            '플랫폼수수료(원)': o.platformFee,
            'PG수수료(원)': o.pgFee,
            '환불금액(원)': o.refund,
            '쿠폰판매자부담(원)': o.couponBurden,
            '정산조정액(원)': o.adjustment,
            '정산금액(원)': o.finalAmount,
            '정산상태': o.status,
            '정산예정일': o.settledOn,
          }))),
        },
      ],
    });
  };

  const totalFinal = filtered.reduce((sum, s) => sum + s.finalAmount, 0);
  const totalSales = filtered.reduce((sum, s) => sum + s.totalSales, 0);
  const countBy = (st: SettlementStatus) => filtered.filter(s => s.status === st).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '총 판매금액', value: won(totalSales), color: 'text-charcoal', sub: `${filtered.length}개 그룹` },
          { label: '총 수수료', value: won(filtered.reduce((s, x) => s + x.commission, 0)), color: 'text-warm-orange', sub: `쿠폰 판매자부담 ${won(filtered.reduce((s, x) => s + x.couponBurden, 0))}` },
          { label: '총 환불금액', value: won(filtered.reduce((s, x) => s + x.refundAmount, 0)), color: 'text-alert-red', sub: `보류 ${countBy('보류')}건` },
          { label: '최종 정산금액', value: won(totalFinal), color: 'text-primary', sub: `예정 ${countBy('정산예정')}건 · 완료 ${countBy('정산완료')}건` },
        ].map(item => (
          <div key={item.label} className="card p-4">
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="판매자명, 사업자번호 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-36" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as SettlementStatus | '전체'); setPage(1); }}>
            <option value="전체">전체 상태</option>
            <option value="정산예정">정산예정</option>
            <option value="정산완료">정산완료</option>
            <option value="보류">보류</option>
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">정산 기간</span>
            <input type="date" className="input w-36 text-sm" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
            <span className="text-gray-400 text-sm">~</span>
            <input type="date" className="input w-36 text-sm" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
                className="text-xs text-gray-400 hover:text-alert-red transition-colors whitespace-nowrap"
              >
                초기화
              </button>
            )}
          </div>
          <button
            onClick={() => { setGenRange(lastWeekRange()); setGenPay(''); setGenModal(true); }}
            className="btn-secondary flex items-center gap-1.5 whitespace-nowrap text-sm"
          >
            <CalendarPlus size={14} /> 정산 생성
          </button>
          <ExcelDownloadButton onClick={handleExcelDownload} isLoading={isLoading} hidden={!canDownload} />
        </div>
      </div>

      {/* 일괄 처리 바 */}
      {checkedRows.length > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-2 border-primary/30 bg-primary-light/40">
          <span className="text-sm font-medium text-charcoal px-1">
            {checkedRows.length}개 그룹 선택 · {checkedRows.reduce((s, x) => s + x.settlementIds.length, 0)}건 ·
            <span className="text-primary font-semibold"> {won(checkedRows.reduce((s, x) => s + x.finalAmount, 0))}</span>
          </span>
          <div className="flex-1" />
          <button disabled={busy} onClick={() => openConfirm(checkedRows.filter(s => s.status === '정산예정'))} className="btn-primary text-xs flex items-center gap-1">
            <CheckCircle size={13} /> 일괄 확정
          </button>
          <button disabled={busy} onClick={() => { setHoldReason(''); setHoldCustom(''); setHoldTargets(checkedRows.filter(s => s.status !== '보류')); }} className="btn-warning text-xs flex items-center gap-1">
            <Pause size={13} /> 일괄 보류
          </button>
          <button disabled={busy} onClick={() => handleRelease(checkedRows.filter(s => s.status === '보류'))} className="btn-secondary text-xs flex items-center gap-1">
            <RotateCcw size={13} /> 일괄 보류해제
          </button>
          <button onClick={() => setChecked(new Set())} className="text-xs text-gray-500 hover:text-alert-red px-2">선택 해제</button>
        </div>
      )}

      <div className="flex gap-4">
        <div className={`card flex-1 overflow-hidden ${selected ? 'hidden xl:block' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" className="accent-primary" checked={pageAllChecked} onChange={toggleCheckPage} aria-label="현재 페이지 전체 선택" />
                  </th>
                  {['판매자', '정산기간', '건수', '총 판매금액', '수수료', '환불금액', '최종 정산금액', '상태', '정산예정일', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11}><div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div></td></tr>
                ) : loadError ? (
                  <tr><td colSpan={11}><div className="py-16 text-center text-sm text-alert-red">{loadError}</div></td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={11}><EmptyState /></td></tr>
                ) : paginated.map(s => (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors ${selectedId === s.id ? 'bg-primary-light' : ''}`}
                    onClick={() => { setSelectedId(s.id); setOrdersOpen(false); }}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="accent-primary" checked={checked.has(s.id)} onChange={() => toggleCheck(s.id)} aria-label={`${s.sellerName} 선택`} />
                    </td>
                    <td className="px-4 py-3 font-medium">{s.sellerName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.period}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.orderCount}건</td>
                    <td className="px-4 py-3">{won(s.totalSales)}</td>
                    <td className="px-4 py-3 text-warm-orange">{won(s.commission)}</td>
                    <td className="px-4 py-3 text-alert-red">{won(s.refundAmount)}</td>
                    <td className="px-4 py-3 font-semibold text-primary">{won(s.finalAmount)}</td>
                    <td className="px-4 py-3"><Badge type="settlement">{s.status}</Badge></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.scheduledDate || '-'}</td>
                    <td className="px-4 py-3">
                      {s.status === '정산예정' && (
                        <div className="flex flex-wrap gap-1.5">
                          <button disabled={busy} onClick={e => { e.stopPropagation(); openConfirm([s]); }} className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
                            <CheckCircle size={12} /> 확정
                          </button>
                          <button disabled={busy} onClick={e => { e.stopPropagation(); setHoldReason(''); setHoldCustom(''); setHoldTargets([s]); }} className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium bg-orange-50 text-warm-orange hover:bg-warm-orange hover:text-white transition-colors disabled:opacity-50">
                            <Pause size={12} /> 보류
                          </button>
                        </div>
                      )}
                      {s.status === '보류' && (
                        <button disabled={busy} onClick={e => { e.stopPropagation(); handleRelease([s]); }} className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
                          <RotateCcw size={12} /> 보류 해제
                        </button>
                      )}
                      {s.status === '정산완료' && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-gray-400 whitespace-nowrap">처리완료</span>
                          <button disabled={busy} onClick={e => { e.stopPropagation(); openUnconfirm([s]); }} className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50">
                            <RotateCcw size={12} /> 취소
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Pagination page={safePage} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card w-full xl:w-[26rem] flex-shrink-0 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-charcoal">{selected.sellerName} 정산 상세</h3>
              <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-charcoal text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-5">
              {/* Actions */}
              {selected.status === '정산예정' && (
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => openConfirm([selected])} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1">
                    <CheckCircle size={13} /> 정산 확정
                  </button>
                  <button disabled={busy} onClick={() => { setHoldReason(''); setHoldCustom(''); setHoldTargets([selected]); }} className="btn-warning flex-1 text-xs flex items-center justify-center gap-1">
                    <Pause size={13} /> 보류
                  </button>
                </div>
              )}
              {selected.status === '보류' && (
                <button disabled={busy} onClick={() => handleRelease([selected])} className="btn-primary w-full text-xs flex items-center justify-center gap-1">
                  <RotateCcw size={13} /> 보류 해제
                </button>
              )}
              {selected.status === '정산완료' && (
                <div className="flex gap-2">
                  <div className="flex-1 bg-primary-light text-primary text-xs font-medium rounded-lg py-2 flex items-center justify-center gap-1">
                    <CheckCircle size={13} /> 정산 처리완료
                  </div>
                  <button disabled={busy} onClick={() => openUnconfirm([selected])} className="btn-secondary text-xs flex items-center justify-center gap-1 px-3 whitespace-nowrap">
                    <RotateCcw size={13} /> 확정 취소
                  </button>
                </div>
              )}

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">판매자 정보</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">판매자</span><span>{selected.sellerName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">사업자번호</span><span className="font-mono text-xs">{selected.bizNumber}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">은행</span><span>{selected.bankName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">계좌번호</span><span className="font-mono text-xs">{selected.accountNumber}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">예금주</span><span>{selected.accountHolder}</span></div>
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">정산 내역</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">정산기간</span><span className="text-xs">{selected.period}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">상태</span><Badge type="settlement">{selected.status}</Badge></div>
                  <div className="flex justify-between"><span className="text-gray-500">주문 건수</span><span>{selected.orderCount}건</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">총 판매금액</span><span>{won(selected.totalSales)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">플랫폼 수수료</span><span className="text-warm-orange">-{won(selected.platformFee)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">PG 수수료</span><span className="text-warm-orange">-{won(selected.pgFee)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">환불금액</span><span className="text-alert-red">-{won(selected.refundAmount)}</span></div>
                  {selected.adjustment !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500" title="본사 쿠폰 보전분 + 환불 회계 조정">정산 조정액</span>
                      <span className={selected.adjustment >= 0 ? 'text-primary' : 'text-alert-red'}>
                        {selected.adjustment >= 0 ? '+' : '-'}{won(Math.abs(selected.adjustment))}
                      </span>
                    </div>
                  )}
                  <div className="h-px bg-gray-100 my-1" />
                  <div className="flex justify-between font-semibold"><span>최종 정산금액</span><span className="text-primary">{won(selected.finalAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">정산예정일</span><span>{selected.scheduledDate || '-'}</span></div>
                  {selected.couponBurden > 0 && (
                    <div className="flex justify-between text-xs pt-1">
                      <span className="text-gray-400">└ 쿠폰 판매자 부담액(참고)</span>
                      <span className="text-gray-500">{won(selected.couponBurden)}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* 주문 단위 상세 */}
              <section>
                <button
                  onClick={() => setOrdersOpen(o => !o)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 hover:text-charcoal transition-colors"
                >
                  <span>주문별 상세 ({selected.orders.length}건)</span>
                  {ordersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {ordersOpen && (
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                      {selected.orders.map(o => (
                        <div key={o.id} className="p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-charcoal truncate">{o.productName || '-'}</span>
                            <Badge type="settlement">{o.status}</Badge>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span className="font-mono">{o.settlementCode}</span>
                            <span className="font-mono">{o.orderCode}</span>
                          </div>
                          <div className="flex justify-between"><span className="text-gray-500">판매금액</span><span>{won(o.amount)}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">수수료(플랫폼/PG)</span><span className="text-warm-orange">-{won(o.platformFee + o.pgFee)}</span></div>
                          {o.refund > 0 && <div className="flex justify-between"><span className="text-gray-500">환불</span><span className="text-alert-red">-{won(o.refund)}</span></div>}
                          {o.couponBurden > 0 && <div className="flex justify-between"><span className="text-gray-500">쿠폰 판매자부담</span><span className="text-gray-500">{won(o.couponBurden)}</span></div>}
                          {o.adjustment !== 0 && (
                            <div className="flex justify-between"><span className="text-gray-500">조정액</span>
                              <span className={o.adjustment >= 0 ? 'text-primary' : 'text-alert-red'}>{o.adjustment >= 0 ? '+' : '-'}{won(Math.abs(o.adjustment))}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold pt-0.5"><span>정산금액</span><span className="text-primary">{won(o.finalAmount)}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">관리자 메모</p>
                  <button
                    onClick={() => { setMemoText(selected.memo ?? ''); setMemoTarget(selected); }}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <StickyNote size={12} /> {selected.memo ? '수정' : '작성'}
                  </button>
                </div>
                {selected.memo
                  ? <p className="text-sm text-charcoal bg-yellow-50 rounded-lg p-3 whitespace-pre-wrap">{selected.memo}</p>
                  : <p className="text-xs text-gray-400">등록된 메모가 없습니다.</p>}
                <p className="text-[11px] text-gray-400 mt-2">※ 메모는 판매자 앱 정산 화면에도 노출됩니다(보류 사유 통지 겸용).</p>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* 확정 모달 — 정산예정일 지정 */}
      <Modal open={!!confirmTargets} onClose={() => setConfirmTargets(null)} title="정산 확정">
        <div className="space-y-4">
          <div className="bg-soft-gray rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">대상</span><span>{confirmTargets?.length ?? 0}개 그룹 · {confirmTargets?.reduce((s, x) => s + x.settlementIds.length, 0) ?? 0}건</span></div>
            <div className="flex justify-between"><span className="text-gray-500">지급 총액</span><span className="font-semibold text-primary">{won(confirmTargets?.reduce((s, x) => s + x.finalAmount, 0) ?? 0)}</span></div>
            {(confirmTargets?.length ?? 0) <= 5 && (
              <p className="text-xs text-gray-400 pt-1">{confirmTargets?.map(t => t.sellerName).join(', ')}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-charcoal block mb-1">정산예정일(실지급일)</label>
            <input type="date" className="input" value={payDate} onChange={e => setPayDate(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">확정 시 판매자에게 정산 확정 알림이 이 날짜와 함께 발송됩니다.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setConfirmTargets(null)} className="btn-secondary flex-1">취소</button>
            <button disabled={busy} onClick={handleConfirm} className="btn-primary flex-1">확정 처리</button>
          </div>
        </div>
      </Modal>

      {/* 확정 취소 모달 */}
      <Modal open={!!unconfirmTargets} onClose={() => setUnconfirmTargets(null)} title="정산 확정 취소">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            <b>{unconfirmTargets?.map(t => t.sellerName).join(', ')}</b>의 정산 확정을 취소하고 "정산예정" 상태로 되돌립니다.
          </p>
          <p className="text-xs text-gray-500 bg-yellow-50 rounded-lg p-3">
            판매자에게 <b>정산예정 전환 알림</b>이 발송되고 감사 로그에 기록됩니다. 이미 실지급이 끝난 정산이라면 되돌리지 마세요.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setUnconfirmTargets(null)} className="btn-secondary flex-1">닫기</button>
            <button disabled={busy} onClick={handleUnconfirm} className="btn-danger flex-1">확정 취소</button>
          </div>
        </div>
      </Modal>

      {/* 보류 모달 */}
      <Modal open={!!holdTargets} onClose={() => { setHoldTargets(null); setHoldReason(''); setHoldCustom(''); }} title="정산 보류 사유">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            대상 {holdTargets?.length ?? 0}개 그룹 · {holdTargets?.reduce((s, x) => s + x.settlementIds.length, 0) ?? 0}건
          </p>
          {HOLD_REASONS.map(r => (
            <label key={r} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-soft-gray">
              <input type="radio" name="holdReason" value={r} checked={holdReason === r} onChange={e => setHoldReason(e.target.value)} className="accent-primary" />
              <span className="text-sm">{r}</span>
            </label>
          ))}
          {holdReason === '직접 입력' && (
            <textarea
              className="input h-20 resize-none"
              placeholder="보류 사유를 입력하세요."
              value={holdCustom}
              onChange={e => setHoldCustom(e.target.value)}
            />
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setHoldTargets(null); setHoldReason(''); setHoldCustom(''); }} className="btn-secondary flex-1">취소</button>
            <button disabled={busy} onClick={handleHold} className="btn-warning flex-1">보류 처리</button>
          </div>
        </div>
      </Modal>

      {/* 메모 편집 모달 */}
      <Modal open={!!memoTarget} onClose={() => setMemoTarget(null)} title="관리자 메모">
        <div className="space-y-3">
          <textarea
            className="input h-28 resize-none"
            placeholder="정산 관련 메모를 입력하세요. (판매자 앱 정산 화면에도 노출됩니다)"
            value={memoText}
            onChange={e => setMemoText(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => setMemoTarget(null)} className="btn-secondary flex-1">취소</button>
            <button disabled={busy} onClick={handleSaveMemo} className="btn-primary flex-1">저장</button>
          </div>
        </div>
      </Modal>

      {/* 정산 생성 모달 */}
      <Modal open={genModal} onClose={() => setGenModal(false)} title="정산 생성 (기간 지정)">
        <div className="space-y-4">
          <p className="text-xs text-gray-500 bg-soft-gray rounded-lg p-3 leading-relaxed">
            지정한 기간에 <b>픽업완료된 주문</b>을 집계해 정산 행을 생성합니다. 평소에는 주간 배치가 자동 처리하며,
            배치 누락이나 임시 마감이 필요할 때 사용하세요.<br />
            이미 정산된 주문은 자동으로 제외되므로 <b>여러 번 실행해도 중복 생성되지 않습니다.</b>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-charcoal block mb-1">시작일</label>
              <input type="date" className="input" value={genRange.start} onChange={e => setGenRange(r => ({ ...r, start: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-charcoal block mb-1">종료일</label>
              <input type="date" className="input" value={genRange.end} onChange={e => setGenRange(r => ({ ...r, end: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-charcoal block mb-1">정산예정일 (선택)</label>
            <input type="date" className="input" value={genPay} onChange={e => setGenPay(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">비워두면 이번 주 수요일로 지정됩니다.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setGenModal(false)} className="btn-secondary flex-1">취소</button>
            <button disabled={busy} onClick={handleGenerate} className="btn-primary flex-1">정산 생성</button>
          </div>
        </div>
      </Modal>

      {/* 액션 결과와 엑셀 다운로드 토스트가 같은 자리에 겹치지 않게 하나만 노출 */}
      {notice
        ? <Toast message={notice.message} type={notice.type} onClose={() => setNotice(null)} />
        : toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
