import { useEffect, useState } from 'react';
import { Search, Eye, CheckCircle, XCircle, Ban, Download, FileWarning, MapPin } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { fetchSellers, setStoreApproval, setStoreSuspension, setStoreCoords } from '../lib/api';
import { geocode, isMapKeyConfigured, isMapFatalError } from '../lib/naverGeocode';
import type { Seller, SellerStatus } from '../types';

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 목록: admin_stores 뷰(fetchSellers) — 검색/상태/지역 필터·페이지네이션은 클라이언트에서 처리.
 * - 승인/반려: admin_set_store_approval RPC(setStoreApproval), 이용정지/해제: admin_set_store_suspension RPC(setStoreSuspension).
 *   RPC가 감사 로그를 자동 기록하므로 별도 logAction 호출 불필요.
 * - 좌표 보정: 네이버 지도 SDK geocoder(브라우저)로 주소 → 위경도를 얻어 admin_set_store_coords RPC(setStoreCoords)로 저장.
 *   판매자앱 지오코딩이 배포되지 않아 lat/lng 가 null 인 매장은 사용자앱 지도에 핀이 뜨지 않는다 — 여기서 백필한다.
 *   RPC 가 감사 로그를 기록하고, 서버 트리거가 해당 매장의 상품 픽업 좌표까지 자동 동기화한다.
 * ⚠️ 보안: residentNumberMasked(주민번호)는 마스킹된 값만 표시. bizCertImage 는 Storage URL(실서비스는 signed URL 권장).
 */
const STATUS_OPTIONS: SellerStatus[] = ['승인대기', '승인완료', '반려', '이용정지'];
const REJECT_REASONS = [
  '사업자등록증 정보가 불명확합니다.',
  '매장 주소 확인이 필요합니다.',
  '정산 계좌 정보가 일치하지 않습니다.',
  '제출 서류가 미비합니다.',
  '직접 입력',
];

const PAGE_SIZE = 6;

/** 좌표가 실제로 저장돼 있는가 — 둘 중 하나라도 null 이면 사용자앱 지도에서 제외된다. */
const hasCoords = (s: Seller) => s.lat != null && s.lng != null;
/** 목록/상세 표시용 좌표 문자열(소수점 6자리 ≈ 0.1m 해상도). */
const fmtCoords = (s: Seller) => `${Number(s.lat).toFixed(6)}, ${Number(s.lng).toFixed(6)}`;

/** 일괄 보정 실패 항목 — 어떤 매장이 왜 실패했는지 운영자가 바로 후속 조치할 수 있게 주소까지 남긴다. */
interface CoordFail {
  name: string;
  address: string;
  reason: string;
}

