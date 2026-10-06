'use client';

import { use, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ADULT_PRICE, CHILD_PRICE, calcTotal } from '../../../lib/pricing';
import { buildPromptPayPayload } from '../../../lib/promptpay';
import {
  AlertIcon, BrandMark, CartIcon, CheckIcon, ChevronIcon, MinusIcon, PlusIcon, QrIcon,
} from '../../../components/Icons';
import styles from './order.module.css';

const MAX_QTY = 5; // จำนวนต่อรายการ
const MAX_LINES = 10; // รายการต่อการส่ง 1 ครั้ง
const cartKey = (sessionId) => `suki_cart_${sessionId}`;

export default function OrderPage({ params }) {
  // params เป็น Promise ต้อง unwrap ด้วย use() เสมอ
  const { tableNumber } = use(params);
  const tableNo = parseInt(tableNumber, 10);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null); // { id, adult_count, child_count }
  const [closed, setClosed] = useState(false); // ปิดโต๊ะแล้ว
  const [billing, setBilling] = useState(false); // เรียกเก็บเงินแล้ว รอชำระ
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [cart, setCart] = useState({}); // { [itemId]: { name, quantity } }
  const [showCart, setShowCart] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!Number.isInteger(tableNo) || tableNo < 1) {
        setLoading(false);
        return;
      }
      try {
        const { data: open, error: e1 } = await supabase
          .from('sessions')
          .select('id, adult_count, child_count, status')
          .eq('table_number', tableNo)
          .in('status', ['open', 'billing'])
          .order('created_at', { ascending: false })
          .limit(1);
        if (e1) throw e1;
        if (cancelled) return;
        if (!open || open.length === 0) {
          setLoading(false);
          return;
        }
        setSession(open[0]);
        if (open[0].status === 'billing') setBilling(true);

        // กู้ตะกร้าที่ยังไม่ได้ส่ง (เผื่อรีเฟรชหน้า)
        try {
          const saved = JSON.parse(sessionStorage.getItem(cartKey(open[0].id)) || '{}');
          if (saved && typeof saved === 'object') setCart(saved);
        } catch {
          /* ignore */
        }

        const [catRes, itemRes] = await Promise.all([
          supabase.from('menu_categories').select('id, name, sort_order').order('sort_order', { ascending: true }),
          supabase.from('menu_items').select('id, category_id, name').order('id', { ascending: true }),
        ]);
        if (catRes.error) throw catRes.error;
        if (itemRes.error) throw itemRes.error;
        if (cancelled) return;
        setCategories(catRes.data || []);
        setItems(itemRes.data || []);
        if (catRes.data && catRes.data.length > 0) setActiveCat(catRes.data[0].id);
      } catch (err) {
        if (!cancelled) setError('โหลดข้อมูลไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tableNo]);

  // เก็บตะกร้าไว้ในเครื่อง ไม่หายเมื่อรีเฟรช
  useEffect(() => {
    if (!session) return;
    try {
      sessionStorage.setItem(cartKey(session.id), JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart, session]);

  // ตอนรอชำระเงิน: เช็คทุก 5 วินาทีว่าพนักงานรับเงินแล้วหรือยัง
  useEffect(() => {
    if (!billing || !session) return;
    const t = setInterval(async () => {
      const { data, error: e } = await supabase.from('sessions').select('id, status').eq('id', session.id);
      if (e) return;
      if (!data || data.length === 0 || data[0].status === 'closed') setClosed(true);
    }, 5000);
    return () => clearInterval(t);
  }, [billing, session]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ปิดหน้าต่างด้วยปุ่ม Esc
  useEffect(() => {
    if (!showBill) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) setShowBill(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showBill, busy]);

  const lineCount = Object.keys(cart).length;
  const totalQty = Object.values(cart).reduce((sum, l) => sum + l.quantity, 0);

  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  };

  const changeQty = (item, delta) => {
    setError('');
    const cur = cart[item.id];
    if (!cur) {
      if (delta < 0) return;
      if (lineCount >= MAX_LINES) {
        setError(`สั่งได้สูงสุด ${MAX_LINES} รายการต่อครั้ง กรุณาส่งออเดอร์ก่อน`);
        return;
      }
      setCart({ ...cart, [item.id]: { name: item.name, quantity: 1 } });
      return;
    }
    const q = cur.quantity + delta;
    if (q > MAX_QTY) {
      setError(`สั่งได้สูงสุด ${MAX_QTY} ที่ต่อรายการ`);
      return;
    }
    const next = { ...cart };
    if (q < 1) delete next[item.id];
    else next[item.id] = { ...cur, quantity: q };
    setCart(next);
    if (Object.keys(next).length === 0) setShowCart(false);
  };

  const checkStatus = async () => {
    const { data, error: e } = await supabase.from('sessions').select('id, status').eq('id', session.id);
    if (e) throw e;
    if (!data || data.length === 0 || data[0].status === 'closed') return 'closed';
    return data[0].status;
  };

  const sendOrder = async () => {
    if (lineCount === 0 || busy) return;
    setBusy(true);
    setError('');
    setToast('');
    try {
      // กันกรณีพนักงานปิดโต๊ะไปแล้ว
      const status = await checkStatus();
      if (status === 'closed') {
        setClosed(true);
        return;
      }
      if (status === 'billing') {
        setBilling(true);
        return;
      }

      const orderItems = Object.values(cart).map((l) => ({ name: l.name, quantity: l.quantity }));
      const { error: e1 } = await supabase.from('orders').insert({
        session_id: session.id,
        table_number: tableNo,
        items: orderItems,
        status: 'received',
      });
      if (e1) throw e1;

      setCart({});
      setShowCart(false);
      showToast(`ส่งออเดอร์เข้าครัวแล้ว (${orderItems.length} รายการ)`);
    } catch (err) {
      setError('ส่งออเดอร์ไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
    }
  };

  const confirmBill = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: e } = await supabase
        .from('sessions')
        .update({ status: 'billing' })
        .eq('id', session.id)
        .eq('status', 'open')
        .select('id');
      if (e) throw e;
      setShowBill(false);
      // ไม่มีแถวถูกอัปเดต = สถานะเปลี่ยนไปแล้ว (เช่น พนักงานปิดโต๊ะ) ตรวจสถานะจริงก่อน
      if (!data || data.length === 0) {
        const status = await checkStatus();
        if (status === 'closed') {
          setClosed(true);
          return;
        }
      }
      setBilling(true);
    } catch (err) {
      setShowBill(false);
      setError('เรียกเก็บเงินไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
    }
  };

  // ---------- สถานะเต็มหน้าจอ ----------
  if (loading) {
    return (
      <div className={styles.shell} aria-busy="true">
        <div className={styles.headerSkeleton} />
        <div className={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 72 }} />)}
        </div>
        <span className="sr-only" role="status">กำลังโหลด...</span>
      </div>
    );
  }

  if (closed) {
    return (
      <div className={`state-screen ${styles.darkScreen}`}>
        <div className="state-icon" style={{ background: 'var(--saffron)', color: 'var(--jade-900)' }}><CheckIcon size={42} /></div>
        <div className="state-title" style={{ color: '#fff' }}>ขอบคุณที่ใช้บริการ</div>
        <div className="state-text" style={{ color: 'var(--jade-200)' }}>Suki Halal หวังว่าจะได้ต้อนรับอีกครั้ง</div>
      </div>
    );
  }

  if (billing && session) {
    return <PaymentScreen session={session} tableNo={tableNo} />;
  }

  if (!session) {
    return (
      <div className="state-screen">
        <div className="state-icon" style={{ background: error ? 'var(--chili-100)' : 'var(--saffron-100)', color: error ? 'var(--chili)' : 'var(--saffron-ink)' }}>
          <AlertIcon size={40} />
        </div>
        <div className="state-title">{error ? 'เกิดข้อผิดพลาด' : 'โต๊ะนี้ยังไม่เปิดใช้งาน'}</div>
        <div className="state-text">{error || 'กรุณาแจ้งพนักงานเพื่อเปิดโต๊ะ แล้วสแกน QR อีกครั้ง'}</div>
        {error && <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>ลองอีกครั้ง</button>}
      </div>
    );
  }

  const total = calcTotal(session.adult_count, session.child_count);
  const visibleItems = items.filter((i) => i.category_id === activeCat);
  const cartOpen = showCart && lineCount > 0;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className="brand">
            <BrandMark />
            <div>
              <div className="brand-name">Suki Halal</div>
              <div className={styles.subtle}>บุฟเฟต์สุกี้ฮาลาล</div>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-on-dark" style={{ borderRadius: 999 }} onClick={() => setShowBill(true)}>
            เรียกเก็บเงิน
          </button>
        </div>
        <div className={styles.infoRow}>
          <div className={styles.infoBox}>
            <span className={styles.subtle}>โต๊ะ</span>
            <span className={styles.tableNo}>{tableNo}</span>
          </div>
          <div className={styles.infoBox} style={{ flex: 2 }}>
            <span className={styles.subtle}>ลูกค้า</span>
            <span className={styles.guests}>ผู้ใหญ่ {session.adult_count} · เด็ก {session.child_count}</span>
          </div>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="หมวดหมู่เมนู">
        {categories.map((cat) => (
          <button key={cat.id} type="button"
            className={`${styles.tab} ${cat.id === activeCat ? styles.tabOn : ''}`}
            aria-pressed={cat.id === activeCat}
            onClick={() => setActiveCat(cat.id)}>
            {cat.name}
          </button>
        ))}
      </nav>

      <div className={styles.messages} aria-live="polite">
        {toast && <div className="alert alert-success" role="status"><CheckIcon />{toast}</div>}
        {error && <div className="alert alert-error" role="alert"><AlertIcon />{error}</div>}
      </div>

      <div key={activeCat} className={`${styles.list} stagger`}>
        {visibleItems.map((item) => {
          const line = cart[item.id];
          return (
            <div key={item.id} className={`${styles.item} ${line ? styles.itemOn : ''}`}>
              <span className={styles.itemName}>{item.name}</span>
              {line ? (
                <div className={styles.stepper}>
                  <button type="button" className={`icon-btn ${styles.minus}`} onClick={() => changeQty(item, -1)} aria-label={`ลด ${item.name}`}>
                    <MinusIcon size={18} />
                  </button>
                  <b key={line.quantity} className={`${styles.qty} pop`} aria-live="polite">{line.quantity}</b>
                  <button type="button" className={`icon-btn ${styles.plus}`} onClick={() => changeQty(item, 1)} aria-label={`เพิ่ม ${item.name}`}
                    disabled={line.quantity >= MAX_QTY}>
                    <PlusIcon size={18} />
                  </button>
                </div>
              ) : (
                <button type="button" className={`btn btn-primary btn-sm ${styles.addBtn}`} onClick={() => changeQty(item, 1)} aria-label={`เพิ่ม ${item.name}`}>
                  <PlusIcon /> เพิ่ม
                </button>
              )}
            </div>
          );
        })}

        {categories.length > 0 && visibleItems.length === 0 && (
          <p className={styles.empty}>ยังไม่มีเมนูในหมวดนี้</p>
        )}
        {categories.length === 0 && (
          <p className={styles.empty}>ยังไม่มีเมนู กรุณาแจ้งพนักงาน</p>
        )}
      </div>

      <div className={styles.barWrap}>
        <div className={styles.bar}>
          {cartOpen && (
            <div className={styles.cartList} id="cart-list">
              {Object.entries(cart).map(([id, l]) => (
                <div key={id} className={styles.cartRow}>
                  <span className={styles.cartName}>{l.name}</span>
                  <div className={styles.stepper}>
                    <button type="button" className={`icon-btn ${styles.minus}`} onClick={() => changeQty({ id, name: l.name }, -1)} aria-label={`ลด ${l.name}`}>
                      <MinusIcon size={16} />
                    </button>
                    <b className={styles.qty}>{l.quantity}</b>
                    <button type="button" className={`icon-btn ${styles.plus}`} onClick={() => changeQty({ id, name: l.name }, 1)} aria-label={`เพิ่ม ${l.name}`}
                      disabled={l.quantity >= MAX_QTY}>
                      <PlusIcon size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={styles.barRow}>
            <button type="button" className={styles.cartToggle} onClick={() => setShowCart((v) => !v)}
              aria-expanded={cartOpen} aria-controls="cart-list" disabled={lineCount === 0}>
              <span className={styles.cartIcon}>
                <CartIcon />
                {totalQty > 0 && <span key={totalQty} className={styles.badge}>{totalQty}</span>}
              </span>
              <span className={styles.cartText}>
                <span className={styles.cartTitle}>ตะกร้า {lineCount}/{MAX_LINES}</span>
                <span className={styles.subtleDark}>{lineCount === 0 ? 'เลือกเมนูเพื่อเริ่ม' : `${totalQty} ที่ · ${cartOpen ? 'แตะเพื่อซ่อน' : 'แตะเพื่อดู'}`}</span>
              </span>
              {lineCount > 0 && <ChevronIcon up={cartOpen} />}
            </button>
            <button type="button" className="btn btn-accent btn-lg" disabled={lineCount === 0 || busy} onClick={sendOrder}>
              {busy && <span className="spinner" />}
              {busy ? 'กำลังส่ง' : 'ส่งออเดอร์'}
            </button>
          </div>
        </div>
      </div>

      {showBill && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setShowBill(false); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="bill-title">
            <h2 id="bill-title">เรียกเก็บเงิน</h2>
            <div className="summary">
              <div className="summary-row"><span>ผู้ใหญ่ {session.adult_count} × {ADULT_PRICE}</span><b>{(session.adult_count * ADULT_PRICE).toLocaleString('th-TH')}</b></div>
              <div className="summary-row"><span>เด็ก {session.child_count} × {CHILD_PRICE}</span><b>{(session.child_count * CHILD_PRICE).toLocaleString('th-TH')}</b></div>
            </div>
            <div className="summary-row" style={{ alignItems: 'baseline' }}>
              <span>ยอดรวม</span>
              <span className="display" style={{ fontSize: 32, fontWeight: 700, color: 'var(--jade-700)' }}>{total.toLocaleString('th-TH')} บาท</span>
            </div>
            {lineCount > 0 && (
              <div className="alert alert-warn"><AlertIcon />ในตะกร้ายังมี {lineCount} รายการที่ยังไม่ได้ส่ง จะถูกยกเลิก</div>
            )}
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>เมื่อยืนยันแล้วจะสั่งอาหารเพิ่มไม่ได้ และจะแสดงหน้าชำระเงิน</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={confirmBill}>
                {busy && <span className="spinner" />}ยืนยันเรียกเก็บเงิน
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setShowBill(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PaymentScreen({ session, tableNo }) {
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const amount = calcTotal(session.adult_count, session.child_count);
  const payload = buildPromptPayPayload(process.env.NEXT_PUBLIC_PROMPTPAY_ID, amount);

  return (
    <div className={styles.payScreen}>
      <div className={styles.payHead}>
        <span className="brand-name">Suki Halal</span>
        <span className={styles.subtle}>โต๊ะ {tableNo} · รอชำระเงิน</span>
      </div>
      <div className={`card ${styles.payCard}`}>
        <span className="muted">ยอดที่ต้องชำระ</span>
        <span className={styles.amount}>{amount.toLocaleString('th-TH')} <small>บาท</small></span>
        <div className="summary" style={{ alignSelf: 'stretch' }}>
          <div className="summary-row"><span>ผู้ใหญ่ {session.adult_count} × {ADULT_PRICE}</span><b>{(session.adult_count * ADULT_PRICE).toLocaleString('th-TH')}</b></div>
          <div className="summary-row"><span>เด็ก {session.child_count} × {CHILD_PRICE}</span><b>{(session.child_count * CHILD_PRICE).toLocaleString('th-TH')}</b></div>
        </div>
        {payload && !qrFailed ? (
          <>
            <div className={styles.qrBox}>
              {!qrLoaded && <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`}
                alt="QR พร้อมเพย์" width={232} height={232}
                onLoad={() => setQrLoaded(true)}
                onError={() => setQrFailed(true)}
                style={{ opacity: qrLoaded ? 1 : 0, transition: 'opacity 0.4s' }} />
            </div>
            <span style={{ textAlign: 'center' }}>สแกนจ่ายด้วยพร้อมเพย์<br />หรือชำระเงินสดกับพนักงาน</span>
          </>
        ) : (
          <div className={styles.qrEmpty}><QrIcon /> {qrFailed ? 'โหลด QR ไม่สำเร็จ กรุณาชำระเงินกับพนักงาน' : 'กรุณาชำระเงินกับพนักงาน'}</div>
        )}
      </div>
      <div className={styles.payFoot} role="status">
        <span className="dot dot-wait" />
        หน้านี้จะเปลี่ยนเองเมื่อพนักงานยืนยันการรับเงิน
      </div>
    </div>
  );
}
