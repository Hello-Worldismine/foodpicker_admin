import { useState } from 'react';
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { mockBanners, mockNotices } from '../data/mockData';
import type { Banner, Notice } from '../types';

/**
 * [백엔드 연동 안내] 현재 mockBanners/mockNotices(목데이터)로 동작 중.
 * - 공지(Notice)는 실 DB `notices` 테이블이 존재함: GET /api/admin/notices, POST /api/admin/notices, PATCH /api/admin/notices/:id
 *   단, 실 테이블 컬럼은 (notice_code, emoji, title, content, published_at, is_published)뿐이라
 *   관리자 화면의 target(전체/사용자/판매자)·startDate/endDate·important는 컬럼 추가 마이그레이션이 선행되어야 함.
 * - 배너(Banner)는 실 DB에 대응 테이블이 아예 없음(신규 설계 필요).
 *   제안 스키마: banners(id, title, image_url, link, position, start_date, end_date, active, created_at)
 *   API 예시: GET /api/admin/banners, POST /api/admin/banners, PATCH /api/admin/banners/:id
 */
export default function BannerManagement() {
  const [tab, setTab] = useState<'banner' | 'notice'>('banner');
  const [banners, setBanners] = useState<Banner[]>(mockBanners);
  const [notices, setNotices] = useState<Notice[]>(mockNotices);
  const [bannerModal, setBannerModal] = useState(false);
  const [noticeModal, setNoticeModal] = useState(false);
  const [editBanner, setEditBanner] = useState<Banner | null>(null);
  const [editNotice, setEditNotice] = useState<Notice | null>(null);

  const [bForm, setBForm] = useState({ title: '', link: '', position: '메인 상단', startDate: '', endDate: '' });
  const [nForm, setNForm] = useState({ title: '', content: '', target: '전체' as Notice['target'], startDate: '', endDate: '', important: false });

  const openBannerAdd = () => { setEditBanner(null); setBForm({ title: '', link: '', position: '메인 상단', startDate: '', endDate: '' }); setBannerModal(true); };
  const openNoticeAdd = () => { setEditNotice(null); setNForm({ title: '', content: '', target: '전체', startDate: '', endDate: '', important: false }); setNoticeModal(true); };

  const saveBanner = () => {
    if (!bForm.title) return alert('배너 제목을 입력하세요.');
    if (editBanner) {
      setBanners(prev => prev.map(b => b.id === editBanner.id ? { ...b, ...bForm } : b));
    } else {
      setBanners(prev => [...prev, { id: `b${Date.now()}`, ...bForm, imageUrl: '', active: true }]);
    }
    setBannerModal(false);
  };

  const saveNotice = () => {
    if (!nForm.title) return alert('공지 제목을 입력하세요.');
    if (editNotice) {
      setNotices(prev => prev.map(n => n.id === editNotice.id ? { ...n, ...nForm } : n));
    } else {
      setNotices(prev => [...prev, { id: `n${Date.now()}`, ...nForm, active: true, createdAt: new Date().toISOString().slice(0, 10) }]);
    }
    setNoticeModal(false);
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
          <div className="space-y-3">
            {banners.map(b => (
              <div key={b.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-primary/30 transition-colors">
                <div className="w-16 h-10 bg-soft-gray rounded-lg flex-shrink-0 flex items-center justify-center">
                  <span className="text-xl">🖼️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{b.title}</p>
                  <p className="text-xs text-gray-400">{b.position} · {b.startDate} ~ {b.endDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setBanners(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x))}>
                    {b.active ? <ToggleRight size={24} className="text-primary" /> : <ToggleLeft size={24} className="text-gray-300" />}
                  </button>
                  <button onClick={() => { setEditBanner(b); setBForm({ title: b.title, link: b.link, position: b.position, startDate: b.startDate, endDate: b.endDate }); setBannerModal(true); }} className="text-gray-400 hover:text-primary">
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">공지 목록</h2>
            <button onClick={openNoticeAdd} className="btn-primary flex items-center gap-2"><Plus size={15} /> 공지 추가</button>
          </div>
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
                  <button onClick={() => setNotices(prev => prev.map(x => x.id === n.id ? { ...x, active: !x.active } : x))}>
                    {n.active ? <ToggleRight size={24} className="text-primary" /> : <ToggleLeft size={24} className="text-gray-300" />}
                  </button>
                  <button onClick={() => { setEditNotice(n); setNForm({ title: n.title, content: n.content, target: n.target, startDate: n.startDate, endDate: n.endDate, important: n.important }); setNoticeModal(true); }} className="text-gray-400 hover:text-primary">
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Banner Modal */}
      <Modal open={bannerModal} onClose={() => setBannerModal(false)} title={editBanner ? '배너 수정' : '배너 추가'} size="lg">
        <div className="space-y-3">
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
