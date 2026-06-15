import { useState } from 'react';
import { Search, CheckCircle, Pause } from 'lucide-react';
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

export default function SettlementManagement() {
  const [settlements, setSettlements] = useState<Settlement[]>(mockSettlements);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SettlementStatus | '전체'>('전체');
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
    const matchSearch = s.sellerName.includes(search) || s.businessNumber.includes(search);
    const matchStatus = statusFilter === '전체' || s.status === statusFilter;
    return matchSearch && matchStatus;
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
          '사업자번호': s.businessNumber,
          '총판매금액(원)': s.totalSales,
          '수수료(원)': s.commission,
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
        <div className="flex flex-wrap gap-3">
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
                      <div className="flex gap-1">
                        {s.status !== '정산완료' && s.status !== '보류' && (
                          <button onClick={e => { e.stopPropagation(); handleConfirm(s); }} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                            <CheckCircle size={12} /> 확정
                          </button>
                        )}
                        {s.status !== '보류' && (
                          <button onClick={e => { e.stopPropagation(); setSelected(s); setHoldModal(true); }} className="text-xs text-warn-orange hover:underline flex items-center gap-0.5 ml-1">
                            <Pause size={12} /> 보류
                          </button>
                        )}
                      </div>
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
              <div className="flex gap-2">
                {selected.status !== '정산완료' && selected.status !== '보류' && (
                  <button onClick={() => handleConfirm(selected)} className="btn-primary flex-1 text-xs flex items-center justify-center gap-1">
                    <CheckCircle size={13} /> 정산 확정
                  </button>
                )}
                {selected.status !== '보류' && (
                  <button onClick={() => setHoldModal(true)} className="btn-warning flex-1 text-xs flex items-center justify-center gap-1">
                    <Pause size={13} /> 보류
                  </button>
                )}
                {selected.status === '보류' && (
                  <button onClick={() => updateStatus(selected.id, '정산예정')} className="btn-primary flex-1 text-xs">보류 해제</button>
                )}
              </div>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">판매자 정보</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">판매자</span><span>{selected.sellerName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">사업자번호</span><span className="font-mono text-xs">{selected.businessNumber}</span></div>
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
                  <div className="flex justify-between"><span className="text-gray-500">수수료 (10%)</span><span className="text-warm-orange">-{selected.commission.toLocaleString()}원</span></div>
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
