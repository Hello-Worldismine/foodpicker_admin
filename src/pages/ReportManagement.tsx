import { useEffect, useState } from 'react';
import { Search, MessageSquare, History, Lock, ChevronDown, ArrowLeft, PlayCircle, ImageIcon } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import Lightbox from '../components/ui/Lightbox';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { useAdmin } from '../context/AdminContext';
import { fetchReports, fetchReportLogs, fetchAdmins, updateReport, addReportLog, reportRefund } from '../lib/api';
import type { Report, ReportStatus, InquirerType, AdminAccount } from '../types';

const USER_REPORT_TYPES = [
  '전체',
  '상품 상태가 설명과 달라요',
  '소비기한이 지났어요',
  '매장이 픽업을 거부했어요',
  '상품을 받지 못했어요',
  '알레르기/성분 정보가 부족해요',
  '결제/환불 문제가 있어요',
  '기타',
];

// 판매자(점주)가 직접 남기는 1:1 문의는 구매자 신고와 성격이 달라 유형을 별도로 관리한다.
const SELLER_INQUIRY_TYPES = [
  '전체',
  '정산 관련 문의',
  '계정/정보 변경 요청',
  '상품 등록 오류',
  '이용정지/제재 이의제기',
  '플랫폼 정책 문의',
  '기타',
];

const STATUSES: ReportStatus[] = ['접수', '확인중', '판매자 답변 대기', '구매자 답변 대기', '환불 처리', '종결'];
const PAGE_SIZE = 6;

// 자주 쓰는 답변 문구 — 선택하면 답변 작성란에 즉시 채워짐(추가 편집 가능)
const USER_REPLY_TEMPLATES = [
  { label: '환불 처리 완료 안내', content: '안녕하세요, 고객님. 문의주신 건 확인 결과 환불 처리가 가능한 사안으로 확인되어 환불 처리해드렸습니다. 이용에 불편을 드려 죄송합니다.' },
  { label: '소비기한 경과 사과 안내', content: '안녕하세요, 고객님. 소비기한이 경과된 상품이 판매된 점 진심으로 사과드립니다. 해당 건은 전액 환불 및 판매자 조치가 완료되었습니다.' },
  { label: '상품 상태 불량 사과 안내', content: '안녕하세요, 고객님. 상품 상태 관련 불편을 드려 죄송합니다. 해당 판매자에게 경고 조치하였으며, 결제하신 금액은 환불 처리해드렸습니다.' },
  { label: '픽업 거부/노쇼 사과 안내', content: '안녕하세요, 고객님. 매장 사정으로 픽업이 어려우셨던 점 사과드립니다. 결제하신 금액은 전액 환불 처리해드렸습니다.' },
  { label: '추가 확인 요청', content: '안녕하세요, 고객님. 정확한 확인을 위해 주문 시점의 사진이나 추가 정보를 남겨주시면 신속히 처리해드리겠습니다.' },
  { label: '처리 완료 안내', content: '안녕하세요, 고객님. 문의주신 건에 대한 처리가 완료되었습니다. 추가 문의사항이 있으시면 언제든 남겨주세요.' },
];

const SELLER_REPLY_TEMPLATES = [
  { label: '정산 문의 답변', content: '안녕하세요, 사장님. 문의주신 정산 내역을 확인한 결과 아래와 같이 안내드립니다. 추가로 궁금하신 점 있으시면 언제든 남겨주세요.' },
  { label: '계좌/정보 변경 완료 안내', content: '안녕하세요, 사장님. 요청하신 정보 변경이 완료되었습니다. 다음 정산부터 변경된 내용으로 반영됩니다.' },
  { label: '상품 등록 오류 안내', content: '안녕하세요, 사장님. 문의주신 상품 등록 오류를 확인했습니다. 아래 방법으로 다시 시도해주시면 정상적으로 등록됩니다.' },
  { label: '이용정지 이의제기 답변', content: '안녕하세요, 사장님. 이의 제기해주신 내용을 재검토했습니다. 검토 결과는 아래와 같이 안내드립니다.' },
  { label: '정책 안내', content: '안녕하세요, 사장님. 문의주신 플랫폼 정책에 대해 아래와 같이 안내드립니다.' },
  { label: '처리 완료 안내', content: '안녕하세요, 사장님. 문의주신 건에 대한 처리가 완료되었습니다. 추가 문의사항이 있으시면 언제든 남겨주세요.' },
];

