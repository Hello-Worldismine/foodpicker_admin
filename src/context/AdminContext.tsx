import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AdminAccount, AdminRole } from '../types';

export interface DownloadLog {
  id: string;
  adminId: string;
  adminName: string;
  menu: string;
  filters: string;
  downloadedAt: string;
  count: number;
}

interface AdminContextType {
  currentAdmin: AdminAccount;
  downloadLogs: DownloadLog[];
  addDownloadLog: (log: Omit<DownloadLog, 'id'>) => void;
  canDownload: boolean;
}

const AdminContext = createContext<AdminContextType | null>(null);

/**
 * [백엔드 연동 안내] 로그인 화면이 없어 "현재 관리자"를 최고관리자로 하드코딩해둔 임시 상태.
 * 실 인증 연동 시 Supabase Auth 세션에서 로그인한 관리자 정보로 교체하고,
 * canDownload 등 권한 체크도 서버 측(RLS/API 미들웨어)에서 한 번 더 검증할 것 — 클라이언트 role 값만 믿지 말 것.
 */
const CURRENT_ADMIN: AdminAccount = {
  id: 'a1',
  name: '김관리',
  email: 'admin@foodpicker.kr',
  role: '최고관리자',
  status: '활성',
  lastLogin: new Date().toLocaleString('ko-KR'),
  createdAt: '2023-01-01',
};

const DOWNLOAD_ALLOWED_ROLES: AdminRole[] = ['최고관리자', '운영관리자', '정산관리자', 'CS관리자'];

export function AdminProvider({ children }: { children: ReactNode }) {
  const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);

  const addDownloadLog = (log: Omit<DownloadLog, 'id'>) => {
    setDownloadLogs(prev => [{ id: `dl_${Date.now()}`, ...log }, ...prev]);
  };

  return (
    <AdminContext.Provider value={{
      currentAdmin: CURRENT_ADMIN,
      downloadLogs,
      addDownloadLog,
      canDownload: DOWNLOAD_ALLOWED_ROLES.includes(CURRENT_ADMIN.role),
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
