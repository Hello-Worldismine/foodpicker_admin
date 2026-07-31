import { useEffect, useState } from 'react';
import { Search, Eye, AlertTriangle } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { fetchOrders, setOrderStatus, refundOrder } from '../lib/api';
import type { Order, OrderStatus, CancelRequestStatus } from '../types';

// 실제 DB order_seller_status enum('new'|'confirmed'|'completed'|'cancelled')과 동일한 4개 상태.
// '노쇼', '분쟁중' 등은 별도 상태로 존재하지 않으며 memo로 기록한다.
/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 목록: fetchOrders() — `orders` 테이블(판매자 앱과 공유), 최신 1000건.
 * - 상태 변경: setOrderStatus() — RPC admin_set_order_status(사유 필수, 서버가 감사 로그 기록).
 * - 환불: refundOrder() — 토스 결제 건(payment_key 보유)은 Edge Function toss-cancel 로 PG 결제취소 선행 후
 *   RPC admin_refund_order → paymentStatus='환불완료', status='취소'. PG 취소 실패 시 DB 환불도 중단된다.
 * - safeNumber(050 안심번호)는 통신사 연동 결과이므로 관리자는 조회만 하고 발급/해제는 판매자 앱/PG 쪽 로직을 따른다.
 * - 관리자 메모는 표시 전용(저장 액션 없음).
 * - 취소 요청(cancelRequestStatus)은 조회 전용이다. 구매자가 주문 후 10분 이내에 요청하면 'requested' 가 되고
 *   승인/거절은 판매자앱에서만 처리한다(승인 시 판매자앱이 PG 전액취소 후 respond_order_cancel 호출).
 *   관리자는 '취소요청 대기' 배지로 판매자 미응답 건을 파악하고, 필요하면 기존 환불 처리로 직접 개입한다.
 */
const ORDER_STATUSES: OrderStatus[] = ['신규접수', '픽업대기', '픽업완료', '취소'];
const PAGE_SIZE = 7;

