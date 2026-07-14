import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Store, Package, ShoppingCart, CreditCard,
  Flag, Star, Megaphone, Tag, Ticket, Leaf, Users, Settings,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';

const navItems = [
  { path: '/', label: '대시보드', icon: LayoutDashboard },
  { path: '/sellers', label: '판매자 관리', icon: Store },
  { path: '/products', label: '상품 관리', icon: Package },
  { path: '/orders', label: '주문 관리', icon: ShoppingCart },
  { path: '/settlements', label: '정산 관리', icon: CreditCard },
  { path: '/reports', label: '신고/문의 관리', icon: Flag },
  { path: '/reviews', label: '리뷰 관리', icon: Star },
  { path: '/banners', label: '배너/공지 관리', icon: Megaphone },
  { path: '/categories', label: '카테고리 관리', icon: Tag },
  { path: '/coupons', label: '쿠폰/프로모션', icon: Ticket },
  { path: '/env-stats', label: '환경 통계', icon: Leaf },
  { path: '/admins', label: '관리자 계정', icon: Users },
  { path: '/settings', label: '설정', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* lg 미만에서 사이드바를 드로어로 열었을 때의 배경 오버레이 (탭하면 닫힘) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full bg-charcoal flex flex-col z-40 w-60 transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:z-30 lg:transition-all ${collapsed ? 'lg:w-16' : 'lg:w-60'}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <div className="flex items-center min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">FP</span>
            </div>
            <span className={`ml-3 text-white font-bold text-base whitespace-nowrap ${collapsed ? 'lg:hidden' : ''}`}>FoodPicker 관리자</span>
          </div>
          <button onClick={onMobileClose} className="text-gray-400 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors group ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className={`text-sm font-medium ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Toggle (데스크톱 전용 — 모바일은 X 버튼으로 닫는다) */}
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center h-12 border-t border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>
    </>
  );
}
