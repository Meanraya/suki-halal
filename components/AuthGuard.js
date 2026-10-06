'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { BrandMark } from './Icons';

const LINKS = [
  { href: '/generate-qr', label: 'เปิดโต๊ะ' },
  { href: '/kitchen', label: 'ครัว' },
  { href: '/cashier', label: 'แคชเชียร์' },
  { href: '/admin/menu', label: 'จัดการเมนู' },
];

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    const goLogin = () => router.replace('/login?next=' + encodeURIComponent(pathname));

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
      else goLogin();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
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

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
  };

  if (!ready) {
    return (
      <div className="state-screen" role="status">
        <span className="spinner spinner-lg" />
        <div className="state-text">กำลังตรวจสอบสิทธิ์...</div>
      </div>
    );
  }

  return (
    <>
      <nav className="staff-nav" aria-label="เมนูพนักงาน">
        <div className="brand">
          <BrandMark size={34} />
          <span className="brand-name">Suki Halal</span>
        </div>
        <div className="staff-links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="staff-link"
              aria-current={pathname === l.href || pathname.startsWith(l.href + '/') ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </div>
        <button type="button" className="btn btn-sm btn-on-dark logout" onClick={signOut} disabled={signingOut}>
          {signingOut ? <span className="spinner" /> : null}
          ออกจากระบบ
        </button>
      </nav>
      {children}
    </>
  );
}
