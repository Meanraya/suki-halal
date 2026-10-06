'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { ADULT_PRICE, CHILD_PRICE, calcTotal } from '../../lib/pricing';
import { AlertIcon, CheckIcon, MinusIcon, PlusIcon, QrIcon } from '../../components/Icons';
import styles from './generate-qr.module.css';

const MAX_GUESTS = 50;

function toCount(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

function Counter({ id, label, price, value, onChange, disabled }) {
  const n = toCount(value);
  const safe = Number.isNaN(n) ? 0 : n;
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label} <span className="muted" style={{ fontWeight: 400 }}>({price} บาท)</span></label>
      <div className={styles.counter}>
        <button type="button" className={`icon-btn ${styles.counterMinus}`} aria-label={`ลด${label}`}
          onClick={() => onChange(String(Math.max(0, safe - 1)))} disabled={disabled || safe <= 0}>
          <MinusIcon size={18} />
        </button>
        <input id={id} type="number" inputMode="numeric" min="0" max={MAX_GUESTS} className={styles.counterInput}
          value={value} placeholder="0" disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className={`icon-btn ${styles.counterPlus}`} aria-label={`เพิ่ม${label}`}
          onClick={() => onChange(String(Math.min(MAX_GUESTS, safe + 1)))} disabled={disabled || safe >= MAX_GUESTS}>
          <PlusIcon size={18} />
        </button>
      </div>
    </div>
  );
}

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
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const copyTimer = useRef(null);
  const tableInput = useRef(null);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (!showConfirm) return;
    const onKey = (e) => { if (e.key === 'Escape' && !loading) setShowConfirm(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showConfirm, loading]);

  const resetAll = () => {
    setTable(''); setAdults(''); setChildren('');
    setExisting(null); setShowConfirm(false);
    setResult(null); setError(''); setCopied(false); setQrLoaded(false); setQrFailed(false);
    setTimeout(() => tableInput.current && tableInput.current.focus(), 0);
  };

  const a = toCount(adults);
  const c = toCount(children);
  const estimate = Number.isNaN(a) || Number.isNaN(c) ? 0 : calcTotal(a, c);

  const handleOpenTable = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    const t = Number(table);

    if (!Number.isInteger(t) || t < 1) return setError('กรุณากรอกเลขโต๊ะเป็นตัวเลขจำนวนเต็มตั้งแต่ 1');
    if (Number.isNaN(a) || Number.isNaN(c) || a < 0 || c < 0) return setError('จำนวนลูกค้าต้องเป็นจำนวนเต็มไม่ติดลบ');
    if (a + c < 1) return setError('กรุณากรอกจำนวนลูกค้าอย่างน้อย 1 คน');
    if (a + c > MAX_GUESTS) return setError(`จำนวนลูกค้ารวมต้องไม่เกิน ${MAX_GUESTS} คน`);

    setLoading(true);
    try {
      const { data: open, error: e1 } = await supabase
        .from('sessions')
        .select('id, adult_count, child_count, created_at, status')
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

      setQrLoaded(false);
      setQrFailed(false);
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
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const { error: e } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existing.id)
        .in('status', ['open', 'billing']) // กันกดซ้ำ: อัปเดตเฉพาะแถวที่ยังเปิดอยู่
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
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('คัดลอกไม่สำเร็จ กรุณาคัดลอกลิงก์ด้วยตัวเอง');
    }
  };

  const minutesOpen = existing
    ? Math.max(0, Math.floor((Date.now() - new Date(existing.created_at).getTime()) / 60000))
    : 0;

  return (
    <main className="staff-page">
      <div className="page-head">
        <div>
          <h1>เปิดโต๊ะ</h1>
          <p>กรอกเลขโต๊ะและจำนวนลูกค้า แล้วให้ลูกค้าสแกน QR เพื่อสั่งอาหาร</p>
        </div>
      </div>

      <div className={styles.layout}>
        <form className={`card ${styles.formCard} fade-up`} onSubmit={handleOpenTable}>
          <div className="field">
            <label className="label" htmlFor="table">เลขโต๊ะ</label>
            <input id="table" ref={tableInput} className="input input-xl" type="number" inputMode="numeric" min="1"
              value={table} placeholder="เช่น 7" disabled={!!result}
              onChange={(e) => { setTable(e.target.value); setExisting(null); }} />
          </div>

          <div className={styles.counters}>
            <Counter id="adults" label="ผู้ใหญ่" price={ADULT_PRICE} value={adults} onChange={setAdults} disabled={!!result} />
            <Counter id="children" label="เด็ก" price={CHILD_PRICE} value={children} onChange={setChildren} disabled={!!result} />
          </div>

          <div className={styles.estimateRow}>
            <span>ยอดประมาณการ</span>
            <span key={estimate} className={`display pop ${styles.estimate}`}>{estimate.toLocaleString('th-TH')} บาท</span>
          </div>

          {error && <div className="alert alert-error" role="alert"><AlertIcon />{error}</div>}

          {existing && (
            <div className={styles.warn} role="alert">
              <div style={{ display: 'flex', gap: 10 }}>
                <AlertIcon size={22} />
                <div>
                  <b>โต๊ะ {existing.table_number} ยัง{existing.status === 'billing' ? 'รอชำระเงิน' : 'มีลูกค้าทานอยู่'}</b>
                  <div style={{ fontSize: 15 }}>กรุณาปิดออเดอร์เดิมก่อนเปิดโต๊ะใหม่</div>
                </div>
              </div>
              <button type="button" className="btn btn-danger btn-block" onClick={() => setShowConfirm(true)}>
                ปิดออเดอร์เดิม
              </button>
            </div>
          )}

          {result ? (
            <button type="button" className="btn btn-outline btn-lg btn-block" onClick={resetAll}>เปิดโต๊ะใหม่</button>
          ) : (
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? 'กำลังทำงาน...' : 'เปิดโต๊ะและสร้าง QR'}
            </button>
          )}
        </form>

        <section className={`${styles.qrPanel} ${result ? styles.qrPanelOn : ''}`} aria-live="polite">
          {result ? (
            <div className={styles.qrContent} key={result.url}>
              <div className={styles.qrHead}>
                <span className="display" style={{ fontSize: 22, fontWeight: 600 }}>โต๊ะ {result.table} พร้อมแล้ว</span>
                <span className="pill pill-solid-saffron"><CheckIcon size={16} /> เปิดแล้ว</span>
              </div>
              <div className={styles.qrBox}>
                {qrFailed ? (
                  <div className={styles.qrFail}>โหลด QR ไม่สำเร็จ<br />ให้ลูกค้าเปิดลิงก์ด้านล่างแทน</div>
                ) : !qrLoaded && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(result.url)}`}
                  alt={`QR Code โต๊ะ ${result.table}`} width={240} height={240}
                  onLoad={() => setQrLoaded(true)} onError={() => setQrFailed(true)} style={{ opacity: qrLoaded ? 1 : 0 }} />
              </div>
              <span className={styles.guests}>ผู้ใหญ่ {result.adults} · เด็ก {result.children}</span>
              <div className={styles.linkRow}>
                <span className={styles.link} title={result.url}>{result.url}</span>
                <button type="button" className="btn btn-accent btn-sm" onClick={handleCopy}>
                  {copied ? <><CheckIcon size={16} /> คัดลอกแล้ว</> : 'คัดลอกลิงก์'}
                </button>
              </div>
              <button type="button" className="btn btn-on-dark btn-block" onClick={() => window.print()}>พิมพ์ QR</button>
            </div>
          ) : (
            <div className={styles.qrPlaceholder}>
              <QrIcon size={56} />
              <span>QR ของโต๊ะจะแสดงที่นี่</span>
            </div>
          )}
        </section>
      </div>

      {existing && showConfirm && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) setShowConfirm(false); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="close-title">
            <h2 id="close-title" style={{ color: 'var(--chili)' }}>ยืนยันปิดโต๊ะเดิม?</h2>
            <div className="summary">
              <div className="summary-row"><span>โต๊ะ</span><b>{existing.table_number}</b></div>
              <div className="summary-row"><span>ลูกค้า</span><b>ผู้ใหญ่ {existing.adult_count} · เด็ก {existing.child_count}</b></div>
              <div className="summary-row"><span>เปิดมาแล้ว</span><b>{minutesOpen} นาที</b></div>
              {existing.status === 'billing' && (
                <div className="summary-row"><span>สถานะ</span><b style={{ color: 'var(--chili)' }}>รอชำระเงิน (ยังไม่ได้รับเงิน)</b></div>
              )}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-danger btn-lg" onClick={handleConfirmClose} disabled={loading}>
                {loading && <span className="spinner" />}ยืนยันปิดโต๊ะเดิม
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowConfirm(false)} disabled={loading}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
