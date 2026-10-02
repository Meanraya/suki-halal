import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <h1>Suki Halal</h1>
      <p>ระบบสั่งอาหารบุฟเฟต์ (ลูกค้าสแกน QR ที่โต๊ะเพื่อสั่งอาหาร)</p>
      <p style={{ marginTop: 28, fontWeight: 'bold' }}>สำหรับพนักงาน (ต้องเข้าสู่ระบบ)</p>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Link href="/generate-qr">เปิดโต๊ะ / สร้าง QR Code</Link>
        <Link href="/kitchen">หน้าครัว</Link>
        <Link href="/cashier">แคชเชียร์</Link>
        <Link href="/admin/menu">จัดการเมนู</Link>
        <Link href="/login">เข้าสู่ระบบ</Link>
      </nav>
    </main>
  );
}
