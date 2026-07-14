import { useEffect, useState } from 'react';
import { Search, Eye, CheckCircle, XCircle, EyeOff, AlertTriangle } from 'lucide-react';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { fetchProducts, setProductStatus } from '../lib/api';
import type { Product, ProductStatus } from '../types';

// 판매자 앱은 상품 등록 즉시 '판매중' 상태로 게시하므로(사전 검수 단계 없음),
// 실제 product_status enum과 동일한 4개 상태만 관리자가 다룬다.
/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 목록: fetchProducts() → admin_products 뷰(products + 매장명/신고수 조인)
 * - 숨김/판매중지/판매 재개: setProductStatus(id, '숨김'|'판매중지'|'판매중', reason?) → admin_set_product_status RPC(감사 로그 서버 자동 기록)
 *   판매 재개 시 서버가 소비기한 경과 여부를 재검증하고, 재고 0이면 트리거가 품절로 전환하므로 성공 후 목록을 전체 refetch 한다.
 * 참고: 자동할인(startPrice/floorPrice/reductionAmount/intervalMinutes)은 판매자 앱이 스케줄링하는 필드로, 관리자는 조회만 한다.
 */
const STATUS_OPTIONS: ProductStatus[] = ['판매중', '품절', '판매중지', '숨김'];
const PAGE_SIZE = 6;

function isExpired(expiryDate: string) {
  return new Date(expiryDate) < new Date();
}