export default function SellerManagement() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
  // 좌표 보정 관련 — mapFatal 은 '키 미설정/인증 실패' 처럼 재시도해도 소용없는 원인을 화면에 노출하기 위한 것.
  const [mapFatal, setMapFatal] = useState('');
  const [geoBusyId, setGeoBusyId] = useState<string | null>(null);
  const [coordModal, setCoordModal] = useState(false);
  const [coordRunning, setCoordRunning] = useState(false);
  const [coordProgress, setCoordProgress] = useState({ done: 0, total: 0, ok: 0 });
  const [coordFails, setCoordFails] = useState<CoordFail[]>([]);
  const { download, isLoading, toast, canDownload } = useExcelDownload();

  const mapKeyReady = isMapKeyConfigured();
  // 좌표가 없고 주소는 있는 매장 = 일괄 보정 대상(주소가 비면 지오코딩 자체가 불가능하다).
  const coordTargets = sellers.filter(s => !hasCoords(s) && s.address.trim() !== '');
  // 버튼을 조용히 죽이지 않고 '왜 못 쓰는지'를 그대로 보여준다.
  const mapBlockReason = !mapKeyReady
    ? '지도 키 미설정 — .env 의 VITE_NAVER_MAP_CLIENT_ID 를 설정하세요.'
    : mapFatal;

  useEffect(() => {
    let cancelled = false;
    fetchSellers()
      .then(rows => { if (!cancelled) setSellers(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const regionOptions = ['전체', ...new Set(sellers.map(s => s.region).filter(r => r && r !== '전체'))];

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
          // 좌표 미등록 매장은 사용자앱 지도에서 빠지므로 다운로드본에서도 바로 식별할 수 있게 남긴다.
          '위도': s.lat ?? '',
          '경도': s.lng ?? '',
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

  // RPC 반환값은 뷰 전용 필드(email/totalOrders 등)가 비어 있으므로 status/memo 만 기존 항목에 병합한다.
  const updateStatus = (id: string, status: SellerStatus, memo?: string) => {
    setSellers(prev => prev.map(s => s.id === id ? { ...s, status, memo: memo ?? s.memo } : s));
    setSelected(prev => prev && prev.id === id ? { ...prev, status, memo: memo ?? prev.memo } : prev);
  };

  const handleApprove = async (seller: Seller) => {
    try {
      const updated = seller.status === '이용정지'
        ? await setStoreSuspension(seller.id, false)
        : await setStoreApproval(seller.id, 'approved');
      updateStatus(seller.id, updated.status, updated.memo);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    const reason = rejectReason === '직접 입력' ? customReason : rejectReason;
    if (!reason) return alert('반려 사유를 선택해주세요.');
    try {
      const updated = await setStoreApproval(selected.id, 'rejected', reason);
      updateStatus(selected.id, updated.status, updated.memo);
      setRejectModal(false);
      setRejectReason('');
      setCustomReason('');
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  // 좌표는 RPC 반환값 중 유일하게 신뢰할 수 있는 필드라 lat/lng 만 병합한다(뷰 전용 필드는 비어 있음).
  const applyCoords = (id: string, lat: number, lng: number) => {
    setSellers(prev => prev.map(s => s.id === id ? { ...s, lat, lng } : s));
    setSelected(prev => prev && prev.id === id ? { ...prev, lat, lng } : prev);
  };

  /** 단건 보정 — 상세 패널의 [주소로 좌표 찾기]. */
  const handleFindCoords = async (seller: Seller) => {
    if (!seller.address.trim()) return alert('매장 주소가 없어 좌표를 찾을 수 없습니다.');
    setGeoBusyId(seller.id);
    try {
      const coords = await geocode(seller.address);
      if (!coords) {
        alert(`주소로 좌표를 찾지 못했습니다.\n주소: ${seller.address}\n도로명 주소인지 확인해주세요.`);
        return;
      }
      const updated = await setStoreCoords(seller.id, coords.lat, coords.lng);
      applyCoords(seller.id, updated.lat ?? coords.lat, updated.lng ?? coords.lng);
    } catch (e) {
      const message = (e as Error).message ?? '알 수 없는 오류';
      if (isMapFatalError(e)) setMapFatal(message);
      alert('좌표 보정 실패: ' + message);
    } finally {
      setGeoBusyId(null);
    }
  };

  /**
   * 일괄 보정 — 좌표가 없고 주소가 있는 매장을 순차 처리한다.
   * 개별 실패(주소 검색 실패·RPC 거부)는 목록에 모아두고 계속 진행하되,
   * 지도 SDK 자체가 못 쓰는 오류(키 미설정·인증 실패)는 나머지도 전부 같은 이유로 실패하므로 즉시 중단한다.
   */
  const handleBulkCoords = async () => {
    if (coordTargets.length === 0) {
      return alert('좌표를 보정할 매장이 없습니다. (주소가 비어 있는 매장은 대상에서 제외됩니다)');
    }
    const targets = [...coordTargets];
    setMapFatal('');
    setCoordFails([]);
    setCoordProgress({ done: 0, total: targets.length, ok: 0 });
    setCoordRunning(true);
    setCoordModal(true);

    let done = 0;
    let ok = 0;
    const fails: CoordFail[] = [];
    for (const seller of targets) {
      try {
        const coords = await geocode(seller.address);
        if (!coords) {
          fails.push({ name: seller.storeName, address: seller.address, reason: '주소 검색 결과 없음' });
        } else {
          await setStoreCoords(seller.id, coords.lat, coords.lng);
          applyCoords(seller.id, coords.lat, coords.lng);
          ok += 1;
        }
      } catch (e) {
        const message = (e as Error).message ?? '알 수 없는 오류';
        if (isMapFatalError(e)) {
          setMapFatal(message);
          break;
        }
        fails.push({ name: seller.storeName, address: seller.address, reason: message });
      }
      done += 1;
      setCoordProgress({ done, total: targets.length, ok });
      setCoordFails([...fails]);
    }
    setCoordFails([...fails]);
    setCoordRunning(false);
  };

  const handleSuspend = async () => {
    if (!selected || !suspendReason.trim()) return alert('이용정지 사유를 입력해주세요.');
    try {
      const updated = await setStoreSuspension(selected.id, true, suspendReason.trim());
      updateStatus(selected.id, updated.status, updated.memo);
      setSuspendModal(false);
      setSuspendReason('');
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
            <input className="input pl-9" placeholder="매장명, 대표자명, 사업자번호 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-36" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as SellerStatus | '전체'); setPage(1); }}>
            <option value="전체">전체 상태</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input w-40" value={regionFilter} onChange={e => { setRegionFilter(e.target.value); setPage(1); }}>
            {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={handleBulkCoords}
            disabled={!!mapBlockReason || coordRunning || coordTargets.length === 0}
            title={mapBlockReason || (coordTargets.length === 0 ? '좌표 미등록 매장이 없습니다.' : '')}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MapPin size={14} />
            매장 좌표 일괄 보정{coordTargets.length > 0 ? ` (${coordTargets.length})` : ''}
          </button>
          <ExcelDownloadButton onClick={handleExcelDownload} isLoading={isLoading} hidden={!canDownload} />
        </div>
        {/* 버튼을 조용히 비활성화만 하지 않고 원인을 그대로 노출한다. */}
        {mapBlockReason && (
          <p className="mt-2 text-xs text-alert-red">지도 기능 사용 불가: {mapBlockReason}</p>
        )}
      </div>

      <div className="flex gap-4">
        {/* List */}
        <div className={`card flex-1 overflow-hidden ${selected ? 'hidden xl:block' : ''}`}>
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : loadError ? (
            <div className="py-16 text-center text-sm text-alert-red">{loadError}</div>
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  {['매장명', '대표자', '사업자번호', '지역', '상태', '좌표', '가입일', '주문수', '신고수', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={10}><EmptyState /></td></tr>
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
                    {/* 좌표 미등록 = 사용자앱 지도에 핀이 뜨지 않는 매장 */}
                    <td className="px-4 py-3">
                      {hasCoords(seller)
                        ? <Badge variant="green">있음</Badge>
                        : <Badge variant="red">없음</Badge>}
                    </td>
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
          </>
          )}
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
                <p className="text-sm text-charcoal">{selected.address || '-'}</p>
                {/* 좌표는 사용자앱 지도 노출의 전제조건이다 — 없으면 원인과 조치 버튼을 함께 보여준다. */}
                <div className="mt-2">
                  {hasCoords(selected) ? (
                    <p className="text-xs text-gray-500 font-mono">좌표 {fmtCoords(selected)}</p>
                  ) : (
                    <p className="text-xs text-alert-red">좌표 미등록 — 사용자 지도에 표시되지 않습니다</p>
                  )}
                  <button
                    onClick={() => handleFindCoords(selected)}
                    disabled={!!mapBlockReason || geoBusyId === selected.id || !selected.address.trim()}
                    title={mapBlockReason || (!selected.address.trim() ? '매장 주소가 없습니다.' : '')}
                    className="btn-secondary mt-2 w-full flex items-center justify-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MapPin size={13} />
                    {geoBusyId === selected.id
                      ? '좌표 찾는 중...'
                      : hasCoords(selected) ? '주소로 좌표 다시 찾기' : '주소로 좌표 찾기'}
                  </button>
                  {mapBlockReason && <p className="mt-1 text-xs text-alert-red">{mapBlockReason}</p>}
                </div>
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

      {/* 좌표 일괄 보정 진행 모달 — 진행 중에는 닫아도 작업은 계속 진행된다(상태만 백그라운드로 갱신). */}
      <Modal
        open={coordModal}
        onClose={() => { if (!coordRunning) setCoordModal(false); }}
        title="매장 좌표 일괄 보정"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">{coordRunning ? '보정 중...' : '완료'}</span>
              <span className="font-medium text-charcoal">
                {coordProgress.done} / {coordProgress.total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${coordProgress.total ? (coordProgress.done / coordProgress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              성공 {coordProgress.ok}건 / 실패 {coordFails.length}건
            </p>
          </div>

          {mapFatal && (
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-alert-red">
                지도 SDK 오류로 중단되었습니다: {mapFatal}
              </p>
            </div>
          )}

          {coordFails.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">실패 목록</p>
              <div className="max-h-56 overflow-y-auto space-y-2">
                {coordFails.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="bg-soft-gray rounded-lg p-3">
                    <p className="text-sm font-medium text-charcoal">{f.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{f.address || '(주소 없음)'}</p>
                    <p className="text-xs text-alert-red mt-0.5">{f.reason}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                실패 건은 매장 주소를 도로명 주소로 수정한 뒤 상세 패널의 [주소로 좌표 찾기]로 개별 처리하세요.
              </p>
            </div>
          )}

          <button
            onClick={() => setCoordModal(false)}
            disabled={coordRunning}
            className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {coordRunning ? '진행 중...' : '닫기'}
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
