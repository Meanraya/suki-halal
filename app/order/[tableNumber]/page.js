'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { ADULT_PRICE, CHILD_PRICE, calcTotal } from '../../../lib/pricing';
import { buildPromptPayPayload } from '../../../lib/promptpay';
const MAX_QTY = 5; // จำนวนต่อรายการ
const MAX_LINES = 10; // รายการต่อการส่ง 1 ครั้ง

const c = {
  green: '#15803d',
  cream: '#fffbeb',
  full: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, fontSize: 28, fontWeight: 'bold', background: '#fffbeb' },
  page: { maxWidth: 480, margin: '0 auto', background: '#fffbeb', minHeight: '100vh', paddingBottom: 130, fontSize: 18 },
  header: { position: 'sticky', top: 0, zIndex: 5, background: '#15803d', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  billBtn: { background: '#fff', color: '#15803d', border: 'none', borderRadius: 20, padding: '10px 16px', fontSize: 16, fontWeight: 'bold', cursor: 'pointer' },
  tabs: { position: 'sticky', top: 60, zIndex: 4, display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 12px', background: '#fef3c7' },
  tab: { flex: '0 0 auto', padding: '12px 18px', borderRadius: 24, border: '2px solid #15803d', background: '#fff', color: '#15803d', fontSize: 17, fontWeight: 'bold', cursor: 'pointer' },
  tabOn: { background: '#15803d', color: '#fff' },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fff', margin: '10px 12px', padding: '14px 16px', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' },
  addBtn: { width: 52, height: 52, borderRadius: 26, border: 'none', background: '#15803d', color: '#fff', fontSize: 30, fontWeight: 'bold', cursor: 'pointer', flex: '0 0 auto' },
  minusBtn: { background: '#e5e7eb', color: '#111' },
  stepper: { display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto' },
  toast: { margin: '12px', padding: 14, background: '#dcfce7', border: '2px solid #16a34a', borderRadius: 12, color: '#166534', fontWeight: 'bold', textAlign: 'center' },
  err: { margin: '12px', padding: 14, background: '#fff7ed', border: '2px solid #f97316', borderRadius: 12, color: '#9a3412' },
  bar: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 6 },
  barInner: { maxWidth: 480, margin: '0 auto', background: '#fff', borderTop: '3px solid #15803d', boxShadow: '0 -2px 10px rgba(0,0,0,0.2)', padding: 12 },
  cartList: { maxHeight: '35vh', overflowY: 'auto', marginBottom: 10 },
  cartRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e5e7eb' },
  barRow: { display: 'flex', gap: 10, alignItems: 'center' },
  cartToggle: { flex: 1, textAlign: 'left', background: '#f3f4f6', border: 'none', borderRadius: 12, padding: '14px 12px', fontSize: 17, fontWeight: 'bold', cursor: 'pointer' },
  sendBtn: { flex: '0 0 auto', background: '#15803d', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 20px', fontSize: 19, fontWeight: 'bold', cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 20 },
  dialog: { background: '#fff', borderRadius: 16, padding: 22, maxWidth: 420, width: '100%', fontSize: 20 },
  dlgBtn: { width: '100%', border: 'none', borderRadius: 12, padding: 16, fontSize: 21, fontWeight: 'bold', cursor: 'pointer', marginTop: 12 },
};

export default function OrderPage({ params }) {
  // params เป็น Promise ต้อง unwrap ด้วย use() เสมอ
  const { tableNumber } = use(params);

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const t = parseInt(tableNumber, 10);
      if (!Number.isInteger(t)) {
        setLoading(false);
        return;
      }
      try {
        const { data: open, error: e1 } = await supabase
          .from('sessions')
          .select('id, adult_count, child_count, status')
          .eq('table_number', t)
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

        const [catRes, itemRes] = await Promise.all([
          supabase.from('menu_categories').select('id, name, sort_order').order('sort_order', { ascending: true }),
          supabase.from('menu_items').select('id, category_id, name'),
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
  }, [tableNumber]);

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

  const lineCount = Object.keys(cart).length;
  const totalQty = Object.values(cart).reduce((sum, l) => sum + l.quantity, 0);

  const changeQty = (item, delta) => {
    setError('');
    setCart((prev) => {
      const cur = prev[item.id];
      const next = { ...prev };
      if (!cur) {
        if (delta < 0) return prev;
        if (Object.keys(prev).length >= MAX_LINES) {
          setError(`สั่งได้สูงสุด ${MAX_LINES} รายการต่อครั้ง กรุณาส่งออเดอร์ก่อน`);
          return prev;
        }
        next[item.id] = { name: item.name, quantity: 1 };
        return next;
      }
      const q = cur.quantity + delta;
      if (q > MAX_QTY) {
        setError(`สั่งได้สูงสุด ${MAX_QTY} ที่ต่อรายการ`);
        return prev;
      }
      if (q < 1) {
        delete next[item.id];
        return next;
      }
      next[item.id] = { ...cur, quantity: q };
      return next;
    });
  };

  const sendOrder = async () => {
    if (lineCount === 0 || busy) return;
    setBusy(true);
    setError('');
    setToast('');
    try {
      // กันกรณีพนักงานปิดโต๊ะไปแล้ว
      const { data: still, error: e0 } = await supabase
        .from('sessions').select('id, status').eq('id', session.id);
      if (e0) throw e0;
      if (!still || still.length === 0 || still[0].status === 'closed') {
        setClosed(true);
        return;
      }
      if (still[0].status === 'billing') {
        setBilling(true);
        return;
      }

      const orderItems = Object.values(cart).map((l) => ({ name: l.name, quantity: l.quantity }));
      const { error: e1 } = await supabase.from('orders').insert({
        session_id: session.id,
        table_number: parseInt(tableNumber, 10),
        items: orderItems,
        status: 'received',
      });
      if (e1) throw e1;

      setCart({});
      setShowCart(false);
      setToast('ส่งออเดอร์แล้ว ✓');
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setError('ส่งออเดอร์ไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
    }
  };

  const confirmBill = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: e } = await supabase
        .from('sessions')
        .update({ status: 'billing' })
        .eq('id', session.id)
        .eq('status', 'open')
        .select('id');
      if (e) throw e;
      setShowBill(false);
      setBilling(true);
    } catch (err) {
      setShowBill(false);
      setError('เรียกเก็บเงินไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={c.full}>กำลังโหลด...</div>;
  if (closed) return <div style={c.full}>ขอบคุณที่ใช้บริการ 🙏<br />Suki Halal</div>;
  if (billing && session) {
    const amount = calcTotal(session.adult_count, session.child_count);
    const payload = buildPromptPayPayload(process.env.NEXT_PUBLIC_PROMPTPAY_ID, amount);
    return (
      <div style={{ ...c.full, flexDirection: 'column', gap: 12 }}>
        <div>ยอดที่ต้องชำระ</div>
        <div style={{ fontSize: 44, color: c.green }}>{amount.toLocaleString('th-TH')} บาท</div>
        {payload ? (
          <>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`}
              alt="QR พร้อมเพย์" width={300} height={300} />
            <div style={{ fontSize: 18, fontWeight: 'normal' }}>สแกนจ่ายด้วยพร้อมเพย์ หรือชำระเงินสดกับพนักงาน</div>
          </>
        ) : (
          <div style={{ fontSize: 20, fontWeight: 'normal' }}>กรุณาชำระเงินกับพนักงาน</div>
        )}
        <div style={{ fontSize: 16, fontWeight: 'normal', color: '#6b7280' }}>
          หน้านี้จะเปลี่ยนเมื่อพนักงานยืนยันการรับเงินแล้ว
        </div>
      </div>
    );
  }
  if (!session) {
    return (
      <div style={c.full}>
        {error || 'โต๊ะนี้ยังไม่เปิดใช้งาน กรุณาแจ้งพนักงาน'}
      </div>
    );
  }

  const total = session.adult_count * ADULT_PRICE + session.child_count * CHILD_PRICE;
  const visibleItems = items.filter((i) => i.category_id === activeCat);

  return (
    <main style={c.page}>
      <header style={c.header}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 'bold' }}>Suki Halal</div>
          <div style={{ fontSize: 15 }}>โต๊ะ {tableNumber}</div>
        </div>
        <button type="button" style={c.billBtn} onClick={() => setShowBill(true)}>เรียกเก็บเงิน</button>
      </header>

      <nav style={c.tabs}>
        {categories.map((cat) => (
          <button key={cat.id} type="button"
            style={{ ...c.tab, ...(cat.id === activeCat ? c.tabOn : {}) }}
            onClick={() => setActiveCat(cat.id)}>
            {cat.name}
          </button>
        ))}
      </nav>

      {toast && <div style={c.toast}>{toast}</div>}
      {error && <div style={c.err}>{error}</div>}

      {visibleItems.map((item) => {
        const line = cart[item.id];
        return (
          <div key={item.id} style={c.item}>
            <span style={{ fontSize: 19, fontWeight: 'bold' }}>{item.name}</span>
            {line ? (
              <div style={c.stepper}>
                <button type="button" style={{ ...c.addBtn, ...c.minusBtn }} onClick={() => changeQty(item, -1)} aria-label="ลด">−</button>
                <b style={{ fontSize: 22, minWidth: 20, textAlign: 'center' }}>{line.quantity}</b>
                <button type="button" style={c.addBtn} onClick={() => changeQty(item, 1)} aria-label="เพิ่ม">+</button>
              </div>
            ) : (
              <button type="button" style={c.addBtn} onClick={() => changeQty(item, 1)} aria-label={`เพิ่ม ${item.name}`}>+</button>
            )}
          </div>
        );
      })}

      {categories.length > 0 && visibleItems.length === 0 && (
        <p style={{ textAlign: 'center', color: '#6b7280' }}>ยังไม่มีเมนูในหมวดนี้</p>
      )}

      <div style={c.bar}>
        <div style={c.barInner}>
          {showCart && lineCount > 0 && (
            <div style={c.cartList}>
              {Object.entries(cart).map(([id, l]) => (
                <div key={id} style={c.cartRow}>
                  <span>{l.name}</span>
                  <div style={c.stepper}>
                    <button type="button" style={{ ...c.addBtn, ...c.minusBtn, width: 44, height: 44, fontSize: 26 }}
                      onClick={() => changeQty({ id, name: l.name }, -1)}>−</button>
                    <b style={{ minWidth: 20, textAlign: 'center' }}>{l.quantity}</b>
                    <button type="button" style={{ ...c.addBtn, width: 44, height: 44, fontSize: 26 }}
                      onClick={() => changeQty({ id, name: l.name }, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={c.barRow}>
            <button type="button" style={c.cartToggle} onClick={() => setShowCart((v) => !v)}>
              🛒 ตะกร้า {lineCount}/{MAX_LINES} รายการ
              {totalQty > 0 && <span style={{ fontWeight: 'normal' }}> ({totalQty} ที่)</span>}
            </button>
            <button type="button"
              style={{ ...c.sendBtn, opacity: lineCount === 0 || busy ? 0.5 : 1 }}
              disabled={lineCount === 0 || busy} onClick={sendOrder}>
              {busy ? 'กำลังส่ง...' : 'ส่งออเดอร์'}
            </button>
          </div>
        </div>
      </div>

      {showBill && (
        <div style={c.overlay}>
          <div style={c.dialog} role="dialog" aria-modal="true">
            <h2 style={{ marginTop: 0 }}>เรียกเก็บเงิน</h2>
            <p>ผู้ใหญ่ {session.adult_count} × {ADULT_PRICE} บาท</p>
            <p>เด็ก {session.child_count} × {CHILD_PRICE} บาท</p>
            <p style={{ fontSize: 28, fontWeight: 'bold', color: c.green }}>
              ยอดรวม {total.toLocaleString('th-TH')} บาท
            </p>
            <p style={{ fontSize: 16, color: '#6b7280' }}>เมื่อยืนยันแล้วจะสั่งอาหารเพิ่มไม่ได้ และจะแสดงหน้าชำระเงิน</p>
            <button type="button" style={{ ...c.dlgBtn, background: c.green, color: '#fff', opacity: busy ? 0.6 : 1 }}
              disabled={busy} onClick={confirmBill}>ยืนยัน</button>
            <button type="button" style={{ ...c.dlgBtn, background: '#e5e7eb', color: '#111' }}
              disabled={busy} onClick={() => setShowBill(false)}>ยกเลิก</button>
          </div>
        </div>
      )}
    </main>
  );
}
