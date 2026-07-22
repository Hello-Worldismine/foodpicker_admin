import { useEffect, useState } from 'react';
import { Search, Star, ImageIcon, ArrowLeft } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { fetchReviews, fetchStoreOptions, fetchFlaggedReviewCounts, moderateReview } from '../lib/api';
import type { Review, ReviewStatus, StoreOption } from '../types';

const STORE_PAGE_SIZE = 10;
const REVIEW_PAGE_SIZE = 7;

const isHidden = (s: ReviewStatus) => s === '숨김' || s === '신고검토-숨김';
const isDeleted = (s: ReviewStatus) => s === '삭제' || s === '신고검토-삭제';
const isPendingReview = (s: ReviewStatus) => s === '신고검토';

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료. 매장별 리뷰 보기(2단계 드릴다운) 구조.
 * - 1단계(매장 선택): `admin_stores` 경량 조회(fetchStoreOptions) — 매장명/카테고리/주소 부분일치 검색(클라이언트 필터),
 *   리뷰수 내림차순 정렬. 매장 행 클릭 시 해당 매장 리뷰 목록으로 진입.
 * - 2단계(리뷰 목록): `admin_reviews` 뷰 조회(fetchReviews(storeId)) — store_id 필터 + 최신순(created_at desc).
 *   product_name/reviewer_name/report_count 등 뷰 전용 필드 포함. 매장 전환 시 검색/필터/선택/페이지 상태 전체 리셋.
 * - 모더레이션/메모: `admin_moderate_review` RPC(moderateReview) — 상태 7종(정상/숨김/삭제/신고검토/신고검토-*)과
 *   관리자 메모를 서버에 기록하며 감사 로그도 서버에서 자동 남김. RPC 반환 행에는 뷰 전용 필드가 없을 수 있으므로
 *   로컬 상태에는 변경 필드(status/memo)만 스프레드 병합한다.
 * - 신고검토-* 3종은 "신고 접수 후 검토를 거친 결과"를 구분하기 위한 값으로, 정상/숨김/삭제와 실제 노출 동작은 동일.
 */

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={12} className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
      ))}
    </div>
  );
}