function isPickupAfterExpiry(pickupEnd: string, expiryDate: string, productDate: string) {
  const base = productDate.split(' ')[0];
  const pickupEndTime = new Date(`${base} ${pickupEnd}`);
  const expiry = new Date(expiryDate);
  return pickupEndTime > expiry;
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | '전체'>('전체');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Product | null>(null);
  const [actionModal, setActionModal] = useState<'hide' | 'stop' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const { download, isLoading, toast, canDownload } = useExcelDownload();

  useEffect(() => {
    let cancelled = false;
    fetchProducts()
      .then(rows => { if (!cancelled) setProducts(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categories = ['전체', ...new Set(products.map(p => p.category))];

  const filtered = products.filter(p => {
    const matchSearch = p.name.includes(search) || p.storeName.includes(search);
    const matchStatus = statusFilter === '전체' || p.status === statusFilter;
    const matchCategory = categoryFilter === '전체' || p.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExcelDownload = () => {
    const filters = [
      search && `검색: ${search}`,
      statusFilter !== '전체' && `상태: ${statusFilter}`,
      categoryFilter !== '전체' && `카테고리: ${categoryFilter}`,
    ].filter(Boolean).join(', ');

    download({
      filename: 'products',
      menu: '상품 관리',
      filters,
      sheets: [{
        name: '상품 목록',
        data: filtered.map(p => ({
          '상품명': p.name,
          '매장명': p.storeName,
          '카테고리': p.category,
          '정가(원)': p.originalPrice,
          '판매가(원)': p.salePrice,
          '할인율(%)': p.discountRate,
          '재고': p.stock,
          '소비기한': p.expiryDate,
          '픽업시작': p.pickupStart,
          '픽업종료': p.pickupEnd,
          '보관방법': p.storageDetail ? `${p.storage}(${p.storageDetail})` : p.storage,
          '알레르기정보': p.allergyInfo,
          '원산지': p.originInfo,
          '상태': p.status,
          '신고수': p.reportCount,
          '등록일': p.registeredAt,
          '수정일': p.updatedAt,
        })),
      }],
    });
  };

  // 상태 변경 후 전체 refetch: 서버 트리거(재고 0 → 품절 등)가 반영된 최신 목록으로 갱신
  const refetchProducts = async (selectedId?: string) => {
    const rows = await fetchProducts();
    setProducts(rows);
    if (selectedId) setSelected(rows.find(p => p.id === selectedId) ?? null);
  };

  const handleResume = async (product: Product) => {
    if (isExpired(product.expiryDate)) {
      alert('소비기한이 경과된 상품은 판매 재개할 수 없습니다.');
      return;
    }
    try {
      // 서버(RPC)가 소비기한 경과 여부를 다시 검증한다.
      await setProductStatus(product.id, '판매중');
      await refetchProducts(product.id);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const handleAction = async () => {
    if (!selected || !actionReason.trim()) return alert('사유를 입력해주세요.');
    const nextStatus: ProductStatus = actionModal === 'hide' ? '숨김' : '판매중지';
    try {
      await setProductStatus(selected.id, nextStatus, actionReason);
      setActionModal(null);
      setActionReason('');
      await refetchProducts(selected.id);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const getWarnings = (p: Product) => {
    const warnings: string[] = [];
    if (isExpired(p.expiryDate)) warnings.push('소비기한 경과');
    if (isPickupAfterExpiry(p.pickupEnd, p.expiryDate, p.registeredAt)) warnings.push('픽업종료 > 소비기한');
    if (p.reportCount >= 3) warnings.push(`신고 ${p.reportCount}건`);
    if (p.salePrice === 0) warnings.push('판매가 0원');
    return warnings;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="상품명, 매장명 검색" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-36" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as ProductStatus | '전체'); setPage(1); }}>
            <option value="전체">전체 상태</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input w-32" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
                  {['상품명', '매장명', '카테고리', '정가', '판매가', '할인율', '재고', '소비기한', '상태', '신고', '관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11}><div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div></td></tr>
                ) : loadError ? (
                  <tr><td colSpan={11}><div className="py-16 text-center text-sm text-alert-red">{loadError}</div></td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={11}><EmptyState /></td></tr>
                ) : paginated.map(product => {
                  const warnings = getWarnings(product);
                  return (
                    <tr
                      key={product.id}
                      className={`border-b border-gray-50 hover:bg-soft-gray/50 cursor-pointer transition-colors ${selected?.id === product.id ? 'bg-primary-light' : ''}`}
                      onClick={() => setSelected(product)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-charcoal">{product.name}</span>
                          {warnings.length > 0 && <AlertTriangle size={13} className="text-warm-orange flex-shrink-0" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{product.storeName}</td>
                      <td className="px-4 py-3 text-gray-500">{product.category}</td>
                      <td className="px-4 py-3 text-gray-500 line-through">{product.originalPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">{product.salePrice.toLocaleString()}원</td>
                      <td className="px-4 py-3 text-primary font-semibold">{product.discountRate}%</td>
                      <td className="px-4 py-3 text-gray-600">{product.stock}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{product.expiryDate}</td>
                      <td className="px-4 py-3"><Badge type="product">{product.status}</Badge></td>
                      <td className="px-4 py-3"><span className={product.reportCount >= 3 ? 'text-alert-red font-semibold' : 'text-gray-600'}>{product.reportCount}</span></td>
                      <td className="px-4 py-3">
                        <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={e => { e.stopPropagation(); setSelected(product); }}>
                          <Eye size={13} /> 상세
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
              <h3 className="font-semibold text-charcoal truncate pr-4">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-charcoal text-xl leading-none flex-shrink-0">×</button>
            </div>
            <div className="p-5 space-y-5">
              {/* Warnings */}
              {getWarnings(selected).length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-alert-red mb-1 flex items-center gap-1"><AlertTriangle size={12} /> 자동 차단 조건</p>
                  {getWarnings(selected).map((w, i) => <p key={i} className="text-xs text-alert-red">• {w}</p>)}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {selected.status === '판매중' && (
                  <>
                    <button onClick={() => setActionModal('hide')} className="btn-secondary flex-1 flex items-center justify-center gap-1 text-xs">
                      <EyeOff size={13} /> 숨김
                    </button>
                    <button onClick={() => setActionModal('stop')} className="btn-danger flex-1 flex items-center justify-center gap-1 text-xs">
                      <XCircle size={13} /> 판매중지
                    </button>
                  </>
                )}
                {(selected.status === '숨김' || selected.status === '판매중지') && (
                  <button onClick={() => handleResume(selected)} className="btn-primary w-full flex items-center justify-center gap-1 text-xs">
                    <CheckCircle size={13} /> 판매 재개
                  </button>
                )}
              </div>

              {/* Product Info */}
              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">상품 정보</p>
                <div className="space-y-2 text-sm">
                  {[
                    ['매장명', selected.storeName],
                    ['카테고리', selected.category],
                    ['상태', <Badge type="product">{selected.status}</Badge>],
                    ['정가', `${selected.originalPrice.toLocaleString()}원`],
                    ['판매가', `${selected.salePrice.toLocaleString()}원`],
                    ['할인율', `${selected.discountRate}%`],
                    ['재고', `${selected.stock}개`],
                    ['소비기한', selected.expiryDate],
                    ['픽업 시작', selected.pickupStart],
                    ['픽업 종료', selected.pickupEnd],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-charcoal text-right">{value as React.ReactNode}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">식품 정보</p>
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-500">보관 방법</span><p className="text-charcoal">{selected.storage}{selected.storageDetail ? ` · ${selected.storageDetail}` : ''}</p></div>
                  <div><span className="text-gray-500">알레르기</span><p className="text-charcoal">{selected.allergyInfo || '없음'}</p></div>
                  <div><span className="text-gray-500">원산지</span><p className="text-charcoal">{selected.originInfo}</p></div>
                </div>
              </section>

              {selected.floorPrice != null && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">자동 할인 설정</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">시작가</span><span className="text-charcoal">{selected.startPrice?.toLocaleString()}원</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">최저가</span><span className="text-charcoal">{selected.floorPrice.toLocaleString()}원</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">할인 주기</span><span className="text-charcoal">{selected.intervalMinutes}분마다 {selected.reductionAmount?.toLocaleString()}원씩 인하</span></div>
                  </div>
                </section>
              )}

              {selected.description && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">상품 설명</p>
                  <p className="text-sm text-charcoal bg-soft-gray rounded-lg p-3">{selected.description}</p>
                </section>
              )}

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

      {/* Action Modal */}
      <Modal
        open={!!actionModal}
        onClose={() => { setActionModal(null); setActionReason(''); }}
        title={actionModal === 'hide' ? '숨김 사유 입력' : '판매중지 사유 입력'}
      >
        <div className="space-y-3">
          <textarea
            className="input h-28 resize-none"
            placeholder="사유를 입력하세요. (필수)"
            value={actionReason}
            onChange={e => setActionReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => { setActionModal(null); setActionReason(''); }} className="btn-secondary flex-1">취소</button>
            <button onClick={handleAction} className="btn-danger flex-1">
              {actionModal === 'hide' ? '숨김 처리' : '판매중지'}
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
