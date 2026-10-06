'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AlertIcon, CheckIcon, PlusIcon, TrashIcon } from '../../../components/Icons';
import styles from './staff.module.css';

async function api(method, path, body) {
  const { data } = await supabase.auth.getSession();
  const token = data.session ? data.session.access_token : '';
  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) throw new Error(json.error || `เกิดข้อผิดพลาด (${res.status})`);
  return json;
}

function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function StaffAdminPage() {
  const [staff, setStaff] = useState([]);
  const [me, setMe] = useState('');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(''); // 'invite' | `resend:${id}` | `delete:${id}`
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null); // staff row to delete

  const load = useCallback(async () => {
    try {
      const data = await api('GET', '/api/staff');
      setStaff(data.staff || []);
      setMe(data.me || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 5000);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) setConfirm(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, busy]);

  const invite = async (e) => {
    e.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError('กรุณากรอกอีเมลให้ถูกต้อง');
    setError(''); setMsg(''); setBusy('invite');
    try {
      await api('POST', '/api/staff', { email: value });
      setEmail('');
      setMsg(`ส่งคำเชิญไปที่ ${value.toLowerCase()} แล้ว ให้พนักงานเปิดอีเมลเพื่อตั้งรหัสผ่าน`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const resend = async (s) => {
    if (busy) return;
    setError(''); setMsg(''); setBusy('resend:' + s.id);
    try {
      await api('POST', '/api/staff', { email: s.email, resend: true });
      setMsg(`ส่งคำเชิญใหม่ไปที่ ${s.email} แล้ว`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    const s = confirm;
    if (!s || busy) return;
    setError(''); setMsg(''); setBusy('delete:' + s.id);
    try {
      await api('DELETE', `/api/staff?id=${encodeURIComponent(s.id)}`);
      setMsg(`ลบ ${s.email} ออกจากพนักงานแล้ว`);
      setConfirm(null);
      await load();
    } catch (err) {
      setError(err.message);
      setConfirm(null);
    } finally {
      setBusy('');
    }
  };

  const activeCount = staff.filter((s) => s.active).length;
  const pendingCount = staff.length - activeCount;

  return (
    <main className="staff-page" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div>
          <h1>พนักงาน</h1>
          <p>เพิ่มพนักงานใหม่ด้วยอีเมล ระบบจะส่งลิงก์ให้ตั้งรหัสผ่านเอง</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="pill pill-jade">ใช้งาน {activeCount}</span>
          {pendingCount > 0 && <span className="pill pill-saffron">รอตั้งรหัสผ่าน {pendingCount}</span>}
        </div>
      </div>

      <div className={styles.toastArea} aria-live="polite">
        {msg && <div className="alert alert-success" role="status"><CheckIcon />{msg}</div>}
        {error && <div className="alert alert-error" role="alert"><AlertIcon />{error}</div>}
      </div>

      <form className={`card ${styles.box} fade-up`} onSubmit={invite}>
        <h2 className={styles.boxTitle}>เพิ่มพนักงานใหม่</h2>
        <div className={styles.row}>
          <label htmlFor="invite-email" className="sr-only">อีเมลพนักงานใหม่</label>
          <input id="invite-email" type="email" className={`input ${styles.grow}`} placeholder="อีเมลพนักงาน เช่น somchai@gmail.com"
            autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button type="submit" className="btn btn-primary" disabled={!!busy}>
            {busy === 'invite' ? <span className="spinner" /> : <PlusIcon />}
            ส่งคำเชิญ
          </button>
        </div>
        <p className={styles.hint}>พนักงานทุกคนมีสิทธิ์เท่ากัน เข้าได้ทุกหน้า (เปิดโต๊ะ ครัว แคชเชียร์ จัดการเมนู และหน้านี้)</p>
      </form>

      <section className={`card ${styles.box}`}>
        <h2 className={styles.boxTitle}>พนักงานทั้งหมด</h2>
        {loading && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
        {!loading && staff.length === 0 && !error && <p className="muted" style={{ margin: 0 }}>ยังไม่มีข้อมูลพนักงาน</p>}
        <ul className={`${styles.list} stagger`}>
          {staff.map((s) => {
            const isMe = s.id === me;
            return (
              <li key={s.id} className={styles.item}>
                <span className={styles.avatar} aria-hidden="true">{(s.email || '?').slice(0, 1).toUpperCase()}</span>
                <div className={styles.info}>
                  <span className={styles.email}>
                    {s.email}
                    {isMe && <span className="pill pill-jade" style={{ padding: '2px 10px', fontSize: 12 }}>คุณ</span>}
                  </span>
                  <span className={styles.meta}>
                    {s.active
                      ? `เข้าใช้ล่าสุด ${fmtDate(s.last_sign_in_at)}`
                      : `เชิญเมื่อ ${fmtDate(s.invited_at || s.created_at)} · ยังไม่ได้ตั้งรหัสผ่าน`}
                  </span>
                </div>
                <span className={`pill ${s.active ? 'pill-jade' : 'pill-saffron'} ${styles.status}`}>
                  {s.active ? 'ใช้งานอยู่' : 'รอตั้งรหัสผ่าน'}
                </span>
                <div className={styles.actions}>
                  {!s.active && (
                    <button type="button" className="btn btn-sm btn-outline" disabled={!!busy} onClick={() => resend(s)}>
                      {busy === 'resend:' + s.id && <span className="spinner" />}ส่งใหม่
                    </button>
                  )}
                  {!isMe && (
                    <button type="button" className={`icon-btn ${styles.iconDel}`} disabled={!!busy}
                      onClick={() => setConfirm(s)} aria-label={`ลบพนักงาน ${s.email}`}>
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {confirm && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setConfirm(null); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="del-title">
            <h2 id="del-title" style={{ color: 'var(--chili)' }}>ลบพนักงานคนนี้?</h2>
            <p style={{ margin: 0 }}><b>{confirm.email}</b> จะเข้าสู่ระบบหลังร้านไม่ได้อีก (ถ้าล็อกอินค้างอยู่ จะใช้งานต่อได้จนกว่าเซสชันจะหมดอายุ สูงสุดประมาณ 1 ชั่วโมง)</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-danger btn-lg" disabled={!!busy} onClick={remove}>
                {busy && <span className="spinner" />}ยืนยันลบ
              </button>
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => setConfirm(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
