'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const s = {
  page: { maxWidth: 520, margin: '0 auto', padding: 20, fontSize: 22 },
  h1: { fontSize: 32, textAlign: 'center', margin: '8px 0 20px' },
  label: { display: 'block', fontWeight: 'bold', margin: '16px 0 6px' },
  input: { width: '100%', boxSizing: 'border-box', fontSize: 28, padding: 12, border: '2px solid #888', borderRadius: 8 },
  btn: { width: '100%', fontSize: 26, fontWeight: 'bold', padding: 16, border: 'none', borderRadius: 10, cursor: 'pointer', marginTop: 20, background: '#16a34a', color: '#fff' },
  btnDanger: { background: '#dc2626' },
  btnGray: { background: '#e5e7eb', color: '#111' },
  warn: { marginTop: 20, padding: 18, border: '4px solid #dc2626', background: '#fff1f2', borderRadius: 12, color: '#991b1b' },
  err: { marginTop: 16, padding: 12, background: '#fff7ed', border: '2px solid #f97316', borderRadius: 8, color: '#9a3412' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 10 },
  dialog: { background: '#fff', border: '6px solid #f97316', borderRadius: 14, padding: 22, maxWidth: 460, width: '100%' },
  result: { marginTop: 20, textAlign: 'center' },
  link: { wordBreak: 'break-all', fontSize: 18, color: '#1d4ed8', margin: '8px 0' },
  copyBtn: { fontSize: 18, padding: '6px 12px', borderRadius: 6, border: '2px solid #1d4ed8', background: '#fff', color: '#1d4ed8', cursor: 'pointer', marginLeft: 8 },
};

export default function GenerateQrPage() {
  const [table, setTable] = useState('');
  const [adults, setAdults] = useState('');
  const [children, setChildren] = useState('');
  const [existing, setExisting] = useState(null); // session เก่าที่ยังเปิดอยู่
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState(null); // { table, adults, children, url }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const resetAll = () => {
    setTable(''); setAdults(''); setChildren('');
    setExisting(null); setShowConfirm(false);
    setResult(null); setError(''); setCopied(false);
  };

  const handleOpenTable = async (e) => {
    e.preventDefault();
    setError('');
    const t = parseInt(table, 10);
    const a = parseInt(adults || '0', 10);
    const c = parseInt(children || '0', 10);

    if (!Number.isInteger(t) || t < 1) return setError('กรุณากรอกเลขโต๊ะเป็นตัวเลข');
    if (a < 0 || c < 0 || a + c < 1) return setError('กรุณากรอกจำนวนลูกค้าอย่างน้อย 1 คน');

    setLoading(true);
    try {
      const { data: open, error: e1 } = await supabase
        .from('sessions')
        .select('id, adult_count, child_count, created_at')
        .eq('table_number', t)
        .in('status', ['open', 'billing'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (e1) throw e1;

      if (open && open.length > 0) {
        setExisting({ ...open[0], table_number: t });
        return;
      }

      const { error: e2 } = await supabase
        .from('sessions')
        .insert({ table_number: t, adult_count: a, child_count: c, status: 'open' });
      if (e2) throw e2;

      setResult({
        table: t, adults: a, children: c,
        url: `${window.location.origin}/order/${t}`,
      });
    } catch (err) {
      setError('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmClose = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: e } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existing.id)
        .in('status', ['open', 'billing']) // กันกดซ้ำ: อัปเดตเฉพาะแถวที่ยัง open
        .select('id');
      if (e) throw e;
      // ปิดสำเร็จ (หรือถูกปิดไปแล้ว) -> กลับไปฟอร์มเดิม ค่าที่กรอกยังอยู่
      setShowConfirm(false);
      setExisting(null);
    } catch (err) {
      setShowConfirm(false);
      setError('ปิดโต๊ะไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('คัดลอกไม่สำเร็จ กรุณาคัดลอกลิงก์ด้วยตัวเอง');
    }
  };

  const minutesOpen = existing
    ? Math.max(0, Math.floor((Date.now() - new Date(existing.created_at).getTime()) / 60000))
    : 0;

  // ---------- หน้าผลลัพธ์ QR ----------
  if (result) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.url)}`;
    return (
      <main style={s.page}>
        <h1 style={s.h1}>Suki Halal</h1>
        <div style={s.result}>
          <img src={qrSrc} alt={`QR Code โต๊ะ ${result.table}`} width={300} height={300} />
          <p style={{ fontSize: 26, fontWeight: 'bold' }}>
            โต๊ะ {result.table} · ผู้ใหญ่ {result.adults} · เด็ก {result.children}
          </p>
          <div style={s.link}>
            {result.url}
            <button type="button" style={s.copyBtn} onClick={handleCopy}>
              {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
            </button>
          </div>
          {error && <div style={s.err}>{error}</div>}
          <button type="button" style={s.btn} onClick={resetAll}>เปิดโต๊ะใหม่</button>
        </div>
      </main>
    );
  }

  // ---------- ฟอร์มเปิดโต๊ะ ----------
  return (
    <main style={s.page}>
      <h1 style={s.h1}>Suki Halal · เปิดโต๊ะ</h1>

      <form onSubmit={handleOpenTable}>
        <label style={s.label} htmlFor="table">เลขโต๊ะ</label>
        <input id="table" style={s.input} type="number" inputMode="numeric" min="1"
          value={table}
          onChange={(e) => { setTable(e.target.value); setExisting(null); }} />

        <label style={s.label} htmlFor="adults">จำนวนผู้ใหญ่</label>
        <input id="adults" style={s.input} type="number" inputMode="numeric" min="0"
          value={adults} onChange={(e) => setAdults(e.target.value)} />

        <label style={s.label} htmlFor="children">จำนวนเด็ก</label>
        <input id="children" style={s.input} type="number" inputMode="numeric" min="0"
          value={children} onChange={(e) => setChildren(e.target.value)} />

        <button type="submit" style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
          {loading ? 'กำลังทำงาน...' : 'เปิดโต๊ะ'}
        </button>
      </form>

      {error && <div style={s.err}>{error}</div>}

      {existing && (
        <div style={s.warn}>
          <p style={{ fontWeight: 'bold', margin: '0 0 12px' }}>
            ⚠️ โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
          </p>
          <button type="button" style={{ ...s.btn, ...s.btnDanger, marginTop: 0 }}
            onClick={() => setShowConfirm(true)}>
            ปิดออเดอร์เดิม
          </button>
        </div>
      )}

      {existing && showConfirm && (
        <div style={s.overlay}>
          <div style={s.dialog} role="dialog" aria-modal="true">
            <h2 style={{ marginTop: 0, color: '#c2410c' }}>ยืนยันปิดโต๊ะเดิม?</h2>
            <p>โต๊ะ <b>{existing.table_number}</b></p>
            <p>ผู้ใหญ่ <b>{existing.adult_count}</b> · เด็ก <b>{existing.child_count}</b></p>
            <p>เปิดมาแล้ว <b>{minutesOpen}</b> นาที</p>
            <button type="button" style={{ ...s.btn, ...s.btnDanger, opacity: loading ? 0.6 : 1 }}
              onClick={handleConfirmClose} disabled={loading}>
              ยืนยันปิดโต๊ะเดิม
            </button>
            <button type="button" style={{ ...s.btn, ...s.btnGray }}
              onClick={() => setShowConfirm(false)} disabled={loading}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
