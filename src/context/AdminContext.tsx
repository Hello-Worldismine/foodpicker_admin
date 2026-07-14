import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchMyAdminProfile, touchAdminLogin, fetchDownloadLogs, insertDownloadLog, insertActionLog } from '../lib/api';
import Login from '../pages/Login';
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
  signOut: () => Promise<void>;
  /** 직접 테이블 UPDATE 로 처리한 관리자 액션의 감사 로그 기록(RPC 액션은 서버가 자동 기록) */
  logAction: (action: string, targetType: string, targetId: string, detail: string) => void;
}

const AdminContext = createContext<AdminContextType | null>(null);

const DOWNLOAD_ALLOWED_ROLES: AdminRole[] = ['최고관리자', '운영관리자', '정산관리자', 'CS관리자'];

/**
 * 인증 게이트 + 관리자 컨텍스트.
 * - 세션 없음 → 로그인 화면
 * - 세션 있으나 admin_profiles 미등록/비활성 → 접근 거부 화면
 * - 관리자 → 컨텍스트 제공(권한 최종 강제는 서버 RLS/RPC — 클라이언트 role 은 표시용)
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentAdmin, setCurrentAdmin] = useState<AdminAccount | null>(null);
  const [downloadLogs, setDownloadLogs] = useState<DownloadLog[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setCurrentAdmin(null);
        setLoading(false);
      } else {
        setLoading(true); // 새 세션 → 프로필 확인 전까지 스플래시 유지
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchMyAdminProfile();
        if (cancelled) return;
        setCurrentAdmin(profile);
        if (profile) {
          touchAdminLogin().catch(() => {});
          fetchDownloadLogs().then(logs => { if (!cancelled) setDownloadLogs(logs); }).catch(() => {});
        }
      } catch {
        if (!cancelled) setCurrentAdmin(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const addDownloadLog = useCallback((log: Omit<DownloadLog, 'id'>) => {
    setDownloadLogs(prev => [{ id: `dl_${Date.now()}`, ...log }, ...prev]);
    insertDownloadLog(log.adminId, log.adminName, log.menu, log.filters, log.count).catch(() => {});
  }, []);

  const logAction = useCallback((action: string, targetType: string, targetId: string, detail: string) => {
    if (!currentAdmin) return;
    insertActionLog(currentAdmin.id, currentAdmin.name, action, targetType, targetId, detail).catch(() => {});
  }, [currentAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-gray">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500">FoodPicker 관리자 콘솔 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (!currentAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-gray px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-lg font-bold text-charcoal mb-2">관리자 권한이 없습니다</h1>
          <p className="text-sm text-gray-500 mb-1">{session.user.email}</p>
          <p className="text-sm text-gray-500 mb-6">
            이 계정은 관리자로 등록되어 있지 않습니다.<br />
            최고관리자에게 계정 등록을 요청하세요.
          </p>
          <button
            onClick={signOut}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{
      currentAdmin,
      downloadLogs,
      addDownloadLog,
      canDownload: DOWNLOAD_ALLOWED_ROLES.includes(currentAdmin.role),
      signOut,
      logAction,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- 컨텍스트 훅은 프로바이더와 같은 파일에 두는 기존 구조 유지
export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
