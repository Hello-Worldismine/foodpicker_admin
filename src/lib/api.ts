// 관리자 웹 데이터 계층: DB row(snake_case/영문 enum) ↔ 화면 타입(한글 라벨) 매퍼 + 쿼리/RPC.
// 읽기: admin_* 뷰(is_admin() 게이트) 또는 admin RLS 정책. 쓰기: 관리자 RPC(감사 로그 포함) 또는
// 관리자 전용 테이블 직접 CRUD. 마이그레이션: 20260716000000_admin.sql
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabase';
import {
  PRODUCT_STATUS_KO, PRODUCT_STATUS_EN, PAUSE_REASON_KO,
  ORDER_STATUS_KO, ORDER_STATUS_EN, PAYMENT_STATUS_KO,
  SETTLEMENT_STATUS_KO, SETTLEMENT_STATUS_EN,
  REPORT_STATUS_KO, REPORT_STATUS_EN, INQUIRER_TYPE_KO,
  REVIEW_STATUS_KO, REVIEW_STATUS_EN,
  ADMIN_ROLE_KO, ADMIN_ROLE_EN,
  COST_BEARER_KO, COST_BEARER_EN, DISCOUNT_TYPE_KO, DISCOUNT_TYPE_EN,
  COUPON_SOURCE_KO, COUPON_REQUEST_KO,
  BANNER_POSITION_KO, BANNER_POSITION_EN, NOTICE_TARGET_KO, NOTICE_TARGET_EN,
  fmtDate, fmtDateTime, fmtPickupWindow, regionFromAddress, maskResidentNumber,
} from './labels';
import type {
  Seller, SellerStatus, Product, Order, Settlement, Report, ReportStatus, Review, ReviewStatus,
  Banner, Notice, Category, Coupon, AdminAccount, AdminRole,
} from '../types';

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// ============================================================================
// 매퍼
// ============================================================================

function sellerStatusFrom(row: any): SellerStatus {
  // 이용정지 = 관리자 전용 플래그(suspended_by_admin). is_selling_paused 는 판매자 자율 일시중지라 별개.
  if (row.suspended_by_admin) return '이용정지';
  if (row.approval_status === 'pending') return '승인대기';
  if (row.approval_status === 'rejected') return '반려';
  return '승인완료';
}

export function mapSeller(row: any): Seller {
  return {
    id: row.id,
    sellerId: row.seller_id,
    storeName: row.name ?? '',
    ownerName: row.owner_name ?? '',
    bizNumber: row.biz_number ?? '',
    residentNumberMasked: row.resident_number ? maskResidentNumber(row.resident_number) : undefined,
    region: regionFromAddress(row.address),
    status: sellerStatusFrom(row),
    commissionRate: row.commission_rate ?? 10,
    bizCertImage: row.biz_cert_image ?? undefined,
    joinDate: fmtDate(row.created_at),
    totalOrders: row.total_orders ?? 0,
    reportCount: row.report_count ?? 0,
    phone: row.phone ?? '',
    email: row.email ?? '',
    address: row.address ?? '',
    bankName: row.bank_name ?? '',
    accountNumber: row.account_number ?? '',
    accountHolder: row.account_holder ?? '',
    categoryMain: row.category ?? '',
    memo: row.admin_memo ?? '',
  };
}

export function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name ?? '',
    storeName: row.store_name ?? '',
    sellerId: row.seller_id,
    category: row.category ?? '기타',
    originalPrice: row.original_price ?? 0,
    startPrice: row.start_price ?? undefined,
    floorPrice: row.floor_price ?? undefined,
    salePrice: row.sale_price ?? 0,
    discountRate: row.discount_rate ?? 0,
    reductionAmount: row.reduction_amount ?? undefined,
    intervalMinutes: row.interval_minutes ?? undefined,
    stock: row.stock ?? 0,
    expiryDate: fmtDateTime(row.expiry_date),
    pickupStart: row.pickup_start ? fmtDateTime(row.pickup_start).slice(11) : '',
    pickupEnd: row.pickup_end ? fmtDateTime(row.pickup_end).slice(11) : '',
    status: PRODUCT_STATUS_KO[row.status] ?? '판매중',
    pauseReason: row.pause_reason ? PAUSE_REASON_KO[row.pause_reason] : undefined,
    reportCount: row.report_count ?? 0,
    registeredAt: fmtDateTime(row.created_at),
    updatedAt: fmtDateTime(row.updated_at),
    storage: row.storage ?? '실온',
    storageDetail: row.storage_detail ?? undefined,
    allergyInfo: Array.isArray(row.allergens) && row.allergens.length > 0 ? row.allergens.join(', ') : '없음',
    originInfo: row.origin ?? '',
    description: row.description ?? '',
    imageUrl: row.thumbnail ?? (Array.isArray(row.images) ? row.images[0] : undefined) ?? '',
    memo: row.admin_memo ?? (row.status === 'hidden' ? row.reject_reason ?? '' : ''),
  };
}

