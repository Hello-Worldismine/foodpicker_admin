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
  FAQ_CATEGORY_KO, FAQ_CATEGORY_EN,
  fmtDate, fmtDateTime, fmtPickupDeadline, regionFromAddress, maskResidentNumber,
} from './labels';
import type {
  Seller, SellerStatus, Product, Order, Settlement, Report, ReportStatus, Review, ReviewStatus,
  Banner, Notice, Category, Coupon, AdminAccount, AdminRole, Faq, FaqCategory, StoreOption,
} from '../types';

function throwIf(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** PostgREST 가 해당 인자 조합의 함수를 찾지 못했을 때(마이그레이션 미적용) 인가 */
function isMissingRpcSignature(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || /Could not find the function/i.test(error.message ?? '');
}

// ============================================================================
// 매퍼
// ============================================================================

/** 좌표 정규화 — double precision 이 숫자/문자열 어느 쪽으로 내려와도 유한한 number 만 남기고 나머지는 null. */
function toCoord(value: any): number | null {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

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
    // admin_stores 뷰는 `select s.*` 라 lat/lng 가 이미 내려온다(별도 조회 불필요).
    lat: toCoord(row.lat),
    lng: toCoord(row.lng),
    memo: row.admin_memo ?? '',
  };
}

/** 사진 목록 정규화 — products.images 가 text[] / jsonb / (문자열 그대로) 어느 형태로 내려와도
 *  유효한 URL 문자열만 남긴다. 빈 배열은 undefined 로 접어 UI 분기(사진 없음)를 단순화한다. */
function toImageList(value: any): string[] | undefined {
  let raw: any = value;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try { raw = JSON.parse(trimmed); } catch { raw = [trimmed]; }
  }
  if (!Array.isArray(raw)) return undefined;
  const urls = raw.filter((v: unknown): v is string => typeof v === 'string' && v.trim() !== '');
  return urls.length > 0 ? urls : undefined;
}

export function mapProduct(row: any): Product {
  const images = toImageList(row.images);
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
    // 픽업 마감 시각(정본) — 소비기한 비교에 쓰므로 포맷하지 않고 원본 ISO 그대로 넘긴다.
    pickupDeadlineAt: row.pickup_deadline_at ?? undefined,
    pickupDeadlineMinutes: row.pickup_deadline_minutes ?? undefined,
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
    emoji: row.emoji ?? undefined,
    thumbnail: row.thumbnail ?? undefined,
    images,
    imageUrl: row.thumbnail ?? images?.[0] ?? '',
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
    paymentKey: row.payment_key ?? undefined,
    pickupDeadlineMinutes: row.pickup_deadline_minutes ?? undefined,
    // 픽업 마감 시각 — pickup_deadline_at 우선, 없으면 ordered_at + pickup_deadline_minutes 로 계산
    pickupTime: fmtPickupDeadline(row.pickup_deadline_at, row.ordered_at, row.pickup_deadline_minutes),
    orderedAt: fmtDateTime(row.ordered_at),
    // 취소 요청(구매자 → 판매자). 컬럼 미적용 DB 에서는 undefined 로 떨어져 배지가 표시되지 않을 뿐이다.
    cancelRequestStatus: row.cancel_request_status ?? undefined,
    cancelRequestedAt: row.cancel_requested_at ? fmtDateTime(row.cancel_requested_at) : undefined,
    cancelRequestReason: row.cancel_request_reason ?? undefined,
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
    imageUrl: row.image_url ?? undefined,
    productCount,
    active: row.is_active ?? false,
    order: row.display_order ?? 0,
  };
}

