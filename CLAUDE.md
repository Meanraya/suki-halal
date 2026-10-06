# Suki Halal — ระบบสั่งอาหารบุฟเฟต์

Stack: Next.js (App Router, **JavaScript ไม่ใช่ TypeScript**) + Supabase, deploy บน Vercel

## กฎสำคัญ
- **ร้านนี้เป็นฮาลาล**: ห้ามมีคำว่า "หมู" หรือเมนูหมูในโค้ด ข้อความ หรือข้อมูลตัวอย่าง ให้ใช้เนื้อวัว ไก่ อาหารทะเล ฯลฯ แทน
- ชื่อโปรเจกต์/ร้านที่แสดงผล: "Suki Halal"

## Next.js เวอร์ชันล่าสุด: params เป็น Promise
ใน Dynamic Route (เช่น `app/order/[sessionId]/page.js`) `params` เป็น **Promise**
ใน Client Component ต้อง unwrap ด้วย `use()` จาก React เสมอ:

```js
'use client';
import { use } from 'react';

export default function OrderPage({ params }) {
  const { sessionId } = use(params);
  // ...
}
```

(ถ้าเป็น Server Component ให้ใช้ `const { sessionId } = await params;`)

## Environment variables (.env.local และตั้งใน Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (เฉพาะฝั่งเซิร์ฟเวอร์ ใช้ในหน้าจัดการพนักงาน)
- SITE_URL (ไม่บังคับ) โดเมนจริงของเว็บ ใช้สร้างลิงก์ในอีเมลเชิญ เช่น https://suki-halal.vercel.app

ใช้ client จาก `lib/supabaseClient.js`

## โครงสร้างตารางฐานข้อมูล (มีอยู่แล้วใน Supabase ไม่ต้องสร้างใหม่)
- **sessions**: id, table_number, adult_count, child_count, status, created_at
- **menu_categories**: id, name, sort_order
- **menu_items**: id, category_id, name
- **orders**: id, session_id, table_number, items (jsonb), status, created_at

## หน้าที่วางแผนไว้
- `/` หน้าแรก (ทดสอบ deploy)
- `/generate-qr` สร้าง QR โต๊ะ
- `/kitchen` หน้าครัว
- หน้าสั่งอาหาร (dynamic route) — ขั้นตอนถัดไป

## ระบบล็อกอินพนักงาน (Supabase Auth, อีเมล+รหัสผ่าน)
- หน้าพนักงานทั้งหมด (`/generate-qr`, `/kitchen`, `/cashier`, `/admin/*`) ครอบด้วย `components/AuthGuard.js` ผ่านไฟล์ `layout.js` ของแต่ละโฟลเดอร์
- หน้าลูกค้า `/order/[tableNumber]` ไม่ต้องล็อกอิน (ใช้ role anon) ความปลอดภัยจริงมาจาก RLS ใน `supabase-setup.sql` ไม่ใช่แค่ AuthGuard
- ปิด "Allow new users to sign up" ใน Supabase เสมอ (RLS ให้ทุกบัญชีที่ล็อกอินได้สิทธิ์พนักงานเต็ม ถ้าเปิดสมัครเอง คนนอกจะเข้าหลังร้านได้)
- เพิ่มพนักงานใหม่ที่ `/admin/staff`: กรอกอีเมล → `app/api/staff/route.js` เรียก Supabase Admin API (`inviteUserByEmail`) → พนักงานเปิดลิงก์ในอีเมลไปที่ `/set-password` เพื่อตั้งรหัสผ่านเอง
- Admin API ใช้ `SUPABASE_SERVICE_ROLE_KEY` ผ่าน `lib/supabaseAdmin.js` (มี `import 'server-only'`) ห้ามใช้ใน client และห้ามตั้งชื่อขึ้นต้น `NEXT_PUBLIC_`
- ทุกคำขอไป `/api/staff` ต้องแนบ `Authorization: Bearer <access_token>` ของพนักงานที่ล็อกอินอยู่ พนักงานทุกคนมีสิทธิ์เท่ากัน

## สถานะ session และการชำระเงิน
- sessions.status: `open` (กำลังทาน) → `billing` (ลูกค้ากดเรียกเก็บเงิน รอชำระ) → `closed` (แคชเชียร์ยืนยันรับเงินที่ `/cashier`)
- คอลัมน์เพิ่มใน sessions: `payment_method` ('cash' | 'promptpay'), `paid_amount`, `paid_at`
- หน้าชำระเงินของลูกค้าสร้าง QR พร้อมเพย์จาก `NEXT_PUBLIC_PROMPTPAY_ID` ด้วย `lib/promptpay.js`
- ราคาบุฟเฟต์อยู่ใน `lib/pricing.js` (ผู้ใหญ่ 289 / เด็ก 145)

## จัดการเมนู
- `/admin/menu` เพิ่ม/แก้ชื่อ/ลบ หมวดหมู่และเมนู (ตาราง menu_items ไม่มีคอลัมน์ราคา เพราะเป็นบุฟเฟต์ราคาต่อหัว)

## ดีไซน์ (Jade & Saffron)
- โทเคนสี ฟอนต์ และอนิเมชันกลางอยู่ใน `app/globals.css` (ตัวแปร `--jade-*`, `--saffron`, `--chili`, `--ground`, `--ink`, `--muted`) ใช้คลาสกลาง เช่น `.btn .btn-primary`, `.card`, `.input`, `.alert`, `.dialog`, `.pill`, `.skeleton`, `.stagger`
- สไตล์เฉพาะหน้าใช้ CSS Modules (`*.module.css`) ข้างไฟล์ page ห้ามใช้ `:global(...)` ปนในตัวเลือก (webpack build จะพัง) ให้ไปเขียนใน globals.css แทน
- ฟอนต์โหลดผ่าน `next/font/google` ใน `app/layout.js`: Prompt (หัวข้อ) + IBM Plex Sans Thai (เนื้อหา)
- ไอคอนเป็น SVG ใน `components/Icons.js` (ไม่ใช้อีโมจิในหน้าพนักงาน/ลูกค้า)
- เคารพ `prefers-reduced-motion` (ตั้งไว้แล้วใน globals.css)
