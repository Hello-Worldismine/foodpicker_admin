import { useEffect, useState } from 'react';
import { Plus, Copy, Check, CheckCircle, XCircle, Search, X } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Switch from '../components/ui/Switch';
import EmptyState from '../components/ui/EmptyState';
import { fetchCoupons, fetchStoreOptions, createCoupon, toggleCouponActive, approveCouponRequest, rejectCouponRequest, withdrawCouponOffer } from '../lib/api';
import { useAdmin } from '../context/AdminContext';
import type { Coupon, CouponCostBearer, StoreOption } from '../types';

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 조회: fetchCoupons() → admin_coupons 뷰(신청 매장명 store_name 조인 포함).
 * - 생성: createCoupon() → coupons INSERT (source='admin'). 전체 발급은 즉시 활성(is_active=true),
 *   매장 지정 발급은 seller_id + request_status='pending' + is_active=false 로 INSERT — DB 트리거가
 *   판매자에게 알림을 발송하고, 판매자가 수락해야 활성화되어 사용자 앱 상점 상세에 쿠폰 다운로드
 *   UI가 노출된다(수락 주체는 판매자 — 이 상태에선 관리자 활성 토글·승인/반려 버튼을 노출하지 않음).
 *   code UNIQUE 제약 — 충돌 시 에러 메시지에 'duplicate' 포함되어 별도 alert 처리.
 * - 매장 검색: fetchStoreOptions() 경량 목록을 클라이언트에서 매장명/카테고리 부분일치 필터(최대 8개).
 * - 활성 토글 / 점주 신청 승인·반려: toggleCouponActive / approveCouponRequest / rejectCouponRequest —
 *   직접 테이블 UPDATE 이므로 logAction 으로 감사 로그를 남긴다.
 *   request_status 변경 시 DB 트리거가 판매자에게 알림을 자동 발송.
 * - cost_bearer/platform_share 는 정산 배치가 참조(본사/점주/분담 차감),
 *   used_count 증가·allow_stacking 검증은 주문 RPC(create_order)가 서버 측에서 처리.
 */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const emptyForm = {
  code: generateCode(), name: '', discountType: '정액' as '정액' | '정률', discountValue: 0,
  maxDiscountAmount: 0, minOrderAmount: 0, startDate: '', endDate: '', target: '전체', totalQuantity: 100,
  costBearer: '본사' as CouponCostBearer, platformShare: 50, allowStacking: true,
};

function CostBearerBadge({ coupon }: { coupon: Coupon }) {
  if (coupon.costBearer === '본사') return <span className="badge bg-primary-light text-primary">본사 100%</span>;
  if (coupon.costBearer === '점주') return <span className="badge bg-orange-100 text-warm-orange">점주 100%</span>;
  return <span className="badge bg-purple-100 text-purple-700">본사 {coupon.platformShare}% · 점주 {100 - (coupon.platformShare ?? 50)}%</span>;
}

// 관리자 매장 지정 발급 쿠폰의 판매자 수락 흐름 상태 — 수락 주체가 판매자이므로
// 이 상태에서는 관리자 활성 토글·승인/반려 버튼을 노출하지 않는다.
const isSellerAcceptPending = (c: Coupon) => c.source === '관리자 발행' && !!c.sellerId && c.requestStatus === '대기';
const isSellerRejected = (c: Coupon) => c.source === '관리자 발행' && !!c.sellerId && c.requestStatus === '반려';

