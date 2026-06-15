import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import SellerManagement from './pages/SellerManagement';
import ProductManagement from './pages/ProductManagement';
import OrderManagement from './pages/OrderManagement';
import SettlementManagement from './pages/SettlementManagement';
import ReportManagement from './pages/ReportManagement';
import ReviewManagement from './pages/ReviewManagement';
import BannerManagement from './pages/BannerManagement';
import CategoryManagement from './pages/CategoryManagement';
import CouponManagement from './pages/CouponManagement';
import EnvStats from './pages/EnvStats';
import AdminAccounts from './pages/AdminAccounts';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sellers" element={<SellerManagement />} />
          <Route path="/products" element={<ProductManagement />} />
          <Route path="/orders" element={<OrderManagement />} />
          <Route path="/settlements" element={<SettlementManagement />} />
          <Route path="/reports" element={<ReportManagement />} />
          <Route path="/reviews" element={<ReviewManagement />} />
          <Route path="/banners" element={<BannerManagement />} />
          <Route path="/categories" element={<CategoryManagement />} />
          <Route path="/coupons" element={<CouponManagement />} />
          <Route path="/env-stats" element={<EnvStats />} />
          <Route path="/admins" element={<AdminAccounts />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
