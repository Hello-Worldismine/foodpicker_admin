import { useState } from 'react';
import { Search, Star, ImageIcon } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { mockReviews } from '../data/mockData';
import type { Review, ReviewStatus } from '../types';

const PAGE_SIZE = 7;

const isHidden = (s: ReviewStatus) => s === '숨김' || s === '신고검토-숨김';
const isDeleted = (s: ReviewStatus) => s === '삭제' || s === '신고검토-삭제';
const isPendingReview = (s: ReviewStatus) => s === '신고검토';

/**
 * [백엔드 연동 안내] 현재 mockReviews(목데이터)로 동작 중. 실 서비스는 Supabase `reviews` 테이블(판매자 앱과 공유)에 대응됨.
 * - 목록/검색: GET /api/admin/reviews?search=&status=&page=
 * - ownerReply/ownerRepliedAt은 실 DB 컬럼(owner_reply, owner_replied_at)이 그대로 존재하므로 조회만 하면 됨.
 * ⚠️ status(정상/숨김/삭제/신고검토/신고검토-정상/신고검토-숨김/신고검토-삭제) 모더레이션 상태와 reportCount(신고수)는
 *    실 DB `reviews` 테이블에 대응 컬럼이 없음. 실 연동 전 백엔드에서 moderation_status, report_count 컬럼 추가
 *    또는 별도 review_reports 테이블 설계가 선행되어야 함.
 *    신고검토-* 3종은 "신고가 접수되어 검토를 거친 뒤의 결과"임을 구분하기 위한 값으로, 정상/숨김/삭제와 실제
 *    노출 동작은 동일하다(접두어 없는 값은 신고 없이 관리자가 바로 조치한 경우). 통계/감사 목적의 구분이므로
 *    moderation_status ENUM에 이 7개 값을 그대로 두거나, is_reported(boolean) + status(정상|숨김|삭제|신고검토) 조합으로
 *    설계해도 무방하다.
 * ⚠️ images(리뷰 사진)도 실 DB에 컬럼이 없음 — 사용자 앱에서 첨부 업로드를 지원하려면 reviews.images(text[]) 컬럼 추가 +
 *    Supabase Storage 버킷 연동이 선행되어야 함. 관리자는 신고 처리 시 증빙 사진 확인 용도로 조회만 하면 된다.
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
  const [reviews, setReviews] = useState<Review[]>(mockReviews);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | '전체'>('전체');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Review | null>(null);
  const [memo, setMemo] = useState('');
  const { download, isLoading, toast, canDownload } = useExcelDownload();

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

  const updateStatus = (id: string, status: ReviewStatus) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
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
                    onClick={() => setSelected(r)}
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
                      <button className="text-xs text-primary hover:underline" onClick={e => { e.stopPropagation(); setSelected(r); }}>상세</button>
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
