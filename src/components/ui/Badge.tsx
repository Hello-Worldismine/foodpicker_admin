import type { SellerStatus, ProductStatus, OrderStatus, SettlementStatus, ReportStatus, ReviewStatus } from '../../types';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'orange' | 'purple';

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-primary-light text-primary',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-alert-red',
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-warm-orange',
  purple: 'bg-purple-100 text-purple-700',
};

const sellerStatusMap: Record<SellerStatus, BadgeVariant> = {
  '승인대기': 'yellow',
  '승인완료': 'green',
  '반려': 'red',
  '이용정지': 'orange',
  '탈퇴': 'gray',
};

const productStatusMap: Record<ProductStatus, BadgeVariant> = {
  '판매중': 'green',
  '품절': 'gray',
  '판매종료': 'gray',
  '숨김': 'gray',
  '검수대기': 'yellow',
  '반려': 'red',
  '관리자중지': 'red',
};

const orderStatusMap: Record<OrderStatus, BadgeVariant> = {
  '결제완료': 'blue',
  '픽업대기': 'yellow',
  '픽업완료': 'green',
  '취소요청': 'orange',
  '환불완료': 'gray',
  '노쇼': 'red',
  '분쟁중': 'purple',
};

const settlementStatusMap: Record<SettlementStatus, BadgeVariant> = {
  '정산예정': 'yellow',
  '정산완료': 'green',
  '보류': 'red',
};

const reportStatusMap: Record<ReportStatus, BadgeVariant> = {
  '접수': 'blue',
  '확인중': 'yellow',
  '판매자 답변 대기': 'orange',
  '구매자 답변 대기': 'orange',
  '환불 처리': 'purple',
  '종결': 'green',
};

const reviewStatusMap: Record<ReviewStatus, BadgeVariant> = {
  '정상': 'green',
  '숨김': 'gray',
  '신고검토': 'red',
  '삭제': 'gray',
};

interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
  type?: 'seller' | 'product' | 'order' | 'settlement' | 'report' | 'review';
}

export default function Badge({ children, variant, type }: BadgeProps) {
  let resolvedVariant: BadgeVariant = variant ?? 'gray';

  if (!variant && type) {
    if (type === 'seller') resolvedVariant = sellerStatusMap[children as SellerStatus] ?? 'gray';
    else if (type === 'product') resolvedVariant = productStatusMap[children as ProductStatus] ?? 'gray';
    else if (type === 'order') resolvedVariant = orderStatusMap[children as OrderStatus] ?? 'gray';
    else if (type === 'settlement') resolvedVariant = settlementStatusMap[children as SettlementStatus] ?? 'gray';
    else if (type === 'report') resolvedVariant = reportStatusMap[children as ReportStatus] ?? 'gray';
    else if (type === 'review') resolvedVariant = reviewStatusMap[children as ReviewStatus] ?? 'gray';
  }

  return (
    <span className={`badge ${variantClasses[resolvedVariant]}`}>
      {children}
    </span>
  );
}
