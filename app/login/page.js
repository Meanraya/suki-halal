'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const input = { width: '100%', boxSizing: 'border-box', fontSize: 22, padding: 12, border: '2px solid #888', borderRadius: 8 };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      return;
    }
    const next = new URLSearchParams(window.location.search).get('next');
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/generate-qr');
  };

  return (
    <main style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
      <h1 style={{ textAlign: 'center' }}>Suki Halal</h1>
      <p style={{ textAlign: 'center', fontSize: 20 }}>เข้าสู่ระบบพนักงาน</p>
      <form onSubmit={handleLogin}>
        <label style={{ display: 'block', fontWeight: 'bold', margin: '14px 0 6px' }} htmlFor="email">อีเมล</label>
        <input id="email" type="email" style={input} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label style={{ display: 'block', fontWeight: 'bold', margin: '14px 0 6px' }} htmlFor="password">รหัสผ่าน</label>
        <input id="password" type="password" style={input} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div style={{ marginTop: 14, padding: 12, background: '#fff7ed', border: '2px solid #f97316', borderRadius: 8, color: '#9a3412' }}>{error}</div>}
        <button type="submit" disabled={loading}
          style={{ width: '100%', marginTop: 20, fontSize: 22, fontWeight: 'bold', padding: 14, border: 'none', borderRadius: 10, background: '#16a34a', color: '#fff', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  );
}