export function mapFaq(row: any): Faq {
  return {
    id: row.id,
    category: FAQ_CATEGORY_KO[row.category] ?? '주문 · 결제',
    question: row.question ?? '',
    answer: row.answer ?? '',
    order: row.display_order ?? 0,
    active: row.is_active ?? false,
    createdAt: fmtDate(row.created_at),
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

/**
 * 매장 좌표 보정 — 판매자앱 지오코딩 미배포로 lat/lng 가 null 인 매장을 관리자가 채운다.
 * stores 에는 관리자 UPDATE RLS 정책이 없어 직접 update 는 0 row 로 조용히 실패하므로 RPC 가 유일한 경로다.
 * RPC 가 감사 로그(log_admin_action)를 남기므로 별도 insertActionLog 는 호출하지 않는다(기존 store RPC 3종과 동일 규약).
 * ※ 서버가 대한민국 영역(lat 33~38.7 / lng 124.5~132)을 검증해 x/y 뒤바뀜을 막는다.
 */
export async function setStoreCoords(storeId: string, lat: number, lng: number): Promise<Seller> {
  const { data, error } = await supabase.rpc('admin_set_store_coords', {
    p_store_id: storeId, p_lat: lat, p_lng: lng,
  });
  throwIf(error);
  return mapSeller(data);
}

// ============================================================================
// 상품
// ============================================================================

export async function fetchProducts(): Promise<Product[]> {
  // admin_products 뷰는 `select p.*` 로 생성돼 뷰의 컬럼 목록이 생성 시점에 고정된다.
  // 20260730 마이그레이션이 뷰를 재생성하며 pickup_deadline_at 을 포함시키므로 원칙적으로 보충 조회는 불필요하지만,
  // 뷰가 아직 반영되지 않은 DB 방어를 위해 마감 컬럼 2종을 products 에서 직접 보충한다.
  //   (products_admin_select 정책으로 관리자는 전 행 조회 가능. 조회 실패 시엔 마감 표기만 '-' 로 떨어진다.)
  const [viewRes, deadlineRes] = await Promise.all([
    supabase.from('admin_products').select('*').order('created_at', { ascending: false }),
    supabase.from('products').select('id, pickup_deadline_minutes, pickup_deadline_at'),
  ]);
  throwIf(viewRes.error);

  const deadlines = new Map<string, { minutes: number | null; at: string | null }>();
  if (!deadlineRes.error) {
    for (const row of (deadlineRes.data ?? []) as any[]) {
      deadlines.set(row.id, { minutes: row.pickup_deadline_minutes ?? null, at: row.pickup_deadline_at ?? null });
    }
  }
  return (viewRes.data ?? []).map((row: any) => mapProduct({
    ...row,
    pickup_deadline_minutes: row.pickup_deadline_minutes ?? deadlines.get(row.id)?.minutes ?? null,
    pickup_deadline_at: row.pickup_deadline_at ?? deadlines.get(row.id)?.at ?? null,
  }));
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

/** Edge Function toss-cancel 호출 — 토스페이먼츠 결제취소. 실패 시 throw(에러 응답 { error } 메시지 추출). */
async function invokeTossCancel(paymentKey: string, cancelReason: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('toss-cancel', {
    body: { paymentKey, cancelReason },
  });
  if (error) {
    let message = error.message ?? '알 수 없는 오류';
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) message = body.error;
    } catch { /* 에러 응답 본문 파싱 실패 시 기본 메시지 유지 */ }
    throw new Error(`토스 결제취소 실패: ${message}`);
  }
  if (!data || data.ok !== true) throw new Error('토스 결제취소 실패: 응답이 올바르지 않습니다.');
}

/**
 * 주문에 payment_key 가 있으면 DB 환불 전에 토스 결제취소를 선행. 취소 실패 시 throw → DB 환불 중단.
 * payment_key 없는 주문(테스트 데이터/토스 도입 전)과 이미 환불된 주문(RPC 가 'already refunded' 처리)은 건너뛴다.
 */
async function cancelTossForOrder(orderId: string, cancelReason: string): Promise<void> {
  const { data, error } = await supabase
    .from('orders').select('payment_key, payment_status').eq('id', orderId).maybeSingle();
  throwIf(error);
  if (!data?.payment_key || data.payment_status === 'refunded') return;
  await invokeTossCancel(data.payment_key, cancelReason);
}

export async function refundOrder(orderId: string, reason?: string): Promise<Order> {
  await cancelTossForOrder(orderId, reason?.trim() || '관리자 환불 처리');
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

/** 정산 조회 상한 — 이 이상은 잘라내고 화면에 절단 사실을 알린다(조용한 부분 집계 방지). */
const SETTLEMENT_MAX_ROWS = 20000;
const SETTLEMENT_PAGE = 1000;

export interface SettlementFetchResult {
  groups: Settlement[];
  /** 상한에 걸려 일부 행을 못 읽었는가 — true 면 그룹 합계가 실제보다 작을 수 있다. */
  truncated: boolean;
  /** 실제로 읽어들인 원본(주문 단위) 행 수 */
  rowCount: number;
}

/**
 * 정산 조회 — `admin_settlements`(주문 1건 = 1행)를 전량 페이징으로 읽어 판매자×기간으로 집계한다.
 * 예전에는 `.limit(2000)` 한 번이라 정산행이 2000 을 넘는 순간 경계에 걸친 그룹이 '일부 행만'
 * 집계돼 금액이 조용히 작게 표시되고, 그 그룹을 확정하면 settlementIds 에 없는 나머지 행이
 * 영구히 정산예정으로 남는 사고가 났다.
 */
export async function fetchSettlements(): Promise<SettlementFetchResult> {
  const rows: any[] = [];
  let truncated = false;
  for (let from = 0; ; from += SETTLEMENT_PAGE) {
    if (from >= SETTLEMENT_MAX_ROWS) { truncated = true; break; }
    const { data, error } = await supabase
      .from('admin_settlements').select('*')
      .order('created_at', { ascending: false })
      .range(from, from + SETTLEMENT_PAGE - 1);
    throwIf(error);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < SETTLEMENT_PAGE) break;
  }

  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const key = `${row.seller_id}|${row.period_start ?? ''}|${row.period_end ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const num = (v: any) => Number(v) || 0;

  const result: Settlement[] = [];
  for (const [key, groupRows] of groups) {
    const first = groupRows[0];
    const sum = (f: (r: any) => number) => groupRows.reduce((acc, r) => acc + (f(r) || 0), 0);
    const statuses = new Set(groupRows.map(r => r.status));
    const status = statuses.has('on_hold') ? 'on_hold'
      : (statuses.size === 1 && statuses.has('completed')) ? 'completed' : 'scheduled';

    const totalSales = sum(r => num(r.amount));
    const platformFee = sum(r => num(r.platform_fee));
    const pgFee = sum(r => num(r.pg_fee));
    const refundAmount = sum(r => num(r.refund));
    const finalAmount = sum(r => num(r.settlement_amount));

    result.push({
      id: key,
      settlementIds: groupRows.map(r => r.id),
      sellerName: first.store_name ?? '',
      sellerId: first.seller_id,
      storeId: first.store_id,
      bizNumber: first.biz_number ?? '',
      period: first.period_start && first.period_end ? `${first.period_start} ~ ${first.period_end}` : '-',
      orderCount: groupRows.length,
      totalSales,
      platformFee,
      pgFee,
      commission: sum(r => num(r.fee)),
      refundAmount,
      couponBurden: sum(r => num(r.coupon_burden)),
      // 본사 쿠폰 보전분·환불 회계까지 반영한 잔차.
      // 상세 화면의 금액식(판매 - 수수료 - 환불 + 조정 = 최종)이 항상 맞아떨어지게 하는 용도.
      adjustment: finalAmount - (totalSales - platformFee - pgFee - refundAmount),
      finalAmount,
      status: SETTLEMENT_STATUS_KO[status] ?? '정산예정',
      scheduledDate: first.settled_on ?? '',
      bankName: first.bank_name ?? '',
      accountNumber: first.account_number ?? '',
      accountHolder: first.account_holder ?? '',
      memo: groupRows.find(r => r.admin_memo)?.admin_memo ?? '',
      mixed: statuses.size > 1,
      orders: groupRows.map(r => {
        const amount = num(r.amount), pf = num(r.platform_fee), pg = num(r.pg_fee);
        const refund = num(r.refund), fin = num(r.settlement_amount);
        return {
          id: r.id,
          settlementCode: r.settlement_code ?? '',
          orderCode: r.order_code ?? '',
          productName: r.product_name ?? '',
          amount, platformFee: pf, pgFee: pg, refund,
          couponBurden: num(r.coupon_burden),
          adjustment: fin - (amount - pf - pg - refund),
          finalAmount: fin,
          status: SETTLEMENT_STATUS_KO[r.status] ?? '정산예정',
          settledOn: r.settled_on ?? '',
        };
      }).sort((a, b) => a.settlementCode.localeCompare(b.settlementCode)),
    });
  }
  return { groups: result, truncated, rowCount: rows.length };
}

/** 정산 상태 변경 결과. degraded=true 면 20260818 마이그레이션 미적용이라 구 시그니처로 처리된 것. */
export interface SettlementStatusResult {
  count: number;
  /** 구 시그니처 RPC 로 폴백됨 — 정산예정일 지정·판매자 알림·상태 가드가 적용되지 않았다. */
  degraded: boolean;
}

/**
 * 정산 상태 일괄 변경.
 * - settledOn(정산예정일)은 20260818000000, fromStatus(원천 상태 가드)는 20260818010000 에서 추가됐다.
 *   마이그레이션 미적용 DB 는 PostgREST 가 시그니처를 못 찾으므로(PGRST202) 단계적으로 낮춰 재시도한다.
 * - fromStatus 를 넘기면 서버가 그 상태인 행만 바꾼다. 판매자×기간 그룹에 상태가 섞여 있어도
 *   이미 지급 완료된 행의 정산예정일이 덮이거나 중복 알림이 나가지 않는다.
 */
export async function setSettlementStatus(
  settlementIds: string[], statusKo: Settlement['status'], memo?: string,
  settledOn?: string, fromStatusKo?: Settlement['status'],
): Promise<SettlementStatusResult> {
  const base = {
    p_ids: settlementIds, p_status: SETTLEMENT_STATUS_EN[statusKo], p_memo: memo ?? null,
  };
  const withDate = { ...base, p_settled_on: settledOn || null };

  const full = await supabase.rpc('admin_set_settlement_status', {
    ...withDate, p_from_status: fromStatusKo ? SETTLEMENT_STATUS_EN[fromStatusKo] : null,
  });
  if (!full.error) return { count: full.data ?? 0, degraded: false };
  if (!isMissingRpcSignature(full.error)) throwIf(full.error);

  const dated = await supabase.rpc('admin_set_settlement_status', withDate);
  if (!dated.error) return { count: dated.data ?? 0, degraded: true };
  if (!isMissingRpcSignature(dated.error)) throwIf(dated.error);

  const legacy = await supabase.rpc('admin_set_settlement_status', base);
  throwIf(legacy.error);
  return { count: legacy.data ?? 0, degraded: true };
}

/** 잘못 생성된 정산 행 삭제(정정용). 지급 완료 건은 서버가 제외한다. 사유 필수. */
export async function deleteSettlements(settlementIds: string[], reason: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_delete_settlements', {
    p_ids: settlementIds, p_reason: reason,
  });
  throwIf(error);
  return data ?? 0;
}

/** 정산 관리자 메모만 갱신 — 상태 변경/판매자 알림 없이 memo 만 기록한다. */
export async function setSettlementMemo(settlementIds: string[], memo: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_set_settlement_memo', {
    p_ids: settlementIds, p_memo: memo,
  });
  throwIf(error);
  return data ?? 0;
}

/** 기간을 지정해 정산 행을 생성(마감). 이미 정산된 주문은 건너뛰므로 재실행해도 안전하다. */
export async function generateSettlements(start: string, end: string, payDate?: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_generate_settlements', {
    p_start: start, p_end: end, p_pay: payDate || null,
  });
  throwIf(error);
  return data ?? 0;
}

/** 매장별 수수료율(%) 변경 — 변경 시점 이후 생성되는 주문부터 적용된다. */
export async function setStoreCommission(storeId: string, rate: number): Promise<number> {
  const { data, error } = await supabase.rpc('admin_set_store_commission', {
    p_store_id: storeId, p_rate: rate,
  });
  throwIf(error);
  return data ?? rate;
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
  // 연결 주문이 토스 결제 건이면 RPC(admin_report_refund → admin_refund_order) 전에 PG 결제취소를 선행.
  const { data: report, error: reportError } = await supabase
    .from('reports').select('order_id, receipt_code').eq('id', reportId).maybeSingle();
  throwIf(reportError);
  if (report?.order_id) {
    const fallback = report.receipt_code ? `신고 건 환불: ${report.receipt_code}` : '신고 건 환불 처리';
    await cancelTossForOrder(report.order_id, reason?.trim() || fallback);
  }
  const { data, error } = await supabase.rpc('admin_report_refund', {
    p_report_id: reportId, p_reason: reason ?? null,
  });
  throwIf(error);
  return mapReport(data);
}

// ============================================================================
// 리뷰
// ============================================================================

/** 리뷰 목록 — storeId 지정 시 해당 매장 리뷰만(매장별 보기), 항상 최신순 */
export async function fetchReviews(storeId?: string): Promise<Review[]> {
  let query = supabase
    .from('admin_reviews').select('*').order('created_at', { ascending: false }).limit(1000);
  if (storeId) query = query.eq('store_id', storeId);
  const { data, error } = await query;
  throwIf(error);
  return (data ?? []).map(mapReview);
}

/** 매장 피커용 경량 목록(리뷰 매장별 보기·쿠폰 매장 지정 발급 공용) — 민감정보 컬럼 미조회.
 *  total_review_count 는 20260722010000 마이그레이션의 admin_stores 재정의가 선행돼야 한다. */
export async function fetchStoreOptions(): Promise<StoreOption[]> {
  const { data, error } = await supabase
    .from('admin_stores')
    .select('id, seller_id, name, category, address, rating, review_count, total_review_count, approval_status, suspended_by_admin')
    .order('name', { ascending: true });
  throwIf(error);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    sellerId: row.seller_id,
    name: row.name ?? '',
    category: row.category ?? '',
    address: row.address ?? '',
    rating: Number(row.rating ?? 0),
    reviewCount: row.total_review_count ?? row.review_count ?? 0,
    approved: row.approval_status === 'approved' && !row.suspended_by_admin,
  }));
}

/** 매장별 '신고검토(flagged)' 대기 리뷰 수 — 리뷰 관리 매장 목록의 검토 대기 배지용 */
export async function fetchFlaggedReviewCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('admin_reviews').select('store_id').eq('moderation_status', 'flagged');
  throwIf(error);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { store_id: string }[]) {
    if (row.store_id) counts.set(row.store_id, (counts.get(row.store_id) ?? 0) + 1);
  }
  return counts;
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
  /** 매장 지정 발급 — 지정 시 판매자 수락 대기(pending·비활성) 상태로 생성된다. auth.users id. */
  sellerId?: string;
  /** UI 표시용 매장명(DB 미저장) */
  sellerName?: string;
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
    // 매장 지정 발급: 판매자 수락 대기(pending·비활성)로 생성 → 판매자가 respond_coupon_offer RPC로
    // 수락하면 활성화(approved)되고, store_coupons 게이트를 통과해 사용자 앱 상점 상세에 노출된다.
    // DB 트리거(notify_coupon_offer)가 지정 시점에 판매자 알림을 자동 발송한다.
    seller_id: form.sellerId ?? null,
    request_status: form.sellerId ? 'pending' : null,
    is_active: form.sellerId ? false : true,
  }).select().single();
  throwIf(error);
  const coupon = mapCoupon(data);
  // insert 반환 행에는 admin_coupons 뷰 전용 store_name 이 없어 매장명이 비므로 폼 값으로 보충
  if (form.sellerId && !coupon.sellerName) coupon.sellerName = form.sellerName;
  return coupon;
}

/** 매장 지정 발급 회수 — 판매자 수락 대기(pending) 상태의 관리자 발행 쿠폰을 철회한다.
 *  DELETE RLS 정책이 없으므로 rejected + 비활성 UPDATE 방식(coupons_admin_update 통과). */
export async function withdrawCouponOffer(couponId: string): Promise<void> {
  const { error } = await supabase.from('coupons')
    .update({ request_status: 'rejected', is_active: false, reject_reason: '관리자 회수' })
    .eq('id', couponId).eq('source', 'admin').eq('request_status', 'pending');
  throwIf(error);
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

export async function createCategory(name: string, icon: string, imageUrl?: string): Promise<Category> {
  const { data: existing } = await supabase.from('categories').select('display_order')
    .order('display_order', { ascending: false }).limit(1);
  const nextOrder = ((existing?.[0]?.display_order as number | undefined) ?? 0) + 1;
  const { data, error } = await supabase.from('categories')
    .insert({ name, icon: icon || '📦', image_url: imageUrl || null, display_order: nextOrder, is_active: true })
    .select().single();
  throwIf(error);
  return mapCategory(data, 0);
}

export async function updateCategory(categoryId: string, patch: { name?: string; icon?: string; imageUrl?: string | null; active?: boolean; order?: number }): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.icon !== undefined) dbPatch.icon = patch.icon;
  if (patch.imageUrl !== undefined) dbPatch.image_url = patch.imageUrl; // null → 이미지 제거(이모지 폴백)
  if (patch.active !== undefined) dbPatch.is_active = patch.active;
  if (patch.order !== undefined) dbPatch.display_order = patch.order;
  const { error } = await supabase.from('categories').update(dbPatch).eq('id', categoryId);
  throwIf(error);
}

/** 카테고리 아이콘 이미지 업로드(category-icons 버킷) → public URL */
export async function uploadCategoryIcon(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `icons/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('category-icons').upload(path, file, {
    contentType: file.type || 'image/png',
  });
  throwIf(error);
  const { data } = supabase.storage.from('category-icons').getPublicUrl(path);
  return data.publicUrl;
}

// ============================================================================
// FAQ (자주 묻는 질문) — 소비자 앱 FAQScreen.js 와 동일 콘텐츠를 관리자 웹에서 CRUD
// ============================================================================

export async function fetchFaqs(): Promise<Faq[]> {
  const { data, error } = await supabase
    .from('faqs').select('*').order('category', { ascending: true }).order('display_order', { ascending: true });
  throwIf(error);
  return (data ?? []).map(mapFaq);
}

export interface FaqForm {
  category: FaqCategory; question: string; answer: string; active?: boolean;
}

function faqToDb(form: FaqForm): Record<string, unknown> {
  return {
    category: FAQ_CATEGORY_EN[form.category] ?? 'order_payment',
    question: form.question,
    answer: form.answer,
    ...(form.active !== undefined ? { is_active: form.active } : {}),
  };
}

export async function createFaq(form: FaqForm): Promise<Faq> {
  const dbCategory = FAQ_CATEGORY_EN[form.category] ?? 'order_payment';
  const { data: existing } = await supabase.from('faqs').select('display_order')
    .eq('category', dbCategory).order('display_order', { ascending: false }).limit(1);
  const nextOrder = ((existing?.[0]?.display_order as number | undefined) ?? 0) + 1;
  const { data, error } = await supabase.from('faqs')
    .insert({ ...faqToDb(form), display_order: nextOrder, is_active: form.active ?? true })
    .select().single();
  throwIf(error);
  return mapFaq(data);
}

export async function updateFaq(faqId: string, form: FaqForm): Promise<Faq> {
  const { data, error } = await supabase.from('faqs')
    .update(faqToDb(form)).eq('id', faqId).select().single();
  throwIf(error);
  return mapFaq(data);
}

export async function toggleFaqActive(faqId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('faqs').update({ is_active: isActive }).eq('id', faqId);
  throwIf(error);
}

export async function deleteFaq(faqId: string): Promise<void> {
  const { error } = await supabase.from('faqs').delete().eq('id', faqId);
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
