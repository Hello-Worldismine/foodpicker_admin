import { useEffect, useState } from 'react';
import { Search, Star, ImageIcon } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { fetchReviews, moderateReview } from '../lib/api';
import type { Review, ReviewStatus } from '../types';

const PAGE_SIZE = 7;

const isHidden = (s: ReviewStatus) => s === '숨김' || s === '신고검토-숨김';
const isDeleted = (s: ReviewStatus) => s === '삭제' || s === '신고검토-삭제';
const isPendingReview = (s: ReviewStatus) => s === '신고검토';

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 목록: `admin_reviews` 뷰 조회(fetchReviews) — product_name/store_name/reviewer_name/report_count 등 뷰 전용 필드 포함.
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | '전체'>('전체');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Review | null>(null);
  const [memo, setMemo] = useState('');
  const { download, isLoading, toast, canDownload } = useExcelDownload();

  useEffect(() => {
    let cancelled = false;
    fetchReviews()
      .then(rows => { if (!cancelled) setReviews(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 선택 리뷰 변경 시 메모 입력값을 해당 리뷰의 저장된 메모로 리셋
  const selectReview = (r: Review) => {
    setSelected(r);
    setMemo(r.memo ?? '');
  };

  const filtered = reviews.filter(r => {
    const matchSearch = r.productName.includes(search) || r.storeName.includes(search) || r.buyerName.includes(search);
    const matchStatus = statusFilter === '전체' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExcelDownload = () => {
    const filters = [
      search && `검색: ${search}`,
      statusFilter !== '전체' && `상태: ${statusFilter}`,
    ].filter(Boolean).join(', ');

    download({
      filename: 'reviews',
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

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="상품명, 매장명, 구매자 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
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
                  {['상품명', '매장명', '구매자', '별점', '사진', '작성일', '신고수', '상태', '답글', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={10}><EmptyState /></td></tr>
                ) : paginated.map(r => (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors ${selected?.id === r.id ? 'bg-primary-light' : ''}`}
                    onClick={() => selectReview(r)}
                  >
                    <td className="px-4 py-3 font-medium max-w-32 truncate">{r.productName}</td>
                    <td className="px-4 py-3 text-gray-600">{r.storeName}</td>
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
            <Pagination page={page} totalPages={Math.ceil(filtered.length / PAGE_SIZE)} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
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