export function mapOrder(row: any): Order {
  return {
    id: row.id,
    orderNumber: row.order_code ?? '',
    buyerName: row.buyer_name ?? '-',
    buyerId: row.buyer_id ?? '',
    safeNumber: row.safe_number ?? undefined,
    sellerName: row.store_name ?? '',
    sellerId: row.seller_id,
    productName: row.product_name ?? '',
    productId: row.product_id ?? '',
    amount: row.amount ?? 0,
    fee: row.fee ?? 0,
    totalPrice: row.total_price ?? 0,
    quantity: row.quantity ?? 1,
    status: ORDER_STATUS_KO[row.seller_status] ?? '신규접수',
    paymentStatus: PAYMENT_STATUS_KO[row.payment_status] ?? '결제완료',
    pickupTime: fmtPickupWindow(row.pickup_start, row.pickup_end),
    orderedAt: fmtDateTime(row.ordered_at),
    memo: row.admin_memo ?? undefined,
  };
}

export function mapReview(row: any): Review {
  return {
    id: row.id,
    productId: row.product_id ?? undefined,
    storeId: row.store_id ?? undefined,
    productName: row.product_name ?? '(삭제된 상품)',
    storeName: row.store_name ?? '',
    buyerName: row.reviewer_name ?? '',
    rating: row.rating ?? 0,
    content: row.content ?? '',
    images: Array.isArray(row.images) && row.images.length > 0 ? row.images : undefined,
    writtenAt: fmtDateTime(row.created_at),
    reportCount: row.report_count ?? 0,
    status: REVIEW_STATUS_KO[row.moderation_status] ?? '정상',
    ownerReply: row.owner_reply ?? undefined,
    ownerRepliedAt: row.owner_replied_at ? fmtDateTime(row.owner_replied_at) : undefined,
    memo: row.admin_memo ?? '',
  };
}

export function mapReport(row: any): Report {
  return {
    id: row.id,
    receiptNumber: row.receipt_code ?? '',
    inquirerType: INQUIRER_TYPE_KO[row.inquirer_type] ?? '사용자',
    type: row.type ?? '기타',
    orderNumber: row.order_code ?? undefined,
    buyerName: row.buyer_name ?? undefined,
    sellerName: row.store_name ?? '',
    title: row.title ?? '',
    content: row.content ?? '',
    evidence: Array.isArray(row.evidence) && row.evidence.length > 0 ? row.evidence : undefined,
    status: REPORT_STATUS_KO[row.status] ?? '접수',
    receivedAt: fmtDateTime(row.received_at),
    manager: row.manager ?? '미배정',
    memo: row.admin_memo ?? '',
  };
}

export function mapCoupon(row: any): Coupon {
  return {
    id: row.id,
    code: row.code ?? '',
    name: row.name ?? '',
    discountType: DISCOUNT_TYPE_KO[row.discount_type] ?? '정액',
    discountValue: row.discount_value ?? 0,
    maxDiscountAmount: row.max_discount_amount ?? undefined,
    minOrderAmount: row.min_order_amount ?? 0,
    startDate: row.starts_on ?? '',
    endDate: row.ends_on ?? '',
    target: row.seller_id ? '해당 매장' : (row.target ?? '전체'),
    totalQuantity: row.total_quantity ?? 0,
    usedQuantity: row.used_count ?? 0,
    active: row.is_active ?? false,
    costBearer: COST_BEARER_KO[row.cost_bearer] ?? '본사',
    platformShare: row.platform_share ?? undefined,
    allowStacking: row.allow_stacking ?? false,
    source: COUPON_SOURCE_KO[row.source] ?? '관리자 발행',
    sellerId: row.seller_id ?? undefined,
    sellerName: row.store_name ?? undefined,
    requestStatus: row.request_status ? COUPON_REQUEST_KO[row.request_status] : undefined,
    rejectReason: row.reject_reason ?? undefined,
  };
}

