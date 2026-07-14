import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 관리자 로그인 / 계정 만들기.
 * 가입해도 admin_profiles 에 등록되기 전까지는 접근 불가(게이트가 차단).
 * 최초 관리자는 supabase/provision_admin.sql, 이후는 '관리자 계정' 메뉴에서 등록.
 */
export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) setError(err.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : err.message);
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (err) setError(err.message);
        else {
          setInfo('가입 요청 완료! 이메일 인증 후, 최고관리자에게 관리자 등록을 요청하세요.');
          setMode('login');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-gray px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <span className="text-3xl">🥗</span>
            <span className="text-2xl font-extrabold text-charcoal">FoodPicker</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">관리자 콘솔</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <h1 className="text-lg font-bold text-charcoal">
            {mode === 'login' ? '로그인' : '계정 만들기'}
          </h1>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">이름</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="홍길동"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">이메일</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="admin@foodpicker.kr" autoComplete="username"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">비밀번호</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {error && <p className="text-sm text-alert-red">{error}</p>}
          {info && <p className="text-sm text-primary">{info}</p>}

          <button
            type="submit" disabled={busy}
            className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {busy ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>

          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {mode === 'login' ? '계정이 없나요? 계정 만들기' : '이미 계정이 있나요? 로그인'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          관리자 권한은 최고관리자가 '관리자 계정' 메뉴에서 부여합니다.
        </p>
      </div>
    </div>
  );
}
