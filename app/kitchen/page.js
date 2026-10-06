'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AlertIcon } from '../../components/Icons';
import styles from './kitchen.module.css';

const ACTIVE = ['received', 'cooking'];
const LATE_MINUTES = 15;
const FRESH_MS = 2 * 60 * 1000; // ออเดอร์ที่เพิ่งเข้าภายใน 2 นาทีจะเรืองแสง
const LEAVE_MS = 260; // เวลาอนิเมชันการ์ดหายไป

function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

function sortOldestFirst(list) {
  return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

// เสียงแจ้งเตือนสั้นๆ เมื่อมีออเดอร์ใหม่ (เบราว์เซอร์อาจบล็อกจนกว่าจะมีการแตะหน้าจอครั้งแรก)
function playDing(ctxRef) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!ctxRef.current) ctxRef.current = new Ctx();
    const ctx = ctxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.12);
      o.stop(t + i * 0.12 + 0.4);
    });
  } catch {
    /* ignore */
  }
}

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState({}); // { [orderId]: true } กันกดซ้ำ
  const [leaving, setLeaving] = useState({}); // { [orderId]: true } กำลังเล่นอนิเมชันออก
  const audioRef = useRef(null);

  const loadOrders = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('orders')
      .select('id, session_id, table_number, items, status, created_at')
      .in('status', ACTIVE)
      .order('created_at', { ascending: true });
    if (e) {
      setError('โหลดออเดอร์ไม่สำเร็จ: ' + e.message);
    } else {
      setError('');
      setOrders(data || []);
    }
    setLoading(false);
  }, []);

  // โหลดครั้งแรก + สำรองดึงใหม่ทุก 60 วินาที (กันกรณีเน็ตหลุดแล้วพลาดอัปเดต)
  useEffect(() => {
    loadOrders();
    const poll = setInterval(loadOrders, 60000);
    return () => clearInterval(poll);
  }, [loadOrders]);

  // อัปเดตเวลา "ผ่านมากี่นาที" ทุก 30 วินาที
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Realtime: INSERT และ UPDATE ของตาราง orders
  useEffect(() => {
    const applyChange = (row) => {
      setOrders((prev) => {
        const rest = prev.filter((o) => o.id !== row.id);
        if (!ACTIVE.includes(row.status)) return rest; // served ฯลฯ -> เอาออก
        return sortOldestFirst([...rest, row]);
      });
    };

    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (p) => {
        applyChange(p.new);
        if (ACTIVE.includes(p.new.status)) {
          setNow(Date.now());
          playDing(audioRef);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (p) => applyChange(p.new))
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') loadOrders(); // ดึงซ้ำเผื่อพลาดช่วงที่หลุด
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  const updateStatus = async (order, newStatus) => {
    if (busy[order.id]) return;
    setError('');
    setBusy((b) => ({ ...b, [order.id]: true }));
    const { data, error: e } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id)
      .select('id, session_id, table_number, items, status, created_at');
    setBusy((b) => {
      const n = { ...b };
      delete n[order.id];
      return n;
    });
    if (e) {
      setError('อัปเดตสถานะไม่สำเร็จ: ' + e.message);
      return;
    }
    const row = data && data[0] ? data[0] : { ...order, status: newStatus };
    const apply = () => setOrders((prev) => {
      const rest = prev.filter((o) => o.id !== order.id);
      return ACTIVE.includes(row.status) ? sortOldestFirst([...rest, row]) : rest;
    });
    if (ACTIVE.includes(row.status)) {
      apply();
    } else {
      // ให้การ์ดเล่นอนิเมชันหายไปก่อนค่อยเอาออก
      setLeaving((l) => ({ ...l, [order.id]: true }));
      setTimeout(() => {
        apply();
        setLeaving((l) => {
          const n = { ...l };
          delete n[order.id];
          return n;
        });
      }, LEAVE_MS);
    }
  };

  const newCount = orders.filter((o) => o.status === 'received').length;
  const cookingCount = orders.length - newCount;

  return (
    <main className={styles.page} onPointerDown={() => audioRef.current && audioRef.current.state === 'suspended' && audioRef.current.resume()}>
      <div className={styles.head}>
        <h1 className={styles.title}>ครัว</h1>
        <div className={styles.stats}>
          <span className={styles.chip}>
            <span className={`dot ${live ? 'dot-live' : 'dot-wait'}`} />
            {live ? 'เชื่อมต่อสด' : 'กำลังเชื่อมต่อ...'}
          </span>
          <span className={styles.chip}>ใหม่ {newCount}</span>
          <span className={styles.chip}>กำลังทำ {cookingCount}</span>
          <span key={orders.length} className={`pill pill-solid-saffron pop ${styles.total}`}>ค้าง {orders.length} ออเดอร์</span>
        </div>
      </div>

      {error && <div className={styles.err} role="alert"><AlertIcon />{error}</div>}

      {loading && (
        <div className={styles.grid}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton-dark" style={{ height: 260 }} />)}
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>✓</div>
          <div>ไม่มีออเดอร์ค้าง</div>
          <div className={styles.emptySub}>ออเดอร์ใหม่จะเด้งขึ้นที่นี่ทันทีพร้อมเสียงแจ้งเตือน</div>
        </div>
      )}

      <div className={styles.grid}>
        {orders.map((o) => {
          const cooking = o.status === 'cooking';
          const age = now - new Date(o.created_at).getTime();
          const mins = Math.max(0, Math.floor(age / 60000));
          const late = mins >= LATE_MINUTES;
          const fresh = !cooking && age < FRESH_MS;
          const time = new Date(o.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
          const items = parseItems(o.items);
          const isBusy = !!busy[o.id];
          const cls = [
            styles.card,
            cooking ? styles.cardCooking : styles.cardNew,
            late ? styles.cardLate : '',
            fresh ? styles.cardFresh : '',
            leaving[o.id] ? styles.cardLeaving : '',
          ].join(' ');
          return (
            <article key={o.id} className={cls} aria-busy={isBusy}>
              <div className={styles.top}>
                <div className={styles.table}>โต๊ะ {o.table_number}</div>
                <div className={styles.time}>
                  <div>{time} น.</div>
                  <div className={late ? styles.lateText : ''} style={{ fontWeight: 700 }}>
                    {mins === 0 ? 'เพิ่งเข้า' : `รอ ${mins} นาที`}
                  </div>
                </div>
              </div>
              <span className={`pill ${cooking ? 'pill-solid-saffron' : 'pill-saffron'}`} style={{ alignSelf: 'flex-start' }}>
                {cooking ? 'กำลังทำ' : 'ออเดอร์ใหม่'}
              </span>
              <ul className={styles.items}>
                {items.map((it, i) => (
                  <li key={i} className={styles.itemRow}>
                    <span>{it.name}</span>
                    <span className={styles.itemQty}>× {it.quantity}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.btnRow}>
                <button type="button" className="btn btn-accent btn-lg" style={{ flex: 1 }}
                  disabled={cooking || isBusy}
                  onClick={() => updateStatus(o, 'cooking')}>
                  {cooking ? 'กำลังทำ' : 'เริ่มทำ'}
                </button>
                <button type="button" className="btn btn-primary btn-lg" style={{ flex: 1 }}
                  disabled={isBusy}
                  onClick={() => updateStatus(o, 'served')}>
                  {isBusy && <span className="spinner" />}เสิร์ฟแล้ว
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
