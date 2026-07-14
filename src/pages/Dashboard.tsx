import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, ShoppingCart, XCircle,
  Store, Flag, CreditCard, AlertTriangle, ArrowRight
} from 'lucide-react';
import {
  mockDailyOrders, mockCategoryStats,
  mockHourlyPickups
} from '../data/mockData';

const COLORS = ['#22A06B', '#FF8A3D', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B'];

/**
 * [백엔드 연동 안내] statCards/alerts/차트 데이터가 모두 하드코딩된 예시값. 실 연동 시 집계 API 필요:
 * - GET /api/admin/dashboard/summary → 오늘 거래액/주문수/픽업완료/취소/신규판매자/신고/정산보류 건수 (orders/stores/reports/settlements 집계)
 * - GET /api/admin/dashboard/daily-orders?days=7 → 일별 주문수/거래액 (차트용)
 * - GET /api/admin/dashboard/alerts → "운영 주의 알림" 피드(소비기한 임박, 신고 누적 매장, 정산 보류 등 여러 도메인을 조합한 결과이므로
 *   프론트에서 여러 API를 합치기보다 백엔드에서 하나의 알림 피드로 합쳐 내려주는 것을 권장)
 * 집계 쿼리는 실시간 계산 비용이 크므로 배치/캐시(예: 5분 주기 머티리얼라이즈드 뷰) 설계를 권장.
 */
const statCards = [
  { label: '신규 판매자 신청', value: '8건', icon: Store, color: 'text-warm-orange', bg: 'bg-orange-50', sub: '검토 필요' },
  { label: '오늘 거래액', value: '1,284,000원', icon: TrendingUp, color: 'text-primary', bg: 'bg-primary-light', sub: '어제 대비 +12%' },
  { label: '오늘 주문 수', value: '245건', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', sub: '어제 대비 +8' },
  { label: '오늘 취소', value: '12건', icon: XCircle, color: 'text-alert-red', bg: 'bg-red-50', sub: '취소율 4.9%' },
  { label: '신고 접수', value: '3건', icon: Flag, color: 'text-alert-red', bg: 'bg-red-50', sub: '미처리 2건' },
  { label: '정산 보류', value: '1건', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50', sub: '확인 필요' },
];

const alerts = [
  { text: '소비기한 경과 상품 등록 시도 3건', path: '/products', severity: 'high' },
  { text: '신고 누적 판매자 2곳 (맛있는반찬, 기타매장)', path: '/sellers', severity: 'high' },
  { text: '정산 보류 1건 - 맛있는반찬', path: '/settlements', severity: 'medium' },
  { text: '취소율 높은 매장 1곳 - 신선도시락 (15%)', path: '/sellers', severity: 'medium' },
  { text: '미처리 신고/문의 2건', path: '/reports', severity: 'low' },
];

const wasteReductionData = [
  { date: '06/09', kg: 42 },
  { date: '06/10', kg: 48 },
  { date: '06/11', kg: 45 },
  { date: '06/12', kg: 53 },
  { date: '06/13', kg: 58 },
  { date: '06/14', kg: 51 },
  { date: '06/15', kg: 62 },
];

export default function Dashboard() {
  const navigate = useNavigate();

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
            <BarChart data={mockDailyOrders} barSize={24}>
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
            <AreaChart data={mockDailyOrders}>
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
              <Pie data={mockCategoryStats} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {mockCategoryStats.map((_, i) => (
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
            <LineChart data={mockHourlyPickups}>
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
