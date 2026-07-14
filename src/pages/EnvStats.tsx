import { useEffect, useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Leaf, Package, TrendingDown, DollarSign } from 'lucide-react';
import ExcelDownloadButton from '../components/ui/ExcelDownloadButton';
import Toast from '../components/ui/Toast';
import { useExcelDownload } from '../hooks/useExcelDownload';
import { fetchEnvStats } from '../lib/api';

const COLORS = ['#22A06B', '#FF8A3D', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B'];

/**
 * [백엔드 연동 안내] Supabase RPC `admin_env_stats`(api.fetchEnvStats) 실데이터 연동 완료.
 * 반환 jsonb: totalSoldQty, totalDiscountAmount, monthly(최근 6개월 [{month,products}]),
 * categoryStats([{name,value(수량)}]), regionStats([{region,qty}]).
 * 폐기 감소량(kg)=판매 수량×0.25, 탄소 절감(톤)=kg×2/1000 은 클라이언트 추정 계산.
 */
interface EnvStatsData {
  totalSoldQty: number;
  totalDiscountAmount: number;
  monthly: { month: string; products: number }[];
  categoryStats: { name: string; value: number }[];
  regionStats: { region: string; qty: number }[];
}

function formatWon(amount: number): string {
  if (amount >= 100_000_000) {
    const eok = amount / 100_000_000;
    return `약 ${eok >= 10 ? Math.round(eok).toLocaleString() : eok.toFixed(1)}억 원`;
  }
  if (amount >= 10_000) return `약 ${Math.round(amount / 10_000).toLocaleString()}만 원`;
  return `${amount.toLocaleString()}원`;
}

export default function EnvStats() {
  const { download, isLoading, toast, canDownload } = useExcelDownload();
  const [envStats, setEnvStats] = useState<EnvStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchEnvStats()
      .then((data) => { if (!cancelled) setEnvStats(data as EnvStatsData); })
      .catch((e) => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const monthlyData = (envStats?.monthly ?? []).map((m) => ({ ...m, kg: m.products * 0.25 }));
  const regionData = (envStats?.regionStats ?? []).map((r) => ({ region: r.region, kg: r.qty * 0.25 }));
  const categoryTotal = (envStats?.categoryStats ?? []).reduce((sum, c) => sum + c.value, 0);
  const categoryWasteData = (envStats?.categoryStats ?? []).map((c) => ({
    name: c.name,
    value: categoryTotal > 0 ? Math.round((c.value / categoryTotal) * 100) : 0,
  }));

  const totalSoldQty = envStats?.totalSoldQty ?? 0;
  const wasteKg = totalSoldQty * 0.25;
  const carbonTons = (wasteKg * 2) / 1000;

  const handleExcelDownload = () => {
    download({
      filename: 'env_stats',
      menu: '환경 통계',
      filters: '전체',
      sheets: [
        {
          name: '월별 현황',
          data: monthlyData.map(d => ({
            '월': d.month,
            '판매 상품 수(개)': d.products,
            '예상 폐기 감소량(kg, 추정)': d.kg,
          })),
        },
        {
          name: '지역별 현황',
          data: regionData.map(d => ({
            '지역': d.region,
            '예상 폐기 감소량(kg, 추정)': d.kg,
          })),
        },
        {
          name: '카테고리별 현황',
          data: categoryWasteData.map(d => ({
            '카테고리': d.name,
            '비율(%, 추정)': d.value,
          })),
        },
      ],
    });
  };

  const stats = [
    { label: '누적 판매 상품 수', value: `${totalSoldQty.toLocaleString()}개`, icon: Package, color: 'text-primary', bg: 'bg-primary-light', note: '' },
    { label: '예상 음식물 폐기 감소량', value: `${wasteKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}kg`, icon: Leaf, color: 'text-primary', bg: 'bg-primary-light', note: '* 상품 평균 250g 기준 추정' },
    { label: '예상 탄소 절감량', value: `${carbonTons.toLocaleString(undefined, { maximumFractionDigits: 2 })}톤 CO₂`, icon: TrendingDown, color: 'text-blue-600', bg: 'bg-blue-50', note: '* 1kg 음식물 = 2kgCO₂ 기준 추정' },
    { label: '예상 절감 금액', value: formatWon(envStats?.totalDiscountAmount ?? 0), icon: DollarSign, color: 'text-warm-orange', bg: 'bg-orange-50', note: '* 할인 금액 합계 기준 추정' },
  ];

  return (
    <div className="space-y-6">
      {/* Disclaimer + Download */}
      <div className="flex items-center gap-4">
        <div className="flex-1 bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-700">
          ⚠️ 이 페이지의 모든 수치는 <strong>예상 또는 추정값</strong>으로, 실제 측정값과 다를 수 있습니다. 참고용으로만 활용해 주세요.
        </div>
        <ExcelDownloadButton onClick={handleExcelDownload} isLoading={isLoading} hidden={!canDownload} />
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : loadError ? (
        <div className="py-16 text-center text-sm text-red-500">{loadError}</div>
      ) : (
      <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, note }) => (
          <div key={label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={20} className={color} />
            </div>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-xl font-bold text-charcoal">{value}</p>
            {note && <p className="text-xs text-gray-400 mt-2">{note}</p>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-charcoal mb-1">월별 판매 상품 수 & 예상 폐기 감소량</h2>
          <p className="text-xs text-gray-400 mb-4">* 폐기 감소량은 추정값입니다.</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="products" fill="#22A06B" radius={[4, 4, 0, 0]} name="판매 상품 수" />
              <Bar yAxisId="right" dataKey="kg" fill="#FF8A3D" radius={[4, 4, 0, 0]} name="폐기 감소량(kg, 추정)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-charcoal mb-1">카테고리별 예상 폐기 감소량</h2>
          <p className="text-xs text-gray-400 mb-4">* 비율은 추정값입니다.</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={categoryWasteData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                {categoryWasteData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v as number}%`, '비율(추정)']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-charcoal mb-1">지역별 예상 음식물 폐기 감소량 (kg)</h2>
        <p className="text-xs text-gray-400 mb-4">* 추정값입니다.</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={regionData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="region" type="category" tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v) => [`${v as number}kg`, '폐기 감소량(추정)']} />
            <Bar dataKey="kg" fill="#22A06B" radius={[0, 4, 4, 0]} name="감소량(kg, 추정)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
