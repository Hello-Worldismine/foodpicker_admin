import { useState } from 'react';
import { Search, Eye, CheckCircle, XCircle, Ban, Download, FileWarning } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { mockSellers } from '../data/mockData';
import type { Seller, SellerStatus } from '../types';

/**
 * [백엔드 연동 안내] 현재 mockSellers(목데이터)로 동작 중. 실 서비스는 Supabase `stores` 테이블(판매자 앱과 공유)에 대응됨.
 * - 목록/검색: GET /api/admin/sellers?search=&status=&region=&page=
 * - 상세: GET /api/admin/sellers/:id
 * - 승인/반려: PATCH /api/admin/sellers/:id/approval  { approvalStatus: 'approved'|'pending'|'rejected', rejectReason? }
 * - 이용정지/해제: PATCH /api/admin/sellers/:id/pause  { isSellingPaused: boolean, reason? }  (DB의 stores.is_selling_paused)
 * - 수수료율 변경: PATCH /api/admin/sellers/:id/commission  { commissionRate: number }  (stores.commission_rate, 판매자는 수정 불가 — 관리자 전용 컬럼)
 * - 사업자등록증 다운로드: bizCertImage는 실제로는 Supabase Storage에 업로드된 파일의 signed URL(만료시간 있는 임시 URL)이어야 함.
 *   퍼블릭 URL로 영구 노출하지 말 것 — 다운로드 버튼 클릭 시점에 GET /api/admin/sellers/:id/biz-cert 로 signed URL을 새로 발급받는 방식을 권장.
 * ⚠️ 보안: residentNumberMasked(주민번호)는 반드시 마스킹된 값만 API 응답에 포함할 것. 평문 주민번호/전체 사업자 서류는 별도 권한 체크 후에만 조회.
 */
const STATUS_OPTIONS: SellerStatus[] = ['승인대기', '승인완료', '반려', '이용정지'];
const REGIONS = ['전체', '서울 강남', '서울 마포', '서울 서초', '서울 홍대', '서울 강동', '경기 성남', '경기 수원', '인천 연수'];
const REJECT_REASONS = [
  '사업자등록증 정보가 불명확합니다.',
  '매장 주소 확인이 필요합니다.',
  '정산 계좌 정보가 일치하지 않습니다.',
  '제출 서류가 미비합니다.',
  '직접 입력',
];

const PAGE_SIZE = 6;