export function mapBanner(row: any): Banner {
  return {
    id: row.id,
    title: row.title ?? '',
    imageUrl: row.image_url ?? '',
    link: row.link ?? '',
    position: BANNER_POSITION_KO[row.position] ?? '메인 상단',
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    active: row.is_active ?? false,
  };
}

export function mapNotice(row: any): Notice {
  return {
    id: row.id,
    title: row.title ?? '',
    content: row.content ?? '',
    target: NOTICE_TARGET_KO[row.target] ?? '전체',
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    important: row.is_important ?? false,
    active: row.is_published ?? false,
    createdAt: fmtDate(row.created_at),
  };
}

export function mapCategory(row: any, productCount = 0): Category {
  return {
    id: row.id,
    name: row.name ?? '',
    icon: row.icon ?? '📦',
    productCount,
    active: row.is_active ?? false,
    order: row.display_order ?? 0,
  };
}

export function mapAdmin(row: any): AdminAccount {
  return {
    id: row.user_id,
    name: row.name ?? '',
    email: row.email ?? '',
    role: ADMIN_ROLE_KO[row.role] ?? '읽기전용',
    status: row.is_active ? '활성' : '비활성',
    lastLogin: row.last_login_at ? fmtDateTime(row.last_login_at) : '-',
    createdAt: fmtDate(row.created_at),
  };
}

// ============================================================================
// 인증 / 관리자 프로필
// ============================================================================

export async function fetchMyAdminProfile(): Promise<AdminAccount | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('admin_profiles').select('*').eq('user_id', user.id).maybeSingle();
  throwIf(error);
  if (!data || !data.is_active) return null;
  return mapAdmin(data);
}

export async function touchAdminLogin(): Promise<void> {
  await supabase.rpc('touch_admin_login');
}

// ============================================================================
// 대시보드 / 환경 통계
// ============================================================================

export async function fetchDashboardStats(): Promise<any> {
  const { data, error } = await supabase.rpc('admin_dashboard_stats');
  throwIf(error);
  return data;
}

export async function fetchEnvStats(): Promise<any> {
  const { data, error } = await supabase.rpc('admin_env_stats');
  throwIf(error);
  return data;
}

// ============================================================================
// 판매자(매장)
// ============================================================================

export async function fetchSellers(): Promise<Seller[]> {
  const { data, error } = await supabase
    .from('admin_stores').select('*').order('created_at', { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapSeller);
}

export async function setStoreApproval(storeId: string, status: 'approved' | 'pending' | 'rejected', reason?: string): Promise<Seller> {
  const { data, error } = await supabase.rpc('admin_set_store_approval', {
    p_store_id: storeId, p_status: status, p_reason: reason ?? null,
  });
  throwIf(error);
  return mapSeller(data);
}

export async function setStoreSuspension(storeId: string, suspended: boolean, reason?: string): Promise<Seller> {
  const { data, error } = await supabase.rpc('admin_set_store_suspension', {
    p_store_id: storeId, p_suspended: suspended, p_reason: reason ?? null,
  });
  throwIf(error);
  return mapSeller(data);
}

export async function setStoreMemo(storeId: string, memo: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_store_memo', { p_store_id: storeId, p_memo: memo });
  throwIf(error);
}

// ============================================================================
// 상품
// ============================================================================

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('admin_products').select('*').order('created_at', { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapProduct);
}

/** 상태 변경(한글 라벨 입력): '숨김'/'판매중지'/'판매중' */
export async function setProductStatus(productId: string, statusKo: Product['status'], reason?: string): Promise<Product> {
  const { data, error } = await supabase.rpc('admin_set_product_status', {
    p_product_id: productId, p_status: PRODUCT_STATUS_EN[statusKo], p_reason: reason ?? null,
  });
  throwIf(error);
  return mapProduct(data);
}

// ============================================================================
// 주문
// ============================================================================

export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders').select('*').order('ordered_at', { ascending: false }).limit(1000);
  throwIf(error);
  return (data ?? []).map(mapOrder);
}

