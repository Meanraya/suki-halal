'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ADULT_PRICE, CHILD_PRICE, calcTotal } from '../../lib/pricing';
import { AlertIcon, CheckIcon } from '../../components/Icons';
import styles from './cashier.module.css';

const METHOD_LABEL = { cash: 'เงินสด', promptpay: 'โอน/พร้อมเพย์' };

export default function CashierPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [pending, setPending] = useState(null); // { row, method } รอยืนยัน
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('sessions')
      .select('id, table_number, adult_count, child_count, created_at')
      .eq('status', 'billing')
      .order('created_at', { ascending: true });
    if (e) setError('โหลดข้อมูลไม่สำเร็จ: ' + e.message);
    else { setError(''); setRows(data || []); }
    setLoading(false);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(''), 4000);
    return () => clearTimeout(t);
  }, [done]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) setPending(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, busy]);

  const receive = async () => {
    if (!pending || busy) return;
    const { row, method } = pending;
    const total = calcTotal(row.adult_count, row.child_count);
    setBusy(true);
    setError('');
    const { data, error: e } = await supabase
      .from('sessions')
      .update({ status: 'closed', payment_method: method, paid_amount: total, paid_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'billing')
      .select('id');
    setBusy(false);
    setPending(null);
    if (e) {
      setError('บันทึกการรับเงินไม่สำเร็จ: ' + e.message);
      return;
    }
    if (!data || data.length === 0) {
      setError(`โต๊ะ ${row.table_number} ถูกปิดหรือรับเงินไปแล้วโดยเครื่องอื่น`);
    } else {
      setDone(`รับ${METHOD_LABEL[method]}โต๊ะ ${row.table_number} จำนวน ${total.toLocaleString('th-TH')} บาทแล้ว`);
    }
    load();
  };

  const totalWaiting = rows.reduce((s, r) => s + calcTotal(r.adult_count, r.child_count), 0);

  return (
    <main className="staff-page">
      <div className="page-head">
        <div>
          <h1>แคชเชียร์</h1>
          <p>โต๊ะที่กดเรียกเก็บเงินแล้ว · อัปเดตอัตโนมัติทุก 5 วินาที</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span key={rows.length} className="pill pill-saffron pop">รอชำระ {rows.length} โต๊ะ</span>
          {rows.length > 0 && <span className="pill pill-jade">รวม {totalWaiting.toLocaleString('th-TH')} บาท</span>}
        </div>
      </div>

      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {done && <div className="alert alert-success" role="status"><CheckIcon />{done}</div>}
        {error && <div className="alert alert-error" role="alert"><AlertIcon />{error}</div>}
      </div>

      {loading && (
        <div className={styles.grid}>
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 300 }} />)}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><CheckIcon size={40} /></div>
          <div className={styles.emptyTitle}>ไม่มีโต๊ะที่รอชำระเงิน</div>
          <div className="muted">เมื่อลูกค้ากดเรียกเก็บเงิน โต๊ะจะขึ้นที่นี่</div>
        </div>
      )}

      <div className={`${styles.grid} stagger`}>
        {rows.map((r) => {
          const total = calcTotal(r.adult_count, r.child_count);
          const mins = Math.max(0, Math.floor((now - new Date(r.created_at).getTime()) / 60000));
          return (
            <article key={r.id} className={`card ${styles.card}`}>
              <div className={styles.cardTop}>
                <span className={styles.table}>โต๊ะ {r.table_number}</span>
                <span className="muted" style={{ fontSize: 14 }}>เปิดมา {mins} นาที</span>
              </div>
              <div className="summary">
                <div className="summary-row"><span>ผู้ใหญ่ {r.adult_count} × {ADULT_PRICE}</span><span>{(r.adult_count * ADULT_PRICE).toLocaleString('th-TH')}</span></div>
                <div className="summary-row"><span>เด็ก {r.child_count} × {CHILD_PRICE}</span><span>{(r.child_count * CHILD_PRICE).toLocaleString('th-TH')}</span></div>
              </div>
              <div className="summary-row" style={{ alignItems: 'baseline' }}>
                <span>ยอดรวม</span>
                <span className={styles.total}>{total.toLocaleString('th-TH')} บาท</span>
              </div>
              <div className={styles.actions}>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setPending({ row: r, method: 'cash' })}>รับเงินสด</button>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setPending({ row: r, method: 'promptpay' })}>รับพร้อมเพย์</button>
              </div>
            </article>
          );
        })}
      </div>

      {pending && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setPending(null); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="pay-title">
            <h2 id="pay-title">ยืนยันรับ{METHOD_LABEL[pending.method]}</h2>
            <div className="summary">
              <div className="summary-row"><span>โต๊ะ</span><b>{pending.row.table_number}</b></div>
              <div className="summary-row"><span>ลูกค้า</span><b>ผู้ใหญ่ {pending.row.adult_count} · เด็ก {pending.row.child_count}</b></div>
            </div>
            <div className="summary-row" style={{ alignItems: 'baseline' }}>
              <span>ยอดที่รับ</span>
              <span className={styles.total}>{calcTotal(pending.row.adult_count, pending.row.child_count).toLocaleString('th-TH')} บาท</span>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={receive}>
                {busy && <span className="spinner" />}ยืนยันรับเงินแล้ว
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setPending(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
