import Link from 'next/link';
import { BrandMark } from '../components/Icons';
import styles from './home.module.css';

const LINKS = [
  { href: '/generate-qr', title: 'เปิดโต๊ะ / สร้าง QR', desc: 'รับลูกค้าเข้าโต๊ะและสร้าง QR สั่งอาหาร' },
  { href: '/kitchen', title: 'หน้าครัว', desc: 'ดูออเดอร์แบบเรียลไทม์และอัปเดตสถานะ' },
  { href: '/cashier', title: 'แคชเชียร์', desc: 'รับชำระเงินโต๊ะที่เรียกเก็บเงิน' },
  { href: '/admin/menu', title: 'จัดการเมนู', desc: 'เพิ่ม แก้ไข ลบ หมวดหมู่และเมนู' },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <BrandMark size={64} />
        <h1 className={styles.title}>Suki Halal</h1>
        <p className={styles.lead}>ระบบสั่งอาหารบุฟเฟต์ · ลูกค้าสแกน QR ที่โต๊ะเพื่อสั่งอาหาร</p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>สำหรับพนักงาน</h2>
        <nav className={`${styles.grid} stagger`} aria-label="เมนูพนักงาน">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.tile}>
              <span className={styles.tileTitle}>{l.title}</span>
              <span className={styles.tileDesc}>{l.desc}</span>
              <span className={styles.arrow} aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
        <Link href="/login" className="btn btn-outline btn-block">เข้าสู่ระบบ</Link>
      </section>
    </main>
  );
}