export default function CouponManagement() {
  const { logAction } = useAdmin();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<'issued' | 'pending'>('issued');
  const [search, setSearch] = useState('');
  const [costBearerFilter, setCostBearerFilter] = useState<CouponCostBearer | '전체'>('전체');
  const [pendingStatusFilter, setPendingStatusFilter] = useState<'대기' | '전체' | '반려'>('대기');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Coupon | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Coupon | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // 발급 대상: 전체 발급(기본) vs 매장 지정 발급(판매자 수락 대기로 생성)
  const [issueMode, setIssueMode] = useState<'전체' | '매장'>('전체');
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [storesLoaded, setStoresLoaded] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCoupons()
      .then(rows => { if (!cancelled) setCoupons(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const issuedCoupons = coupons
    .filter(c => c.source === '관리자 발행' || c.requestStatus === '승인')
    .filter(c => !search || (c.sellerName ?? '').includes(search) || c.name.includes(search))
    .filter(c => costBearerFilter === '전체' || c.costBearer === costBearerFilter);
  // 점주 신청 탭: source 조건으로 필터 — 관리자 매장 지정 발급(source='관리자 발행'·requestStatus='대기')은 여기 섞이지 않는다.
  const pendingRequests = coupons.filter(c => c.source === '점주 신청');
  const visiblePending = pendingStatusFilter === '전체' ? pendingRequests : pendingRequests.filter(c => c.requestStatus === pendingStatusFilter);
  const waitingCount = pendingRequests.filter(c => c.requestStatus === '대기').length;

  // 매장 지정 발급용 검색 — fetchStoreOptions() 결과를 매장명/카테고리 부분일치로 클라이언트 필터, 최대 8개 표시
  const storeQuery = storeSearch.trim();
  const storeResults = storeQuery
    // 승인완료·정지 아님 매장만 발급 대상 — 미승인/반려/이용정지 매장에 쿠폰이 걸리는 것 방지
    ? storeOptions.filter(s => s.approved && (s.name.includes(storeQuery) || s.category.includes(storeQuery))).slice(0, 8)
    : [];

  const switchToStoreMode = async () => {
    setIssueMode('매장');
    if (storesLoaded || storesLoading) return;
    setStoresLoading(true);
    try {
      setStoreOptions(await fetchStoreOptions());
      setStoresLoaded(true);
    } catch (e) {
      alert('매장 목록을 불러오지 못했습니다: ' + (e as Error).message);
    } finally {
      setStoresLoading(false);
    }
  };

  const closeCreateModal = () => {
    setModal(false);
    setIssueMode('전체');
    setSelectedStore(null);
    setStoreSearch('');
  };

  const save = async () => {
    if (!form.name.trim()) return alert('쿠폰명을 입력하세요.');
    if (!form.code.trim()) return alert('쿠폰번호를 입력하세요.');
    if (form.discountType === '정률' && form.maxDiscountAmount <= 0) return alert('정률 할인은 최대 할인 한도를 입력해야 합니다.');
    if (form.costBearer === '분담' && (form.platformShare < 0 || form.platformShare > 100)) return alert('본사 부담 비율은 0~100 사이로 입력하세요.');
    if (issueMode === '매장' && !selectedStore) return alert('발급할 매장을 검색해 선택하세요.');

    try {
      // 매장 지정 발급이면 sellerId/sellerName 전달 → createCoupon 이 판매자 수락 대기(pending·비활성)로 INSERT
      const created = await createCoupon(
        issueMode === '매장' && selectedStore
          ? { ...form, sellerId: selectedStore.sellerId, sellerName: selectedStore.name }
          : form,
      );
      setCoupons(prev => [created, ...prev]);
      closeCreateModal();
      setForm({ ...emptyForm, code: generateCode() });
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('duplicate')) alert('이미 존재하는 쿠폰번호입니다.');
      else alert('처리 실패: ' + msg);
    }
  };

  const toggle = async (c: Coupon) => {
    const next = !c.active;
    try {
      await toggleCouponActive(c.id, next);
      logAction(`쿠폰 ${next ? '활성화' : '비활성화'}`, 'coupon', c.id, c.name);
      setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, active: next } : x));
      setSelected(prev => prev && prev.id === c.id ? { ...prev, active: next } : prev);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const approveRequest = async (c: Coupon) => {
    if (!confirm(`${c.sellerName}의 "${c.name}" 쿠폰 발행 신청을 승인하시겠습니까?\n승인 즉시 사용자 앱에 노출됩니다.`)) return;
    try {
      await approveCouponRequest(c.id);
      logAction('쿠폰 신청 승인', 'coupon', c.id, c.name);
      setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, requestStatus: '승인', active: true, rejectReason: undefined } : x));
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  // 매장 지정 발급 회수 — 판매자 수락 대기(pending) 상태에서만. rejected+비활성으로 철회.
  const withdrawOffer = async (c: Coupon) => {
    if (!confirm(`'${c.name}' 매장 지정 발급을 회수하시겠습니까?\n판매자가 더 이상 수락할 수 없게 됩니다.`)) return;
    try {
      await withdrawCouponOffer(c.id);
      logAction('쿠폰 매장 지정 발급 회수', 'coupon', c.id, c.name);
      const patch = { requestStatus: '반려' as const, rejectReason: '관리자 회수', active: false };
      setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, ...patch } : x));
      setSelected(prev => prev && prev.id === c.id ? { ...prev, ...patch } : prev);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const rejectRequest = async () => {
    if (!rejectTarget || !rejectReason.trim()) return alert('반려 사유를 입력하세요.');
    try {
      await rejectCouponRequest(rejectTarget.id, rejectReason);
      logAction('쿠폰 신청 반려', 'coupon', rejectTarget.id, rejectTarget.name);
      setCoupons(prev => prev.map(x => x.id === rejectTarget.id ? { ...x, requestStatus: '반려', rejectReason, active: false } : x));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 w-fit shadow-sm border border-gray-100">
        <button onClick={() => setTab('issued')} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'issued' ? 'bg-primary text-white' : 'text-gray-500 hover:text-charcoal'}`}>
          발행된 쿠폰
        </button>
        <button onClick={() => setTab('pending')} className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'pending' ? 'bg-primary text-white' : 'text-gray-500 hover:text-charcoal'}`}>
          쿠폰 신청 대기
          {waitingCount > 0 && (
            <span className={`ml-1.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold ${tab === 'pending' ? 'bg-white text-primary' : 'bg-alert-red text-white'}`}>
              {waitingCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'issued' ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">쿠폰/프로모션</h2>
              <p className="text-xs text-gray-400 mt-1">쿠폰을 생성하고 발급 현황을 관리합니다.</p>
            </div>
            <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2"><Plus size={15} /> 쿠폰 추가</button>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="매장명으로 검색" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-56" value={costBearerFilter} onChange={e => setCostBearerFilter(e.target.value as CouponCostBearer | '전체')}>
              <option value="전체">전체 부담 주체</option>
              <option value="본사">푸드피커 본사 발급 쿠폰</option>
              <option value="분담">본사·점주 공동 발급 쿠폰</option>
              <option value="점주">점주 발급 쿠폰</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  {['쿠폰명', '쿠폰번호', '할인', '부담 주체', '중복사용', '최소주문금액', '기간', '대상', '발급/사용', '상태', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={11}><div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div></td></tr>
                )}
                {!loading && loadError && (
                  <tr><td colSpan={11}><div className="py-16 text-center text-sm text-alert-red">{loadError}</div></td></tr>
                )}
                {!loading && !loadError && issuedCoupons.length === 0 && (
                  <tr><td colSpan={11}><EmptyState /></td></tr>
                )}
                {issuedCoupons.map(c => (
                  <tr key={c.id} className={`border-b border-gray-50 ${!c.active && !isSellerAcceptPending(c) ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {c.name}
                      {c.source === '점주 신청' && <span className="block text-xs text-gray-400 font-normal">{c.sellerName} 신청</span>}
                      {isSellerRejected(c) && c.rejectReason && <span className="block text-xs text-alert-red font-normal">거절 사유: {c.rejectReason}</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{c.code}</td>
                    <td className="px-4 py-3 text-primary font-semibold whitespace-nowrap">
                      {c.discountType === '정액' ? `${c.discountValue.toLocaleString()}원` : (
                        <>
                          {c.discountValue}%
                          {c.maxDiscountAmount != null && <span className="block text-xs text-gray-400 font-normal">최대 {c.maxDiscountAmount.toLocaleString()}원</span>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3"><CostBearerBadge coupon={c} /></td>
                    <td className="px-4 py-3">
                      <span className={`badge ${c.allowStacking ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{c.allowStacking ? '중복 가능' : '단독 사용'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.minOrderAmount.toLocaleString()}원 이상</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{c.startDate} ~ {c.endDate}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {c.target}
                      {/* mapCoupon 이 seller_id 있으면 target='해당 매장' + sellerName(store_name) 세팅 — 매장명 병기 */}
                      {c.sellerId && c.sellerName && <span className="block text-xs text-gray-400">{c.sellerName}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600">{c.totalQuantity}</span>
                        <span className="text-gray-300">/</span>
                        <span className="text-warm-orange font-medium">{c.usedQuantity}</span>
                      </div>
                      <div className="w-20 bg-gray-100 rounded-full h-1.5 mt-1">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${c.totalQuantity > 0 ? Math.min(100, (c.usedQuantity / c.totalQuantity) * 100) : 0}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {/* 매장 지정 발급의 수락/거절 상태 — 수락 주체가 판매자이므로 관리자 활성 토글 미노출 */}
                      {isSellerAcceptPending(c) ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="badge bg-yellow-100 text-yellow-700">판매자 수락 대기</span>
                          <button className="text-xs text-gray-400 hover:text-alert-red hover:underline" onClick={() => withdrawOffer(c)}>회수</button>
                        </span>
                      ) : isSellerRejected(c) ? (
                        <span className="badge bg-red-100 text-alert-red">판매자 거절</span>
                      ) : (
                        <Switch checked={c.active} onChange={() => toggle(c)} label={`${c.name} 활성화 여부`} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-primary hover:underline" onClick={() => setSelected(c)}>상세</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">쿠폰 신청 대기</h2>
              <p className="text-xs text-gray-400 mt-1">점주가 직접 신청한 쿠폰입니다. 승인 즉시 예산 100%가 해당 매장 정산에서 차감되며 사용자 앱에 노출됩니다.</p>
            </div>
            <select className="input w-32 text-sm" value={pendingStatusFilter} onChange={e => setPendingStatusFilter(e.target.value as '대기' | '전체' | '반려')}>
              <option value="대기">대기중만</option>
              <option value="반려">반려됨만</option>
              <option value="전체">전체 이력</option>
            </select>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : loadError ? (
              <div className="py-16 text-center text-sm text-alert-red">{loadError}</div>
            ) : visiblePending.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {pendingStatusFilter === '대기' ? '대기 중인 쿠폰 신청이 없습니다.' : '신청 이력이 없습니다.'}
              </p>
            ) : visiblePending.map(c => (
              <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{c.name}</p>
                    <span className="badge bg-orange-100 text-warm-orange">{c.sellerName}</span>
                    {c.requestStatus === '승인' && <span className="badge bg-primary-light text-primary">승인됨</span>}
                    {c.requestStatus === '반려' && <span className="badge bg-red-100 text-alert-red">반려됨</span>}
                  </div>
                  <p className="text-xs text-gray-500">
                    {c.discountType === '정액' ? `${c.discountValue.toLocaleString()}원 할인` : `${c.discountValue}% 할인 (최대 ${c.maxDiscountAmount?.toLocaleString()}원)`}
                    {' · '}최소주문 {c.minOrderAmount.toLocaleString()}원{' · '}{c.startDate} ~ {c.endDate}{' · '}<span className="text-warm-orange font-medium">예산 점주 100% 부담</span>
                  </p>
                  {c.requestStatus === '반려' && c.rejectReason && (
                    <p className="text-xs text-alert-red mt-1">반려 사유: {c.rejectReason}</p>
                  )}
                </div>
                {c.requestStatus === '대기' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => approveRequest(c)} className="btn-primary text-xs flex items-center gap-1 px-3 py-1.5">
                      <CheckCircle size={13} /> 승인
                    </button>
                    <button onClick={() => setRejectTarget(c)} className="btn-danger text-xs flex items-center gap-1 px-3 py-1.5">
                      <XCircle size={13} /> 반려
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="쿠폰 상세">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">쿠폰번호 (사용자 등록용)</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-primary bg-primary-light rounded-lg px-3 py-2 flex-1 text-center tracking-wider">{selected.code}</span>
                <button onClick={() => copyCode(selected.code)} className="btn-secondary flex items-center gap-1 text-xs px-3 py-2">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '복사됨' : '복사'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">사용자가 앱의 쿠폰 등록 화면에 이 번호를 직접 입력해야 발급됩니다.</p>
            </div>

            <div className="space-y-1.5 text-sm">
              {[
                ['쿠폰명', selected.name],
                ['할인', selected.discountType === '정액' ? `${selected.discountValue.toLocaleString()}원 할인` : `${selected.discountValue}% 할인 (최대 ${selected.maxDiscountAmount?.toLocaleString() ?? '-'}원)`],
                ['최소주문금액', `${selected.minOrderAmount.toLocaleString()}원 이상`],
                ['부담 주체', selected.costBearer === '분담' ? `분담 (본사 ${selected.platformShare}% · 점주 ${100 - (selected.platformShare ?? 50)}%)` : `${selected.costBearer} 100%`],
                ['중복 사용', selected.allowStacking ? '다른 쿠폰과 함께 사용 가능' : '단독 사용만 가능'],
                ['대상', selected.sellerId && selected.sellerName ? `${selected.target} · ${selected.sellerName}` : selected.target],
                ['기간', `${selected.startDate} ~ ${selected.endDate}`],
                ['발급/사용', `${selected.totalQuantity} / ${selected.usedQuantity}`],
                ['상태', isSellerAcceptPending(selected) ? '판매자 수락 대기' : isSellerRejected(selected) ? '판매자 거절' : selected.active ? '활성' : '비활성'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3"><span className="text-gray-500 flex-shrink-0">{l}</span><span className="text-charcoal text-right">{v}</span></div>
              ))}
              {isSellerRejected(selected) && selected.rejectReason && (
                <p className="text-xs text-alert-red pt-1">거절 사유: {selected.rejectReason}</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              {/* 판매자 수락 대기/거절 상태에선 활성 토글 미노출 — 수락 주체는 판매자. 대기 중엔 회수 가능 */}
              {isSellerAcceptPending(selected) ? (
                <button onClick={() => withdrawOffer(selected)} className="btn-secondary flex-1 text-sm text-alert-red">
                  발급 회수
                </button>
              ) : !isSellerRejected(selected) && (
                <button onClick={() => toggle(selected)} className="btn-secondary flex-1 text-sm">
                  {selected.active ? '비활성화' : '활성화'}
                </button>
              )}
              <button onClick={() => setSelected(null)} className="btn-primary flex-1 text-sm">닫기</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject reason modal */}
      <Modal open={!!rejectTarget} onClose={() => { setRejectTarget(null); setRejectReason(''); }} title="쿠폰 신청 반려 사유">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            <strong>{rejectTarget?.sellerName}</strong>님이 신청한 <strong>{rejectTarget?.name}</strong> 쿠폰을 반려합니다.
          </p>
          <textarea className="input h-24 resize-none" placeholder="반려 사유를 입력하세요. (점주에게 전달됩니다)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="btn-secondary flex-1">취소</button>
            <button onClick={rejectRequest} className="btn-danger flex-1">반려 처리</button>
          </div>
        </div>
      </Modal>

      {/* Create Modal (관리자 발행) */}
      <Modal open={modal} onClose={closeCreateModal} title="쿠폰 추가" size="lg">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">쿠폰번호 (사용자 등록용)</label>
            <div className="flex gap-2">
              <input className="input font-mono flex-1" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              <button type="button" onClick={() => setForm({ ...form, code: generateCode() })} className="btn-secondary text-xs px-3">재생성</button>
            </div>
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">쿠폰명</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">할인 방식</label>
              <select className="input" value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value as '정액' | '정률' })}>
                <option value="정액">정액 할인</option>
                <option value="정률">정률 할인</option>
              </select>
            </div>
            <div><label className="text-xs text-gray-500 block mb-1">{form.discountType === '정액' ? '할인 금액 (원)' : '할인율 (%)'}</label>
              <input type="number" className="input" value={form.discountValue} onChange={e => setForm({ ...form, discountValue: Number(e.target.value) })} />
            </div>
          </div>
          {form.discountType === '정률' && (
            <div className="bg-orange-50 rounded-lg p-3">
              <label className="text-xs text-warm-orange font-medium block mb-1">최대 할인 한도 (원) — 필수</label>
              <input type="number" className="input" placeholder="예: 3000" value={form.maxDiscountAmount || ''} onChange={e => setForm({ ...form, maxDiscountAmount: Number(e.target.value) })} />
              <p className="text-xs text-warm-orange/80 mt-1">고액 주문에서도 이 금액을 초과해 할인되지 않도록 상한을 걸어 예산을 보호합니다.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">최소 주문금액</label><input type="number" className="input" value={form.minOrderAmount} onChange={e => setForm({ ...form, minOrderAmount: Number(e.target.value) })} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">발급 수량</label><input type="number" className="input" value={form.totalQuantity} onChange={e => setForm({ ...form, totalQuantity: Number(e.target.value) })} /></div>
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">대상 회원</label>
            <select className="input" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}>
              {['전체', '신규 회원', '기존 회원', '특정 회원'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">시작일</label><input type="date" className="input" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">종료일</label><input type="date" className="input" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>

          {/* 발급 대상 — 전체 발급 vs 매장 지정 발급(판매자 수락 대기로 생성) */}
          <div className="border-t border-gray-100 pt-3">
            <label className="text-xs text-gray-500 block mb-1">발급 대상</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIssueMode('전체')}
                className={`text-sm py-2 rounded-lg border transition-colors ${issueMode === '전체' ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary'}`}
              >
                전체 발급
              </button>
              <button
                type="button"
                onClick={switchToStoreMode}
                className={`text-sm py-2 rounded-lg border transition-colors ${issueMode === '매장' ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary'}`}
              >
                매장 지정 발급
              </button>
            </div>
            {issueMode === '매장' && (
              <div className="mt-2 space-y-2">
                {selectedStore ? (
                  /* 선택된 매장 칩 — 매장명 + 해제 버튼 */
                  <div className="flex items-center justify-between gap-2 bg-primary-light rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{selectedStore.name}</p>
                      <p className="text-xs text-gray-500 truncate">{selectedStore.category} · {selectedStore.address}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedStore(null)}
                      className="p-1 rounded-full text-primary hover:bg-white/70 transition-colors flex-shrink-0"
                      aria-label="매장 선택 해제"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="input pl-9"
                        placeholder="매장명 또는 카테고리로 검색"
                        value={storeSearch}
                        onChange={e => setStoreSearch(e.target.value)}
                      />
                    </div>
                    {storesLoading ? (
                      <p className="text-xs text-gray-400 text-center py-2">매장 목록 불러오는 중...</p>
                    ) : storeQuery ? (
                      storeResults.length > 0 ? (
                        <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-56 overflow-y-auto">
                          {storeResults.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => { setSelectedStore(s); setStoreSearch(''); }}
                              className="w-full text-left px-3 py-2 hover:bg-soft-gray/50 transition-colors"
                            >
                              <p className="text-sm font-medium text-charcoal">{s.name}</p>
                              <p className="text-xs text-gray-400">{s.category} · {s.address}</p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-2">검색 결과가 없습니다.</p>
                      )
                    ) : (
                      <p className="text-xs text-gray-400">매장명 또는 카테고리를 입력해 검색하세요.</p>
                    )}
                  </>
                )}
                <p className="text-xs text-warm-orange bg-orange-50 rounded-lg p-2.5">
                  판매자 수락 대기 상태로 생성되며, 판매자가 수락하면 활성화되어 사용자 앱 상점 상세에 노출됩니다.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-3">
            <label className="text-xs text-gray-500 block mb-1">예산 부담 주체 — 정산 연동 핵심 항목</label>
            <div className="grid grid-cols-3 gap-2">
              {(['본사', '점주', '분담'] as CouponCostBearer[]).map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setForm({ ...form, costBearer: b })}
                  className={`text-sm py-2 rounded-lg border transition-colors ${form.costBearer === b ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600 hover:border-primary'}`}
                >
                  {b} 부담
                </button>
              ))}
            </div>
            {form.costBearer === '분담' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number" min={0} max={100} className="input w-24"
                  value={form.platformShare}
                  onChange={e => setForm({ ...form, platformShare: Math.min(100, Math.max(0, Number(e.target.value))) })}
                />
                <span className="text-xs text-gray-500">% 본사 부담 → 점주 {100 - form.platformShare}% 부담</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <p className="text-sm font-medium text-charcoal">다른 쿠폰과 중복 사용 허용</p>
              <p className="text-xs text-gray-400">끄면 결제 시 이 쿠폰 단독으로만 사용할 수 있습니다.</p>
            </div>
            <Switch checked={form.allowStacking} onChange={() => setForm({ ...form, allowStacking: !form.allowStacking })} label="중복 사용 허용" />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={closeCreateModal} className="btn-secondary flex-1">취소</button>
            <button onClick={save} className="btn-primary flex-1">저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