export async function setOrderStatus(orderId: string, statusKo: Order['status'], reason: string): Promise<Order> {
  const { data, error } = await supabase.rpc('admin_set_order_status', {
    p_order_id: orderId, p_status: ORDER_STATUS_EN[statusKo], p_reason: reason,
  });
  throwIf(error);
  return mapOrder(data);
}

export async function refundOrder(orderId: string, reason?: string): Promise<Order> {
  const { data, error } = await supabase.rpc('admin_refund_order', {
    p_order_id: orderId, p_reason: reason ?? null,
  });
  throwIf(error);
  return mapOrder(data);
}

export async function setOrderMemo(orderId: string, memo: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_order_memo', { p_order_id: orderId, p_memo: memo });
  throwIf(error);
}

// ============================================================================
// 정산 — DB 는 주문 단위 행 → 판매자×기간 그룹으로 집계해 반환
// ============================================================================

export async function fetchSettlements(): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('admin_settlements').select('*').order('created_at', { ascending: false }).limit(2000);
  throwIf(error);

  const groups = new Map<string, any[]>();
  for (const row of data ?? []) {
    const key = `${row.seller_id}|${row.period_start ?? ''}|${row.period_end ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const result: Settlement[] = [];
  for (const [key, rows] of groups) {
    const first = rows[0];
    const sum = (f: (r: any) => number) => rows.reduce((acc, r) => acc + (f(r) || 0), 0);
    const statuses = new Set(rows.map(r => r.status));
    const status = statuses.has('on_hold') ? 'on_hold'
      : (statuses.size === 1 && statuses.has('completed')) ? 'completed' : 'scheduled';
    result.push({
      id: key,
      settlementIds: rows.map(r => r.id),
      sellerName: first.store_name ?? '',
      sellerId: first.seller_id,
      bizNumber: first.biz_number ?? '',
      period: first.period_start && first.period_end ? `${first.period_start} ~ ${first.period_end}` : '-',
      totalSales: sum(r => r.amount),
      platformFee: sum(r => r.platform_fee),
      pgFee: sum(r => r.pg_fee),
      commission: sum(r => r.fee),
      refundAmount: sum(r => r.refund),
      finalAmount: sum(r => r.settlement_amount),
      status: SETTLEMENT_STATUS_KO[status] ?? '정산예정',
      scheduledDate: first.settled_on ?? '',
      bankName: first.bank_name ?? '',
      accountNumber: first.account_number ?? '',
      accountHolder: first.account_holder ?? '',
      memo: rows.find(r => r.admin_memo)?.admin_memo ?? '',
    });
  }
  return result;
}

export async function setSettlementStatus(settlementIds: string[], statusKo: Settlement['status'], memo?: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_set_settlement_status', {
    p_ids: settlementIds, p_status: SETTLEMENT_STATUS_EN[statusKo], p_memo: memo ?? null,
  });
  throwIf(error);
  return data ?? 0;
}

// ============================================================================
// 신고/문의
// ============================================================================

export async function fetchReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports').select('*').order('received_at', { ascending: false }).limit(1000);
  throwIf(error);
  return (data ?? []).map(mapReport);
}

/** 전체 처리 이력을 reportId → ['[시각] 메시지'] 맵으로 로드 */
export async function fetchReportLogs(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('report_logs').select('*').order('created_at', { ascending: true }).limit(3000);
  throwIf(error);
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!map[row.report_id]) map[row.report_id] = [];
    const who = row.admin_name ? ` (${row.admin_name})` : '';
    map[row.report_id].push(`[${fmtDateTime(row.created_at)}] ${row.message}${who}`);
  }
  return map;
}

export async function updateReport(reportId: string, patch: { status?: ReportStatus; manager?: string; memo?: string }): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.status = REPORT_STATUS_EN[patch.status];
  if (patch.manager !== undefined) dbPatch.manager = patch.manager;
  if (patch.memo !== undefined) dbPatch.admin_memo = patch.memo;
  const { error } = await supabase.from('reports').update(dbPatch).eq('id', reportId);
  throwIf(error);
}

export async function addReportLog(reportId: string, adminName: string, kind: 'status' | 'reply' | 'refund' | 'memo' | 'system', message: string): Promise<void> {
  const { error } = await supabase.from('report_logs').insert({
    report_id: reportId, admin_name: adminName, kind, message,
  });
  throwIf(error);
}

export async function reportRefund(reportId: string, reason?: string): Promise<Report> {
  const { data, error } = await supabase.rpc('admin_report_refund', {
    p_report_id: reportId, p_reason: reason ?? null,
  });
  throwIf(error);
  return mapReport(data);
}

// ============================================================================
// 리뷰
// ============================================================================

export async function fetchReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('admin_reviews').select('*').order('created_at', { ascending: false }).limit(1000);
  throwIf(error);
  return (data ?? []).map(mapReview);
}

export async function moderateReview(reviewId: string, statusKo: ReviewStatus, memo?: string): Promise<Review> {
  const { data, error } = await supabase.rpc('admin_moderate_review', {
    p_review_id: reviewId, p_status: REVIEW_STATUS_EN[statusKo], p_memo: memo ?? null,
  });
  throwIf(error);
  return mapReview(data);
}

// ============================================================================
// 쿠폰
// ============================================================================

export async function fetchCoupons(): Promise<Coupon[]> {
  const { data, error } = await supabase
    .from('admin_coupons').select('*').order('created_at', { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapCoupon);
}

export interface CouponForm {
  code: string;
  name: string;
  discountType: '정액' | '정률';
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  startDate?: string;
  endDate?: string;
  target: string;
  totalQuantity?: number;
  costBearer: '본사' | '점주' | '분담';
  platformShare?: number;
  allowStacking: boolean;
}

export async function createCoupon(form: CouponForm): Promise<Coupon> {
  const { data, error } = await supabase.from('coupons').insert({
    code: form.code || null,
    name: form.name,
    discount_type: DISCOUNT_TYPE_EN[form.discountType],
    discount_value: form.discountValue,
    max_discount_amount: form.discountType === '정률' ? form.maxDiscountAmount ?? null : null,
    min_order_amount: form.minOrderAmount ?? 0,
    starts_on: form.startDate || null,
    ends_on: form.endDate || null,
    target: form.target || '전체',
    total_quantity: form.totalQuantity ?? null,
    cost_bearer: COST_BEARER_EN[form.costBearer],
    platform_share: form.costBearer === '분담' ? form.platformShare ?? 50 : null,
    allow_stacking: form.allowStacking,
    source: 'admin',
    is_active: true,
  }).select().single();
  throwIf(error);
  return mapCoupon(data);
}

export async function toggleCouponActive(couponId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('coupons').update({ is_active: isActive }).eq('id', couponId);
  throwIf(error);
}

/** 점주 신청 승인 — request_status 변경 시 DB 트리거가 판매자에게 알림 자동 발송 */
export async function approveCouponRequest(couponId: string): Promise<void> {
  const { error } = await supabase.from('coupons')
    .update({ request_status: 'approved', is_active: true, reject_reason: null })
    .eq('id', couponId);
  throwIf(error);
}

export async function rejectCouponRequest(couponId: string, reason: string): Promise<void> {
  const { error } = await supabase.from('coupons')
    .update({ request_status: 'rejected', is_active: false, reject_reason: reason })
    .eq('id', couponId);
  throwIf(error);
}

// ============================================================================
// 배너 / 공지 / 카테고리
// ============================================================================

export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await supabase
    .from('banners').select('*').order('created_at', { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapBanner);
}

export interface BannerForm {
  title: string; imageUrl: string; link: string;
  position: string; startDate: string; endDate: string; active?: boolean;
}

function bannerToDb(form: BannerForm): Record<string, unknown> {
  return {
    title: form.title,
    image_url: form.imageUrl || null,
    link: form.link || null,
    position: BANNER_POSITION_EN[form.position as '메인 상단'] ?? 'main_top',
    start_date: form.startDate || null,
    end_date: form.endDate || null,
    ...(form.active !== undefined ? { is_active: form.active } : {}),
  };
}

export async function createBanner(form: BannerForm): Promise<Banner> {
  const { data, error } = await supabase.from('banners')
    .insert({ ...bannerToDb(form), is_active: form.active ?? true }).select().single();
  throwIf(error);
  return mapBanner(data);
}

export async function updateBanner(bannerId: string, form: BannerForm): Promise<Banner> {
  const { data, error } = await supabase.from('banners')
    .update(bannerToDb(form)).eq('id', bannerId).select().single();
  throwIf(error);
  return mapBanner(data);
}

export async function toggleBannerActive(bannerId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('banners').update({ is_active: isActive }).eq('id', bannerId);
  throwIf(error);
}

/** 배너 이미지 업로드(banner-images 버킷) → public URL */
export async function uploadBannerImage(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `banners/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('banner-images').upload(path, file, {
    contentType: file.type || 'image/jpeg',
  });
  throwIf(error);
  const { data } = supabase.storage.from('banner-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices').select('*').order('created_at', { ascending: false });
  throwIf(error);
  return (data ?? []).map(mapNotice);
}

