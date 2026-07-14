import { useEffect, useState } from 'react';
import { Plus, Copy, Check, CheckCircle, XCircle, Search } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Switch from '../components/ui/Switch';
import EmptyState from '../components/ui/EmptyState';
import { fetchCoupons, createCoupon, toggleCouponActive, approveCouponRequest, rejectCouponRequest } from '../lib/api';
import { useAdmin } from '../context/AdminContext';
import type { Coupon, CouponCostBearer } from '../types';

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 조회: fetchCoupons() → admin_coupons 뷰(신청 매장명 store_name 조인 포함).
 * - 생성: createCoupon() → coupons INSERT (source='admin', is_active=true). code UNIQUE 제약 —
 *   충돌 시 에러 메시지에 'duplicate' 포함되어 별도 alert 처리.
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
  const pendingRequests = coupons.filter(c => c.source === '점주 신청');
  const visiblePending = pendingStatusFilter === '전체' ? pendingRequests : pendingRequests.filter(c => c.requestStatus === pendingStatusFilter);
  const waitingCount = pendingRequests.filter(c => c.requestStatus === '대기').length;

  const save = async () => {
    if (!form.name.trim()) return alert('쿠폰명을 입력하세요.');
    if (!form.code.trim()) return alert('쿠폰번호를 입력하세요.');
    if (form.discountType === '정률' && form.maxDiscountAmount <= 0) return alert('정률 할인은 최대 할인 한도를 입력해야 합니다.');
    if (form.costBearer === '분담' && (form.platformShare < 0 || form.platformShare > 100)) return alert('본사 부담 비율은 0~100 사이로 입력하세요.');

    try {
      const created = await createCoupon(form);
      setCoupons(prev => [created, ...prev]);
      setModal(false);
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
                  <tr key={c.id} className={`border-b border-gray-50 ${!c.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {c.name}
                      {c.source === '점주 신청' && <span className="block text-xs text-gray-400 font-normal">{c.sellerName} 신청</span>}
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
                    <td className="px-4 py-3 text-gray-600">{c.target}</td>
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
                    <td className="px-4 py-3">
                      <Switch checked={c.active} onChange={() => toggle(c)} label={`${c.name} 활성화 여부`} />
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
                ['대상', selected.target],
                ['기간', `${selected.startDate} ~ ${selected.endDate}`],
                ['발급/사용', `${selected.totalQuantity} / ${selected.usedQuantity}`],
                ['상태', selected.active ? '활성' : '비활성'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3"><span className="text-gray-500 flex-shrink-0">{l}</span><span className="text-charcoal text-right">{v}</span></div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => toggle(selected)} className="btn-secondary flex-1 text-sm">
                {selected.active ? '비활성화' : '활성화'}
              </button>
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
      <Modal open={modal} onClose={() => setModal(false)} title="쿠폰 추가" size="lg">
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
          <div><label className="text-xs text-gray-500 block mb-1">발급 대상</label>
            <select className="input" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}>
              {['전체', '신규 회원', '기존 회원', '특정 회원'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">시작일</label><input type="date" className="input" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">종료일</label><input type="date" className="input" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
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
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">취소</button>
            <button onClick={save} className="btn-primary flex-1">저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
