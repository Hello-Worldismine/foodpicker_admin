import { useState } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { mockReports } from '../data/mockData';
import type { Report, ReportStatus } from '../types';

const REPORT_TYPES = [
  '전체',
  '상품 상태가 설명과 달라요',
  '소비기한이 지났어요',
  '매장이 픽업을 거부했어요',
  '상품을 받지 못했어요',
  '알레르기/성분 정보가 부족해요',
  '결제/환불 문제가 있어요',
  '기타',
];

const STATUSES: ReportStatus[] = ['접수', '확인중', '판매자 답변 대기', '구매자 답변 대기', '환불 처리', '종결'];
const PAGE_SIZE = 6;

/**
 * [백엔드 연동 안내] 현재 mockReports(목데이터)로만 동작하며, 실 DB에는 신고/문의를 저장할 테이블이 아직 없음(신규 설계 필요).
 * 제안 스키마: reports(id, receipt_code, type, order_id FK, buyer_id FK, seller_id FK, title, content, status, manager_id FK, created_at, updated_at)
 * + 처리 이력(logs state)은 report_activity_logs(report_id, admin_id, message, created_at) 같은 별도 테이블 또는 감사로그 테이블 재사용 권장.
 * API 예시:
 * - GET /api/admin/reports?search=&type=&status=&page=
 * - PATCH /api/admin/reports/:id/status  { status }
 * - POST /api/admin/reports/:id/reply  { content }  → 처리 이력에 기록
 * - POST /api/admin/reports/:id/refund  → orders/settlements 쪽 환불 플로우와 연동 필요
 */

export default function ReportManagement() {
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | '전체'>('전체');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Report | null>(null);
  const [replyText, setReplyText] = useState('');
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const { download, isLoading, toast: xlsxToast, canDownload } = useExcelDownload();

  const filtered = reports.filter(r => {
    const matchSearch = r.receiptNumber.includes(search) || r.buyerName.includes(search) || r.sellerName.includes(search) || r.title.includes(search);
    const matchType = typeFilter === '전체' || r.type === typeFilter;
    const matchStatus = statusFilter === '전체' || r.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExcelDownload = () => {
    const filters = [
      search && `검색: ${search}`,
      typeFilter !== '전체' && `유형: ${typeFilter}`,
      statusFilter !== '전체' && `상태: ${statusFilter}`,
    ].filter(Boolean).join(', ');

    download({
      filename: 'reports',
      menu: '신고/문의 관리',
      filters,
      sheets: [{
        name: '신고문의 목록',
        data: filtered.map(r => ({
          '접수번호': r.receiptNumber,
          '유형': r.type,
          '주문번호': r.orderNumber,
          '제목': r.title,
          '내용': r.content,
          '구매자': r.buyerName,
          '판매자': r.sellerName,
          '처리상태': r.status,
          '담당자': r.manager,
          '접수일': r.receivedAt,
        })),
      }],
    });
  };

  const updateStatus = (id: string, status: ReportStatus, logMsg?: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    if (logMsg) {
      setLogs(prev => ({ ...prev, [id]: [...(prev[id] ?? []), `[${new Date().toLocaleString('ko-KR')}] ${logMsg}`] }));
    }
  };

  const handleReply = () => {
    if (!selected || !replyText.trim()) return alert('답변 내용을 입력하세요.');
    const msg = `답변 등록: ${replyText}`;
    updateStatus(selected.id, selected.status, msg);
    setReplyText('');
    alert('답변이 등록되었습니다.');
  };

  const handleClose = () => {
    if (!selected) return;
    updateStatus(selected.id, '종결', '관리자 종결 처리');
    alert('신고/문의가 종결 처리되었습니다.');
  };

  const handleRefund = () => {
    if (!selected) return;
    updateStatus(selected.id, '환불 처리', '환불 처리 완료');
    alert('환불 처리되었습니다.');
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="접수번호, 구매자, 판매자, 제목 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-52" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input w-40" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as ReportStatus | '전체'); setPage(1); }}>
            <option value="전체">전체 상태</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
                  {['접수번호', '유형', '제목', '구매자', '판매자', '처리상태', '접수일', '담당자', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={9}><EmptyState /></td></tr>
                ) : paginated.map(report => (
                  <tr
                    key={report.id}
                    className={`border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors ${selected?.id === report.id ? 'bg-primary-light' : ''}`}
                    onClick={() => setSelected(report)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{report.receiptNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-28 truncate">{report.type}</td>
                    <td className="px-4 py-3 font-medium text-charcoal max-w-36 truncate">{report.title}</td>
                    <td className="px-4 py-3">{report.buyerName}</td>
                    <td className="px-4 py-3 text-gray-600">{report.sellerName}</td>
                    <td className="px-4 py-3"><Badge type="report">{report.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{report.receivedAt}</td>
                    <td className="px-4 py-3 text-gray-600">{report.manager}</td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={e => { e.stopPropagation(); setSelected(report); }}>
                        <MessageSquare size={13} /> 처리
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
          <div className="card w-full xl:w-[420px] flex-shrink-0 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-charcoal text-sm truncate pr-4">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-charcoal text-xl leading-none flex-shrink-0">×</button>
            </div>
            <div className="p-5 space-y-5">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge type="report">{selected.status}</Badge>
                <span className="text-xs text-gray-400">{selected.receivedAt}</span>
              </div>

              {/* Info */}
              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">신고 정보</p>
                <div className="space-y-1.5 text-sm">
                  {[
                    ['접수번호', selected.receiptNumber],
                    ['유형', selected.type],
                    ['주문번호', selected.orderNumber],
                    ['구매자', selected.buyerName],
                    ['판매자', selected.sellerName],
                    ['담당자', selected.manager],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between">
                      <span className="text-gray-500">{l}</span>
                      <span className="text-charcoal text-right text-xs">{v}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Content */}
              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">내용</p>
                <p className="text-sm text-charcoal bg-soft-gray rounded-lg p-3">{selected.content}</p>
              </section>

              {/* Logs */}
              {(logs[selected.id]?.length ?? 0) > 0 && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">처리 이력</p>
                  <div className="space-y-1">
                    {logs[selected.id].map((log, i) => (
                      <p key={i} className="text-xs text-gray-600 bg-soft-gray rounded p-2">{log}</p>
                    ))}
                  </div>
                </section>
              )}

              {/* Status actions */}
              <div className="flex flex-wrap gap-2">
                {selected.status !== '확인중' && (
                  <button onClick={() => updateStatus(selected.id, '확인중', '확인중으로 상태 변경')} className="btn-secondary text-xs flex-1">확인중</button>
                )}
                {selected.status !== '환불 처리' && selected.status !== '종결' && (
                  <button onClick={handleRefund} className="btn-warning text-xs flex-1">환불 처리</button>
                )}
                {selected.status !== '종결' && (
                  <button onClick={handleClose} className="btn-secondary text-xs flex-1">종결 처리</button>
                )}
              </div>

              {/* Reply */}
              {selected.status !== '종결' && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">답변 작성</p>
                  <textarea
                    className="input h-24 resize-none text-sm"
                    placeholder="답변 내용을 입력하세요."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                  />
                  <button onClick={handleReply} className="btn-primary w-full mt-2 text-sm">답변 등록</button>
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      {xlsxToast && <Toast message={xlsxToast.message} type={xlsxToast.type} />}
    </div>
  );
}
