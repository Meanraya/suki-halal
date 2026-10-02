# Suki Halal

ระบบสั่งอาหารบุฟเฟต์ — Next.js (App Router, JavaScript) + Supabase, deploy บน Vercel

## เริ่มใช้งาน
```bash
npm install
cp .env.local.example .env.local   # แล้วใส่ค่า Supabase จริง
npm run dev
```

## หมายเหตุ
โปรเจกต์ใช้ Next.js เวอร์ชันล่าสุด ซึ่ง `params` ของ Dynamic Route เป็น Promise
ต้อง unwrap ด้วย `use()` จาก React เสมอ (ดูรายละเอียดใน CLAUDE.md)

บน Vercel อย่าลืมตั้ง Environment Variables: NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY

## Environment Variables เพิ่มเติม
- `NEXT_PUBLIC_PROMPTPAY_ID` เบอร์พร้อมเพย์ (10 หลัก) หรือเลข 13 หลัก ใช้สร้าง QR ชำระเงิน (ถ้าไม่ตั้ง จะแสดงให้ชำระกับพนักงาน)

## ตั้งค่า Supabase ครั้งแรก
รันไฟล์ `supabase-setup.sql` ใน Supabase → SQL Editor แล้วสร้างบัญชีพนักงานที่ Authentication → Users