// 취소 요청 상태 한글 라벨 — 관리자 화면 표시 전용(DB 에는 영문 키만 저장된다).
const CANCEL_REQUEST_KO: Record<CancelRequestStatus, string> = {
  requested: '취소요청 대기',
  approved: '취소 승인',
  rejected: '취소 거절',
};
/** 판매자가 아직 응답하지 않은 취소 요청 — 관리자가 챙겨야 할 건. */
const isCancelPending = (o: Order) => o.cancelRequestStatus === 'requested';

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | '전체'>('전체');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Order | null>(null);
  const [statusChangeModal, setStatusChangeModal] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('신규접수');
  const [changeReason, setChangeReason] = useState('');
  const [refundModal, setRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const { download, isLoading, toast, canDownload } = useExcelDownload();

  useEffect(() => {
    let cancelled = false;
    fetchOrders()
      .then(rows => { if (!cancelled) setOrders(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = orders.filter(o => {
    const matchSearch = o.orderNumber.includes(search) || o.buyerName.includes(search) || o.sellerName.includes(search) || o.productName.includes(search);
    const matchStatus = statusFilter === '전체' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // 필터와 무관하게 전체 기준으로 센다 — 필터를 걸어 놓고 미응답 건을 놓치는 일을 막는다.
  const cancelPendingCount = orders.filter(isCancelPending).length;

  const handleExcelDownload = () => {
    const filters = [
      search && `검색: ${search}`,
      statusFilter !== '전체' && `주문상태: ${statusFilter}`,
    ].filter(Boolean).join(', ');

    download({
      filename: 'orders',
      menu: '주문 관리',
      filters,
      sheets: [{
        name: '주문 목록',
        data: filtered.map(o => ({
          '주문번호': o.orderNumber,
          '구매자': o.buyerName,
          '판매자': o.sellerName,
          '상품명': o.productName,
          '상품금액(원)': o.amount,
          '수수료(원)': o.fee,
          '결제금액(원)': o.totalPrice,
          '수량': o.quantity,
          '주문상태': o.status,
          '결제상태': o.paymentStatus,
          '안심번호': o.safeNumber,
          '픽업 마감': o.pickupTime,
          '주문일시': o.orderedAt,
          '취소요청': o.cancelRequestStatus ? CANCEL_REQUEST_KO[o.cancelRequestStatus] : '',
          '취소요청일시': o.cancelRequestedAt ?? '',
        })),
      }],
    });
  };

  const handleStatusChange = async () => {
    if (!selected || !changeReason.trim()) return alert('변경 사유를 입력해주세요.');
    try {
      await setOrderStatus(selected.id, newStatus, changeReason.trim());
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: newStatus } : o));
      setSelected(prev => prev ? { ...prev, status: newStatus } : null);
      setStatusChangeModal(false);
      setChangeReason('');
      alert(`주문 상태가 "${newStatus}"으로 변경되었습니다. (로그 기록됨)`);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const handleRefund = async () => {
    if (!selected) return;
    try {
      // 환불 사유는 토스 결제취소(toss-cancel)의 cancelReason 및 주문 cancel_reason 으로 전달된다.
      await refundOrder(selected.id, refundReason.trim() || undefined);
      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: '취소', paymentStatus: '환불완료' } : o));
      setSelected(prev => prev ? { ...prev, status: '취소', paymentStatus: '환불완료' } : null);
      setRefundModal(false);
      setRefundReason('');
      alert('환불 처리가 완료되었습니다. (로그 기록됨)');
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="주문번호, 구매자, 판매자, 상품명 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-36" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as OrderStatus | '전체'); setPage(1); }}>
            <option value="전체">전체 상태</option>
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ExcelDownloadButton onClick={handleExcelDownload} isLoading={isLoading} hidden={!canDownload} />
        </div>
        {/* 판매자가 아직 승인/거절하지 않은 취소 요청이 쌓여 있으면 상단에 먼저 알린다. */}
        {cancelPendingCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-alert-red">
            <AlertTriangle size={14} className="flex-shrink-0" />
            판매자 응답을 기다리는 취소 요청이 {cancelPendingCount}건 있습니다. 목록의 '취소요청 대기' 배지를 확인하세요.
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {/* List */}
        <div className={`card flex-1 overflow-hidden ${selected ? 'hidden xl:block' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  {['주문번호', '구매자', '판매자', '상품명', '결제금액', '주문상태', '결제상태', '픽업 마감', '주문일시', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10}><div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div></td></tr>
                ) : loadError ? (
                  <tr><td colSpan={10}><div className="py-16 text-center text-sm text-red-500">{loadError}</div></td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={10}><EmptyState /></td></tr>
                ) : paginated.map(order => (
                  <tr
                    key={order.id}
                    className={`border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors ${selected?.id === order.id ? 'bg-primary-light' : ''}`}
                    onClick={() => setSelected(order)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.orderNumber}</td>
                    <td className="px-4 py-3 font-medium">{order.buyerName}</td>
                    <td className="px-4 py-3 text-gray-600">{order.sellerName}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-32 truncate">{order.productName}</td>
                    <td className="px-4 py-3 font-medium">{order.totalPrice.toLocaleString()}원</td>
                    <td className="px-4 py-3">
                      <Badge type="order">{order.status}</Badge>
                      {/* 판매자 미응답 취소 요청 — 관리자가 방치 건을 바로 찾을 수 있게 요청 시각까지 노출 */}
                      {isCancelPending(order) && (
                        <div className="mt-1">
                          <Badge variant="red">취소요청 대기</Badge>
                          {order.cancelRequestedAt && (
                            <div className="mt-0.5 text-[11px] text-alert-red whitespace-nowrap">{order.cancelRequestedAt}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge type="payment">{order.paymentStatus}</Badge></td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{order.pickupTime}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{order.orderedAt}</td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={e => { e.stopPropagation(); setSelected(order); }}>
                        <Eye size={13} /> 상세
                      </button>
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
              <h3 className="font-semibold text-charcoal text-sm">{selected.orderNumber}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-charcoal text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-5">
              {/* 취소 요청 — 승인/거절은 판매자앱 전용이므로 관리자에게는 조회 정보로만 보여준다. */}
              {selected.cancelRequestStatus && (
                <div className={`rounded-lg p-3 space-y-1 ${isCancelPending(selected) ? 'bg-red-50' : 'bg-soft-gray'}`}>
                  <div className="flex items-center gap-1.5">
                    {isCancelPending(selected) && <AlertTriangle size={14} className="text-alert-red flex-shrink-0" />}
                    <Badge variant={isCancelPending(selected) ? 'red' : 'gray'}>
                      {CANCEL_REQUEST_KO[selected.cancelRequestStatus]}
                    </Badge>
                  </div>
                  {selected.cancelRequestedAt && (
                    <p className="text-xs text-gray-600">요청 시각: {selected.cancelRequestedAt}</p>
                  )}
                  {selected.cancelRequestReason && (
                    <p className="text-xs text-gray-600">요청 사유: {selected.cancelRequestReason}</p>
                  )}
                  {isCancelPending(selected) && (
                    <p className="text-xs text-alert-red">
                      판매자 응답 대기 중입니다. 승인·거절은 판매자앱에서 처리되며, 관리자가 직접 처리하려면 아래 [환불 처리]를 사용하세요.
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setNewStatus(selected.status); setStatusChangeModal(true); }} className="btn-secondary flex-1 text-xs">상태 변경</button>
                {selected.paymentStatus !== '환불완료' && (
                  <button onClick={() => setRefundModal(true)} className="btn-warning flex-1 text-xs">환불 처리</button>
                )}
              </div>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">주문 정보</p>
                <div className="space-y-2 text-sm">
                  {[
                    ['주문상태', <Badge type="order">{selected.status}</Badge>],
                    ['결제상태', <Badge type="payment">{selected.paymentStatus}</Badge>],
                    ['상품명', selected.productName],
                    ['상품금액', `${selected.amount.toLocaleString()}원`],
                    ['수수료', `${selected.fee.toLocaleString()}원`],
                    ['결제금액', `${selected.totalPrice.toLocaleString()}원`],
                    ['수량', `${selected.quantity}개`],
                    ['주문일시', selected.orderedAt],
                    ['픽업 마감', selected.pickupTime],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between items-center">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-charcoal text-right">{value as React.ReactNode}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">구매자 정보</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">구매자</span><span>{selected.buyerName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">안심번호</span><span className="font-mono text-xs">{selected.safeNumber ?? '-'}</span></div>
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">판매자 정보</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">매장명</span><span>{selected.sellerName}</span></div>
                </div>
              </section>

              {selected.memo && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">관리자 메모</p>
                  <p className="text-sm text-charcoal bg-soft-gray rounded-lg p-3">{selected.memo}</p>
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Change Modal */}
      <Modal open={statusChangeModal} onClose={() => setStatusChangeModal(false)} title="주문 상태 변경">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">변경할 상태</label>
            <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value as OrderStatus)}>
              {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">변경 사유 (필수)</label>
            <textarea className="input h-24 resize-none" placeholder="변경 사유를 입력하세요." value={changeReason} onChange={e => setChangeReason(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStatusChangeModal(false)} className="btn-secondary flex-1">취소</button>
            <button onClick={handleStatusChange} className="btn-primary flex-1">변경</button>
          </div>
        </div>
      </Modal>

      {/* Refund Modal */}
      <Modal open={refundModal} onClose={() => { setRefundModal(false); setRefundReason(''); }} title="환불 처리">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{selected?.buyerName}</strong>님의 주문 ({selected?.orderNumber})을 환불 처리합니다.
          </p>
          <p className="text-sm font-semibold text-charcoal">환불 금액: {selected?.totalPrice.toLocaleString()}원</p>
          <textarea className="input h-24 resize-none" placeholder="환불 사유를 입력하세요. (토스 결제취소 사유로 전달, 미입력 시 '관리자 환불 처리')" value={refundReason} onChange={e => setRefundReason(e.target.value)} maxLength={200} />
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-yellow-700">⚠️ 환불 처리 후 되돌릴 수 없으며, 모든 이력이 로그에 기록됩니다. 토스 결제 건은 PG 결제취소가 함께 진행됩니다.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setRefundModal(false); setRefundReason(''); }} className="btn-secondary flex-1">취소</button>
            <button onClick={handleRefund} className="btn-warning flex-1">환불 처리</button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
