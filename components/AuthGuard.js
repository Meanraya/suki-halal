'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const bar = { display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: '8px 16px', background: '#0b1220', color: '#fff', fontSize: 16 };
const link = { color: '#93c5fd', textDecoration: 'none' };

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const goLogin = () => router.replace('/login?next=' + encodeURIComponent(pathname));

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
      else goLogin();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setReady(false);
        goLogin();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (!ready) {
    return <div style={{ padding: 40, textAlign: 'center', fontSize: 22 }}>กำลังตรวจสอบสิทธิ์...</div>;
  }

  return (
    <>
      <div style={bar}>
        <b>Suki Halal · พนักงาน</b>
        <Link href="/generate-qr" style={link}>เปิดโต๊ะ</Link>
        <Link href="/kitchen" style={link}>ครัว</Link>
        <Link href="/cashier" style={link}>แคชเชียร์</Link>
        <Link href="/admin/menu" style={link}>จัดการเมนู</Link>
        <button type="button" onClick={() => supabase.auth.signOut()}
          style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
          ออกจากระบบ
        </button>
      </div>
      {children}
    </>
  );
}
