import { useState } from 'react';
import { Save } from 'lucide-react';

export default function Settings() {
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
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.autoExpireCheck} onChange={e => setSettings({ ...settings, autoExpireCheck: e.target.checked })} className="sr-only peer" />
              <div className="w-10 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:bg-primary transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </label>
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
    </div>
  );
}
