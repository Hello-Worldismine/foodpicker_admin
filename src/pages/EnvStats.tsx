import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Leaf, Package, TrendingDown, DollarSign } from 'lucide-react';

const COLORS = ['#22A06B', '#FF8A3D', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B'];

const regionData = [
  { region: '서울 강남', kg: 124 },
  { region: '서울 마포', kg: 87 },
  { region: '서울 서초', kg: 65 },
  { region: '경기 성남', kg: 43 },
  { region: '서울 홍대', kg: 91 },
  { region: '인천 연수', kg: 38 },
];

const categoryWasteData = [
  { name: '도시락', value: 35 },
  { name: '빵', value: 28 },
  { name: '디저트', value: 17 },
  { name: '반찬', value: 12 },
  { name: '음료', value: 5 },
  { name: '샐러드', value: 3 },
];

const monthlyData = [
  { month: '1월', products: 1240, kg: 310 },
  { month: '2월', products: 1380, kg: 345 },
  { month: '3월', products: 1560, kg: 390 },
  { month: '4월', products: 1720, kg: 430 },
  { month: '5월', products: 1890, kg: 472 },
  { month: '6월', products: 2050, kg: 512 },
];

export default function EnvStats() {
  const stats = [
    { label: '누적 판매 상품 수', value: '9,840개', icon: Package, color: 'text-primary', bg: 'bg-primary-light', note: '' },
    { label: '예상 음식물 폐기 감소량', value: '2,460kg', icon: Leaf, color: 'text-primary', bg: 'bg-primary-light', note: '* 상품 평균 250g 기준 추정' },
    { label: '예상 탄소 절감량', value: '4.9톤 CO₂', icon: TrendingDown, color: 'text-blue-600', bg: 'bg-blue-50', note: '* 1kg 음식물 = 2kgCO₂ 기준 추정' },
    { label: '예상 절감 금액', value: '약 1억 2천만 원', icon: DollarSign, color: 'text-warm-orange', bg: 'bg-orange-50', note: '* 할인 금액 합계 기준 추정' },
  ];

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-700">
        ⚠️ 이 페이지의 모든 수치는 <strong>예상 또는 추정값</strong>으로, 실제 측정값과 다를 수 있습니다. 참고용으로만 활용해 주세요.
      </div>

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
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {categoryWasteData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v}%`, '비율(추정)']} />
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
            <Tooltip formatter={(v: number) => [`${v}kg`, '폐기 감소량(추정)']} />
            <Bar dataKey="kg" fill="#22A06B" radius={[0, 4, 4, 0]} name="감소량(kg, 추정)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
