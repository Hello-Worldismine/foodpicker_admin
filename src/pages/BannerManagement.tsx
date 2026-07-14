import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, ImagePlus, X } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Switch from '../components/ui/Switch';
import {
  fetchBanners, createBanner, updateBanner, toggleBannerActive, uploadBannerImage,
  fetchNotices, createNotice, updateNotice, toggleNoticeActive,
} from '../lib/api';
import type { Banner, Notice } from '../types';

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 배너: `banners` 테이블 — fetchBanners / createBanner / updateBanner / toggleBannerActive
 * - 공지: `notices` 테이블 — fetchNotices / createNotice / updateNotice / toggleNoticeActive
 * - 이미지: 파일 선택 즉시 Supabase Storage `banner-images` 버킷에 업로드(uploadBannerImage)하고
 *   반환된 public URL을 image_url로 저장한다.
 * - 배너 권장 비율(2.14:1)은 foodpicker_app(사용자 앱) HomeScreen.js의 배너 슬롯 크기
 *   (화면 너비 - 좌우 패딩 32px, 높이 160px)에서 역산한 값이다. 사용자 앱은 아직 그라디언트+이모지로
 *   렌더링되고 있으므로, 실제 배너 이미지를 표시하려면 해당 화면도 함께 수정이 필요하다.
 */
const BANNER_ASPECT = 1200 / 560; // ≈ 2.14:1 — 사용자 앱 메인 배너 슬롯 비율

