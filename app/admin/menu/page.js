'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { AlertIcon, CheckIcon, PlusIcon, TrashIcon } from '../../../components/Icons';
import styles from './menu.module.css';

export default function MenuAdminPage() {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [newCat, setNewCat] = useState({ name: '', sort: '' });
  const [newItem, setNewItem] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null); // { title, body, action }

  const load = useCallback(async () => {
    const [c, i] = await Promise.all([
      supabase.from('menu_categories').select('id, name, sort_order').order('sort_order', { ascending: true }),
      supabase.from('menu_items').select('id, category_id, name').order('id', { ascending: true }),
    ]);
    setLoading(false);
    if (c.error || i.error) {
      setError('โหลดเมนูไม่สำเร็จ: ' + (c.error || i.error).message);
      return;
    }
    setCats(c.data || []);
    setItems(i.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) setConfirm(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirm, busy]);

  const val = (key, original) => (drafts[key] !== undefined ? drafts[key] : original);
  const setDraft = (key, v) => setDrafts((d) => ({ ...d, [key]: v }));
  const clearDrafts = (...keys) => setDrafts((d) => {
    const n = { ...d };
    keys.forEach((k) => delete n[k]);
    return n;
  });
  const isDirty = (key, original) => drafts[key] !== undefined && String(drafts[key]) !== String(original);

  // คืนค่า true เมื่อสำเร็จ เพื่อให้ผู้เรียกล้างช่องกรอกเฉพาะตอนบันทึกได้จริง
  const run = async (fn, okMsg) => {
    setError(''); setMsg(''); setBusy(true);
    let failed = null;
    try {
      const res = await fn();
      if (res && res.error) failed = res.error;
    } catch (e) {
      failed = e;
    }
    setBusy(false);
    if (failed) {
      setError('ไม่สำเร็จ: ' + (failed.message || 'ไม่ทราบสาเหตุ'));
      return false;
    }
    setMsg(okMsg);
    await load();
    return true;
  };

  const parseSort = (raw) => {
    if (raw === '' || raw === null || raw === undefined) return null;
    const n = Number(raw);
    return Number.isInteger(n) ? n : NaN;
  };

  const addCategory = async () => {
    const name = newCat.name.trim();
    if (!name) return setError('กรุณากรอกชื่อหมวดหมู่');
    const parsed = parseSort(newCat.sort);
    if (Number.isNaN(parsed)) return setError('ลำดับต้องเป็นจำนวนเต็ม');
    const sort = parsed !== null ? parsed : cats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0) + 1;
    const ok = await run(() => supabase.from('menu_categories').insert({ name, sort_order: sort }), `เพิ่มหมวด "${name}" แล้ว`);
    if (ok) setNewCat({ name: '', sort: '' });
  };

  const saveCategory = async (c) => {
    const name = String(val('cn:' + c.id, c.name)).trim();
    const sort = parseSort(val('cs:' + c.id, c.sort_order ?? 0));
    if (!name) return setError('ชื่อหมวดหมู่ห้ามว่าง');
    if (sort === null || Number.isNaN(sort)) return setError('ลำดับต้องเป็นจำนวนเต็ม');
    const ok = await run(() => supabase.from('menu_categories').update({ name, sort_order: sort }).eq('id', c.id), 'บันทึกหมวดหมู่แล้ว');
    if (ok) clearDrafts('cn:' + c.id, 'cs:' + c.id);
  };

  const deleteCategory = (c) => {
    const count = items.filter((i) => i.category_id === c.id).length;
    setConfirm({
      title: `ลบหมวด "${c.name}"?`,
      body: count > 0 ? `เมนูในหมวดนี้ ${count} รายการจะถูกลบไปด้วย` : 'หมวดนี้ยังไม่มีเมนู',
      action: () => run(async () => {
        const r1 = await supabase.from('menu_items').delete().eq('category_id', c.id);
        if (r1.error) return r1;
        return supabase.from('menu_categories').delete().eq('id', c.id);
      }, 'ลบหมวดหมู่แล้ว'),
    });
  };

  const addItem = async (catId) => {
    const name = String(newItem[catId] || '').trim();
    if (!name) return setError('กรุณากรอกชื่อเมนู');
    const ok = await run(() => supabase.from('menu_items').insert({ category_id: catId, name }), `เพิ่มเมนู "${name}" แล้ว`);
    if (ok) setNewItem((n) => ({ ...n, [catId]: '' }));
  };

  const saveItem = async (it) => {
    const name = String(val('in:' + it.id, it.name)).trim();
    if (!name) return setError('ชื่อเมนูห้ามว่าง');
    const ok = await run(() => supabase.from('menu_items').update({ name }).eq('id', it.id), 'บันทึกเมนูแล้ว');
    if (ok) clearDrafts('in:' + it.id);
  };

  const deleteItem = (it) => {
    setConfirm({
      title: `ลบเมนู "${it.name}"?`,
      body: 'ลูกค้าจะไม่เห็นเมนูนี้อีก',
      action: () => run(() => supabase.from('menu_items').delete().eq('id', it.id), 'ลบเมนูแล้ว'),
    });
  };

  const doConfirm = async () => {
    const action = confirm.action;
    await action();
    setConfirm(null);
  };

  const onEnter = (fn) => (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };

  return (
    <main className="staff-page" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div>
          <h1>จัดการเมนู</h1>
          <p>{cats.length} หมวดหมู่ · {items.length} เมนู · บุฟเฟต์คิดราคาต่อหัว จึงไม่มีราคาต่อเมนู</p>
        </div>
      </div>

      <div className={styles.toastArea} aria-live="polite">
        {msg && <div className="alert alert-success" role="status"><CheckIcon />{msg}</div>}
        {error && <div className="alert alert-error" role="alert"><AlertIcon />{error}</div>}
      </div>

      <section className={`card ${styles.box} fade-up`}>
        <h2 className={styles.boxTitle}>เพิ่มหมวดหมู่ใหม่</h2>
        <div className={styles.row}>
          <input className={`input ${styles.grow}`} placeholder="ชื่อหมวดหมู่ เช่น ทะเล" aria-label="ชื่อหมวดหมู่ใหม่" value={newCat.name}
            onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} onKeyDown={onEnter(addCategory)} />
          <input className={`input ${styles.num}`} type="number" placeholder="ลำดับ" aria-label="ลำดับการแสดง" value={newCat.sort}
            onChange={(e) => setNewCat({ ...newCat, sort: e.target.value })} onKeyDown={onEnter(addCategory)} />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={addCategory}><PlusIcon /> เพิ่มหมวด</button>
        </div>
      </section>

      {loading && [0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 180 }} />)}

      <div className={`${styles.list} stagger`}>
        {cats.map((c) => {
          const catItems = items.filter((i) => i.category_id === c.id);
          const catDirty = isDirty('cn:' + c.id, c.name) || isDirty('cs:' + c.id, c.sort_order ?? 0);
          return (
            <section key={c.id} className={`card ${styles.box}`}>
              <div className={styles.catHead}>
                <input className={`input ${styles.grow} ${styles.catName}`} aria-label="ชื่อหมวดหมู่" value={val('cn:' + c.id, c.name)}
                  onChange={(e) => setDraft('cn:' + c.id, e.target.value)} onKeyDown={onEnter(() => saveCategory(c))} />
                <input className={`input ${styles.num}`} type="number" aria-label="ลำดับการแสดง" title="ลำดับการแสดง" value={val('cs:' + c.id, c.sort_order ?? 0)}
                  onChange={(e) => setDraft('cs:' + c.id, e.target.value)} onKeyDown={onEnter(() => saveCategory(c))} />
                <button type="button" className={`btn btn-sm ${catDirty ? 'btn-primary' : 'btn-ghost'}`} disabled={busy || !catDirty} onClick={() => saveCategory(c)}>บันทึก</button>
                <button type="button" className={`btn btn-sm btn-ghost ${styles.del}`} disabled={busy} onClick={() => deleteCategory(c)} aria-label={`ลบหมวด ${c.name}`}>
                  <TrashIcon /> ลบหมวด
                </button>
              </div>

              <div className={styles.items}>
                {catItems.length === 0 && <p className="muted" style={{ margin: '4px 0' }}>ยังไม่มีเมนูในหมวดนี้</p>}
                {catItems.map((it) => {
                  const dirty = isDirty('in:' + it.id, it.name);
                  return (
                    <div key={it.id} className={styles.row}>
                      <input className={`input ${styles.grow}`} aria-label="ชื่อเมนู" value={val('in:' + it.id, it.name)}
                        onChange={(e) => setDraft('in:' + it.id, e.target.value)} onKeyDown={onEnter(() => saveItem(it))} />
                      <button type="button" className={`btn btn-sm ${dirty ? 'btn-primary' : 'btn-ghost'}`} disabled={busy || !dirty} onClick={() => saveItem(it)}>บันทึก</button>
                      <button type="button" className={`icon-btn ${styles.iconDel}`} disabled={busy} onClick={() => deleteItem(it)} aria-label={`ลบเมนู ${it.name}`}>
                        <TrashIcon />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className={`${styles.row} ${styles.addRow}`}>
                <input className={`input ${styles.grow}`} placeholder="ชื่อเมนูใหม่ในหมวดนี้" aria-label={`เมนูใหม่ในหมวด ${c.name}`} value={newItem[c.id] || ''}
                  onChange={(e) => setNewItem({ ...newItem, [c.id]: e.target.value })} onKeyDown={onEnter(() => addItem(c.id))} />
                <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => addItem(c.id)}><PlusIcon /> เพิ่มเมนู</button>
              </div>
            </section>
          );
        })}
      </div>

      {confirm && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) setConfirm(null); }}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <h2 id="confirm-title" style={{ color: 'var(--chili)' }}>{confirm.title}</h2>
            <p style={{ margin: 0 }}>{confirm.body}</p>
            <div className="dialog-actions">
              <button type="button" className="btn btn-danger btn-lg" disabled={busy} onClick={doConfirm}>
                {busy && <span className="spinner" />}ยืนยันลบ
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirm(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
