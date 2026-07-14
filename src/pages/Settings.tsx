import { useState } from 'react';
import { Save, Download } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import Switch from '../components/ui/Switch';

/**
 * [백엔드 연동 안내] settings 상태가 로컬 useState뿐이라 새로고침하면 초기화됨 — 저장할 DB 테이블이 없음(신규 설계 필요).
 * 제안: settings 단일 행 테이블 또는 key-value 형태의 admin_settings(key, value, updated_at) 테이블.
 * API 예시: GET /api/admin/settings, PUT /api/admin/settings
 * 여기 설정값(commissionRate 기본값, autoExpireCheck, reportThreshold, maxReportBeforeSuspend, autoPickupTimeout 등)은
 * 실제로는 판매자 앱/배치 서버 쪽 자동화 로직(소비기한 자동 판매중지, 신고 누적 자동 이용정지 등)의 파라미터이므로
 * 백엔드 배치 잡과 값이 반드시 동기화되어야 함.
 */
export default function Settings() {
  const { downloadLogs } = useAdmin();
  const [settings, setSettings] = useState({
    siteName: 'FoodPicker 관리자',
    commissionRate: 10,
    autoExpireCheck: true,
    reportThreshold: 5,
    settlementCycle: '격주',
    notifyEmail: 'admin@foodpicker.kr',
    autoPickupTimeout: 120,
    maxReportBeforeSuspend: 10,
    allowGuestOrder: false,
  });

  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">기본 설정</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-charcoal block mb-1">사이트 이름</label>
            <input className="input" value={settings.siteName} onChange={e => setSettings({ ...settings, siteName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-charcoal block mb-1">알림 이메일</label>
            <input type="email" className="input" value={settings.notifyEmail} onChange={e => setSettings({ ...settings, notifyEmail: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">정산 설정</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-charcoal block mb-1">수수료율 (%)</label>
            <input type="number" min={0} max={100} className="input w-32" value={settings.commissionRate} onChange={e => setSettings({ ...settings, commissionRate: Number(e.target.value) })} />
            <p className="text-xs text-gray-400 mt-1">현재 설정: {settings.commissionRate}%</p>
          </div>
          <div>
            <label className="text-sm font-medium text-charcoal block mb-1">정산 주기</label>
            <select className="input w-40" value={settings.settlementCycle} onChange={e => setSettings({ ...settings, settlementCycle: e.target.value })}>
              {['주간', '격주', '월간'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <h2 className="font-semibold text-charcoal">운영 정책 설정</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-charcoal">소비기한 자동 판매종료</p>
              <p className="text-xs text-gray-400">소비기한 경과 상품 자동 판매종료 처리</p>
            </div>
            <Switch
              checked={settings.autoExpireCheck}
              onChange={() => setSettings({ ...settings, autoExpireCheck: !settings.autoExpireCheck })}
              label="소비기한 자동 판매종료"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-charcoal block mb-1">신고 임계치 (이 건 이상 시 경고)</label>
            <input type="number" min={1} className="input w-32" value={settings.reportThreshold} onChange={e => setSettings({ ...settings, reportThreshold: Number(e.target.value) })} />
          </div>

          <div>
            <label className="text-sm font-medium text-charcoal block mb-1">신고 누적 자동 이용정지 기준 (건)</label>
            <input type="number" min={1} className="input w-32" value={settings.maxReportBeforeSuspend} onChange={e => setSettings({ ...settings, maxReportBeforeSuspend: Number(e.target.value) })} />
          </div>

          <div>
            <label className="text-sm font-medium text-charcoal block mb-1">픽업 만료 타임아웃 (분)</label>
            <input type="number" min={0} className="input w-32" value={settings.autoPickupTimeout} onChange={e => setSettings({ ...settings, autoPickupTimeout: Number(e.target.value) })} />
            <p className="text-xs text-gray-400 mt-1">픽업 시간 초과 후 노쇼 처리까지 대기 시간</p>
          </div>
        </div>
      </div>

      <button onClick={save} className={`btn-primary flex items-center gap-2 ${saved ? 'bg-green-600' : ''}`}>
        <Save size={16} />
        {saved ? '저장되었습니다!' : '설정 저장'}
      </button>

      {/* Download Log */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download size={16} className="text-primary" />
          <h2 className="font-semibold">엑셀 다운로드 로그</h2>
          <span className="text-xs text-gray-400 ml-auto">총 {downloadLogs.length}건</span>
        </div>
        {downloadLogs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">다운로드 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-soft-gray/50">
                  {['다운로드일시', '관리자', '메뉴', '적용 필터', '건수'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {downloadLogs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-soft-gray/50">
                    <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">{log.downloadedAt}</td>
                    <td className="px-3 py-2 font-medium text-xs">{log.adminName}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className="badge bg-primary-light text-primary">{log.menu}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-48 truncate">{log.filters}</td>
                    <td className="px-3 py-2 text-xs font-medium text-primary">{log.count.toLocaleString()}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
