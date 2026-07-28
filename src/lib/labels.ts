// DB enum(영문 키) ↔ 화면 한글 라벨 매핑.
// 규약: DB에는 영문 키만 저장하고 한글 라벨은 클라이언트가 파생한다(docs/API_SPEC.md §5).
import type {
  ProductStatus, OrderStatus, PaymentStatus, SettlementStatus,
  ReportStatus, ReviewStatus, AdminRole, CouponCostBearer, CouponSource,
  CouponRequestStatus, InquirerType, ProductPauseReason, FaqCategory,
} from '../types';

function invert<K extends string, V extends string>(map: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<V, K>;
}

// ── products ──────────────────────────────────────────────────────────────
export const PRODUCT_STATUS_KO: Record<string, ProductStatus> = {
  selling: '판매중', soldout: '품절', paused: '판매중지', hidden: '숨김',
};
export const PRODUCT_STATUS_EN = invert(PRODUCT_STATUS_KO);

export const PAUSE_REASON_KO: Record<string, ProductPauseReason> = {
  expiry: '소비기한 경과', manual: '관리자 중지',
};

// ── orders ────────────────────────────────────────────────────────────────
export const ORDER_STATUS_KO: Record<string, OrderStatus> = {
  new: '신규접수', confirmed: '픽업대기', completed: '픽업완료', cancelled: '취소',
};
export const ORDER_STATUS_EN = invert(ORDER_STATUS_KO);

export const PAYMENT_STATUS_KO: Record<string, PaymentStatus> = {
  pending: '결제대기', paid: '결제완료', cancelled: '결제취소', refunded: '환불완료',
};
export const PAYMENT_STATUS_EN = invert(PAYMENT_STATUS_KO);

// ── settlements ───────────────────────────────────────────────────────────
export const SETTLEMENT_STATUS_KO: Record<string, SettlementStatus> = {
  scheduled: '정산예정', completed: '정산완료', on_hold: '보류',
};
export const SETTLEMENT_STATUS_EN = invert(SETTLEMENT_STATUS_KO);

// ── reports ───────────────────────────────────────────────────────────────
export const REPORT_STATUS_KO: Record<string, ReportStatus> = {
  received: '접수', checking: '확인중', awaiting_seller: '판매자 답변 대기',
  awaiting_buyer: '구매자 답변 대기', refunded: '환불 처리', closed: '종결',
};
export const REPORT_STATUS_EN = invert(REPORT_STATUS_KO);

export const INQUIRER_TYPE_KO: Record<string, InquirerType> = {
  buyer: '사용자', seller: '판매자',
};
export const INQUIRER_TYPE_EN = invert(INQUIRER_TYPE_KO);

// ── reviews ───────────────────────────────────────────────────────────────
export const REVIEW_STATUS_KO: Record<string, ReviewStatus> = {
  normal: '정상', hidden: '숨김', deleted: '삭제', flagged: '신고검토',
  flagged_normal: '신고검토-정상', flagged_hidden: '신고검토-숨김', flagged_deleted: '신고검토-삭제',
};
export const REVIEW_STATUS_EN = invert(REVIEW_STATUS_KO);

// ── admin ─────────────────────────────────────────────────────────────────
export const ADMIN_ROLE_KO: Record<string, AdminRole> = {
  super: '최고관리자', ops: '운영관리자', settlement: '정산관리자', cs: 'CS관리자', viewer: '읽기전용',
};
export const ADMIN_ROLE_EN = invert(ADMIN_ROLE_KO);

// ── coupons ───────────────────────────────────────────────────────────────
export const COST_BEARER_KO: Record<string, CouponCostBearer> = {
  platform: '본사', seller: '점주', shared: '분담',
};
export const COST_BEARER_EN = invert(COST_BEARER_KO);

export const DISCOUNT_TYPE_KO: Record<string, '정액' | '정률'> = {
  amount: '정액', rate: '정률',
};
export const DISCOUNT_TYPE_EN = invert(DISCOUNT_TYPE_KO);

export const COUPON_SOURCE_KO: Record<string, CouponSource> = {
  admin: '관리자 발행', seller: '점주 신청',
};
export const COUPON_SOURCE_EN = invert(COUPON_SOURCE_KO);

