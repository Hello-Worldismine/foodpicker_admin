// 판매자(매장) 상태 — 실제 DB의 store_approval_status enum('approved'|'pending'|'rejected')에
// is_selling_paused(판매중지) 상태를 더한 관리자 표시용 4단계. '탈퇴' 등 DB에 없는 상태는 사용하지 않는다.
export type SellerStatus = '승인대기' | '승인완료' | '반려' | '이용정지';

// 상품 상태 — 실제 DB product_status enum('selling'|'soldout'|'paused'|'hidden')과 1:1 대응.
// 판매자 앱은 등록 즉시 '판매중' 상태로 게시되므로 사전 검수 단계('검수대기' 등)는 존재하지 않는다.
export type ProductStatus = '판매중' | '품절' | '판매중지' | '숨김';
export type ProductPauseReason = '소비기한 경과' | '관리자 중지';
// storage 컬럼은 실제로 3가지 값만 허용(냉장/냉동은 한글 그대로 DB에 저장됨)
export type StorageType = '실온' | '냉장' | '냉동';

// 주문 상태 — 실제 DB order_seller_status enum('new'|'confirmed'|'completed'|'cancelled')과 대응.
// '노쇼', '분쟁중' 등은 DB에 별도 상태로 존재하지 않는다.
export type OrderStatus = '신규접수' | '픽업대기' | '픽업완료' | '취소';
// 결제 상태 — 실제 DB payment_status enum('pending'|'paid'|'cancelled'|'refunded')과 대응.
export type PaymentStatus = '결제대기' | '결제완료' | '결제취소' | '환불완료';

// 정산 상태 — 실제 DB settlement_status enum('scheduled'|'completed'|'on_hold')과 대응.
export type SettlementStatus = '정산예정' | '정산완료' | '보류';

// 아래 상태들은 실제 판매자/사용자 앱 DB 스키마에 대응 테이블이 없는 관리자 전용 개념이다.
export type ReportStatus = '접수' | '확인중' | '판매자 답변 대기' | '구매자 답변 대기' | '환불 처리' | '종결';
// '신고검토'는 처리 대기 중(미결) 상태. 관리자가 검토를 마치면 아래 3개 결과값 중 하나로 전환되며,
// 신고 이력이 있었다는 사실은 배지에 남기되(신고검토-*), 신고 없이 바로 조치한 경우엔 접두어 없는 정상/숨김/삭제를 사용한다.
export type ReviewStatus = '정상' | '숨김' | '삭제' | '신고검토' | '신고검토-정상' | '신고검토-숨김' | '신고검토-삭제';
export type AdminRole = '최고관리자' | '운영관리자' | '정산관리자' | 'CS관리자' | '읽기전용';

export interface Seller {
  id: string; // stores.id (uuid)
  sellerId: string; // auth.users id (stores.seller_id)
  storeName: string;
  ownerName: string;
  bizNumber: string;
  // 주민번호: 실 DB 코멘트상 민감정보(마스킹 표시, 실서비스 암호화 권장) — 절대 평문 노출 금지
  residentNumberMasked?: string;
  region: string;
  status: SellerStatus;
  commissionRate: number; // 수수료율(%) — 관리자만 설정 가능한 필드(판매자 앱에서 수정 불가)
  bizCertImage?: string; // 사업자등록증 이미지 URL
  joinDate: string;
  totalOrders: number;
  reportCount: number;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  categoryMain: string;
  memo?: string;
}

export interface Product {
  id: string;
  name: string;
  storeName: string;
  sellerId: string;
  category: string;
  originalPrice: number;
  startPrice?: number; // 자동할인 시작가
  floorPrice?: number; // 자동할인 최저가(바닥가)
  salePrice: number;
  discountRate: number;
  reductionAmount?: number; // 자동할인 1회 차감폭
  intervalMinutes?: number; // 자동할인 주기(분)
  stock: number;
  expiryDate: string;
  pickupStart: string;
  pickupEnd: string;
  status: ProductStatus;
  pauseReason?: ProductPauseReason;
  reportCount: number;
  registeredAt: string;
  updatedAt: string;
  storage: StorageType;
  storageDetail?: string;
  allergyInfo: string;
  originInfo: string;
  description: string;
  imageUrl?: string;
  memo?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // order_code 형식 (예: FP-1000)
  buyerName: string;
  buyerId: string;
  safeNumber?: string; // 050 안심번호
  sellerName: string;
  sellerId: string;
  productName: string;
  productId: string;
  amount: number; // 상품금액
  fee: number; // 플랫폼 수수료
  totalPrice: number; // 실 결제금액(구매자 결제액)
  quantity: number;
  status: OrderStatus; // seller_status
  paymentStatus: PaymentStatus;
  pickupTime: string;
  orderedAt: string;
  memo?: string;
}

export interface Settlement {
  id: string; // 판매자×기간 그룹 키(클라이언트 파생 — DB settlements 는 주문 단위 행)
  settlementIds: string[]; // 그룹에 포함된 settlements.id 목록(일괄 상태 변경용)
  sellerName: string;
  sellerId: string;
  bizNumber: string;
  period: string;
  totalSales: number;
  platformFee: number; // 플랫폼 수수료
  pgFee: number; // PG(결제대행) 수수료
  commission: number; // platformFee + pgFee 합계
  refundAmount: number;
  finalAmount: number;
  status: SettlementStatus;
  scheduledDate: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  memo?: string;
}

