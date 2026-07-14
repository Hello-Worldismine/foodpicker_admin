import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Sidebar.tsx의 w-16/w-60(Tailwind, rem 단위)과 반드시 동일한 값을 rem으로 맞춘다.
  // 여기를 px 숫자로 두면 브라우저 확대/OS 배율(고DPI)에서 두 값의 반올림이 어긋나
  // 헤더와 사이드바 경계가 겹쳐 보이는 문제가 생길 수 있다.
  // lg 미만(모바일/태블릿)에서는 사이드바가 오버레이 드로어로 열리므로 본문을 밀지 않는다 — 값은 lg 이상에서만 적용된다.
  const sidebarWidth = collapsed ? '4rem' : '15rem';

  return (
    <div className="min-h-screen bg-soft-gray" style={{ ['--sidebar-w' as string]: sidebarWidth }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <Header onMenuClick={() => setMobileOpen(true)} />
      <main
        className="pt-16 min-h-screen transition-all duration-300 ml-0 lg:ml-[var(--sidebar-w)]"
      >
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
