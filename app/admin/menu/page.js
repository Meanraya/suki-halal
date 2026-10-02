'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const s = {
  page: { maxWidth: 760, margin: '0 auto', padding: 16, fontSize: 20 },
  box: { border: '3px solid #d1d5db', borderRadius: 12, padding: 14, marginBottom: 16, background: '#fff' },
  row: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 140, fontSize: 20, padding: 10, border: '2px solid #9ca3af', borderRadius: 8 },
  num: { width: 80, fontSize: 20, padding: 10, border: '2px solid #9ca3af', borderRadius: 8 },
  btn: { fontSize: 18, fontWeight: 'bold', padding: '10px 14px', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' },
  ok: { padding: 10, background: '#dcfce7', border: '2px solid #16a34a', borderRadius: 8, marginBottom: 12 },
  err: { padding: 10, background: '#fff7ed', border: '2px solid #f97316', borderRadius: 8, marginBottom: 12, color: '#9a3412' },
};

export default function MenuAdminPage() {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [newCat, setNewCat] = useState({ name: '', sort: '' });
  const [newItem, setNewItem] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [c, i] = await Promise.all([
      supabase.from('menu_categories').select('id, name, sort_order').order('sort_order', { ascending: true }),
      supabase.from('menu_items').select('id, category_id, name').order('id', { ascending: true }),
    ]);
    if (c.error || i.error) {
      setError('โหลดเมนูไม่สำเร็จ: ' + (c.error || i.error).message);
      return;
    }
    setCats(c.data || []);
    setItems(i.data || []);
    setDrafts({});
  }, []);

  useEffect(() => { load(); }, [load]);

  const val = (key, original) => (drafts[key] !== undefined ? drafts[key] : original);
  const setDraft = (key, v) => setDrafts((d) => ({ ...d, [key]: v }));

  const run = async (fn, okMsg) => {
    setError(''); setMsg(''); setBusy(true);
    const { error: e } = await fn();
    setBusy(false);
    if (e) { setError('ไม่สำเร็จ: ' + e.message); return; }
    setMsg(okMsg);
    await load();
  };

  const addCategory = () => {
    const name = newCat.name.trim();
    if (!name) return setError('กรุณากรอกชื่อหมวดหมู่');
    const sort = newCat.sort !== '' ? Number(newCat.sort) : (cats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0) + 1);
    run(() => supabase.from('menu_categories').insert({ name, sort_order: sort }), 'เพิ่มหมวดหมู่แล้ว')
      .then(() => setNewCat({ name: '', sort: '' }));
  };

  const saveCategory = (c) => {
    const name = String(val('cn:' + c.id, c.name)).trim();
    const sort = Number(val('cs:' + c.id, c.sort_order));
    if (!name) return setError('ชื่อหมวดหมู่ห้ามว่าง');
    run(() => supabase.from('menu_categories').update({ name, sort_order: sort }).eq('id', c.id), 'บันทึกหมวดหมู่แล้ว');
  };

  const deleteCategory = (c) => {
    const count = items.filter((i) => i.category_id === c.id).length;
    if (!window.confirm(`ลบหมวด "${c.name}" และเมนูในหมวดนี้ทั้งหมด (${count} รายการ) ใช่หรือไม่?`)) return;
    run(async () => {
      const r1 = await supabase.from('menu_items').delete().eq('category_id', c.id);
      if (r1.error) return r1;
      return supabase.from('menu_categories').delete().eq('id', c.id);
    }, 'ลบหมวดหมู่แล้ว');
  };

  const addItem = (catId) => {
    const name = String(newItem[catId] || '').trim();
    if (!name) return setError('กรุณากรอกชื่อเมนู');
    run(() => supabase.from('menu_items').insert({ category_id: catId, name }), 'เพิ่มเมนูแล้ว')
      .then(() => setNewItem((n) => ({ ...n, [catId]: '' })));
  };

  const saveItem = (it) => {
    const name = String(val('in:' + it.id, it.name)).trim();
    if (!name) return setError('ชื่อเมนูห้ามว่าง');
    run(() => supabase.from('menu_items').update({ name }).eq('id', it.id), 'บันทึกเมนูแล้ว');
  };

  const deleteItem = (it) => {
    if (!window.confirm(`ลบเมนู "${it.name}" ใช่หรือไม่?`)) return;
    run(() => supabase.from('menu_items').delete().eq('id', it.id), 'ลบเมนูแล้ว');
  };

  return (
    <main style={s.page}>
      <h1>จัดการเมนู</h1>
      {msg && <div style={s.ok}>{msg}</div>}
      {error && <div style={s.err}>{error}</div>}

      <div style={s.box}>
        <b>เพิ่มหมวดหมู่ใหม่</b>
        <div style={s.row}>
          <input style={s.input} placeholder="ชื่อหมวดหมู่" value={newCat.name}
            onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <input style={s.num} type="number" placeholder="ลำดับ" value={newCat.sort}
            onChange={(e) => setNewCat({ ...newCat, sort: e.target.value })} />
          <button type="button" style={{ ...s.btn, background: '#16a34a' }} disabled={busy} onClick={addCategory}>เพิ่ม</button>
        </div>
      </div>

      {cats.map((c) => (
        <div key={c.id} style={s.box}>
          <div style={s.row}>
            <input style={{ ...s.input, fontWeight: 'bold' }} value={val('cn:' + c.id, c.name)}
              onChange={(e) => setDraft('cn:' + c.id, e.target.value)} />
            <input style={s.num} type="number" value={val('cs:' + c.id, c.sort_order ?? 0)}
              onChange={(e) => setDraft('cs:' + c.id, e.target.value)} title="ลำดับการแสดง" />
            <button type="button" style={{ ...s.btn, background: '#2563eb' }} disabled={busy} onClick={() => saveCategory(c)}>บันทึก</button>
            <button type="button" style={{ ...s.btn, background: '#dc2626' }} disabled={busy} onClick={() => deleteCategory(c)}>ลบหมวด</button>
          </div>

          {items.filter((i) => i.category_id === c.id).map((it) => (
            <div key={it.id} style={s.row}>
              <input style={s.input} value={val('in:' + it.id, it.name)}
                onChange={(e) => setDraft('in:' + it.id, e.target.value)} />
              <button type="button" style={{ ...s.btn, background: '#2563eb' }} disabled={busy} onClick={() => saveItem(it)}>บันทึก</button>
              <button type="button" style={{ ...s.btn, background: '#dc2626' }} disabled={busy} onClick={() => deleteItem(it)}>ลบ</button>
            </div>
          ))}

          <div style={{ ...s.row, borderTop: '2px dashed #d1d5db', paddingTop: 10 }}>
            <input style={s.input} placeholder="ชื่อเมนูใหม่ในหมวดนี้" value={newItem[c.id] || ''}
              onChange={(e) => setNewItem({ ...newItem, [c.id]: e.target.value })} />
            <button type="button" style={{ ...s.btn, background: '#16a34a' }} disabled={busy} onClick={() => addItem(c.id)}>+ เพิ่มเมนู</button>
          </div>
        </div>
      ))}
    </main>
  );
}