export default function ReviewManagement() {
  // ── 1단계: 매장 선택 상태
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [storePage, setStorePage] = useState(1);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  // 매장별 '신고검토(대기)' 리뷰 수 — 어느 매장에 검토 대기 건이 있는지 목록에서 바로 보이게
  const [flaggedCounts, setFlaggedCounts] = useState<Map<string, number>>(new Map());

  // ── 2단계: 선택 매장의 리뷰 목록 상태
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | '전체'>('전체');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Review | null>(null);
  const [memo, setMemo] = useState('');
  const { download, isLoading, toast, canDownload } = useExcelDownload();

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchStoreOptions(), fetchFlaggedReviewCounts()])
      .then(([rows, counts]) => { if (!cancelled) { setStores(rows); setFlaggedCounts(counts); } })
      .catch(e => { if (!cancelled) setStoresError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setStoresLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 매장 선택 시 해당 매장 리뷰 로드(최신순은 서버 쿼리에서 보장)
  useEffect(() => {
    if (!selectedStore) return;
    let cancelled = false;
    setReviewsLoading(true);
    setReviewsError('');
    fetchReviews(selectedStore.id)
      .then(rows => { if (!cancelled) setReviews(rows); })
      .catch(e => { if (!cancelled) setReviewsError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setReviewsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedStore]);

  // 매장 전환/이탈 시 리뷰 화면 상태 전체 리셋
  const resetReviewState = () => {
    setReviews([]);
    setSelected(null);
    setMemo('');
    setSearch('');
    setStatusFilter('전체');
    setPage(1);
    setReviewsError('');
  };

  const selectStore = (store: StoreOption) => {
    resetReviewState();
    setReviewsLoading(true); // 이펙트 실행 전 1프레임 동안 이전 매장의 빈/에러 상태가 비치지 않게 동기 세팅
    setSelectedStore(store);
  };

  const backToStores = () => {
    resetReviewState();
    setSelectedStore(null);
  };

  // 선택 리뷰 변경 시 메모 입력값을 해당 리뷰의 저장된 메모로 리셋
  const selectReview = (r: Review) => {
    setSelected(r);
    setMemo(r.memo ?? '');
  };

  // 매장 검색: 매장명/카테고리/주소 부분일치. 신고검토 대기 매장 우선, 그다음 리뷰수 내림차순
  const filteredStores = stores
    .filter(s => s.name.includes(storeSearch) || s.category.includes(storeSearch) || s.address.includes(storeSearch))
    .sort((a, b) =>
      (flaggedCounts.get(b.id) ?? 0) - (flaggedCounts.get(a.id) ?? 0) || b.reviewCount - a.reviewCount);
  const paginatedStores = filteredStores.slice((storePage - 1) * STORE_PAGE_SIZE, storePage * STORE_PAGE_SIZE);

  const filtered = reviews.filter(r => {
    const matchSearch = r.productName.includes(search) || r.buyerName.includes(search);
    const matchStatus = statusFilter === '전체' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * REVIEW_PAGE_SIZE, page * REVIEW_PAGE_SIZE);

  const handleExcelDownload = () => {
    if (!selectedStore) return;
    const filters = [
      `매장: ${selectedStore.name}`,
      search && `검색: ${search}`,
      statusFilter !== '전체' && `상태: ${statusFilter}`,
    ].filter(Boolean).join(', ');

    download({
      filename: `reviews_${selectedStore.name}`,
      menu: '리뷰 관리',
      filters,
      sheets: [{
        name: '리뷰 목록',
        data: filtered.map(r => ({
          '상품명': r.productName,
          '매장명': r.storeName,
          '구매자': r.buyerName,
          '별점': r.rating,
          '리뷰내용': r.content,
          '첨부사진 수': r.images?.length ?? 0,
          '작성일': r.writtenAt,
          '신고수': r.reportCount,
          '상태': r.status,
          '판매자 답글': r.ownerReply ?? '',
        })),
      }],
    });
  };

  const updateStatus = async (id: string, status: ReviewStatus) => {
    try {
      await moderateReview(id, status);
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const saveMemo = async () => {
    if (!selected) return;
    try {
      await moderateReview(selected.id, selected.status, memo);
      setReviews(prev => prev.map(r => r.id === selected.id ? { ...r, memo } : r));
      setSelected(prev => prev ? { ...prev, memo } : null);
      alert('메모가 저장되었습니다.');
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  // ── 1단계: 매장 선택 화면
  if (!selectedStore) {
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="매장명, 카테고리, 주소 검색" value={storeSearch} onChange={e => { setStoreSearch(e.target.value); setStorePage(1); }} />
          </div>
        </div>

        <div className="card overflow-hidden">
          {storesLoading ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : storesError ? (
            <div className="py-16 text-center text-sm text-alert-red">{storesError}</div>
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  {['매장명', '카테고리', '주소', '평점', '리뷰수', '신고검토'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedStores.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState message="검색된 매장이 없습니다." /></td></tr>
                ) : paginatedStores.map(s => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors"
                    onClick={() => selectStore(s)}
                  >
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.category || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-72 truncate">{s.address || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <Star size={12} className="text-yellow-400 fill-yellow-400" /> {s.rating.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className={s.reviewCount > 0 ? 'font-semibold text-charcoal' : 'text-gray-400'}>{s.reviewCount}</span></td>
                    <td className="px-4 py-3">
                      {(flaggedCounts.get(s.id) ?? 0) > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-alert-red">
                          {flaggedCounts.get(s.id)}건 대기
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Pagination page={storePage} totalPages={Math.max(1, Math.ceil(filteredStores.length / STORE_PAGE_SIZE))} onPageChange={setStorePage} totalItems={filteredStores.length} pageSize={STORE_PAGE_SIZE} />
          </div>
          </>
          )}
        </div>

        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    );
  }

  // ── 2단계: 선택 매장 리뷰 목록 화면
  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <button onClick={backToStores} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors">
          <ArrowLeft size={16} /> 매장 목록
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <h2 className="font-semibold text-charcoal">{selectedStore.name}</h2>
        <span className="inline-flex items-center gap-1 text-sm text-gray-500">
          <Star size={13} className="text-yellow-400 fill-yellow-400" /> {selectedStore.rating.toFixed(1)}
        </span>
        <span className="text-sm text-gray-400">리뷰 {selectedStore.reviewCount}건</span>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="상품명, 구매자 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-40" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as ReviewStatus | '전체'); setPage(1); }}>
            <option value="전체">전체 상태</option>
            <optgroup label="정상">
              <option value="정상">정상</option>
              <option value="신고검토-정상">신고검토-정상</option>
            </optgroup>
            <optgroup label="숨김">
              <option value="숨김">숨김</option>
              <option value="신고검토-숨김">신고검토-숨김</option>
            </optgroup>
            <optgroup label="삭제">
              <option value="삭제">삭제</option>
              <option value="신고검토-삭제">신고검토-삭제</option>
            </optgroup>
            <option value="신고검토">신고검토 (대기중)</option>
          </select>
          <ExcelDownloadButton onClick={handleExcelDownload} isLoading={isLoading} hidden={!canDownload} />
        </div>
      </div>

      <div className="flex gap-4">
        <div className={`card flex-1 overflow-hidden ${selected ? 'hidden xl:block' : ''}`}>
          {reviewsLoading ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : reviewsError ? (
            <div className="py-16 text-center text-sm text-alert-red">{reviewsError}</div>
          ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  {['상품명', '구매자', '별점', '사진', '작성일', '신고수', '상태', '답글', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={9}><EmptyState message="등록된 리뷰가 없습니다." /></td></tr>
                ) : paginated.map(r => (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors ${selected?.id === r.id ? 'bg-primary-light' : ''}`}
                    onClick={() => selectReview(r)}
                  >
                    <td className="px-4 py-3 font-medium max-w-32 truncate">{r.productName}</td>
                    <td className="px-4 py-3">{r.buyerName}</td>
                    <td className="px-4 py-3"><Stars rating={r.rating} /></td>
                    <td className="px-4 py-3">
                      {r.images && r.images.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary-light rounded-full px-2 py-0.5">
                          <ImageIcon size={12} /> {r.images.length}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{r.writtenAt.slice(0, 10)}</td>
                    <td className="px-4 py-3"><span className={r.reportCount > 0 ? 'text-alert-red font-semibold' : 'text-gray-600'}>{r.reportCount}</span></td>
                    <td className="px-4 py-3"><Badge type="review">{r.status}</Badge></td>
                    <td className="px-4 py-3 text-gray-400">{r.ownerReply ? '있음' : '-'}</td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-primary hover:underline" onClick={e => { e.stopPropagation(); selectReview(r); }}>상세</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / REVIEW_PAGE_SIZE))} onPageChange={setPage} totalItems={filtered.length} pageSize={REVIEW_PAGE_SIZE} />
          </div>
          </>
          )}
        </div>

        {selected && (
          <div className="card w-full xl:w-96 flex-shrink-0 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-charcoal truncate pr-4">{selected.productName}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-charcoal text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <Stars rating={selected.rating} />
                <Badge type="review">{selected.status}</Badge>
              </div>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">리뷰 정보</p>
                <div className="space-y-1.5 text-sm">
                  {[['상품', selected.productName], ['매장', selected.storeName], ['구매자', selected.buyerName], ['작성일', selected.writtenAt], ['신고수', `${selected.reportCount}건`]].map(([l, v]) => (
                    <div key={l} className="flex justify-between"><span className="text-gray-500">{l}</span><span>{v}</span></div>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">리뷰 내용</p>
                <p className="text-sm text-charcoal bg-soft-gray rounded-lg p-3">{selected.content}</p>
              </section>

              {selected.images && selected.images.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">첨부 사진 ({selected.images.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.images.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-gray-100 hover:opacity-80 transition-opacity">
                        <img src={src} alt={`리뷰 첨부 사진 ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {selected.ownerReply && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">판매자 답글</p>
                  <p className="text-sm text-charcoal bg-primary-light rounded-lg p-3">{selected.ownerReply}</p>
                  {selected.ownerRepliedAt && <p className="text-xs text-gray-400 mt-1">{selected.ownerRepliedAt}</p>}
                </section>
              )}

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">관리자 메모</p>
                <textarea className="input h-20 resize-none text-sm" placeholder="관리자 메모 입력..." value={memo} onChange={e => setMemo(e.target.value)} />
                <button onClick={saveMemo} className="btn-secondary w-full text-xs mt-2">메모 저장</button>
              </section>

              {isPendingReview(selected.status) ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">신고 검토 결과를 선택하세요.</p>
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(selected.id, '신고검토-정상')} className="btn-primary flex-1 text-xs">문제없음</button>
                    <button onClick={() => updateStatus(selected.id, '신고검토-숨김')} className="btn-secondary flex-1 text-xs">숨김 처리</button>
                    <button onClick={() => { if (confirm('삭제 처리하시겠습니까?')) updateStatus(selected.id, '신고검토-삭제'); }} className="btn-danger flex-1 text-xs">삭제 처리</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {!isHidden(selected.status) && (
                    <button onClick={() => updateStatus(selected.id, '숨김')} className="btn-secondary flex-1 text-xs">숨김 처리</button>
                  )}
                  {isHidden(selected.status) && (
                    <button onClick={() => updateStatus(selected.id, '정상')} className="btn-primary flex-1 text-xs">숨김 해제</button>
                  )}
                  {!isDeleted(selected.status) && (
                    <button onClick={() => { if (confirm('삭제 처리하시겠습니까?')) updateStatus(selected.id, '삭제'); }} className="btn-danger flex-1 text-xs">삭제</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
