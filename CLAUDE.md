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