/**
 * [백엔드 연동 안내] Supabase 실연동 완료.
 * - 목록/이력: reports · report_logs 테이블 (fetchReports / fetchReportLogs)
 * - 상태 변경·담당자 배정·내부 메모: updateReport(직접 UPDATE) + addReportLog 로 처리 이력 기록
 * - 환불: reportRefund() — 연결 주문이 토스 결제 건(payment_key 보유)이면 Edge Function toss-cancel 로 PG
 *   결제취소를 선행(cancelReason='신고 건 환불: 접수번호', 실패 시 DB 환불 중단) 후 admin_report_refund RPC —
 *   서버가 환불 처리와 refund 로그를 자동 기록
 * - 내부 메모(admin_memo)는 CS 전용 비공개 필드 — 사용자/판매자 앱 응답에 노출 금지.
 * - 답변 템플릿(USER/SELLER_REPLY_TEMPLATES)은 프론트 하드코딩 — 운영팀 직접 관리가 필요해지면
 *   reply_templates 테이블 + 관리 화면 별도 필요.
 * - 과거 문의/신고 이력은 불러온 목록에서 buyerName/sellerName 문자열로 클라이언트 매칭 중
 *   (동명이인 오탐 가능 — buyer_id/seller_id 기준 전용 조회로 개선 여지).
 */