// 상한 음식/소비기한 만료 등 증빙이 필요한 신고 건에 첨부되는 사진·영상 (실 DB엔 아직 컬럼 없음 — 신규 필요)
export interface ReportEvidence {
  type: 'image' | 'video';
  url: string;
}

// 문의 주체 — 사용자(구매자)의 신고/문의인지, 판매자(점주)가 플랫폼에 남긴 1:1 문의인지 구분.
export type InquirerType = '사용자' | '판매자';

export interface Report {
  id: string;
  receiptNumber: string;
  inquirerType: InquirerType;
  type: string;
  orderNumber?: string; // 사용자 문의는 대부분 특정 주문에 연결되지만, 판매자 문의(정산/계정 등)는 주문과 무관할 수 있음
  buyerName?: string; // 사용자 문의일 때만 존재
  sellerName: string; // 사용자 문의: 신고 대상 매장 / 판매자 문의: 문의를 남긴 본인 매장
  title: string;
  content: string;
  evidence?: ReportEvidence[];
  status: ReportStatus;
  receivedAt: string;
  manager: string;
  memo?: string;
}

export interface Review {
  id: string;
  productId?: string;
  storeId?: string;
  productName: string;
  storeName: string;
  buyerName: string;
  rating: number;
  content: string;
  images?: string[]; // 구매자가 첨부한 리뷰 사진 (실 DB reviews 테이블엔 아직 컬럼 없음 — 신규 필요)
  writtenAt: string;
  reportCount: number;
  status: ReviewStatus;
  ownerReply?: string; // 판매자 답글 (실 DB owner_reply)
  ownerRepliedAt?: string;
  memo?: string;
}

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  position: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  target: '전체' | '사용자' | '판매자';
  startDate: string;
  endDate: string;
  important: boolean;
  active: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  imageUrl?: string; // 아이콘 이미지 URL(category-icons 버킷) — 있으면 이모지 대신 표시
  productCount: number;
  active: boolean;
  order: number;
}

// 매장 피커용 경량 타입 — 리뷰 매장별 보기·쿠폰 매장 지정 발급 공용(민감정보 제외)
export interface StoreOption {
  id: string; // stores.id
  sellerId: string; // auth.users id — 쿠폰 seller_id 지정에 사용
  name: string;
  category: string;
  address: string;
  rating: number;
  reviewCount: number; // 관리자 화면용 전체 리뷰 수(숨김/삭제 포함, admin_stores.total_review_count)
  approved: boolean; // 승인완료 && 이용정지 아님 — 쿠폰 발급 대상 필터에 사용
}

// 소비자 앱(foodpicker_app) FAQScreen.js 의 고정 4개 카테고리와 동일한 값을 쓴다.
export type FaqCategory = '주문 · 결제' | '픽업' | '상품 · 가게' | '계정';

export interface Faq {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  order: number;
  active: boolean;
  createdAt: string;
}

// 쿠폰 예산 부담 주체 — 정산 배치가 이 값을 보고 할인액을 본사/점주 중 누구 정산에서 차감할지 결정한다.
export type CouponCostBearer = '본사' | '점주' | '분담';
// 쿠폰을 누가 만들었는지: 관리자가 직접 발행했는지, 점주가 신청해서 관리자 승인을 거쳤는지.
export type CouponSource = '관리자 발행' | '점주 신청';
export type CouponRequestStatus = '대기' | '승인' | '반려';

export interface Coupon {
  id: string;
  code: string; // 사용자가 앱에서 직접 입력해 등록하는 쿠폰번호
  name: string;
  discountType: '정액' | '정률';
  discountValue: number;
  maxDiscountAmount?: number; // 정률 할인일 때 필수 — 이 금액을 넘는 할인은 적용되지 않음(플랫폼 예산 보호)
  minOrderAmount: number;
  startDate: string;
  endDate: string;
  target: string;
  totalQuantity: number;
  usedQuantity: number;
  active: boolean;
  costBearer: CouponCostBearer; // 예산 부담 주체(정산 연동 핵심 필드)
  platformShare?: number; // costBearer가 '분담'일 때 본사 부담 비율(%). 나머지는 점주 부담.
  allowStacking: boolean; // 다른 쿠폰과 중복 사용 허용 여부
  source: CouponSource;
  sellerId?: string; // 매장 전용 쿠폰의 대상 매장(점주 신청 또는 관리자 매장 지정 발급)
  sellerName?: string;
  requestStatus?: CouponRequestStatus; // 점주 신청 승인 흐름 + 관리자 매장 지정 발급의 판매자 수락 대기('대기')에 사용
  rejectReason?: string;
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: '활성' | '비활성';
  lastLogin: string;
  createdAt: string;
}

export interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  todayPickups: number;
  todayCancels: number;
  newSellerApps: number;
  newReports: number;
  pendingSettlements: number;
}

export interface ActionLog {
  id: string;
  adminName: string;
  action: string;
  target: string;
  targetId: string;
  detail: string;
  createdAt: string;
}