export const COUPON_REQUEST_KO: Record<string, CouponRequestStatus> = {
  pending: '대기', approved: '승인', rejected: '반려',
};
export const COUPON_REQUEST_EN = invert(COUPON_REQUEST_KO);

// ── banners / notices ─────────────────────────────────────────────────────
export const BANNER_POSITION_KO: Record<string, string> = {
  main_top: '메인 상단', main_middle: '메인 중간', main_bottom: '메인 하단',
};
export const BANNER_POSITION_EN = invert(BANNER_POSITION_KO as Record<string, '메인 상단' | '메인 중간' | '메인 하단'>);

export const NOTICE_TARGET_KO: Record<string, '전체' | '사용자' | '판매자'> = {
  all: '전체', buyer: '사용자', seller: '판매자',
};
export const NOTICE_TARGET_EN = invert(NOTICE_TARGET_KO);

// ── faq ───────────────────────────────────────────────────────────────────
// 소비자 앱 FAQScreen.js 의 카테고리 구분과 동일(값 자체는 앱 화면에 노출되지 않고 그룹핑 용도).
export const FAQ_CATEGORY_KO: Record<string, FaqCategory> = {
  order_payment: '주문 · 결제', pickup: '픽업', product_store: '상품 · 가게', account: '계정',
};
export const FAQ_CATEGORY_EN = invert(FAQ_CATEGORY_KO);

// ── 날짜/표시 헬퍼 ─────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');

/** timestamptz → 'YYYY-MM-DD' (로컬 시간대) */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** timestamptz → 'YYYY-MM-DD HH:mm' */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** timestamptz → 'HH:mm' */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 픽업 마감 시각 표기: orders.pickup_deadline_at → 'YYYY.MM.DD HH:mm 까지'.
 * pickup_deadline_at 이 비어 있으면 ordered_at + pickup_deadline_minutes(기본 60분)로 계산해 폴백한다.
 * (픽업 시간대(pickup_start~pickup_end) 개념은 '주문 후 N분 이내 마감' 으로 대체됨 — 20260728000000 마이그레이션)
 */
export function fmtPickupDeadline(
  deadlineAt: string | null | undefined,
  orderedAt?: string | null,
  minutes?: number | null,
): string {
  let d: Date | null = deadlineAt ? new Date(deadlineAt) : null;
  if ((!d || Number.isNaN(d.getTime())) && orderedAt) {
    const base = new Date(orderedAt);
    if (!Number.isNaN(base.getTime())) d = new Date(base.getTime() + (minutes ?? 60) * 60000);
  }
  if (!d || Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} 까지`;
}

/** 픽업 마감(분) 표기: 60 → '주문 후 60분 이내' */
export function fmtPickupDeadlineMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(Number(minutes))) return '-';
  return `주문 후 ${Number(minutes)}분 이내`;
}

/** 주소 → '서울 강남' 형태의 지역 라벨(시/도 + 시/군/구, 표시·필터용 파생) */
export function regionFromAddress(address: string | null | undefined): string {
  if (!address) return '-';
  const norm = address
    .replace(/^서울특별시/, '서울').replace(/^부산광역시/, '부산').replace(/^대구광역시/, '대구')
    .replace(/^인천광역시/, '인천').replace(/^광주광역시/, '광주').replace(/^대전광역시/, '대전')
    .replace(/^울산광역시/, '울산').replace(/^세종특별자치시/, '세종').replace(/^경기도/, '경기')
    .replace(/^강원특별자치도|^강원도/, '강원').replace(/^충청북도/, '충북').replace(/^충청남도/, '충남')
    .replace(/^전라북도|^전북특별자치도/, '전북').replace(/^전라남도/, '전남')
    .replace(/^경상북도/, '경북').replace(/^경상남도/, '경남').replace(/^제주특별자치도/, '제주');
  const tokens = norm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '-';
  const second = (tokens[1] ?? '').replace(/(시|군|구)$/, '');
  return second ? `${tokens[0]} ${second}` : tokens[0];
}

/** 주민번호 마스킹: '901231-1234567' → '901231-1******' */
export function maskResidentNumber(value: string | null | undefined): string {
  if (!value) return '';
  const m = value.replace(/\s/g, '');
  if (m.length < 8) return m.replace(/./g, '*');
  return `${m.slice(0, 8)}${'*'.repeat(Math.max(m.length - 8, 0))}`;
}
