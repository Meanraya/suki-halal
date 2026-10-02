'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { calcTotal } from '../../lib/pricing';

const s = {
  page: { maxWidth: 900, margin: '0 auto', padding: 16, fontSize: 22 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 },
  card: { border: '5px solid #2563eb', background: '#eff6ff', borderRadius: 14, padding: 16 },
  btn: { width: '100%', fontSize: 22, fontWeight: 'bold', padding: 14, border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', marginTop: 10 },
  err: { margin: '12px 0', padding: 12, background: '#fff7ed', border: '2px solid #f97316', borderRadius: 8, color: '#9a3412' },
};

export default function CashierPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
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

  const receive = async (row, method) => {
    const total = calcTotal(row.adult_count, row.child_count);
    const label = method === 'cash' ? 'เงินสด' : 'โอน/พร้อมเพย์';
    if (!window.confirm(`โต๊ะ ${row.table_number}: รับ${label} ${total.toLocaleString('th-TH')} บาท ใช่หรือไม่?`)) return;
    setBusyId(row.id);
    setError('');
    const { error: e } = await supabase
      .from('sessions')
      .update({ status: 'closed', payment_method: method, paid_amount: total, paid_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'billing')
      .select('id');
    setBusyId(null);
    if (e) setError('บันทึกการรับเงินไม่สำเร็จ: ' + e.message);
    else load();
  };

  return (
    <main style={s.page}>
      <h1>แคชเชียร์ · รอชำระเงิน</h1>
      {error && <div style={s.err}>{error}</div>}
      {loading && <p>กำลังโหลด...</p>}
      {!loading && rows.length === 0 && <p style={{ color: '#6b7280' }}>ไม่มีโต๊ะที่รอชำระเงิน</p>}
      <div style={s.grid}>
        {rows.map((r) => {
          const total = calcTotal(r.adult_count, r.child_count);
          const mins = Math.max(0, Math.floor((now - new Date(r.created_at).getTime()) / 60000));
          return (
            <div key={r.id} style={s.card}>
              <div style={{ fontSize: 44, fontWeight: 'bold' }}>โต๊ะ {r.table_number}</div>
              <div>ผู้ใหญ่ {r.adult_count} · เด็ก {r.child_count}</div>
              <div style={{ fontSize: 34, fontWeight: 'bold', color: '#15803d', margin: '8px 0' }}>
                {total.toLocaleString('th-TH')} บาท
              </div>
              <div style={{ fontSize: 16, color: '#6b7280' }}>เปิดโต๊ะมา {mins} นาที</div>
              <button type="button" style={{ ...s.btn, background: '#16a34a' }} disabled={busyId === r.id}
                onClick={() => receive(r, 'cash')}>รับเงินสดแล้ว</button>
              <button type="button" style={{ ...s.btn, background: '#2563eb' }} disabled={busyId === r.id}
                onClick={() => receive(r, 'promptpay')}>รับโอน/พร้อมเพย์แล้ว</button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
