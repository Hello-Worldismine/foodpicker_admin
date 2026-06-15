import { useState } from 'react';
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { mockCoupons } from '../data/mockData';
import type { Coupon } from '../types';

export default function CouponManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>(mockCoupons);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    name: '', discountType: '정액' as '정액' | '정률', discountValue: 0,
    minOrderAmount: 0, startDate: '', endDate: '', target: '전체', totalQuantity: 100,
  });

  const save = () => {
    if (!form.name.trim()) return alert('쿠폰명을 입력하세요.');
    setCoupons(prev => [...prev, {
      id: `cp${Date.now()}`, ...form, usedQuantity: 0, active: true
    }]);
    setModal(false);
  };

  const toggle = (id: string) => setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">쿠폰/프로모션</h2>
            <p className="text-xs text-gray-400 mt-1">쿠폰을 생성하고 발급 현황을 관리합니다.</p>
          </div>
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2"><Plus size={15} /> 쿠폰 추가</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-soft-gray/50">
                {['쿠폰명', '할인 방식', '할인값', '최소주문금액', '기간', '대상', '발급/사용', '상태'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} className={`border-b border-gray-50 ${!c.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.discountType} 할인</td>
                  <td className="px-4 py-3 text-primary font-semibold">
                    {c.discountType === '정액' ? `${c.discountValue.toLocaleString()}원` : `${c.discountValue}%`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.minOrderAmount.toLocaleString()}원 이상</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.startDate} ~ {c.endDate}</td>
                  <td className="px-4 py-3 text-gray-600">{c.target}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">{c.totalQuantity}</span>
                      <span className="text-gray-300">/</span>
                      <span className="text-warm-orange font-medium">{c.usedQuantity}</span>
                    </div>
                    <div className="w-20 bg-gray-100 rounded-full h-1.5 mt-1">
                      <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(c.usedQuantity / c.totalQuantity) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(c.id)}>
                      {c.active ? <ToggleRight size={24} className="text-primary" /> : <ToggleLeft size={24} className="text-gray-300" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="쿠폰 추가" size="lg">
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500 block mb-1">쿠폰명</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">할인 방식</label>
              <select className="input" value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value as '정액' | '정률' })}>
                <option value="정액">정액 할인</option>
                <option value="정률">정률 할인</option>
              </select>
            </div>
            <div><label className="text-xs text-gray-500 block mb-1">{form.discountType === '정액' ? '할인 금액 (원)' : '할인율 (%)'}</label>
              <input type="number" className="input" value={form.discountValue} onChange={e => setForm({ ...form, discountValue: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">최소 주문금액</label><input type="number" className="input" value={form.minOrderAmount} onChange={e => setForm({ ...form, minOrderAmount: Number(e.target.value) })} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">발급 수량</label><input type="number" className="input" value={form.totalQuantity} onChange={e => setForm({ ...form, totalQuantity: Number(e.target.value) })} /></div>
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">발급 대상</label>
            <select className="input" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}>
              {['전체', '신규 회원', '기존 회원', '특정 회원'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">시작일</label><input type="date" className="input" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">종료일</label><input type="date" className="input" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModal(false)} className="btn-secondary flex-1">취소</button>
            <button onClick={save} className="btn-primary flex-1">저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
