import { useState } from 'react';
import { Plus, Copy, Check } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Switch from '../components/ui/Switch';
import { mockCoupons } from '../data/mockData';
import type { Coupon } from '../types';

/**
 * [백엔드 연동 안내] 현재 mockCoupons(목데이터)로 동작 중. 실 DB에는 쿠폰 테이블이 아예 없음(신규 설계 필요).
 * 제안 스키마: coupons(id, code UNIQUE, name, discount_type, discount_value, min_order_amount,
 *   start_date, end_date, target, total_quantity, used_quantity, active, created_at)
 * API 예시:
 * - GET /api/admin/coupons, POST /api/admin/coupons, PATCH /api/admin/coupons/:id/active
 * - 사용자 앱에서 쿠폰번호(code)를 입력해 등록/사용 처리하는 엔드포인트가 별도로 필요: POST /api/coupons/redeem { code }
 *   (동시성 이슈 방지를 위해 used_quantity 증가는 DB 트랜잭션/락으로 처리 필요)
 * 지금 프론트에서 생성하는 code는 클라이언트 랜덤 생성이라 서버 저장 전까지 중복 가능성이 있음 — 실제로는 서버에서 UNIQUE 제약 + 재시도로 발급해야 함.
 */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function CouponManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>(mockCoupons);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Coupon | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    code: generateCode(), name: '', discountType: '정액' as '정액' | '정률', discountValue: 0,
    minOrderAmount: 0, startDate: '', endDate: '', target: '전체', totalQuantity: 100,
  });

  const save = () => {
    if (!form.name.trim()) return alert('쿠폰명을 입력하세요.');
    if (!form.code.trim()) return alert('쿠폰번호를 입력하세요.');
    setCoupons(prev => [...prev, {
      id: `cp${Date.now()}`, ...form, usedQuantity: 0, active: true
    }]);
    setModal(false);
    setForm({ code: generateCode(), name: '', discountType: '정액', discountValue: 0, minOrderAmount: 0, startDate: '', endDate: '', target: '전체', totalQuantity: 100 });
  };

  const toggle = (id: string) => {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
    setSelected(prev => prev && prev.id === id ? { ...prev, active: !prev.active } : prev);
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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
                {['쿠폰명', '쿠폰번호', '할인 방식', '할인값', '최소주문금액', '기간', '대상', '발급/사용', '상태', '관리'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} className={`border-b border-gray-50 ${!c.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{c.code}</td>
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
                    <Switch checked={c.active} onChange={() => toggle(c.id)} label={`${c.name} 활성화 여부`} />
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-primary hover:underline" onClick={() => setSelected(c)}>상세</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="쿠폰 상세">
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">쿠폰번호 (사용자 등록용)</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-primary bg-primary-light rounded-lg px-3 py-2 flex-1 text-center tracking-wider">{selected.code}</span>
                <button onClick={() => copyCode(selected.code)} className="btn-secondary flex items-center gap-1 text-xs px-3 py-2">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '복사됨' : '복사'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">사용자가 앱의 쿠폰 등록 화면에 이 번호를 직접 입력해야 발급됩니다.</p>
            </div>

            <div className="space-y-1.5 text-sm">
              {[
                ['쿠폰명', selected.name],
                ['할인', selected.discountType === '정액' ? `${selected.discountValue.toLocaleString()}원 할인` : `${selected.discountValue}% 할인`],
                ['최소주문금액', `${selected.minOrderAmount.toLocaleString()}원 이상`],
                ['대상', selected.target],
                ['기간', `${selected.startDate} ~ ${selected.endDate}`],
                ['발급/사용', `${selected.totalQuantity} / ${selected.usedQuantity}`],
                ['상태', selected.active ? '활성' : '비활성'],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between"><span className="text-gray-500">{l}</span><span className="text-charcoal">{v}</span></div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => toggle(selected.id)} className="btn-secondary flex-1 text-sm">
                {selected.active ? '비활성화' : '활성화'}
              </button>
              <button onClick={() => setSelected(null)} className="btn-primary flex-1 text-sm">닫기</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal} onClose={() => setModal(false)} title="쿠폰 추가" size="lg">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">쿠폰번호 (사용자 등록용)</label>
            <div className="flex gap-2">
              <input className="input font-mono flex-1" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              <button type="button" onClick={() => setForm({ ...form, code: generateCode() })} className="btn-secondary text-xs px-3">재생성</button>
            </div>
          </div>
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
