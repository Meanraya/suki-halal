'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const ACTIVE = ['received', 'cooking'];

const s = {
  page: { minHeight: '100vh', background: '#111827', color: '#fff', padding: 16, fontSize: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  h1: { fontSize: 36, margin: 0 },
  status: { fontSize: 20 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, alignItems: 'start' },
  card: { borderRadius: 16, padding: 18, color: '#111827', border: '6px solid' },
  cardNew: { background: '#ffffff', borderColor: '#22c55e' },
  cardCooking: { background: '#fde047', borderColor: '#f97316' },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  table: { fontSize: 56, fontWeight: 'bold', lineHeight: 1 },
  time: { fontSize: 22, textAlign: 'right' },
  items: { listStyle: 'none', padding: 0, margin: '12px 0', fontSize: 30, fontWeight: 'bold' },
  itemRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '2px dashed rgba(0,0,0,0.2)' },
  btnRow: { display: 'flex', gap: 10, marginTop: 8 },
  btn: { flex: 1, fontSize: 24, fontWeight: 'bold', padding: '16px 8px', border: 'none', borderRadius: 12, cursor: 'pointer', color: '#fff' },
  empty: { textAlign: 'center', fontSize: 36, color: '#9ca3af', marginTop: 80 },
  err: { background: '#7c2d12', padding: 12, borderRadius: 10, marginBottom: 12 },
};

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

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (p) => applyChange(p.new))
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
    setError('');
    const { data, error: e } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id)
      .select('id, session_id, table_number, items, status, created_at');
    if (e) {
      setError('อัปเดตสถานะไม่สำเร็จ: ' + e.message);
      return;
    }
    const row = data && data[0] ? data[0] : { ...order, status: newStatus };
    setOrders((prev) => {
      const rest = prev.filter((o) => o.id !== order.id);
      return ACTIVE.includes(row.status) ? sortOldestFirst([...rest, row]) : rest;
    });
  };

  return (
    <main style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>Suki Halal · ครัว</h1>
        <div style={s.status}>
          {live ? '🟢 เชื่อมต่อสด' : '🟠 กำลังเชื่อมต่อ...'} · ค้าง {orders.length} ออเดอร์
        </div>
      </div>

      {error && <div style={s.err}>{error}</div>}
      {loading && <div style={s.empty}>กำลังโหลด...</div>}
      {!loading && orders.length === 0 && <div style={s.empty}>ไม่มีออเดอร์ค้าง</div>}

      <div style={s.grid}>
        {orders.map((o) => {
          const cooking = o.status === 'cooking';
          const mins = Math.max(0, Math.floor((now - new Date(o.created_at).getTime()) / 60000));
          const time = new Date(o.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
          const items = parseItems(o.items);
          return (
            <div key={o.id} style={{ ...s.card, ...(cooking ? s.cardCooking : s.cardNew) }}>
              <div style={s.top}>
                <div style={s.table}>โต๊ะ {o.table_number}</div>
                <div style={s.time}>
                  <div>{time} น.</div>
                  <div style={{ fontWeight: 'bold', color: mins >= 15 ? '#b91c1c' : '#111827' }}>
                    {mins} นาทีที่แล้ว
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 'bold' }}>
                {cooking ? '🔥 กำลังทำ' : '🆕 ออเดอร์ใหม่'}
              </div>
              <ul style={s.items}>
                {items.map((it, i) => (
                  <li key={i} style={s.itemRow}>
                    <span>{it.name}</span>
                    <span>× {it.quantity}</span>
                  </li>
                ))}
              </ul>
              <div style={s.btnRow}>
                <button type="button"
                  style={{ ...s.btn, background: '#ea580c', opacity: cooking ? 0.35 : 1 }}
                  disabled={cooking}
                  onClick={() => updateStatus(o, 'cooking')}>
                  เริ่มทำ
                </button>
                <button type="button" style={{ ...s.btn, background: '#16a34a' }}
                  onClick={() => updateStatus(o, 'served')}>
                  จัดเสิร์ฟแล้ว
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