export default function BannerManagement() {
  const [tab, setTab] = useState<'banner' | 'notice'>('banner');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [bannerModal, setBannerModal] = useState(false);
  const [noticeModal, setNoticeModal] = useState(false);
  const [editBanner, setEditBanner] = useState<Banner | null>(null);
  const [editNotice, setEditNotice] = useState<Notice | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bForm, setBForm] = useState({ title: '', link: '', position: '메인 상단', startDate: '', endDate: '', imageUrl: '' });
  const [nForm, setNForm] = useState({ title: '', content: '', target: '전체' as Notice['target'], startDate: '', endDate: '', important: false });

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchBanners(), fetchNotices()])
      .then(([bs, ns]) => { if (!cancelled) { setBanners(bs); setNotices(ns); } })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openBannerAdd = () => { setEditBanner(null); setBForm({ title: '', link: '', position: '메인 상단', startDate: '', endDate: '', imageUrl: '' }); setBannerModal(true); };
  const openNoticeAdd = () => { setEditNotice(null); setNForm({ title: '', content: '', target: '전체', startDate: '', endDate: '', important: false }); setNoticeModal(true); };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageUploading(true);
    try {
      const url = await uploadBannerImage(file);
      setBForm(prev => ({ ...prev, imageUrl: url }));
    } catch (err) {
      alert('이미지 업로드 실패: ' + (err as Error).message);
    } finally {
      setImageUploading(false);
    }
  };

  const saveBanner = async () => {
    if (!bForm.title) return alert('배너 제목을 입력하세요.');
    if (imageUploading) return alert('이미지 업로드가 끝난 뒤 저장하세요.');
    if (!bForm.imageUrl) return alert('배너 이미지를 등록하세요.');
    try {
      if (editBanner) {
        const updated = await updateBanner(editBanner.id, bForm);
        setBanners(prev => prev.map(b => b.id === updated.id ? updated : b));
      } else {
        const created = await createBanner(bForm);
        setBanners(prev => [created, ...prev]);
      }
      setBannerModal(false);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const saveNotice = async () => {
    if (!nForm.title) return alert('공지 제목을 입력하세요.');
    try {
      if (editNotice) {
        const updated = await updateNotice(editNotice.id, nForm);
        setNotices(prev => prev.map(n => n.id === updated.id ? updated : n));
      } else {
        const created = await createNotice(nForm);
        setNotices(prev => [created, ...prev]);
      }
      setNoticeModal(false);
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const handleToggleBanner = async (b: Banner) => {
    try {
      await toggleBannerActive(b.id, !b.active);
      setBanners(prev => prev.map(x => x.id === b.id ? { ...x, active: !b.active } : x));
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  const handleToggleNotice = async (n: Notice) => {
    try {
      await toggleNoticeActive(n.id, !n.active);
      setNotices(prev => prev.map(x => x.id === n.id ? { ...x, active: !n.active } : x));
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 w-fit shadow-sm border border-gray-100">
        {(['banner', 'notice'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-primary text-white' : 'text-gray-500 hover:text-charcoal'}`}>
            {t === 'banner' ? '배너 관리' : '공지 관리'}
          </button>
        ))}
      </div>

      {tab === 'banner' ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">배너 목록</h2>
            <button onClick={openBannerAdd} className="btn-primary flex items-center gap-2"><Plus size={15} /> 배너 추가</button>
          </div>
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : loadError ? (
            <div className="py-16 text-center text-sm text-alert-red">{loadError}</div>
          ) : (
          <div className="space-y-3">
            {banners.map(b => (
              <div key={b.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-primary/30 transition-colors">
                <div className="w-24 flex-shrink-0 rounded-lg overflow-hidden bg-soft-gray flex items-center justify-center" style={{ aspectRatio: BANNER_ASPECT }}>
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">🖼️</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{b.title}</p>
                  <p className="text-xs text-gray-400">{b.position} · {b.startDate} ~ {b.endDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={b.active}
                    onChange={() => handleToggleBanner(b)}
                    label={`${b.title} 활성화 여부`}
                  />
                  <button onClick={() => { setEditBanner(b); setBForm({ title: b.title, link: b.link, position: b.position, startDate: b.startDate, endDate: b.endDate, imageUrl: b.imageUrl }); setBannerModal(true); }} className="text-gray-400 hover:text-primary">
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">공지 목록</h2>
            <button onClick={openNoticeAdd} className="btn-primary flex items-center gap-2"><Plus size={15} /> 공지 추가</button>
          </div>
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : loadError ? (
            <div className="py-16 text-center text-sm text-alert-red">{loadError}</div>
          ) : (
          <div className="space-y-3">
            {notices.map(n => (
              <div key={n.id} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-primary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {n.important && <span className="badge bg-alert-red/10 text-alert-red">중요</span>}
                    <span className={`badge ${n.target === '전체' ? 'bg-gray-100 text-gray-600' : n.target === '사용자' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-warm-orange'}`}>{n.target}</span>
                    <p className="font-medium text-sm">{n.title}</p>
                  </div>
                  <p className="text-xs text-gray-400">{n.startDate} ~ {n.endDate}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Switch
                    checked={n.active}
                    onChange={() => handleToggleNotice(n)}
                    label={`${n.title} 활성화 여부`}
                  />
                  <button onClick={() => { setEditNotice(n); setNForm({ title: n.title, content: n.content, target: n.target, startDate: n.startDate, endDate: n.endDate, important: n.important }); setNoticeModal(true); }} className="text-gray-400 hover:text-primary">
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Banner Modal */}
      <Modal open={bannerModal} onClose={() => setBannerModal(false)} title={editBanner ? '배너 수정' : '배너 추가'} size="lg">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">배너 이미지</label>
            <p className="text-xs text-gray-400 mb-2">사용자 앱 메인 배너 영역 비율(2.14:1)에 맞춰 등록하세요. 권장 크기 1200×560px 이상.</p>
            <div
              className="relative w-full rounded-lg overflow-hidden bg-soft-gray border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
              style={{ aspectRatio: BANNER_ASPECT }}
              onClick={() => { if (!imageUploading) fileInputRef.current?.click(); }}
            >
              {imageUploading ? (
                <div className="flex flex-col items-center gap-1 text-gray-400">
                  <ImagePlus size={24} className="animate-pulse" />
                  <span className="text-xs">이미지 업로드 중...</span>
                </div>
              ) : bForm.imageUrl ? (
                <>
                  <img src={bForm.imageUrl} alt="배너 미리보기" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setBForm(prev => ({ ...prev, imageUrl: '' })); }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-400">
                  <ImagePlus size={24} />
                  <span className="text-xs">클릭해서 이미지 업로드</span>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">배너 제목</label><input className="input" value={bForm.title} onChange={e => setBForm({ ...bForm, title: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">링크</label><input className="input" value={bForm.link} onChange={e => setBForm({ ...bForm, link: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">노출 위치</label>
            <select className="input" value={bForm.position} onChange={e => setBForm({ ...bForm, position: e.target.value })}>
              {['메인 상단', '메인 중간', '메인 하단'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">시작일</label><input type="date" className="input" value={bForm.startDate} onChange={e => setBForm({ ...bForm, startDate: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">종료일</label><input type="date" className="input" value={bForm.endDate} onChange={e => setBForm({ ...bForm, endDate: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setBannerModal(false)} className="btn-secondary flex-1">취소</button>
            <button onClick={saveBanner} className="btn-primary flex-1">저장</button>
          </div>
        </div>
      </Modal>

      {/* Notice Modal */}
      <Modal open={noticeModal} onClose={() => setNoticeModal(false)} title={editNotice ? '공지 수정' : '공지 추가'} size="lg">
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500 block mb-1">제목</label><input className="input" value={nForm.title} onChange={e => setNForm({ ...nForm, title: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">내용</label><textarea className="input h-28 resize-none" value={nForm.content} onChange={e => setNForm({ ...nForm, content: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">대상</label>
            <select className="input" value={nForm.target} onChange={e => setNForm({ ...nForm, target: e.target.value as Notice['target'] })}>
              {(['전체', '사용자', '판매자'] as const).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">시작일</label><input type="date" className="input" value={nForm.startDate} onChange={e => setNForm({ ...nForm, startDate: e.target.value })} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">종료일</label><input type="date" className="input" value={nForm.endDate} onChange={e => setNForm({ ...nForm, endDate: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={nForm.important} onChange={e => setNForm({ ...nForm, important: e.target.checked })} className="accent-primary" />
            <span className="text-sm">중요 공지로 설정</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setNoticeModal(false)} className="btn-secondary flex-1">취소</button>
            <button onClick={saveNotice} className="btn-primary flex-1">저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
