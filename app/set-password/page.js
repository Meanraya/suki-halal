'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { AlertIcon, CheckIcon, PotIcon } from '../../components/Icons';
import styles from '../login/login.module.css';

const MIN_LENGTH = 8;

// อ่าน error จากลิงก์เชิญ (เช่น ลิงก์หมดอายุ) ที่ Supabase แนบมาใน URL
function linkError() {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
  return params.get('error_description') || params.get('error') || '';
}

export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState('checking'); // checking | ready | invalid | done
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isReset, setIsReset] = useState(false); // มาจาก "ลืมรหัสผ่าน" (ไม่ใช่คำเชิญ)

  useEffect(() => {
    let active = true;
    setIsReset(new URLSearchParams(window.location.search).get('mode') === 'reset');
    const fromLink = linkError();
    if (fromLink) {
      setStatus('invalid');
      return;
    }
    const apply = (session) => {
      if (!active) return;
      if (session) {
        // ลบโทเคนออกจากแถบที่อยู่ทันที ไม่ให้ค้างในประวัติเบราว์เซอร์
        if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setEmail(session.user.email || '');
        setStatus('ready');
      }
    };
    // supabase-js อ่านโทเคนจากลิงก์เชิญใน URL ให้อัตโนมัติ
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) apply(data.session);
      else setTimeout(() => { if (active) setStatus((s) => (s === 'checking' ? 'invalid' : s)); }, 1500);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (password.length < MIN_LENGTH) return setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN_LENGTH} ตัวอักษร`);
    if (password !== confirmPw) return setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError('ตั้งรหัสผ่านไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
      return;
    }
    // ล้างโทเคนออกจาก URL
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setStatus('done');
    setTimeout(() => router.replace('/generate-qr'), 1500);
  };

  if (status === 'checking') {
    return (
      <div className="state-screen" role="status">
        <span className="spinner spinner-lg" />
        <div className="state-text">กำลังตรวจสอบลิงก์เชิญ...</div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="state-screen">
        <div className="state-icon" style={{ background: 'var(--saffron-100)', color: 'var(--saffron-ink)' }}><AlertIcon size={40} /></div>
        <div className="state-title">ลิงก์ใช้ไม่ได้หรือหมดอายุ</div>
        <div className="state-text">ขอลิงก์ใหม่ได้ที่ &quot;ลืมรหัสผ่าน?&quot; ในหน้าเข้าสู่ระบบ หรือให้หัวหน้ากด &quot;ส่งใหม่&quot; ที่หน้าพนักงาน แล้วเปิดลิงก์จากอีเมลล่าสุด</div>
        <a href="/login" className="btn btn-outline">ไปหน้าเข้าสู่ระบบ</a>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="state-screen">
        <div className="state-icon" style={{ background: 'var(--jade-700)', color: '#fff' }}><CheckIcon size={42} /></div>
        <div className="state-title">ตั้งรหัสผ่านเรียบร้อย</div>
        <div className="state-text">กำลังพาไปหน้าพนักงาน...</div>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.logo}><PotIcon size={38} color="#e8a33d" /></div>
        <h1 className={styles.title}>{isReset ? 'ตั้งรหัสผ่านใหม่' : 'ยินดีต้อนรับ'}</h1>
        <p className="muted">{isReset ? 'รหัสผ่านใหม่สำหรับ' : 'ตั้งรหัสผ่านสำหรับ'} <b>{email}</b></p>
      </div>
      <form className={`card ${styles.form}`} onSubmit={submit}>
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <div className="field">
          <label className="label" htmlFor="new-password">รหัสผ่านใหม่</label>
          <input id="new-password" type="password" className="input" autoComplete="new-password" minLength={MIN_LENGTH}
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="confirm-password">ยืนยันรหัสผ่าน</label>
          <input id="confirm-password" type="password" className="input" autoComplete="new-password" minLength={MIN_LENGTH}
            value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>อย่างน้อย {MIN_LENGTH} ตัวอักษร</p>
        {error && <div className="alert alert-error" role="alert"><AlertIcon />{error}</div>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านและเข้าสู่ระบบ'}
        </button>
      </form>
    </main>
  );
}
