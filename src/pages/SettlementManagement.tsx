import { useState } from 'react';
import { Search, CheckCircle, Pause, RotateCcw } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { mockSettlements } from '../data/mockData';
import type { Settlement, SettlementStatus } from '../types';

const PAGE_SIZE = 6;

/**
 * [백엔드 연동 안내] 현재 mockSettlements(목데이터)로 동작 중. 실 서비스는 Supabase `settlements` 테이블(판매자 앱과 공유)에 대응됨.
 * - 목록/검색: GET /api/admin/settlements?search=&status=&periodStart=&periodEnd=&page=
 * - 정산 확정: PATCH /api/admin/settlements/:id/confirm  (status→'completed', settled_on 기록)
 * - 정산 보류: PATCH /api/admin/settlements/:id/hold  { reason }  (status→'on_hold')
 * - platformFee/pgFee는 정산 배치(주간 배치, migration의 weekly settlement batch 참고)가 계산해 내려주는 값으로 관리자는 조회만 한다.
 */
export default function SettlementManagement() {
  const [settlements, setSettlements] = useState<Settlement[]>(mockSettlements);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SettlementStatus | '전체'>('전체');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [holdModal, setHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const { download, isLoading, toast, canDownload } = useExcelDownload();

  const HOLD_REASONS = [
    '환불 분쟁 확인 필요',
    '계좌 정보 확인 필요',
    '신고 건 처리 필요',
    '직접 입력',
  ];

  const filtered = settlements.filter(s => {
    const matchSearch = s.sellerName.includes(search) || s.bizNumber.includes(search);
    const matchStatus = statusFilter === '전체' || s.status === statusFilter;
    const periodStart = s.period.split(' ~ ')[0]?.trim() ?? '';
    const periodEnd = s.period.split(' ~ ')[1]?.trim() ?? '';
    const matchDateFrom = !dateFrom || periodStart >= dateFrom;
    const matchDateTo = !dateTo || periodEnd <= dateTo;
    return matchSearch && matchStatus && matchDateFrom && matchDateTo;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateStatus = (id: string, status: SettlementStatus, memo?: string) => {
    setSettlements(prev => prev.map(s => s.id === id ? { ...s, status, memo: memo ?? s.memo } : s));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const handleConfirm = (s: Settlement) => {
    if (s.status === '보류') return alert('보류 상태에서는 정산 확정이 불가합니다.');
    updateStatus(s.id, '정산완료');
    alert('정산이 확정되었습니다. (로그 기록됨)');
  };

  const handleUnconfirm = (s: Settlement) => {
    if (!confirm(`${s.sellerName}의 정산 확정을 취소하고 "정산예정" 상태로 되돌리시겠습니까?`)) return;
    updateStatus(s.id, '정산예정');
  };

  const handleHold = () => {
    if (!selected || !holdReason.trim()) return alert('보류 사유를 선택/입력하세요.');
    updateStatus(selected.id, '보류', holdReason);
    setHoldModal(false);
    setHoldReason('');
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
      sheets: [{
        name: '정산내역',
        data: filtered.map(s => ({
          '정산기간': s.period,
          '판매자명': s.sellerName,
          '사업자번호': s.bizNumber,
          '총판매금액(원)': s.totalSales,
          '플랫폼수수료(원)': s.platformFee,
          'PG수수료(원)': s.pgFee,
          '수수료합계(원)': s.commission,
          '환불금액(원)': s.refundAmount,
          '최종정산금액(원)': s.finalAmount,
          '정산상태': s.status,
          '정산예정일': s.scheduledDate,
          '은행': s.bankName,
          '계좌번호': s.accountNumber,
          '예금주': s.accountHolder,
        })),
      }],
    });
  };

  const totalFinal = filtered.reduce((sum, s) => sum + s.finalAmount, 0);
  const totalSales = filtered.reduce((sum, s) => sum + s.totalSales, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '총 판매금액', value: `${totalSales.toLocaleString()}원`, color: 'text-charcoal' },
          { label: '총 수수료', value: `${filtered.reduce((s, x) => s + x.commission, 0).toLocaleString()}원`, color: 'text-warm-orange' },
          { label: '총 환불금액', value: `${filtered.reduce((s, x) => s + x.refundAmount, 0).toLocaleString()}원`, color: 'text-alert-red' },
          { label: '최종 정산금액', value: `${totalFinal.toLocaleString()}원`, color: 'text-primary' },
        ].map(item => (
          <div key={item.label} className="card p-4">
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
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
          <ExcelDownloadButton onClick={handleExcelDownload} isLoading={isLoading} hidden={!canDownload} />
        </div>
      </div>

      <div className="flex gap-4">
        <div className={`card flex-1 overflow-hidden ${selected ? 'hidden xl:block' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  {['판매자', '정산기간', '총 판매금액', '수수료', '환불금액', '최종 정산금액', '상태', '정산예정일', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={9}><EmptyState /></td></tr>
                ) : paginated.map(s => (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors ${selected?.id === s.id ? 'bg-primary-light' : ''}`}
                    onClick={() => setSelected(s)}
                  >
                    <td className="px-4 py-3 font-medium">{s.sellerName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.period}</td>
                    <td className="px-4 py-3">{s.totalSales.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-warm-orange">{s.commission.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-alert-red">{s.refundAmount.toLocaleString()}원</td>
                    <td className="px-4 py-3 font-semibold text-primary">{s.finalAmount.toLocaleString()}원</td>
                    <td className="px-4 py-3"><Badge type="settlement">{s.status}</Badge></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.scheduledDate}</td>
                    <td className="px-4 py-3">
                      {s.status === '정산예정' && (
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={e => { e.stopPropagation(); handleConfirm(s); }} className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                            <CheckCircle size={12} /> 확정
                          </button>
                          <button onClick={e => { e.stopPropagation(); setSelected(s); setHoldModal(true); }} className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium bg-orange-50 text-warm-orange hover:bg-warm-orange hover:text-white transition-colors">
                            <Pause size={12} /> 보류
                          </button>
                        </div>
                      )}
                      {s.status === '보류' && (
                        <button onClick={e => { e.stopPropagation(); updateStatus(s.id, '정산예정'); }} className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
                          <RotateCcw size={12} /> 보류 해제
                        </button>
                      )}
                      {s.status === '정산완료' && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-gray-400 whitespace-nowrap">처리완료</span>
                          <button onClick={e => { e.stopPropagation(); handleUnconfirm(s); }} className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
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
            <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card w-full xl:w-96 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-charcoal">{selected.sellerName} 정산 상세</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-charcoal text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-5">
              {/* Actions */}
              {selected.status === '정산예정' && (
                <div className="flex gap-2">
                  <button onClick={() => handleConfirm(selected)} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1">
                    <CheckCircle size={13} /> 정산 확정
                  </button>
                  <button onClick={() => setHoldModal(true)} className="btn-warning flex-1 text-xs flex items-center justify-center gap-1">
                    <Pause size={13} /> 보류
                  </button>
                </div>
              )}
              {selected.status === '보류' && (
                <button onClick={() => updateStatus(selected.id, '정산예정')} className="btn-primary w-full text-xs flex items-center justify-center gap-1">
                  <RotateCcw size={13} /> 보류 해제
                </button>
              )}
              {selected.status === '정산완료' && (
                <div className="flex gap-2">
                  <div className="flex-1 bg-primary-light text-primary text-xs font-medium rounded-lg py-2 flex items-center justify-center gap-1">
                    <CheckCircle size={13} /> 정산 처리완료
                  </div>
                  <button onClick={() => handleUnconfirm(selected)} className="btn-secondary text-xs flex items-center justify-center gap-1 px-3 whitespace-nowrap">
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
                  <div className="flex justify-between"><span className="text-gray-500">총 판매금액</span><span>{selected.totalSales.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">플랫폼 수수료</span><span className="text-warm-orange">-{selected.platformFee.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">PG 수수료</span><span className="text-warm-orange">-{selected.pgFee.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">환불금액</span><span className="text-alert-red">-{selected.refundAmount.toLocaleString()}원</span></div>
                  <div className="h-px bg-gray-100 my-1" />
                  <div className="flex justify-between font-semibold"><span>최종 정산금액</span><span className="text-primary">{selected.finalAmount.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">정산예정일</span><span>{selected.scheduledDate}</span></div>
                </div>
              </section>

              {selected.memo && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">관리자 메모</p>
                  <p className="text-sm text-charcoal bg-yellow-50 rounded-lg p-3">{selected.memo}</p>
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hold Modal */}
      <Modal open={holdModal} onClose={() => { setHoldModal(false); setHoldReason(''); }} title="정산 보류 사유">
        <div className="space-y-3">
          {HOLD_REASONS.map(r => (
            <label key={r} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-soft-gray">
              <input type="radio" name="holdReason" value={r} checked={holdReason === r} onChange={e => setHoldReason(e.target.value)} className="accent-primary" />
              <span className="text-sm">{r}</span>
            </label>
          ))}
          {holdReason === '직접 입력' && (
            <textarea className="input h-20 resize-none" placeholder="보류 사유를 입력하세요." onChange={e => setHoldReason(e.target.value)} />
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setHoldModal(false); setHoldReason(''); }} className="btn-secondary flex-1">취소</button>
            <button onClick={handleHold} className="btn-warning flex-1">보류 처리</button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