export interface NoticeForm {
  title: string; content: string; target: '전체' | '사용자' | '판매자';
  startDate: string; endDate: string; important: boolean; active?: boolean;
}

function noticeToDb(form: NoticeForm): Record<string, unknown> {
  return {
    title: form.title,
    content: form.content || null,
    target: NOTICE_TARGET_EN[form.target] ?? 'all',
    start_date: form.startDate || null,
    end_date: form.endDate || null,
    is_important: form.important,
    ...(form.active !== undefined ? { is_published: form.active } : {}),
  };
}

export async function createNotice(form: NoticeForm): Promise<Notice> {
  const { data, error } = await supabase.from('notices')
    .insert({ ...noticeToDb(form), is_published: form.active ?? true, published_at: new Date().toISOString().slice(0, 10) })
    .select().single();
  throwIf(error);
  return mapNotice(data);
}

export async function updateNotice(noticeId: string, form: NoticeForm): Promise<Notice> {
  const { data, error } = await supabase.from('notices')
    .update(noticeToDb(form)).eq('id', noticeId).select().single();
  throwIf(error);
  return mapNotice(data);
}

export async function toggleNoticeActive(noticeId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('notices').update({ is_published: isActive }).eq('id', noticeId);
  throwIf(error);
}

export async function fetchCategories(): Promise<Category[]> {
  const [{ data: cats, error: catErr }, { data: prods, error: prodErr }] = await Promise.all([
    supabase.from('categories').select('*').order('display_order', { ascending: true }),
    supabase.from('admin_products').select('category'),
  ]);
  throwIf(catErr);
  throwIf(prodErr);
  const counts = new Map<string, number>();
  for (const p of prods ?? []) {
    const key = p.category ?? '기타';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return (cats ?? []).map(row => mapCategory(row, counts.get(row.name) ?? 0));
}

export async function createCategory(name: string, icon: string): Promise<Category> {
  const { data: existing } = await supabase.from('categories').select('display_order')
    .order('display_order', { ascending: false }).limit(1);
  const nextOrder = ((existing?.[0]?.display_order as number | undefined) ?? 0) + 1;
  const { data, error } = await supabase.from('categories')
    .insert({ name, icon: icon || '📦', display_order: nextOrder, is_active: true })
    .select().single();
  throwIf(error);
  return mapCategory(data, 0);
}

export async function updateCategory(categoryId: string, patch: { name?: string; icon?: string; active?: boolean; order?: number }): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.icon !== undefined) dbPatch.icon = patch.icon;
  if (patch.active !== undefined) dbPatch.is_active = patch.active;
  if (patch.order !== undefined) dbPatch.display_order = patch.order;
  const { error } = await supabase.from('categories').update(dbPatch).eq('id', categoryId);
  throwIf(error);
}

