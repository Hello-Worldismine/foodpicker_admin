import { useEffect, useState } from 'react';
import { Plus, Edit2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Switch from '../components/ui/Switch';
import { fetchAdmins, addAdminAccount, updateAdminAccount } from '../lib/api';
import type { AdminAccount, AdminRole } from '../types';

const ROLES: AdminRole[] = ['최고관리자', '운영관리자', '정산관리자', 'CS관리자', '읽기전용'];

const rolePermissions: Record<AdminRole, string[]> = {
  '최고관리자': ['전체 메뉴'],
  '운영관리자': ['대시보드', '판매자', '상품', '주문', '신고/문의', '리뷰', '배너/공지', '카테고리'],
  '정산관리자': ['대시보드', '정산'],
  'CS관리자': ['대시보드', '신고/문의', '주문', '리뷰'],
  '읽기전용': ['대시보드 (읽기만)'],
};

const roleBadge: Record<AdminRole, string> = {
  '최고관리자': 'bg-primary-light text-primary',
  '운영관리자': 'bg-blue-100 text-blue-700',
  '정산관리자': 'bg-orange-100 text-warm-orange',
  'CS관리자': 'bg-purple-100 text-purple-700',
  '읽기전용': 'bg-gray-100 text-gray-600',
};

/**
 * [백엔드 연동 안내] Supabase 실데이터 연동 완료.
 * - 조회: admin_profiles 테이블(fetchAdmins). 추가/수정/활성토글: admin_add_account / admin_update_account RPC(서버가 감사 로그 자동 기록).
 * - 관리자 추가는 이미 Supabase Auth 에 가입된 이메일만 가능(RPC 가 'user not found' 에러 반환).
 * - 이메일은 인증 계정 식별자라 수정 불가. 마지막 최고관리자 강등/비활성화는 서버에서 차단됨.
 */
export default function AdminAccounts() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminAccount | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: '읽기전용' as AdminRole });

  useEffect(() => {
    let cancelled = false;
    fetchAdmins()
      .then(rows => { if (!cancelled) setAdmins(rows); })
      .catch(e => { if (!cancelled) setLoadError((e as Error).message ?? '데이터를 불러오지 못했습니다.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const openAdd = () => { setEditAdmin(null); setForm({ name: '', email: '', role: '읽기전용' }); setModal(true); };
  const openEdit = (a: AdminAccount) => { setEditAdmin(a); setForm({ name: a.name, email: a.email, role: a.role }); setModal(true); };

  const save = async () => {
    if (!form.name || !form.email) return alert('이름과 이메일을 입력하세요.');
    try {
      if (editAdmin) {
        await updateAdminAccount(editAdmin.id, { name: form.name, role: form.role });
        setAdmins(prev => prev.map(a => a.id === editAdmin.id ? { ...a, name: form.name, role: form.role } : a));
      } else {
        const created = await addAdminAccount(form.email, form.name, form.role);
        setAdmins(prev => [...prev, created]);
      }
      setModal(false);
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('user not found')) {
        alert('해당 이메일 사용자가 없습니다. 먼저 로그인 화면에서 계정 만들기(가입)를 완료해야 합니다.');
      } else {
        alert('처리 실패: ' + msg);
      }
    }
  };

  const toggle = async (id: string) => {
    const target = admins.find(a => a.id === id);
    if (!target) return;
    try {
      await updateAdminAccount(id, { isActive: target.status === '비활성' });
      setAdmins(prev => prev.map(a => a.id === id ? { ...a, status: a.status === '활성' ? '비활성' : '활성' } : a));
    } catch (e) {
      alert('처리 실패: ' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold">관리자 계정</h2>
            <p className="text-xs text-gray-400 mt-1">운영자 계정 및 권한을 관리합니다.</p>
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={15} /> 관리자 추가</button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : loadError ? (
            <div className="py-16 text-center text-sm text-red-500">{loadError}</div>
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-soft-gray/50">
                {['이름', '이메일', '권한', '접근 메뉴', '상태', '최근 로그인', '생성일', '관리'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id} className={`border-b border-gray-50 hover:bg-soft-gray/50 transition-colors ${a.status === '비활성' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{a.email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${roleBadge[a.role]}`}>{a.role}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-40 truncate">
                    {rolePermissions[a.role].join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${a.status === '활성' ? 'bg-primary-light text-primary' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{a.lastLogin}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{a.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(a)} className="text-gray-400 hover:text-primary transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <Switch size="sm" checked={a.status === '활성'} onChange={() => toggle(a.id)} label={`${a.name} 활성화 여부`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Role guide */}
      <div className="card p-5">
        <h3 className="font-semibold mb-4">권한별 접근 메뉴</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROLES.map(role => (
            <div key={role} className="rounded-xl border border-gray-100 p-4">
              <span className={`badge ${roleBadge[role]} mb-2`}>{role}</span>
              <ul className="mt-2 space-y-1">
                {rolePermissions[role].map(p => (
                  <li key={p} className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="text-primary">•</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editAdmin ? '관리자 수정' : '관리자 추가'}>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500 block mb-1">이름</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">이메일</label>
            <input type="email" className="input disabled:bg-gray-50 disabled:text-gray-400" value={form.email} disabled={!!editAdmin} onChange={e => setForm({ ...form, email: e.target.value })} />
            {editAdmin && <p className="text-xs text-gray-400 mt-1">이메일은 인증 계정 식별자라 변경할 수 없습니다.</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">권한</label>
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as AdminRole })}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {form.role && (
              <p className="text-xs text-gray-400 mt-1">접근 가능: {rolePermissions[form.role].join(', ')}</p>
            )}
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
