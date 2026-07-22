import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, HelpCircle } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Switch from '../components/ui/Switch';
import { fetchFaqs, createFaq, updateFaq, toggleFaqActive, deleteFaq } from '../lib/api';
import type { Faq, FaqCategory } from '../types';

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동. `faqs` 테이블(신규 — 마이그레이션 필요, 아래 참고).
 * - 조회: fetchFaqs() — category, display_order 순 정렬.
 * - 생성/수정: createFaq(form) / updateFaq(id, form). 노출 여부: toggleFaqActive(id, active).
 * - 삭제: deleteFaq(id) — 다른 관리 화면과 달리 물리 삭제(비활성화 아님). 실수 방지를 위해 확인창을 거친다.
 * - 카테고리 4종(주문 · 결제/픽업/상품 · 가게/계정)은 소비자 앱 foodpicker_app/src/screens/FAQScreen.js 의
 *   고정 그룹과 동일하다. DB에는 영문 키(order_payment/pickup/product_store/account)로 저장되고
 *   src/lib/labels.ts의 FAQ_CATEGORY_KO/EN 이 화면 라벨과 매핑한다.
 * ⚠️ 소비자 앱은 아직 이 FAQ 내용을 화면에 하드코딩(FAQScreen.js의 FAQS 상수)해서 보여주고 있어,
 *   여기서 등록/수정해도 앱에는 반영되지 않는다. 실제로 연동하려면 소비자 앱도 faqs 테이블(공개 조회,
 *   is_active=true 행만)을 fetch하도록 수정해야 한다 — 이번 작업 범위는 관리자 웹까지다.
 * ⚠️ DB 마이그레이션: FoodPicker_seller_app/supabase/migrations/에 faqs 테이블 생성 SQL을 추가해뒀다
 *   (관리자만 쓰기, 활성 행은 공개 읽기 가능하도록 RLS 설계). Supabase SQL Editor에서 직접 실행해야
 *   실제로 테이블이 생기며, 이 화면은 그 전까지 "데이터를 불러오지 못했습니다" 오류를 표시한다.
 */
const FAQ_CATEGORIES: FaqCategory[] = ['주문 · 결제', '픽업', '상품 · 가게', '계정'];

export default function FaqManagement() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(false);
  const [editFaq, setEditFaq] = useState<Faq | null>(null);
  const [form, setForm] = useState<{ category: FaqCategory; question: string; answer: string }>({
    category: '주문 · 결제', question: '', answer: '',
  });

  useEffect(() => {
    let cancelled = false;
    fetchFaqs()
      .then(rows => { if (!cancelled) setFaqs(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openAdd = (category: FaqCategory) => {
    setEditFaq(null);
    setForm({ category, question: '', answer: '' });
    setModal(true);
  };
  const openEdit = (f: Faq) => {
    setEditFaq(f);
    setForm({ category: f.category, question: f.question, answer: f.answer });
    setModal(true);
  };

  const save = async () => {
    if (!form.question.trim()) return alert('질문을 입력하세요.');
    if (!form.answer.trim()) return alert('답변을 입력하세요.');
    try {
      if (editFaq) {
        const updated = await updateFaq(editFaq.id, form);
        setFaqs(prev => prev.map(f => f.id === updated.id ? updated : f));
      } else {
        const created = await createFaq(form);
        setFaqs(prev => [...prev, created]);
      }
      setModal(false);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const toggle = async (f: Faq) => {
    try {
      await toggleFaqActive(f.id, !f.active);
      setFaqs(prev => prev.map(x => x.id === f.id ? { ...x, active: !f.active } : x));
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const remove = async (f: Faq) => {
    if (!confirm(`"${f.question}" 항목을 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
    try {
      await deleteFaq(f.id);
      setFaqs(prev => prev.filter(x => x.id !== f.id));
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-semibold text-charcoal flex items-center gap-2"><HelpCircle size={18} className="text-primary" /> FAQ 관리</h2>
            <p className="text-xs text-gray-400 mt-1">사용자 앱 "자주 묻는 질문" 화면에 노출되는 Q&A를 카테고리별로 관리합니다.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card py-16 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : loadError ? (
        <div className="card py-16 text-center text-sm text-alert-red">{loadError}</div>
      ) : (
        FAQ_CATEGORIES.map(category => {
          const items = faqs.filter(f => f.category === category);
          return (
            <div key={category} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-charcoal">{category}</h3>
                <button onClick={() => openAdd(category)} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5">
                  <Plus size={13} /> 질문 추가
                </button>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">등록된 질문이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {items.map(f => (
                    <div key={f.id} className={`p-4 rounded-xl border transition-colors ${f.active ? 'border-gray-100 bg-white hover:border-primary/30' : 'border-gray-100 bg-soft-gray opacity-60'}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-charcoal">Q. {f.question}</p>
                          <p className="text-sm text-gray-500 mt-1.5 whitespace-pre-wrap">A. {f.answer}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Switch checked={f.active} onChange={() => toggle(f)} label={`${f.question} 노출 여부`} />
                          <button onClick={() => openEdit(f)} className="text-gray-400 hover:text-primary transition-colors p-1">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => remove(f)} className="text-gray-400 hover:text-alert-red transition-colors p-1">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editFaq ? 'FAQ 수정' : 'FAQ 추가'} size="lg">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">카테고리</label>
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as FaqCategory })}>
              {FAQ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">질문</label>
            <input className="input" placeholder="예: 주문 취소는 어떻게 하나요?" value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">답변</label>
            <textarea className="input h-28 resize-none" placeholder="답변 내용을 입력하세요." value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })} />
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
