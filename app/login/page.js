'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { AlertIcon, PotIcon } from '../../components/Icons';
import styles from './login.module.css';

function safeNext() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/generate-qr';
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef(null);

  // ล็อกอินอยู่แล้ว ไม่ต้องกรอกซ้ำ
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(safeNext());
    });
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setLoading(false);
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      // เล่นอนิเมชันสั่นซ้ำโดยไม่ remount ฟอร์ม (ช่องกรอกยังคงโฟกัสอยู่)
      const f = formRef.current;
      if (f) {
        f.classList.remove(styles.shake);
        void f.offsetWidth;
        f.classList.add(styles.shake);
      }
      return;
    }
    router.replace(safeNext());
  };

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.logo}><PotIcon size={38} color="#e8a33d" /></div>
        <h1 className={styles.title}>Suki Halal</h1>
        <p className="muted">เข้าสู่ระบบพนักงาน</p>
      </div>

      <form ref={formRef} className={`card ${styles.form}`} onSubmit={handleLogin}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove(styles.shake); }}>
        <div className="field">
          <label className="label" htmlFor="email">อีเมล</label>
          <input id="email" type="email" className="input" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">รหัสผ่าน</label>
          <input id="password" type="password" className="input" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && (
          <div className="alert alert-error" role="alert"><AlertIcon />{error}</div>
        )}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  );
}
