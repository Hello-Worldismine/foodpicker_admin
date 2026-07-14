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
export type ReviewStatus = '정상' | '숨김' | '신고검토' | '삭제';
export type AdminRole = '최고관리자' | '운영관리자' | '정산관리자' | 'CS관리자' | '읽기전용';

export interface Seller {
  id: string;
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
  id: string;
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

export interface Report {
  id: string;
  receiptNumber: string;
  type: string;
  orderNumber: string;
  buyerName: string;
  sellerName: string;
  title: string;
  content: string;
  status: ReportStatus;
  receivedAt: string;
  manager: string;
  memo?: string;
}

export interface Review {
  id: string;
  productName: string;
  storeName: string;
  buyerName: string;
  rating: number;
  content: string;
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
  productCount: number;
  active: boolean;
  order: number;
}

export interface Coupon {
  id: string;
  code: string; // 사용자가 앱에서 직접 입력해 등록하는 쿠폰번호
  name: string;
  discountType: '정액' | '정률';
  discountValue: number;
  minOrderAmount: number;
  startDate: string;
  endDate: string;
  target: string;
  totalQuantity: number;
  usedQuantity: number;
  active: boolean;
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
