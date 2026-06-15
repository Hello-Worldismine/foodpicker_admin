import { useState } from 'react';
import { Search, Eye } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { mockOrders } from '../data/mockData';
import type { Order, OrderStatus } from '../types';

const ORDER_STATUSES: OrderStatus[] = ['결제완료', '픽업대기', '픽업완료', '취소요청', '환불완료', '노쇼', '분쟁중'];
const PAGE_SIZE = 7;

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | '전체'>('전체');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Order | null>(null);
  const [statusChangeModal, setStatusChangeModal] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('결제완료');
  const [changeReason, setChangeReason] = useState('');
  const [refundModal, setRefundModal] = useState(false);
  const { download, isLoading, toast, canDownload } = useExcelDownload();

  const filtered = orders.filter(o => {
    const matchSearch = o.orderNumber.includes(search) || o.buyerName.includes(search) || o.sellerName.includes(search) || o.productName.includes(search);
    const matchStatus = statusFilter === '전체' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
          '결제금액(원)': o.amount,
          '수량': o.quantity,
          '주문상태': o.status,
          '결제상태': o.paymentStatus,
          '픽업시간': o.pickupTime,
          '주문일시': o.orderedAt,
        })),
      }],
    });
  };

  const handleStatusChange = () => {
    if (!selected || !changeReason.trim()) return alert('변경 사유를 입력해주세요.');
    setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: newStatus } : o));
    setSelected(prev => prev ? { ...prev, status: newStatus } : null);
    setStatusChangeModal(false);
    setChangeReason('');
    alert(`주문 상태가 "${newStatus}"으로 변경되었습니다. (로그 기록됨)`);
  };

  const handleRefund = () => {
    if (!selected) return;
    setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: '환불완료', paymentStatus: '환불완료' } : o));
    setSelected(prev => prev ? { ...prev, status: '환불완료', paymentStatus: '환불완료' } : null);
    setRefundModal(false);
    alert('환불 처리가 완료되었습니다. (로그 기록됨)');
  };

  const statusColor: Record<string, string> = {
    '결제완료': 'bg-blue-50 text-blue-700',
    '환불완료': 'bg-gray-100 text-gray-600',
    '환불대기': 'bg-yellow-100 text-yellow-700',
    '결제취소': 'bg-red-100 text-alert-red',
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
      </div>

      <div className="flex gap-4">
        {/* List */}
        <div className={`card flex-1 overflow-hidden ${selected ? 'hidden xl:block' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  {['주문번호', '구매자', '판매자', '상품명', '결제금액', '주문상태', '결제상태', '픽업시간', '주문일시', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
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
                    <td className="px-4 py-3 font-medium">{order.amount.toLocaleString()}원</td>
                    <td className="px-4 py-3"><Badge type="order">{order.status}</Badge></td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusColor[order.paymentStatus] ?? 'bg-gray-100 text-gray-600'}`}>{order.paymentStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{order.pickupTime}</td>
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
              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setNewStatus(selected.status); setStatusChangeModal(true); }} className="btn-secondary flex-1 text-xs">상태 변경</button>
                {selected.status !== '환불완료' && (
                  <button onClick={() => setRefundModal(true)} className="btn-warning flex-1 text-xs">환불 처리</button>
                )}
              </div>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">주문 정보</p>
                <div className="space-y-2 text-sm">
                  {[
                    ['주문상태', <Badge type="order">{selected.status}</Badge>],
                    ['결제상태', <span className={`badge ${statusColor[selected.paymentStatus] ?? 'bg-gray-100'}`}>{selected.paymentStatus}</span>],
                    ['상품명', selected.productName],
                    ['결제금액', `${selected.amount.toLocaleString()}원`],
                    ['수량', `${selected.quantity}개`],
                    ['주문일시', selected.orderedAt],
                    ['픽업시간', selected.pickupTime],
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
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">판매자 정보</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">매장명</span><span>{selected.sellerName}</span></div>
                </div>
              </section>

              {selected.status === '분쟁중' && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-purple-700 mb-1">⚠️ 분쟁 진행 중</p>
                  <p className="text-xs text-purple-600">이 주문은 분쟁 처리 중입니다. 정산에서 제외됩니다.</p>
                </div>
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
      <Modal open={refundModal} onClose={() => setRefundModal(false)} title="환불 처리">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{selected?.buyerName}</strong>님의 주문 ({selected?.orderNumber})을 환불 처리합니다.
          </p>
          <p className="text-sm font-semibold text-charcoal">환불 금액: {selected?.amount.toLocaleString()}원</p>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-xs text-yellow-700">⚠️ 환불 처리 후 되돌릴 수 없으며, 모든 이력이 로그에 기록됩니다.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRefundModal(false)} className="btn-secondary flex-1">취소</button>
            <button onClick={handleRefund} className="btn-warning flex-1">환불 처리</button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
