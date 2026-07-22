import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, GripVertical, ImagePlus, X } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Switch from '../components/ui/Switch';
import { fetchCategories, createCategory, updateCategory, uploadCategoryIcon } from '../lib/api';
import type { Category } from '../types';

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 조회: fetchCategories() — categories 테이블 + admin_products.category 집계로 productCount 포함.
 * - 생성: createCategory(name, icon, imageUrl?), 수정/활성화/비활성화: updateCategory(id, patch).
 * - 삭제는 물리 삭제 대신 active=false 비활성화로 처리.
 * - 아이콘 이미지: 파일 선택 즉시 uploadCategoryIcon()으로 Storage에 업로드하고 public URL을 image_url로 저장.
 *   이미지가 없으면 기존 이모지 아이콘으로 폴백 표시.
 * - 백엔드 의존: 20260722010000 마이그레이션(categories.image_url 컬럼 + category-icons 버킷) 적용 필요.
 */
export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', icon: '', imageUrl: '' });
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 업로드 세대 토큰 — 모달 개폐/재선택 시 증가시켜, 이전에 진행 중이던 업로드 결과가
  // 다음에 연 폼에 주입되는 것을 방지한다.
  const uploadSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then(rows => { if (!cancelled) setCategories(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openAdd = () => { uploadSeqRef.current++; setImageUploading(false); setEditCat(null); setForm({ name: '', icon: '', imageUrl: '' }); setModal(true); };
  const openEdit = (c: Category) => { uploadSeqRef.current++; setImageUploading(false); setEditCat(c); setForm({ name: c.name, icon: c.icon, imageUrl: c.imageUrl ?? '' }); setModal(true); };
  const closeModal = () => { uploadSeqRef.current++; setImageUploading(false); setModal(false); };

  // 파일 선택 즉시 Storage(category-icons 버킷)에 업로드하고 반환된 public URL을 폼에 세팅
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const seq = ++uploadSeqRef.current; // 재선택 시 이전 업로드도 무효화
    setImageUploading(true);
    try {
      const url = await uploadCategoryIcon(file);
      if (seq === uploadSeqRef.current) setForm(prev => ({ ...prev, imageUrl: url }));
    } catch (err) {
      if (seq === uploadSeqRef.current) alert('이미지 업로드 실패: ' + (err as Error).message);
    } finally {
      if (seq === uploadSeqRef.current) setImageUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return alert('카테고리명을 입력하세요.');
    if (imageUploading) return alert('이미지 업로드가 끝난 뒤 저장하세요.');
    try {
      if (editCat) {
        // imageUrl '' → null 전달로 이미지 제거(이모지 폴백)
        await updateCategory(editCat.id, { name: form.name, icon: form.icon, imageUrl: form.imageUrl || null });
        setCategories(prev => prev.map(c => c.id === editCat.id
          ? { ...c, name: form.name, icon: form.icon, imageUrl: form.imageUrl || undefined }
          : c));
      } else {
        const created = await createCategory(form.name, form.icon, form.imageUrl || undefined);
        setCategories(prev => [...prev, created]);
      }
      closeModal();
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
              {cat.imageUrl ? (
                <img src={cat.imageUrl} alt={`${cat.name} 아이콘`} className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <span className="text-2xl w-8 text-center">{cat.icon}</span>
              )}
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

      <Modal open={modal} onClose={closeModal} title={editCat ? '카테고리 수정' : '카테고리 추가'}>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">아이콘 이미지</label>
            <p className="text-xs text-gray-400 mb-2">정사각형 이미지를 권장합니다. 이미지가 없으면 아래 이모지가 표시됩니다.</p>
            <div className="flex items-center gap-3">
              <div
                className="relative w-16 h-16 flex-shrink-0 rounded-full overflow-hidden bg-soft-gray border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => { if (!imageUploading) fileInputRef.current?.click(); }}
              >
                {imageUploading ? (
                  <ImagePlus size={20} className="text-gray-400 animate-pulse" />
                ) : form.imageUrl ? (
                  <img src={form.imageUrl} alt="아이콘 미리보기" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={20} className="text-gray-400" />
                )}
              </div>
              {form.imageUrl && !imageUploading && (
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-alert-red transition-colors"
                >
                  <X size={13} /> 이미지 제거
                </button>
              )}
              {imageUploading && <span className="text-xs text-gray-400">이미지 업로드 중...</span>}
              {!form.imageUrl && !imageUploading && <span className="text-xs text-gray-400">클릭해서 이미지 업로드</span>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">이모지 아이콘 (이미지 없을 때 표시)</label>
            <input className="input" placeholder="예: 🍕" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">카테고리명</label>
            <input className="input" placeholder="카테고리명 입력" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={closeModal} className="btn-secondary flex-1">취소</button>
            <button onClick={save} disabled={imageUploading} className="btn-primary flex-1 disabled:opacity-50">저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