export default function SellerManagement() {
  const [sellers, setSellers] = useState<Seller[]>(mockSellers);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SellerStatus | '전체'>('전체');
  const [regionFilter, setRegionFilter] = useState('전체');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Seller | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [suspendModal, setSuspendModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const { download, isLoading, toast, canDownload } = useExcelDownload();

  const filtered = sellers.filter(s => {
    const matchSearch = s.storeName.includes(search) || s.bizNumber.includes(search) || s.ownerName.includes(search);
    const matchStatus = statusFilter === '전체' || s.status === statusFilter;
    const matchRegion = regionFilter === '전체' || s.region === regionFilter;
    return matchSearch && matchStatus && matchRegion;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExcelDownload = () => {
    const filters = [
      search && `검색: ${search}`,
      statusFilter !== '전체' && `상태: ${statusFilter}`,
      regionFilter !== '전체' && `지역: ${regionFilter}`,
    ].filter(Boolean).join(', ');

    download({
      filename: 'sellers',
      menu: '판매자 관리',
      filters,
      sheets: [{
        name: '판매자 목록',
        data: filtered.map(s => ({
          '매장명': s.storeName,
          '대표자명': s.ownerName,
          '사업자번호': s.bizNumber,
          '지역': s.region,
          '상태': s.status,
          '수수료율(%)': s.commissionRate,
          '가입일': s.joinDate,
          '연락처': s.phone,
          '이메일': s.email,
          '주소': s.address,
          '누적주문수': s.totalOrders,
          '신고수': s.reportCount,
          '주요카테고리': s.categoryMain,
          '은행': s.bankName,
          '계좌번호': s.accountNumber,
          '예금주': s.accountHolder,
        })),
      }],
    });
  };

  const updateStatus = (id: string, status: SellerStatus, memo?: string) => {
    setSellers(prev => prev.map(s => s.id === id ? { ...s, status, memo: memo ?? s.memo } : s));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
  };

  const handleApprove = (seller: Seller) => {
    updateStatus(seller.id, '승인완료');
  };

  const handleReject = () => {
    if (!selected) return;
    const reason = rejectReason === '직접 입력' ? customReason : rejectReason;
    if (!reason) return alert('반려 사유를 선택해주세요.');
    updateStatus(selected.id, '반려', reason);
    setRejectModal(false);
    setRejectReason('');
    setCustomReason('');
  };

  const handleSuspend = () => {
    if (!selected || !suspendReason.trim()) return alert('이용정지 사유를 입력해주세요.');
    updateStatus(selected.id, '이용정지', suspendReason);
    setSuspendModal(false);
    setSuspendReason('');
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="매장명, 대표자명, 사업자번호 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-36" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as SellerStatus | '전체'); setPage(1); }}>
            <option value="전체">전체 상태</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input w-40" value={regionFilter} onChange={e => { setRegionFilter(e.target.value); setPage(1); }}>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
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
                  {['매장명', '대표자', '사업자번호', '지역', '상태', '가입일', '주문수', '신고수', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={9}><EmptyState /></td></tr>
                ) : paginated.map(seller => (
                  <tr
                    key={seller.id}
                    className={`border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors ${selected?.id === seller.id ? 'bg-primary-light' : ''}`}
                    onClick={() => setSelected(seller)}
                  >
                    <td className="px-4 py-3 font-medium text-charcoal">{seller.storeName}</td>
                    <td className="px-4 py-3 text-gray-600">{seller.ownerName}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{seller.bizNumber}</td>
                    <td className="px-4 py-3 text-gray-600">{seller.region}</td>
                    <td className="px-4 py-3"><Badge type="seller">{seller.status}</Badge></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{seller.joinDate}</td>
                    <td className="px-4 py-3 text-gray-600">{seller.totalOrders.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={seller.reportCount > 3 ? 'text-alert-red font-semibold' : 'text-gray-600'}>{seller.reportCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={e => { e.stopPropagation(); setSelected(seller); }}>
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
              <h3 className="font-semibold text-charcoal">{selected.storeName}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-charcoal text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-5">
              {/* Status actions */}
              {(selected.status === '승인대기') && (
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(selected)} className="btn-primary flex-1 flex items-center justify-center gap-1">
                    <CheckCircle size={14} /> 승인
                  </button>
                  <button onClick={() => setRejectModal(true)} className="btn-danger flex-1 flex items-center justify-center gap-1">
                    <XCircle size={14} /> 반려
                  </button>
                </div>
              )}
              {selected.status === '승인완료' && (
                <button onClick={() => setSuspendModal(true)} className="btn-warning w-full flex items-center justify-center gap-1">
                  <Ban size={14} /> 이용정지
                </button>
              )}
              {selected.status === '이용정지' && (
                <button onClick={() => handleApprove(selected)} className="btn-primary w-full flex items-center justify-center gap-1">
                  <CheckCircle size={14} /> 이용정지 해제
                </button>
              )}

              {/* Info sections */}
              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">기본 정보</p>
                <div className="space-y-2 text-sm">
                  {[
                    ['상태', <Badge type="seller">{selected.status}</Badge>],
                    ['대표자', selected.ownerName],
                    ['사업자번호', selected.bizNumber],
                    ['주민번호', <span className="font-mono text-xs">{selected.residentNumberMasked ?? '-'}</span>],
                    ['연락처', selected.phone],
                    ['이메일', selected.email],
                    ['지역', selected.region],
                    ['가입일', selected.joinDate],
                    ['수수료율', `${selected.commissionRate}%`],
                    ['누적 주문', `${selected.totalOrders}건`],
                    ['신고 수', `${selected.reportCount}건`],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-charcoal text-right">{value as React.ReactNode}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">사업자등록증</p>
                {selected.bizCertImage ? (
                  <a
                    href={selected.bizCertImage}
                    download={`${selected.storeName}_사업자등록증.svg`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                  >
                    <Download size={14} /> 사업자등록증 다운로드
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-warm-orange bg-orange-50 rounded-lg p-3">
                    <FileWarning size={15} className="flex-shrink-0" />
                    제출된 사업자등록증이 없습니다.
                  </div>
                )}
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">매장 주소</p>
                <p className="text-sm text-charcoal">{selected.address}</p>
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">정산 계좌</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">은행</span><span>{selected.bankName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">계좌번호</span><span className="font-mono text-xs">{selected.accountNumber}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">예금주</span><span>{selected.accountHolder}</span></div>
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

      {/* Reject Modal */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="반려 사유 입력">
        <div className="space-y-3">
          {REJECT_REASONS.map(reason => (
            <label key={reason} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-soft-gray transition-colors">
              <input type="radio" name="rejectReason" value={reason} checked={rejectReason === reason} onChange={e => setRejectReason(e.target.value)} className="mt-0.5 accent-primary" />
              <span className="text-sm">{reason}</span>
            </label>
          ))}
          {rejectReason === '직접 입력' && (
            <textarea className="input h-24 resize-none" placeholder="반려 사유를 직접 입력하세요." value={customReason} onChange={e => setCustomReason(e.target.value)} />
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setRejectModal(false)} className="btn-secondary flex-1">취소</button>
            <button onClick={handleReject} className="btn-danger flex-1">반려 처리</button>
          </div>
        </div>
      </Modal>

      {/* Suspend Modal */}
      <Modal open={suspendModal} onClose={() => setSuspendModal(false)} title="이용정지 사유 입력">
        <div className="space-y-3">
          <textarea className="input h-28 resize-none" placeholder="이용정지 사유를 입력하세요. (필수)" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setSuspendModal(false)} className="btn-secondary flex-1">취소</button>
            <button onClick={handleSuspend} className="btn-warning flex-1">이용정지</button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
