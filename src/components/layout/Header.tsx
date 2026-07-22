import { Search, Bell, LogOut, ChevronDown, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { fetchDashboardStats } from '../../lib/api';

const pageTitles: Record<string, string> = {
  '/': '대시보드',
  '/sellers': '판매자 관리',
  '/products': '상품 관리',
  '/orders': '주문 관리',
  '/settlements': '정산 관리',
  '/reports': '신고/문의 관리',
  '/reviews': '리뷰 관리',
  '/banners': '배너/공지 관리',
  '/categories': '카테고리 관리',
  '/coupons': '쿠폰/프로모션',
  '/faqs': 'FAQ 관리',
  '/env-stats': '환경 통계',
  '/admins': '관리자 계정',
  '/settings': '설정',
};

interface HeaderProps {
  onMenuClick: () => void;
}

interface HeaderAlert {
  id: number;
  text: string;
  path: string;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentAdmin, signOut } = useAdmin();
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [alerts, setAlerts] = useState<HeaderAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardStats().then(stats => {
      if (cancelled || !stats) return;
      const next: HeaderAlert[] = [];
      if (stats.newSellerApps > 0) next.push({ id: 1, text: `신규 판매자 신청 ${stats.newSellerApps}건 검토 필요`, path: '/sellers' });
      if (stats.unresolvedReports > 0) next.push({ id: 2, text: `미처리 신고/문의 ${stats.unresolvedReports}건`, path: '/reports' });
      if (stats.pendingSettlements > 0) next.push({ id: 3, text: `정산 보류 ${stats.pendingSettlements}건 확인 필요`, path: '/settlements' });
      if (stats.expiryPausedCount > 0) next.push({ id: 4, text: `소비기한 경과로 중지된 상품 ${stats.expiryPausedCount}건`, path: '/products' });
      setAlerts(next);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname]);

  const pageTitle = Object.entries(pageTitles).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )?.[1] ?? '페이지';

  return (
    <header
      className="fixed top-0 left-0 right-0 lg:left-[var(--sidebar-w)] h-16 bg-white border-b border-gray-100 flex items-center pl-4 lg:pl-8 pr-4 sm:pr-6 gap-2 sm:gap-4 z-20 transition-all duration-300"
    >
      <button onClick={onMenuClick} className="p-2 -ml-2 rounded-lg hover:bg-soft-gray transition-colors lg:hidden">
        <Menu size={20} className="text-gray-600" />
      </button>

      <h1 className="text-base sm:text-lg font-semibold text-charcoal mr-auto truncate">{pageTitle}</h1>

      {/* Search */}
      <div className="relative hidden sm:block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="검색..."
          className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}
          className="relative p-2 rounded-lg hover:bg-soft-gray transition-colors"
        >
          <Bell size={20} className="text-gray-600" />
          {alerts.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-alert-red rounded-full" />
          )}
        </button>
        {showNotif && (
          <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold">알림</p>
            </div>
            {alerts.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">확인할 알림이 없습니다.</div>
            )}
            {alerts.map(n => (
              <button
                key={n.id}
                onClick={() => { setShowNotif(false); navigate(n.path); }}
                className="block w-full text-left px-4 py-3 hover:bg-soft-gray cursor-pointer border-b border-gray-50 last:border-0"
              >
                <p className="text-sm text-charcoal">{n.text}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="relative">
        <button
          onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-soft-gray transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">{currentAdmin.name.charAt(0)}</span>
          </div>
          <span className="text-sm font-medium hidden sm:block">{currentAdmin.name}</span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
        {showProfile && (
          <div className="absolute right-0 top-12 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold">{currentAdmin.name}</p>
              <p className="text-xs text-gray-400">{currentAdmin.role}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 w-full px-4 py-3 text-sm text-alert-red hover:bg-soft-gray transition-colors"
            >
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
