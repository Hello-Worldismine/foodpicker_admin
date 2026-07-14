import { useState } from 'react';
import { Plus, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { mockAdmins } from '../data/mockData';
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
 * [백엔드 연동 안내] 현재 mockAdmins(목데이터)로 동작 중. 실 서비스는 관리자 다단계 권한 모델 자체가 없음(신규 설계 필요).
 * 현재 판매자 앱 인증은 `auth.users.raw_app_meta_data.role = 'seller'` 정도만 사용하며, admin_accounts 개념이 DB에 없음.
 * 제안 방향: admin_accounts(id, name, email, role, status) 테이블 + Supabase Auth 연동, role별 RLS/API 접근 제어.
 * ⚠️ 로그인 화면/인증 로직은 이번 작업 범위에서 의도적으로 제외됨 — 백엔드에서 인증 설계 확정 후 별도로 연동 필요.
 * API 예시: GET /api/admin/accounts, POST /api/admin/accounts, PATCH /api/admin/accounts/:id (role/status 변경)
 */
export default function AdminAccounts() {
  const [admins, setAdmins] = useState<AdminAccount[]>(mockAdmins);
  const [modal, setModal] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminAccount | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: '읽기전용' as AdminRole });

  const openAdd = () => { setEditAdmin(null); setForm({ name: '', email: '', role: '읽기전용' }); setModal(true); };
  const openEdit = (a: AdminAccount) => { setEditAdmin(a); setForm({ name: a.name, email: a.email, role: a.role }); setModal(true); };

  const save = () => {
    if (!form.name || !form.email) return alert('이름과 이메일을 입력하세요.');
    if (editAdmin) {
      setAdmins(prev => prev.map(a => a.id === editAdmin.id ? { ...a, ...form } : a));
    } else {
      setAdmins(prev => [...prev, {
        id: `a${Date.now()}`, ...form, status: '활성',
        lastLogin: '-', createdAt: new Date().toISOString().slice(0, 10)
      }]);
    }
    setModal(false);
  };

  const toggle = (id: string) => {
    setAdmins(prev => prev.map(a => a.id === id ? { ...a, status: a.status === '활성' ? '비활성' : '활성' } : a));
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
                      <button onClick={() => toggle(a.id)}>
                        {a.status === '활성' ? <ToggleRight size={20} className="text-primary" /> : <ToggleLeft size={20} className="text-gray-300" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <div><label className="text-xs text-gray-500 block mb-1">이메일</label><input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
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