// ============================================================================
// 플랫폼 설정
// ============================================================================

export interface PlatformSettings {
  siteName: string;
  notifyEmail: string;
  commissionRate: number;
  settlementCycle: '주간' | '격주' | '월간';
  autoExpireCheck: boolean;
  reportThreshold: number;
  maxReportBeforeSuspend: number;
  autoPickupTimeout: number;
  allowGuestOrder: boolean;
}

const CYCLE_KO: Record<string, PlatformSettings['settlementCycle']> = {
  weekly: '주간', biweekly: '격주', monthly: '월간',
};
const CYCLE_EN: Record<string, string> = { '주간': 'weekly', '격주': 'biweekly', '월간': 'monthly' };

export async function fetchSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 1).single();
  throwIf(error);
  return {
    siteName: data.site_name ?? 'FoodPicker',
    notifyEmail: data.notify_email ?? '',
    commissionRate: data.default_commission_rate ?? 10,
    settlementCycle: CYCLE_KO[data.settlement_cycle] ?? '주간',
    autoExpireCheck: data.auto_expire_check ?? true,
    reportThreshold: data.report_threshold ?? 3,
    maxReportBeforeSuspend: data.max_report_before_suspend ?? 5,
    autoPickupTimeout: data.auto_pickup_timeout ?? 30,
    allowGuestOrder: data.allow_guest_order ?? false,
  };
}

