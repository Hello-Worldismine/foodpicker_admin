import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Switch from '../components/ui/Switch';
import { fetchCategories, createCategory, updateCategory } from '../lib/api';
import type { Category } from '../types';

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 조회: fetchCategories() — categories 테이블 + admin_products.category 집계로 productCount 포함.
 * - 생성: createCategory(name, icon), 수정/활성화/비활성화: updateCategory(id, patch).
 * - 삭제는 물리 삭제 대신 active=false 비활성화로 처리.
 */
export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: '' });

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then(rows => { if (!cancelled) setCategories(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openAdd = () => { setEditCat(null); setForm({ name: '', icon: '' }); setModal(true); };
  const openEdit = (c: Category) => { setEditCat(c); setForm({ name: c.name, icon: c.icon }); setModal(true); };

  const save = async () => {
    if (!form.name.trim()) return alert('카테고리명을 입력하세요.');
    try {
      if (editCat) {
        await updateCategory(editCat.id, { name: form.name, icon: form.icon });
        setCategories(prev => prev.map(c => c.id === editCat.id ? { ...c, ...form } : c));
      } else {
        const created = await createCategory(form.name, form.icon);
        setCategories(prev => [...prev, created]);
      }
      setModal(false);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('카테고리를 비활성화하시겠습니까?')) return;
    try {
      await updateCategory(id, { active: false });
      setCategories(prev => prev.map(c => c.id === id ? { ...c, active: false } : c));
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const toggle = async (cat: Category) => {
    try {
      await updateCategory(cat.id, { active: !cat.active });
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, active: !cat.active } : c));
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-charcoal">카테고리 관리</h2>
            <p className="text-xs text-gray-400 mt-1">드래그하여 순서를 변경할 수 있습니다.</p>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={15} /> 카테고리 추가</button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : loadError ? (
          <div className="py-16 text-center text-sm text-alert-red">{loadError}</div>
        ) : (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <div key={cat.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${cat.active ? 'border-gray-100 bg-white hover:border-primary/30' : 'border-gray-100 bg-soft-gray opacity-60'}`}>
              <span className="text-gray-300 cursor-grab"><GripVertical size={16} /></span>
              <span className="text-2xl w-8 text-center">{cat.icon}</span>
              <div className="flex-1">
                <p className="font-medium text-sm text-charcoal">{cat.name}</p>
                <p className="text-xs text-gray-400">상품 {cat.productCount}개 등록됨</p>
              </div>
              <span className="text-xs text-gray-400">순서 {idx + 1}</span>
              <div className="flex items-center gap-2">
                <Switch checked={cat.active} onChange={() => toggle(cat)} label={`${cat.name} 활성화 여부`} />
                <button onClick={() => openEdit(cat)} className="text-gray-400 hover:text-primary transition-colors p-1">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => remove(cat.id)} className="text-gray-400 hover:text-alert-red transition-colors p-1">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editCat ? '카테고리 수정' : '카테고리 추가'}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">이모지 아이콘</label>
            <input className="input" placeholder="예: 🍕" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">카테고리명</label>
            <input className="input" placeholder="카테고리명 입력" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
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
