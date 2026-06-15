export type SellerStatus = '승인대기' | '승인완료' | '반려' | '이용정지' | '탈퇴';
export type ProductStatus = '판매중' | '품절' | '판매종료' | '숨김' | '검수대기' | '반려' | '관리자중지';
export type OrderStatus = '결제완료' | '픽업대기' | '픽업완료' | '취소요청' | '환불완료' | '노쇼' | '분쟁중';
export type PaymentStatus = '결제완료' | '환불완료' | '환불대기' | '결제취소';
export type SettlementStatus = '정산예정' | '정산완료' | '보류';
export type ReportStatus = '접수' | '확인중' | '판매자 답변 대기' | '구매자 답변 대기' | '환불 처리' | '종결';
export type ReviewStatus = '정상' | '숨김' | '신고검토' | '삭제';
export type AdminRole = '최고관리자' | '운영관리자' | '정산관리자' | 'CS관리자' | '읽기전용';

export interface Seller {
  id: string;
  storeName: string;
  ownerName: string;
  businessNumber: string;
  region: string;
  status: SellerStatus;
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
  salePrice: number;
  discountRate: number;
  stock: number;
  expiryDate: string;
  pickupStart: string;
  pickupEnd: string;
  status: ProductStatus;
  reportCount: number;
  registeredAt: string;
  updatedAt: string;
  storage: string;
  allergyInfo: string;
  originInfo: string;
  description: string;
  imageUrl?: string;
  memo?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerId: string;
  sellerName: string;
  sellerId: string;
  productName: string;
  productId: string;
  amount: number;
  quantity: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  pickupTime: string;
  orderedAt: string;
  memo?: string;
}

export interface Settlement {
  id: string;
  sellerName: string;
  sellerId: string;
  businessNumber: string;
  period: string;
  totalSales: number;
  commission: number;
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
  reviewNumber: string;
  productName: string;
  storeName: string;
  buyerName: string;
  rating: number;
  tags: string[];
  content: string;
  writtenAt: string;
  reportCount: number;
  status: ReviewStatus;
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