export default function ReportManagement() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<InquirerType>('사용자');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('전체');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | '전체'>('전체');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Report | null>(null);
  const [historyStack, setHistoryStack] = useState<Report[]>([]);
  const [replyText, setReplyText] = useState('');
  const [templateChoice, setTemplateChoice] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [internalMemo, setInternalMemo] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  // 담당자 배정 드롭다운용 — 권한이 부여된(활성) 관리자만 노출한다.
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const { download, isLoading, toast: xlsxToast, canDownload } = useExcelDownload();
  const { currentAdmin } = useAdmin();

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchReports(), fetchReportLogs(), fetchAdmins()])
      .then(([rows, logMap, adminRows]) => {
        if (cancelled) return;
        setReports(rows);
        setLogs(logMap);
        setAdmins(adminRows.filter(a => a.status === '활성'));
      })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openReport = (r: Report) => {
    setSelected(r);
    setShowHistory(false);
    setInternalMemo(r.memo ?? '');
    setTemplateChoice('');
    setLightboxIndex(null);
  };

  // 목록에서 새로 클릭한 경우: 이전 뒤로가기 스택을 초기화하는 진입점
  const selectReport = (r: Report) => {
    setHistoryStack([]);
    openReport(r);
  };

  // 과거 이력에서 다른 건으로 이동: 현재 보던 건을 스택에 쌓아두고 이동
  const goToReport = (r: Report) => {
    if (selected) setHistoryStack(prev => [...prev, selected]);
    openReport(r);
  };

  // 뒤로가기: 스택에서 직전 건을 꺼내 복원
  const goBack = () => {
    setHistoryStack(prev => {
      if (prev.length === 0) return prev;
      openReport(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
  };

  const closePanel = () => {
    setSelected(null);
    setHistoryStack([]);
  };

  const switchTab = (t: InquirerType) => {
    setTab(t);
    setSearch('');
    setTypeFilter('전체');
    setStatusFilter('전체');
    setPage(1);
    closePanel();
  };

  const currentTypes = tab === '사용자' ? USER_REPORT_TYPES : SELLER_INQUIRY_TYPES;
  const currentTemplates = tab === '사용자' ? USER_REPLY_TEMPLATES : SELLER_REPLY_TEMPLATES;

  const filtered = reports.filter(r => {
    if (r.inquirerType !== tab) return false;
    const matchSearch = r.receiptNumber.includes(search) || (r.buyerName ?? '').includes(search) || r.sellerName.includes(search) || r.title.includes(search);
    const matchType = typeFilter === '전체' || r.type === typeFilter;
    const matchStatus = statusFilter === '전체' || r.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 사용자 문의는 구매자(buyerName), 판매자 문의는 신청 매장(sellerName) 기준으로 과거 이력을 판별한다.
  const buyerHistory = selected
    ? reports.filter(r => r.id !== selected.id && r.inquirerType === selected.inquirerType && (
        selected.inquirerType === '판매자' ? r.sellerName === selected.sellerName : r.buyerName === selected.buyerName
      ))
    : [];

  const handleExcelDownload = () => {
    const filters = [
      `구분: ${tab} 문의`,
      search && `검색: ${search}`,
      typeFilter !== '전체' && `유형: ${typeFilter}`,
      statusFilter !== '전체' && `상태: ${statusFilter}`,
    ].filter(Boolean).join(', ');

    download({
      filename: tab === '사용자' ? 'user_reports' : 'seller_inquiries',
      menu: '신고/문의 관리',
      filters,
      sheets: [{
        name: '신고문의 목록',
        data: filtered.map(r => ({
          '접수번호': r.receiptNumber,
          '구분': r.inquirerType,
          '유형': r.type,
          '주문번호': r.orderNumber ?? '-',
          '제목': r.title,
          '내용': r.content,
          '구매자': r.buyerName ?? '-',
          '매장': r.sellerName,
          '처리상태': r.status,
          '담당자': r.manager,
          '접수일': r.receivedAt,
        })),
      }],
    });
  };

  const appendLocalLog = (id: string, msg: string) => {
    setLogs(prev => ({ ...prev, [id]: [...(prev[id] ?? []), `[${new Date().toLocaleString('ko-KR')}] ${msg} (${currentAdmin.name})`] }));
  };

  const updateStatus = async (id: string, status: ReportStatus, logMsg?: string): Promise<boolean> => {
    // 담당자가 아직 미배정이면 처리하는 관리자를 담당자로 배정한다.
    const target = reports.find(r => r.id === id);
    const manager = target && target.manager !== '미배정' ? target.manager : currentAdmin.name;
    try {
      await updateReport(id, { status, manager });
      if (logMsg) await addReportLog(id, currentAdmin.name, 'status', logMsg);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
      return false;
    }
    setReports(prev => prev.map(r => r.id === id ? { ...r, status, manager } : r));
    setSelected(prev => prev && prev.id === id ? { ...prev, status, manager } : prev);
    if (logMsg) appendLocalLog(id, logMsg);
    return true;
  };

  // 담당자 수동 배정/변경 — 상세 패널 드롭다운에서 호출되며 처리 이력에 system 로그로 남긴다.
  const changeManager = async (manager: string) => {
    if (!selected || manager === selected.manager) return;
    const id = selected.id;
    const msg = `담당자 변경: ${selected.manager} → ${manager}`;
    try {
      await updateReport(id, { manager });
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
      return;
    }
    // 배정 자체는 성공 — 이력 기록 실패가 서버-로컬 담당자 불일치를 만들지 않도록 분리
    try { await addReportLog(id, currentAdmin.name, 'system', msg); } catch { /* 이력은 부가 기록 */ }
    setReports(prev => prev.map(r => r.id === id ? { ...r, manager } : r));
    setSelected(prev => prev && prev.id === id ? { ...prev, manager } : prev);
    appendLocalLog(id, msg);
  };

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return alert('답변 내용을 입력하세요.');
    const msg = `답변 등록: ${replyText}`;
    try {
      await addReportLog(selected.id, currentAdmin.name, 'reply', msg);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
      return;
    }
    appendLocalLog(selected.id, msg);
    setReplyText('');
    setTemplateChoice('');
    alert('답변이 등록되었습니다.');
  };

  const applyTemplate = (label: string) => {
    const tpl = currentTemplates.find(t => t.label === label);
    if (tpl) setReplyText(tpl.content);
    setTemplateChoice('');
  };

  const saveMemo = async () => {
    if (!selected) return;
    const id = selected.id;
    try {
      await updateReport(id, { memo: internalMemo });
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
      return;
    }
    setReports(prev => prev.map(r => r.id === id ? { ...r, memo: internalMemo } : r));
    setSelected(prev => prev && prev.id === id ? { ...prev, memo: internalMemo } : prev);
  };

  const handleClose = async () => {
    if (!selected) return;
    if (await updateStatus(selected.id, '종결', '관리자 종결 처리')) {
      alert('신고/문의가 종결 처리되었습니다.');
    }
  };

  const handleRefund = async () => {
    if (!selected) return;
    const id = selected.id;
    try {
      // 서버(admin_report_refund RPC)가 환불 처리 + refund 로그를 자동 기록하므로 addReportLog 를 중복 호출하지 않는다.
      await reportRefund(id);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
      return;
    }
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: '환불 처리' } : r));
    setSelected(prev => prev && prev.id === id ? { ...prev, status: '환불 처리' } : prev);
    appendLocalLog(id, '환불 처리 완료');
    alert('환불 처리되었습니다.');
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 w-fit shadow-sm border border-gray-100">
        {(['사용자', '판매자'] as InquirerType[]).map(t => (
          <button key={t} onClick={() => switchTab(t)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-white' : 'text-gray-500 hover:text-charcoal'}`}>
            {t} 문의
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder={tab === '사용자' ? '접수번호, 구매자, 판매자, 제목 검색' : '접수번호, 매장명, 제목 검색'}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="input w-52" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            {currentTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : loadError ? (
            <div className="py-16 text-center text-sm text-red-500">{loadError}</div>
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  {(tab === '사용자'
                    ? ['접수번호', '유형', '제목', '구매자', '판매자', '처리상태', '접수일', '담당자', '관리']
                    : ['접수번호', '유형', '제목', '문의 매장', '처리상태', '접수일', '담당자', '관리']
                  ).map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={tab === '사용자' ? 9 : 8}><EmptyState /></td></tr>
                ) : paginated.map(report => (
                  <tr
                    key={report.id}
                    className={`border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors ${selected?.id === report.id ? 'bg-primary-light' : ''}`}
                    onClick={() => selectReport(report)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{report.receiptNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-28 truncate">{report.type}</td>
                    <td className="px-4 py-3 font-medium text-charcoal max-w-36 truncate">{report.title}</td>
                    {tab === '사용자' && <td className="px-4 py-3">{report.buyerName}</td>}
                    <td className="px-4 py-3 text-gray-600">{report.sellerName}</td>
                    <td className="px-4 py-3"><Badge type="report">{report.status}</Badge></td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{report.receivedAt}</td>
                    <td className="px-4 py-3 text-gray-600">{report.manager}</td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={e => { e.stopPropagation(); selectReport(report); }}>
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
          </>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="card w-full xl:w-[420px] flex-shrink-0 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {historyStack.length > 0 && (
                  <button onClick={goBack} className="text-gray-400 hover:text-primary flex-shrink-0" title="이전 문의로 돌아가기">
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h3 className="font-semibold text-charcoal text-sm truncate">{selected.title}</h3>
              </div>
              <button onClick={closePanel} className="text-gray-400 hover:text-charcoal text-xl leading-none flex-shrink-0">×</button>
            </div>
            <div className="p-5 space-y-5">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge type="report">{selected.status}</Badge>
                <span className="text-xs text-gray-400">{selected.receivedAt}</span>
              </div>

              {/* Info */}
              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">{selected.inquirerType === '판매자' ? '문의 정보' : '신고 정보'}</p>
                <div className="space-y-1.5 text-sm">
                  {[
                    ['접수번호', selected.receiptNumber],
                    ['유형', selected.type],
                    ...(selected.orderNumber ? [['주문번호', selected.orderNumber]] : []),
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between">
                      <span className="text-gray-500">{l}</span>
                      <span className="text-charcoal text-right text-xs">{v}</span>
                    </div>
                  ))}
                  {selected.inquirerType === '사용자' && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">구매자</span>
                      <span className="text-charcoal text-right text-xs">{selected.buyerName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">{selected.inquirerType === '판매자' ? '문의 매장' : '판매자'}</span>
                    <span className="text-charcoal text-right text-xs">{selected.sellerName}</span>
                  </div>
                  {/* 담당자 배정 — 활성 관리자 목록에서 선택(변경 시 처리 이력에 자동 기록) */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">담당자</span>
                    <select
                      className="input w-36 py-1.5 text-xs"
                      value={selected.manager}
                      onChange={e => changeManager(e.target.value)}
                    >
                      <option value="미배정">미배정</option>
                      {/* 비활성 전환 등으로 목록에 없는 기존 담당자도 현재 값으로 표시되도록 유지 */}
                      {selected.manager !== '미배정' && !admins.some(a => a.name === selected.manager) && (
                        <option value={selected.manager}>{selected.manager}</option>
                      )}
                      {admins.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* 블랙컨슈머/중복 문의 판별용 과거 이력 */}
                <button
                  onClick={() => setShowHistory(v => !v)}
                  className="mt-2 w-full flex items-center justify-between text-xs text-primary bg-primary-light hover:bg-primary/10 rounded-lg px-3 py-2 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <History size={13} />
                    {selected.inquirerType === '판매자' ? '이 매장의 과거 문의 이력 보기' : '과거 문의/신고 이력 보기'} ({buyerHistory.length}건)
                  </span>
                  <ChevronDown size={14} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                </button>
                {showHistory && (
                  <div className="mt-2 space-y-1.5">
                    {buyerHistory.length === 0 ? (
                      <p className="text-xs text-gray-400 px-1">
                        {selected.inquirerType === '판매자' ? '이 매장의 과거 문의 이력이 없습니다.' : '이 구매자의 과거 문의/신고 이력이 없습니다.'}
                      </p>
                    ) : buyerHistory.map(h => (
                      <button
                        key={h.id}
                        onClick={() => goToReport(h)}
                        className="w-full text-left text-xs bg-soft-gray hover:bg-gray-200 rounded-lg p-2.5 flex items-start justify-between gap-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-charcoal truncate hover:underline">{h.title}</p>
                          <p className="text-gray-400 mt-0.5">{h.type} · {h.receivedAt}</p>
                        </div>
                        <Badge type="report">{h.status}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Content */}
              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">내용</p>
                <p className="text-sm text-charcoal bg-soft-gray rounded-lg p-3">{selected.content}</p>
              </section>

              {/* Evidence (사진/영상 증빙 — 라이트박스 미리보기) */}
              {selected.evidence && selected.evidence.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">증빙 자료 ({selected.evidence.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.evidence.map((ev, i) => (
                      <button
                        key={i}
                        onClick={() => setLightboxIndex(i)}
                        className="relative block aspect-square rounded-lg overflow-hidden border border-gray-100 hover:opacity-80 transition-opacity"
                      >
                        <img src={ev.url} alt={`증빙 자료 ${i + 1}`} className="w-full h-full object-cover" />
                        {ev.type === 'video' ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <PlayCircle size={22} className="text-white drop-shadow" />
                          </span>
                        ) : (
                          <span className="absolute bottom-1 right-1 bg-black/50 rounded p-0.5">
                            <ImageIcon size={10} className="text-white" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Internal memo (비공개) */}
              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide flex items-center gap-1">
                  <Lock size={11} /> 내부 메모 <span className="normal-case font-normal text-gray-300">(고객에게 공개되지 않음)</span>
                </p>
                <textarea
                  className="input h-20 resize-none text-sm bg-yellow-50 border-yellow-200 focus:border-primary"
                  placeholder="예: 해당 매장 점주와 통화하여 환불 처리 조율 중 — CS 담당자 간 공유용 메모입니다."
                  value={internalMemo}
                  onChange={e => setInternalMemo(e.target.value)}
                />
                <button onClick={saveMemo} className="btn-secondary w-full mt-2 text-xs">메모 저장</button>
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
                {selected.inquirerType === '사용자' && selected.status !== '환불 처리' && selected.status !== '종결' && (
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
                  <select
                    className="input text-sm mb-2"
                    value={templateChoice}
                    onChange={e => applyTemplate(e.target.value)}
                  >
                    <option value="">⚡ 빠른 답변 템플릿 선택...</option>
                    {currentTemplates.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                  </select>
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

      {selected?.evidence && lightboxIndex !== null && (
        <Lightbox
          items={selected.evidence}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}