export async function saveSettings(s: PlatformSettings): Promise<void> {
  const { error } = await supabase.from('platform_settings').update({
    site_name: s.siteName,
    notify_email: s.notifyEmail,
    default_commission_rate: s.commissionRate,
    settlement_cycle: CYCLE_EN[s.settlementCycle] ?? 'weekly',
    auto_expire_check: s.autoExpireCheck,
    report_threshold: s.reportThreshold,
    max_report_before_suspend: s.maxReportBeforeSuspend,
    auto_pickup_timeout: s.autoPickupTimeout,
    allow_guest_order: s.allowGuestOrder,
  }).eq('id', 1);
  throwIf(error);
}

// ============================================================================
// 관리자 계정
// ============================================================================

export async function fetchAdmins(): Promise<AdminAccount[]> {
  const { data, error } = await supabase
    .from('admin_profiles').select('*').order('created_at', { ascending: true });
  throwIf(error);
  return (data ?? []).map(mapAdmin);
}

export async function addAdminAccount(email: string, name: string, roleKo: AdminRole): Promise<AdminAccount> {
  const { data, error } = await supabase.rpc('admin_add_account', {
    p_email: email, p_name: name, p_role: ADMIN_ROLE_EN[roleKo],
  });
  throwIf(error);
  return mapAdmin(data);
}

export async function updateAdminAccount(userId: string, patch: { name?: string; role?: AdminRole; isActive?: boolean }): Promise<AdminAccount> {
  const { data, error } = await supabase.rpc('admin_update_account', {
    p_user_id: userId,
    p_name: patch.name ?? null,
    p_role: patch.role ? ADMIN_ROLE_EN[patch.role] : null,
    p_is_active: patch.isActive ?? null,
  });
  throwIf(error);
  return mapAdmin(data);
}

// ============================================================================
// 감사 로그 / 다운로드 로그
// ============================================================================

export async function insertActionLog(adminId: string, adminName: string, action: string, targetType: string, targetId: string, detail: string): Promise<void> {
  const { error } = await supabase.from('admin_action_logs').insert({
    admin_id: adminId, admin_name: adminName, action, target_type: targetType, target_id: targetId, detail,
  });
  throwIf(error);
}

export interface DownloadLogRow {
  id: string;
  adminId: string;
  adminName: string;
  menu: string;
  filters: string;
  downloadedAt: string;
  count: number;
}

export async function fetchDownloadLogs(): Promise<DownloadLogRow[]> {
  const { data, error } = await supabase
    .from('download_logs').select('*').order('created_at', { ascending: false }).limit(200);
  throwIf(error);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    adminId: row.admin_id ?? '',
    adminName: row.admin_name ?? '',
    menu: row.menu ?? '',
    filters: row.filters ?? '없음',
    downloadedAt: fmtDateTime(row.created_at),
    count: row.row_count ?? 0,
  }));
}

export async function insertDownloadLog(adminId: string, adminName: string, menu: string, filters: string, count: number): Promise<void> {
  const { error } = await supabase.from('download_logs').insert({
    admin_id: adminId, admin_name: adminName, menu, filters: filters || '없음', row_count: count,
  });
  throwIf(error);
}
