'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { AlertIcon, CheckIcon, PotIcon } from '../../components/Icons';
import styles from './login.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNext() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/generate-qr';
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // login | forgot | sent
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

  const shake = () => {
    // เล่นอนิเมชันสั่นซ้ำโดยไม่ remount ฟอร์ม (ช่องกรอกยังคงโฟกัสอยู่)
    const f = formRef.current;
    if (f) {
      f.classList.remove(styles.shake);
      void f.offsetWidth;
      f.classList.add(styles.shake);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setLoading(false);
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      shake();
      return;
    }
    router.replace(safeNext());
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    if (loading) return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('กรุณากรอกอีเมลให้ถูกต้อง');
      shake();
      return;
    }
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/set-password?mode=reset`,
    });
    setLoading(false);
    if (err) {
      setError(/rate limit|security purposes/i.test(err.message || '')
        ? 'ขอลิงก์ถี่เกินไป กรุณารอสักครู่แล้วลองใหม่'
        : 'ส่งลิงก์ไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
      return;
    }
    // ไม่บอกว่าอีเมลนี้มีบัญชีหรือไม่ เพื่อไม่ให้คนนอกใช้เดาอีเมลพนักงาน
    setMode('sent');
  };

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.logo}><PotIcon size={38} color="#e8a33d" /></div>
        <h1 className={styles.title}>Suki Halal</h1>
        <p className="muted">{mode === 'login' ? 'เข้าสู่ระบบพนักงาน' : 'รีเซ็ตรหัสผ่าน'}</p>
      </div>

      {mode === 'sent' ? (
        <div className={`card ${styles.form}`} role="status">
          <div className={styles.sentIcon}><CheckIcon size={30} /></div>
          <p style={{ margin: 0, textAlign: 'center' }}>
            ถ้า <b>{email.trim()}</b> เป็นบัญชีพนักงาน ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว
          </p>
          <p className="muted" style={{ margin: 0, fontSize: 14, textAlign: 'center' }}>
            ไม่เจออีเมล? ลองดูในโฟลเดอร์สแปม หรือให้หัวหน้าเชิญใหม่ที่หน้าพนักงาน
          </p>
          <button type="button" className="btn btn-outline btn-block" onClick={() => switchMode('login')}>กลับไปหน้าเข้าสู่ระบบ</button>
        </div>
      ) : (
        <form ref={formRef} key={mode} className={`card ${styles.form}`} onSubmit={mode === 'login' ? handleLogin : handleForgot}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove(styles.shake); }}>
          {mode === 'forgot' && (
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>กรอกอีเมลพนักงาน ระบบจะส่งลิงก์ให้ตั้งรหัสผ่านใหม่</p>
          )}
          <div className="field">
            <label className="label" htmlFor="email">อีเมล</label>
            <input id="email" type="email" className="input" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoFocus={mode === 'forgot'} />
          </div>
          {mode === 'login' && (
            <div className="field">
              <div className={styles.labelRow}>
                <label className="label" htmlFor="password">รหัสผ่าน</label>
                <button type="button" className={styles.linkBtn} onClick={() => switchMode('forgot')}>ลืมรหัสผ่าน?</button>
              </div>
              <input id="password" type="password" className="input" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
          )}
          {error && (
            <div className="alert alert-error" role="alert"><AlertIcon />{error}</div>
          )}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
            {loading && <span className="spinner" />}
            {mode === 'login'
              ? (loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ')
              : (loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่')}
          </button>
          {mode === 'forgot' && (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => switchMode('login')}>กลับไปหน้าเข้าสู่ระบบ</button>
          )}
        </form>
      )}
    </main>
  );
}
