import type {
  Seller, Product, Order, Settlement, Report, Review,
  Banner, Notice, Category, Coupon, AdminAccount, DashboardStats, ActionLog
} from '../types';

/**
 * [백엔드 연동 안내] 이 파일 전체가 프론트 전용 목데이터이며, 실제 Supabase 연동이 아직 없음
 * (package.json에 @supabase/supabase-js 미설치, .env 없음 — 100% 로컬 mock 상태).
 * 각 배열이 실 DB 어느 테이블에 대응되는지는 types/index.ts의 각 인터페이스 상단 주석과 pages/*.tsx의
 * "[백엔드 연동 안내]" 주석을 참고할 것. 요약:
 * - 실 DB 테이블 있음 (판매자 앱 FoodPicker_seller_app/supabase/migrations 참고): mockSellers→stores, mockProducts→products,
 *   mockOrders→orders, mockSettlements→settlements, mockReviews→reviews, mockNotices→notices(단, 컬럼 일부 확장 필요)
 * - 실 DB 테이블 없음(신규 설계 필요): mockReports, mockBanners, mockCategories, mockCoupons, mockAdmins
 * 연동 시에는 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수 기반 클라이언트를 새로 만들고
 * (판매자 앱의 src/lib/supabase.js, src/lib/api.js 패턴 참고), 이 mock 배열들을 실제 fetch 함수로 교체하면 됨.
 */
