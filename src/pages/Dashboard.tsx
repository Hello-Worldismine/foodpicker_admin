import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, ShoppingCart, XCircle,
  Store, Flag, CreditCard, AlertTriangle, ArrowRight
} from 'lucide-react';
import { fetchDashboardStats } from '../lib/api';

const COLORS = ['#22A06B', '#FF8A3D', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B'];

/**
 * [백엔드 연동 안내] Supabase RPC `admin_dashboard_stats`(api.fetchDashboardStats) 실데이터 연동 완료.
 * 통계 카드/차트/운영 주의 알림 모두 이 jsonb 집계 결과를 사용한다.
 * 전일 대비 증감(%/건)·취소율·예상 폐기 감소량(완료 수량 × 0.25kg 추정)은 클라이언트에서 계산.
 */
interface DailyPoint {
  date: string;
  orders: number;
  revenue: number;
  completedQty: number;
}

interface DashboardData {
  todayRevenue: number;
  yesterdayRevenue: number;
  todayOrders: number;
  yesterdayOrders: number;
  todayPickups: number;
  todayCancels: number;
  newSellerApps: number;
  newReportsToday: number;
  unresolvedReports: number;
  pendingSettlements: number;
  onHoldStores: string[];
  expiryPausedCount: number;
  daily: DailyPoint[];
  categoryStats: { name: string; value: number }[];
  hourlyPickups: { hour: string; count: number }[];
  highCancelStores: { name: string; rate: number }[];
}

interface AlertItem {
  text: string;
  path: string;
  severity: 'high' | 'medium' | 'low';
}

function revenueDiffLabel(today: number, yesterday: number): string {
  if (yesterday === 0) return '-';
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return `어제 대비 ${pct >= 0 ? '+' : ''}${pct}%`;
}

function orderDiffLabel(today: number, yesterday: number): string {
  if (yesterday === 0) return '-';
  const diff = today - yesterday;
  return `어제 대비 ${diff >= 0 ? '+' : ''}${diff}건`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchDashboardStats()
      .then(data => { if (!cancelled) setStats(data as DashboardData); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>;
  }
  if (loadError || !stats) {
    return <div className="py-16 text-center text-sm text-alert-red">{loadError || '데이터를 불러오지 못했습니다.'}</div>;
  }

  const cancelRateLabel = stats.todayOrders === 0
    ? '-'
    : `취소율 ${((stats.todayCancels / stats.todayOrders) * 100).toFixed(1)}%`;

  const statCards = [
    { label: '신규 판매자 신청', value: `${stats.newSellerApps}건`, icon: Store, color: 'text-warm-orange', bg: 'bg-orange-50', sub: stats.newSellerApps > 0 ? '검토 필요' : '대기 없음' },
    { label: '오늘 거래액', value: `${stats.todayRevenue.toLocaleString()}원`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary-light', sub: revenueDiffLabel(stats.todayRevenue, stats.yesterdayRevenue) },
    { label: '오늘 주문 수', value: `${stats.todayOrders}건`, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', sub: orderDiffLabel(stats.todayOrders, stats.yesterdayOrders) },
    { label: '오늘 취소', value: `${stats.todayCancels}건`, icon: XCircle, color: 'text-alert-red', bg: 'bg-red-50', sub: cancelRateLabel },
    { label: '신고 접수', value: `${stats.newReportsToday}건`, icon: Flag, color: 'text-alert-red', bg: 'bg-red-50', sub: `미처리 ${stats.unresolvedReports}건` },
    { label: '정산 보류', value: `${stats.pendingSettlements}건`, icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50', sub: stats.pendingSettlements > 0 ? '확인 필요' : '이상 없음' },
  ];

  const wasteReductionData = stats.daily.map(d => ({
    date: d.date,
    kg: Math.round(d.completedQty * 0.25 * 10) / 10,
  }));

  const onHoldStores = stats.onHoldStores ?? [];
  const alerts: AlertItem[] = [];
  if (stats.expiryPausedCount > 0) {
    alerts.push({ text: `소비기한 경과로 판매 중지된 상품 ${stats.expiryPausedCount}건`, path: '/products', severity: 'high' });
  }
  if (stats.newSellerApps > 0) {
    alerts.push({ text: `신규 판매자 신청 ${stats.newSellerApps}건 검토 필요`, path: '/sellers', severity: stats.newSellerApps >= 5 ? 'high' : 'medium' });
  }
  if (stats.pendingSettlements > 0) {
    alerts.push({
      text: `정산 보류 ${stats.pendingSettlements}건${onHoldStores.length > 0 ? ` - ${onHoldStores.join(', ')}` : ''}`,
      path: '/settlements',
      severity: 'medium',
    });
  }
  (stats.highCancelStores ?? []).forEach(s => {
    alerts.push({ text: `취소율 높은 매장 - ${s.name} (${s.rate}%)`, path: '/orders', severity: 'medium' });
  });
  if (stats.unresolvedReports > 0) {
    alerts.push({ text: `미처리 신고/문의 ${stats.unresolvedReports}건`, path: '/reports', severity: stats.unresolvedReports >= 3 ? 'medium' : 'low' });
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="card p-4">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-lg font-bold text-charcoal leading-tight">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-charcoal mb-4">일별 주문 수 (최근 7일)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.daily} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="orders" fill="#22A06B" radius={[4, 4, 0, 0]} name="주문 수" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-charcoal mb-4">일별 거래액 (최근 7일)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.daily}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22A06B" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22A06B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v/10000).toFixed(0)}만`} />
              <Tooltip formatter={(v) => [`${(v as number).toLocaleString()}원`, '거래액']} />
              <Area type="monotone" dataKey="revenue" stroke="#22A06B" fill="url(#revenueGrad)" strokeWidth={2} name="거래액" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-charcoal mb-4">카테고리별 판매량</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={stats.categoryStats} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {stats.categoryStats.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-charcoal mb-4">시간대별 픽업량</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.hourlyPickups}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#FF8A3D" strokeWidth={2} dot={false} name="픽업 수" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-charcoal mb-4">예상 폐기 감소량 (kg)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={wasteReductionData}>
              <defs>
                <linearGradient id="wasteGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22A06B" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22A06B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${v as number}kg`, '예상 감소량']} />
              <Area type="monotone" dataKey="kg" stroke="#22A06B" fill="url(#wasteGrad)" strokeWidth={2} name="감소량(kg)" />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-400 mt-2">* 예상 수치로 실제 값과 다를 수 있습니다.</p>
        </div>
      </div>

      {/* Alerts */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-charcoal mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-warm-orange" />
          운영 주의 알림
        </h2>
        <div className="space-y-2">
          {alerts.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">현재 주의가 필요한 알림이 없습니다.</p>
          )}
          {alerts.map((alert, i) => (
            <button
              key={i}
              onClick={() => navigate(alert.path)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-soft-gray transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  alert.severity === 'high' ? 'bg-alert-red' :
                  alert.severity === 'medium' ? 'bg-warm-orange' : 'bg-yellow-400'
                }`} />
                <span className="text-sm text-charcoal">{alert.text}</span>
              </div>
              <ArrowRight size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