// 목데이터 전용 placeholder 이미지(실 업로드 파일이 없으므로 SVG를 데이터 URI로 즉석 생성).
// 실 연동 시에는 storage(Supabase Storage 등)에 업로드된 실제 파일 URL로 대체된다.
function bizCertPlaceholder(storeName: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="594" viewBox="0 0 420 594">
    <rect width="420" height="594" fill="#fff" stroke="#d1d5db" stroke-width="2"/>
    <rect x="24" y="24" width="372" height="56" fill="#22A06B"/>
    <text x="210" y="60" font-family="sans-serif" font-size="20" fill="#fff" text-anchor="middle" font-weight="bold">사업자등록증</text>
    <text x="210" y="140" font-family="sans-serif" font-size="16" fill="#1F2933" text-anchor="middle">상호: ${storeName}</text>
    <line x1="60" y1="190" x2="360" y2="190" stroke="#e5e7eb" stroke-width="1"/>
    <line x1="60" y1="230" x2="360" y2="230" stroke="#e5e7eb" stroke-width="1"/>
    <line x1="60" y1="270" x2="360" y2="270" stroke="#e5e7eb" stroke-width="1"/>
    <text x="210" y="560" font-family="sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle">(목데이터 샘플 이미지)</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const mockSellers: Seller[] = [
  { id: 's1', storeName: '베이커리 달콤', ownerName: '김민준', bizNumber: '123-45-67890', residentNumberMasked: '901231-1******', region: '서울 강남', status: '승인완료', commissionRate: 10, joinDate: '2024-03-15', totalOrders: 342, reportCount: 1, phone: '010-1234-5678', email: 'dalcom@email.com', address: '서울 강남구 테헤란로 123', bankName: '신한은행', accountNumber: '110-123-456789', accountHolder: '김민준', categoryMain: '빵', memo: '', bizCertImage: bizCertPlaceholder('베이커리 달콤') },
  { id: 's2', storeName: '신선도시락', ownerName: '이수연', bizNumber: '234-56-78901', residentNumberMasked: '880604-2******', region: '서울 마포', status: '승인완료', commissionRate: 10, joinDate: '2024-04-02', totalOrders: 215, reportCount: 0, phone: '010-2345-6789', email: 'fresh@email.com', address: '서울 마포구 합정로 45', bankName: '국민은행', accountNumber: '120-234-567890', accountHolder: '이수연', categoryMain: '도시락', memo: '', bizCertImage: bizCertPlaceholder('신선도시락') },
  { id: 's3', storeName: '건강샐러드', ownerName: '박지훈', bizNumber: '345-67-89012', residentNumberMasked: '920815-1******', region: '서울 서초', status: '승인대기', commissionRate: 10, joinDate: '2024-06-10', totalOrders: 0, reportCount: 0, phone: '010-3456-7890', email: 'salad@email.com', address: '서울 서초구 강남대로 78', bankName: '우리은행', accountNumber: '130-345-678901', accountHolder: '박지훈', categoryMain: '샐러드', memo: '', bizCertImage: bizCertPlaceholder('건강샐러드') },
  { id: 's4', storeName: '맛있는반찬', ownerName: '최은지', bizNumber: '456-78-90123', residentNumberMasked: '850227-2******', region: '경기 성남', status: '이용정지', commissionRate: 10, joinDate: '2024-01-20', totalOrders: 89, reportCount: 7, phone: '010-4567-8901', email: 'banchan@email.com', address: '경기 성남시 분당구 판교로 56', bankName: '하나은행', accountNumber: '140-456-789012', accountHolder: '최은지', categoryMain: '반찬', memo: '신고 누적으로 이용정지', bizCertImage: bizCertPlaceholder('맛있는반찬') },
  { id: 's5', storeName: '카페 디저트', ownerName: '정우성', bizNumber: '567-89-01234', residentNumberMasked: '910109-1******', region: '서울 홍대', status: '반려', commissionRate: 10, joinDate: '2024-05-30', totalOrders: 0, reportCount: 0, phone: '010-5678-9012', email: 'dessert@email.com', address: '서울 마포구 와우산로 99', bankName: '신한은행', accountNumber: '150-567-890123', accountHolder: '정우성', categoryMain: '디저트', memo: '사업자등록증 정보 불명확' },
  { id: 's6', storeName: '과일음료', ownerName: '한소희', bizNumber: '678-90-12345', residentNumberMasked: '930402-2******', region: '서울 강동', status: '승인완료', commissionRate: 8, joinDate: '2024-02-28', totalOrders: 456, reportCount: 2, phone: '010-6789-0123', email: 'juice@email.com', address: '서울 강동구 천호대로 200', bankName: '농협은행', accountNumber: '160-678-901234', accountHolder: '한소희', categoryMain: '음료', memo: '', bizCertImage: bizCertPlaceholder('과일음료') },
  { id: 's7', storeName: '전통분식', ownerName: '오민석', bizNumber: '789-01-23456', residentNumberMasked: '870718-1******', region: '경기 수원', status: '승인대기', commissionRate: 10, joinDate: '2024-06-12', totalOrders: 0, reportCount: 0, phone: '010-7890-1234', email: 'bunsik@email.com', address: '경기 수원시 영통구 광교로 33', bankName: '기업은행', accountNumber: '170-789-012345', accountHolder: '오민석', categoryMain: '기타', memo: '' },
  { id: 's8', storeName: '웰빙도시락', ownerName: '송지은', bizNumber: '890-12-34567', residentNumberMasked: '940523-2******', region: '인천 연수', status: '승인완료', commissionRate: 10, joinDate: '2024-03-05', totalOrders: 178, reportCount: 0, phone: '010-8901-2345', email: 'wellbeing@email.com', address: '인천 연수구 컨벤시아대로 100', bankName: '카카오뱅크', accountNumber: '3333-01-1234567', accountHolder: '송지은', categoryMain: '도시락', memo: '', bizCertImage: bizCertPlaceholder('웰빙도시락') },
];

export const mockProducts: Product[] = [
  { id: 'p1', name: '당일 소화 바게트', storeName: '베이커리 달콤', sellerId: 's1', category: '빵', originalPrice: 5000, startPrice: 3500, floorPrice: 2000, salePrice: 2000, discountRate: 60, reductionAmount: 500, intervalMinutes: 60, stock: 5, expiryDate: '2024-06-15 23:59', pickupStart: '18:00', pickupEnd: '20:00', status: '판매중', reportCount: 0, registeredAt: '2024-06-15 09:00', updatedAt: '2024-06-15 09:00', storage: '실온', storageDetail: '직사광선을 피해 보관', allergyInfo: '밀, 계란', originInfo: '국내산', description: '당일 구운 바게트 2개 묶음', imageUrl: '', memo: '' },
  { id: 'p2', name: '오늘의 도시락 세트', storeName: '신선도시락', sellerId: 's2', category: '도시락', originalPrice: 9000, salePrice: 4500, discountRate: 50, stock: 10, expiryDate: '2024-06-15 21:00', pickupStart: '17:00', pickupEnd: '19:00', status: '판매중', reportCount: 0, registeredAt: '2024-06-15 08:00', updatedAt: '2024-06-15 08:00', storage: '냉장', storageDetail: '수령 후 냉장 보관, 데워서 섭취', allergyInfo: '없음', originInfo: '국내산', description: '신선한 당일 도시락', imageUrl: '', memo: '' },
  { id: 'p3', name: '그린 샐러드 믹스', storeName: '건강샐러드', sellerId: 's3', category: '샐러드', originalPrice: 8000, salePrice: 3500, discountRate: 56, stock: 8, expiryDate: '2024-06-15 22:00', pickupStart: '16:00', pickupEnd: '19:00', status: '숨김', reportCount: 0, registeredAt: '2024-06-15 10:00', updatedAt: '2024-06-15 10:00', storage: '냉장', allergyInfo: '없음', originInfo: '국내산', description: '신선한 채소 믹스 샐러드', imageUrl: '', memo: '리뷰 신고 확인 중 임시 숨김 처리' },
  { id: 'p4', name: '오늘의 반찬 3종', storeName: '맛있는반찬', sellerId: 's4', category: '반찬', originalPrice: 12000, salePrice: 5000, discountRate: 58, stock: 3, expiryDate: '2024-06-14 20:00', pickupStart: '17:00', pickupEnd: '19:00', status: '판매중지', pauseReason: '소비기한 경과', reportCount: 5, registeredAt: '2024-06-14 09:00', updatedAt: '2024-06-15 11:00', storage: '냉장', allergyInfo: '대두', originInfo: '국내산', description: '3가지 반찬 세트', imageUrl: '', memo: '소비기한 경과로 자동 종료' },
  { id: 'p5', name: '딸기 크림케이크', storeName: '카페 디저트', sellerId: 's5', category: '디저트', originalPrice: 15000, salePrice: 7000, discountRate: 53, stock: 2, expiryDate: '2024-06-15 20:00', pickupStart: '17:00', pickupEnd: '19:00', status: '판매중', reportCount: 1, registeredAt: '2024-06-15 07:00', updatedAt: '2024-06-15 07:00', storage: '냉장', allergyInfo: '밀, 계란, 유제품', originInfo: '국내산', description: '당일 제조 케이크', imageUrl: '', memo: '' },
  { id: 'p6', name: '착즙 오렌지 주스 2팩', storeName: '과일음료', sellerId: 's6', category: '음료', originalPrice: 6000, salePrice: 2800, discountRate: 53, stock: 15, expiryDate: '2024-06-16 18:00', pickupStart: '09:00', pickupEnd: '18:00', status: '판매중', reportCount: 0, registeredAt: '2024-06-15 06:00', updatedAt: '2024-06-15 06:00', storage: '냉장', allergyInfo: '없음', originInfo: '미국산', description: '신선한 착즙 오렌지 주스', imageUrl: '', memo: '' },
  { id: 'p7', name: '크루아상 4개 묶음', storeName: '베이커리 달콤', sellerId: 's1', category: '빵', originalPrice: 7000, salePrice: 3000, discountRate: 57, stock: 0, expiryDate: '2024-06-15 21:00', pickupStart: '18:00', pickupEnd: '20:00', status: '품절', reportCount: 0, registeredAt: '2024-06-15 09:30', updatedAt: '2024-06-15 15:00', storage: '실온', allergyInfo: '밀, 계란, 유제품', originInfo: '국내산', description: '버터 크루아상 4개', imageUrl: '', memo: '' },
  { id: 'p8', name: '웰빙 현미 도시락', storeName: '웰빙도시락', sellerId: 's8', category: '도시락', originalPrice: 10000, salePrice: 4800, discountRate: 52, stock: 6, expiryDate: '2024-06-15 21:00', pickupStart: '17:00', pickupEnd: '20:00', status: '판매중', reportCount: 0, registeredAt: '2024-06-15 08:30', updatedAt: '2024-06-15 08:30', storage: '냉장', allergyInfo: '없음', originInfo: '국내산', description: '건강한 현미 도시락', imageUrl: '', memo: '' },
];

export const mockOrders: Order[] = [
  { id: 'o1', orderNumber: 'FP-1001', buyerName: '홍길동', buyerId: 'u1', safeNumber: '050-1234-0001', sellerName: '베이커리 달콤', sellerId: 's1', productName: '당일 소화 바게트', productId: 'p1', amount: 2000, fee: 200, totalPrice: 2000, quantity: 1, status: '픽업완료', paymentStatus: '결제완료', pickupTime: '19:30', orderedAt: '2024-06-15 14:32' },
  { id: 'o2', orderNumber: 'FP-1002', buyerName: '김철수', buyerId: 'u2', safeNumber: '050-1234-0002', sellerName: '신선도시락', sellerId: 's2', productName: '오늘의 도시락 세트', productId: 'p2', amount: 4500, fee: 450, totalPrice: 4500, quantity: 1, status: '픽업대기', paymentStatus: '결제완료', pickupTime: '18:00', orderedAt: '2024-06-15 15:10' },
  { id: 'o3', orderNumber: 'FP-1003', buyerName: '이영희', buyerId: 'u3', safeNumber: '050-1234-0003', sellerName: '과일음료', sellerId: 's6', productName: '착즙 오렌지 주스 2팩', productId: 'p6', amount: 5600, fee: 0, totalPrice: 5600, quantity: 2, status: '취소', paymentStatus: '결제취소', pickupTime: '12:00', orderedAt: '2024-06-15 10:05', memo: '구매자 요청으로 픽업 전 취소' },
  { id: 'o4', orderNumber: 'FP-1004', buyerName: '박민수', buyerId: 'u4', safeNumber: '050-1234-0004', sellerName: '카페 디저트', sellerId: 's5', productName: '딸기 크림케이크', productId: 'p5', amount: 7000, fee: 700, totalPrice: 7000, quantity: 1, status: '픽업대기', paymentStatus: '결제완료', pickupTime: '18:30', orderedAt: '2024-06-15 11:20', memo: '상품 상태 문의로 CS 확인 중' },
  { id: 'o5', orderNumber: 'FP-1005', buyerName: '최지영', buyerId: 'u5', safeNumber: '050-1234-0005', sellerName: '웰빙도시락', sellerId: 's8', productName: '웰빙 현미 도시락', productId: 'p8', amount: 4800, fee: 480, totalPrice: 4800, quantity: 1, status: '신규접수', paymentStatus: '결제완료', pickupTime: '18:00', orderedAt: '2024-06-15 16:45' },
  { id: 'o6', orderNumber: 'FP-1006', buyerName: '정대호', buyerId: 'u6', safeNumber: '050-1234-0006', sellerName: '베이커리 달콤', sellerId: 's1', productName: '크루아상 4개 묶음', productId: 'p7', amount: 3000, fee: 0, totalPrice: 3000, quantity: 1, status: '취소', paymentStatus: '환불완료', pickupTime: '19:00', orderedAt: '2024-06-15 09:15' },
  { id: 'o7', orderNumber: 'FP-1007', buyerName: '한예슬', buyerId: 'u7', safeNumber: '050-1234-0007', sellerName: '신선도시락', sellerId: 's2', productName: '오늘의 도시락 세트', productId: 'p2', amount: 4500, fee: 450, totalPrice: 4500, quantity: 1, status: '취소', paymentStatus: '결제완료', pickupTime: '17:30', orderedAt: '2024-06-15 13:00', memo: '노쇼(미수령)로 자동 취소, 환불 없음' },
  { id: 'o8', orderNumber: 'FP-0989', buyerName: '오세진', buyerId: 'u8', safeNumber: '050-1234-0008', sellerName: '과일음료', sellerId: 's6', productName: '착즙 오렌지 주스 2팩', productId: 'p6', amount: 2800, fee: 280, totalPrice: 2800, quantity: 1, status: '픽업완료', paymentStatus: '결제완료', pickupTime: '15:00', orderedAt: '2024-06-14 12:00' },
];

export const mockSettlements: Settlement[] = [
  { id: 'set1', sellerName: '베이커리 달콤', sellerId: 's1', bizNumber: '123-45-67890', period: '2024-06-01 ~ 2024-06-15', totalSales: 284000, platformFee: 22720, pgFee: 5680, commission: 28400, refundAmount: 3000, finalAmount: 252600, status: '정산예정', scheduledDate: '2024-06-20', bankName: '신한은행', accountNumber: '110-123-456789', accountHolder: '김민준', memo: '' },
  { id: 'set2', sellerName: '신선도시락', sellerId: 's2', bizNumber: '234-56-78901', period: '2024-06-01 ~ 2024-06-15', totalSales: 193500, platformFee: 15480, pgFee: 3870, commission: 19350, refundAmount: 0, finalAmount: 174150, status: '정산완료', scheduledDate: '2024-06-20', bankName: '국민은행', accountNumber: '120-234-567890', accountHolder: '이수연', memo: '' },
  { id: 'set3', sellerName: '맛있는반찬', sellerId: 's4', bizNumber: '456-78-90123', period: '2024-06-01 ~ 2024-06-15', totalSales: 45000, platformFee: 3600, pgFee: 900, commission: 4500, refundAmount: 5000, finalAmount: 35500, status: '보류', scheduledDate: '2024-06-20', bankName: '하나은행', accountNumber: '140-456-789012', accountHolder: '최은지', memo: '신고 건 처리 필요' },
  { id: 'set4', sellerName: '과일음료', sellerId: 's6', bizNumber: '678-90-12345', period: '2024-06-01 ~ 2024-06-15', totalSales: 392400, platformFee: 31392, pgFee: 7848, commission: 39240, refundAmount: 0, finalAmount: 353160, status: '정산예정', scheduledDate: '2024-06-20', bankName: '농협은행', accountNumber: '160-678-901234', accountHolder: '한소희', memo: '' },
  { id: 'set5', sellerName: '웰빙도시락', sellerId: 's8', bizNumber: '890-12-34567', period: '2024-06-01 ~ 2024-06-15', totalSales: 153600, platformFee: 12288, pgFee: 3072, commission: 15360, refundAmount: 0, finalAmount: 138240, status: '정산완료', scheduledDate: '2024-06-20', bankName: '카카오뱅크', accountNumber: '3333-01-1234567', accountHolder: '송지은', memo: '' },
];

// 목데이터 전용 증빙 사진 placeholder(실 업로드 파일이 없으므로 SVG를 데이터 URI로 즉석 생성).
function evidencePhotoPlaceholder(emoji: string, bg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="${bg}"/>
    <text x="150" y="180" font-size="110" text-anchor="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const mockReports: Report[] = [
  { id: 'r1', receiptNumber: 'RPT-2406-001', inquirerType: '사용자', type: '상품 상태가 설명과 달라요', orderNumber: 'FP-1004', buyerName: '박민수', sellerName: '카페 디저트', title: '케이크 상태가 사진과 달랐어요', content: '주문한 케이크가 사진과 전혀 달랐습니다. 크림이 다 녹아있었고 모양도 달랐어요.', evidence: [
    { type: 'image', url: evidencePhotoPlaceholder('🍰', '#F3E8E8') },
    { type: 'image', url: evidencePhotoPlaceholder('😖', '#FDECEC') },
    { type: 'video', url: evidencePhotoPlaceholder('🎬', '#E8ECF3') },
  ], status: '확인중', receivedAt: '2024-06-15 19:30', manager: '김관리', memo: '' },
  { id: 'r2', receiptNumber: 'RPT-2406-002', inquirerType: '사용자', type: '소비기한이 지났어요', orderNumber: 'FP-0989', buyerName: '이영희', sellerName: '맛있는반찬', title: '소비기한이 이미 지난 상품을 팔았어요', content: '구매한 반찬에 소비기한이 이미 지나있었습니다.', evidence: [
    { type: 'image', url: evidencePhotoPlaceholder('🥘', '#F3E8E8') },
    { type: 'image', url: evidencePhotoPlaceholder('📅', '#FDF3E7') },
  ], status: '환불 처리', receivedAt: '2024-06-14 21:00', manager: '이운영', memo: '환불 처리 완료' },
  { id: 'r3', receiptNumber: 'RPT-2406-003', inquirerType: '사용자', type: '결제/환불 문제가 있어요', orderNumber: 'FP-1003', buyerName: '이영희', sellerName: '과일음료', title: '취소 후 환불이 안 돼요', content: '주문 취소를 했는데 환불이 아직 안 됐습니다.', status: '판매자 답변 대기', receivedAt: '2024-06-15 16:00', manager: '김관리', memo: '' },
  { id: 'r4', receiptNumber: 'RPT-2406-004', inquirerType: '사용자', type: '매장이 픽업을 거부했어요', orderNumber: 'FP-1007', buyerName: '한예슬', sellerName: '신선도시락', title: '픽업하러 갔는데 매장이 닫혀있었어요', content: '픽업 시간에 맞춰 갔는데 매장 문이 닫혀있었습니다.', status: '접수', receivedAt: '2024-06-15 18:30', manager: '미배정', memo: '' },
  // 판매자(점주)가 직접 남긴 1:1 문의 — 구매자/주문과 무관하게 정산·계정 등을 문의
  { id: 'r5', receiptNumber: 'RPT-2407-001', inquirerType: '판매자', type: '정산 관련 문의', sellerName: '베이커리 달콤', title: '이번 주 정산 금액이 예상보다 적게 들어왔어요', content: '6월 정산 내역을 확인했는데 예상했던 금액보다 적게 입금되었습니다. 수수료 계산이 맞는지 확인 부탁드립니다.', status: '접수', receivedAt: '2024-07-01 10:20', manager: '박정산', memo: '' },
  { id: 'r6', receiptNumber: 'RPT-2407-002', inquirerType: '판매자', type: '계정/정보 변경 요청', sellerName: '신선도시락', title: '매장 정산 계좌를 변경하고 싶어요', content: '계좌를 국민은행에서 신한은행으로 변경하고 싶습니다. 어떻게 처리하면 될까요?', status: '확인중', receivedAt: '2024-06-28 15:40', manager: '이운영', memo: '' },
  { id: 'r7', receiptNumber: 'RPT-2407-003', inquirerType: '판매자', type: '이용정지/제재 이의제기', sellerName: '맛있는반찬', title: '이용정지 처리에 이의를 제기합니다', content: '신고 누적으로 이용정지 처리되었는데, 해당 신고 건들은 이미 소명하고 환불 처리까지 완료한 건들입니다. 재검토 부탁드립니다.', status: '접수', receivedAt: '2024-07-02 09:00', manager: '미배정', memo: '' },
];

// 목데이터 전용 리뷰 사진 placeholder(실 업로드 파일이 없으므로 SVG를 데이터 URI로 즉석 생성).
function reviewPhotoPlaceholder(emoji: string, bg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="${bg}"/>
    <text x="150" y="180" font-size="110" text-anchor="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const mockReviews: Review[] = [
  { id: 'rv1', productName: '당일 소화 바게트', storeName: '베이커리 달콤', buyerName: '홍길동', rating: 5, content: '정말 신선하고 맛있었어요! 가성비도 최고입니다.', images: [reviewPhotoPlaceholder('🥖', '#FDF3E7')], writtenAt: '2024-06-15 20:15', reportCount: 0, status: '정상', ownerReply: '맛있게 드셨다니 감사합니다! 또 방문해주세요 :)', ownerRepliedAt: '2024-06-15 21:00' },
  { id: 'rv2', productName: '오늘의 도시락 세트', storeName: '신선도시락', buyerName: '김철수', rating: 4, content: '도시락이 맛있고 양도 충분했어요.', writtenAt: '2024-06-14 19:30', reportCount: 0, status: '정상' },
  { id: 'rv3', productName: '오늘의 반찬 3종', storeName: '맛있는반찬', buyerName: '오세진', rating: 1, content: '상품이 설명과 달랐고 소비기한도 지나있었어요. 절대 추천 안 합니다.', images: [reviewPhotoPlaceholder('🥘', '#F3E8E8'), reviewPhotoPlaceholder('⏰', '#FDECEC')], writtenAt: '2024-06-14 22:00', reportCount: 3, status: '신고검토' },
  { id: 'rv4', productName: '착즙 오렌지 주스 2팩', storeName: '과일음료', buyerName: '정대호', rating: 5, content: '신선하고 맛있는 주스! 꼭 다시 살 거예요.', writtenAt: '2024-06-13 14:00', reportCount: 0, status: '정상' },
];

export const mockBanners: Banner[] = [
  { id: 'b1', title: '소비기한 임박 특가!', imageUrl: '', link: '/sale', position: '메인 상단', startDate: '2024-06-01', endDate: '2024-06-30', active: true },
  { id: 'b2', title: '신규 판매자 모집', imageUrl: '', link: '/seller-join', position: '메인 중간', startDate: '2024-06-10', endDate: '2024-07-10', active: true },
  { id: 'b3', title: '여름 시즌 음료 특가', imageUrl: '', link: '/category/drinks', position: '메인 하단', startDate: '2024-06-15', endDate: '2024-08-31', active: false },
];

export const mockNotices: Notice[] = [
  { id: 'n1', title: '서비스 이용 약관 개정 안내', content: '2024년 7월 1일부터 서비스 이용 약관이 개정됩니다...', target: '전체', startDate: '2024-06-10', endDate: '2024-07-10', important: true, active: true, createdAt: '2024-06-10' },
  { id: 'n2', title: '판매자 정산 일정 안내', content: '6월 정산은 6월 20일에 진행됩니다...', target: '판매자', startDate: '2024-06-15', endDate: '2024-06-25', important: false, active: true, createdAt: '2024-06-15' },
  { id: 'n3', title: '앱 업데이트 안내 (v2.1)', content: '새로운 기능이 추가되었습니다...', target: '사용자', startDate: '2024-06-12', endDate: '2024-06-30', important: false, active: true, createdAt: '2024-06-12' },
];

export const mockCategories: Category[] = [
  { id: 'c1', name: '빵', icon: '🍞', productCount: 45, active: true, order: 1 },
  { id: 'c2', name: '도시락', icon: '🍱', productCount: 62, active: true, order: 2 },
  { id: 'c3', name: '샐러드', icon: '🥗', productCount: 28, active: true, order: 3 },
  { id: 'c4', name: '반찬', icon: '🥘', productCount: 35, active: true, order: 4 },
  { id: 'c5', name: '디저트', icon: '🍰', productCount: 41, active: true, order: 5 },
  { id: 'c6', name: '음료', icon: '🧃', productCount: 23, active: true, order: 6 },
  { id: 'c7', name: '기타', icon: '📦', productCount: 12, active: false, order: 7 },
];

export const mockCoupons: Coupon[] = [
  { id: 'cp1', code: 'WELCOME1000', name: '신규 가입 할인', discountType: '정액', discountValue: 1000, minOrderAmount: 3000, startDate: '2024-06-01', endDate: '2024-12-31', target: '신규 회원', totalQuantity: 1000, usedQuantity: 342, active: true, costBearer: '본사', allowStacking: true, source: '관리자 발행' },
  { id: 'cp2', code: 'ECOHERO10', name: '환경 챔피언 쿠폰', discountType: '정률', discountValue: 10, maxDiscountAmount: 3000, minOrderAmount: 5000, startDate: '2024-06-01', endDate: '2024-06-30', target: '전체', totalQuantity: 500, usedQuantity: 128, active: true, costBearer: '분담', platformShare: 50, allowStacking: false, source: '관리자 발행' },
  // 점주가 직접 신청한 쿠폰 — 예산 100% 점주 부담, 관리자 승인 대기 중
  { id: 'cp3', code: 'BANCHAN20', name: '맛있는반찬 단골 할인', discountType: '정률', discountValue: 20, maxDiscountAmount: 4000, minOrderAmount: 10000, startDate: '2024-07-01', endDate: '2024-07-31', target: '해당 매장', totalQuantity: 200, usedQuantity: 0, active: false, costBearer: '점주', allowStacking: false, source: '점주 신청', sellerId: 's4', sellerName: '맛있는반찬', requestStatus: '대기' },
  { id: 'cp4', code: 'DALCOM1500', name: '베이커리 달콤 오픈 기념', discountType: '정액', discountValue: 1500, minOrderAmount: 5000, startDate: '2024-07-05', endDate: '2024-07-20', target: '해당 매장', totalQuantity: 100, usedQuantity: 0, active: false, costBearer: '점주', allowStacking: true, source: '점주 신청', sellerId: 's1', sellerName: '베이커리 달콤', requestStatus: '대기' },
];

export const mockAdmins: AdminAccount[] = [
  { id: 'a1', name: '김관리', email: 'admin@foodpicker.kr', role: '최고관리자', status: '활성', lastLogin: '2024-06-15 09:00', createdAt: '2023-01-01' },
  { id: 'a2', name: '이운영', email: 'ops@foodpicker.kr', role: '운영관리자', status: '활성', lastLogin: '2024-06-15 08:30', createdAt: '2023-06-01' },
  { id: 'a3', name: '박정산', email: 'settle@foodpicker.kr', role: '정산관리자', status: '활성', lastLogin: '2024-06-14 17:00', createdAt: '2023-06-01' },
  { id: 'a4', name: '최CS', email: 'cs@foodpicker.kr', role: 'CS관리자', status: '활성', lastLogin: '2024-06-15 10:15', createdAt: '2024-01-15' },
  { id: 'a5', name: '정뷰어', email: 'viewer@foodpicker.kr', role: '읽기전용', status: '비활성', lastLogin: '2024-05-30 14:00', createdAt: '2024-03-01' },
];

export const mockDashboardStats: DashboardStats = {
  todayRevenue: 1284000,
  todayOrders: 245,
  todayPickups: 198,
  todayCancels: 12,
  newSellerApps: 8,
  newReports: 3,
  pendingSettlements: 1,
};

export const mockDailyOrders = [
  { date: '06/09', orders: 198, revenue: 892000 },
  { date: '06/10', orders: 223, revenue: 1045000 },
  { date: '06/11', orders: 215, revenue: 987000 },
  { date: '06/12', orders: 241, revenue: 1123000 },
  { date: '06/13', orders: 256, revenue: 1198000 },
  { date: '06/14', orders: 232, revenue: 1087000 },
  { date: '06/15', orders: 245, revenue: 1284000 },
];

export const mockCategoryStats = [
  { name: '도시락', value: 35 },
  { name: '빵', value: 25 },
  { name: '디저트', value: 18 },
  { name: '반찬', value: 12 },
  { name: '음료', value: 7 },
  { name: '샐러드', value: 3 },
];

export const mockHourlyPickups = [
  { hour: '09시', count: 12 },
  { hour: '10시', count: 18 },
  { hour: '11시', count: 25 },
  { hour: '12시', count: 45 },
  { hour: '13시', count: 38 },
  { hour: '14시', count: 22 },
  { hour: '15시', count: 15 },
  { hour: '16시', count: 20 },
  { hour: '17시', count: 48 },
  { hour: '18시', count: 62 },
  { hour: '19시', count: 55 },
  { hour: '20시', count: 30 },
];

export const mockActionLogs: ActionLog[] = [
  { id: 'log1', adminName: '김관리', action: '판매자 승인', target: '판매자', targetId: 's6', detail: '과일음료 판매자 입점 승인', createdAt: '2024-06-15 10:00' },
  { id: 'log2', adminName: '이운영', action: '판매자 이용정지', target: '판매자', targetId: 's4', detail: '신고 누적으로 이용정지 처리 (사유: 소비기한 경과 상품 반복 판매)', createdAt: '2024-06-15 11:30' },
  { id: 'log3', adminName: '김관리', action: '상품 판매중지', target: '상품', targetId: 'p4', detail: '소비기한 경과 상품 판매중지', createdAt: '2024-06-15 11:35' },
  { id: 'log4', adminName: '최CS', action: '신고 처리', target: '신고', targetId: 'r2', detail: '소비기한 경과 상품 신고 - 환불 처리 완료', createdAt: '2024-06-15 14:00' },
];
