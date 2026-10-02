-- Suki Halal: ตั้งค่า Supabase ครั้งเดียว (รันทั้งไฟล์ใน SQL Editor)

-- 1) คอลัมน์สำหรับบันทึกการรับเงิน
alter table sessions add column if not exists payment_method text;
alter table sessions add column if not exists paid_amount numeric;
alter table sessions add column if not exists paid_at timestamptz;

-- 2) เปิด Row Level Security
alter table sessions enable row level security;
alter table orders enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;

-- 3) ลบ policy เก่าของ 4 ตารางนี้ (ถ้ามี) เพื่อเริ่มใหม่ให้สะอาด
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('sessions', 'orders', 'menu_categories', 'menu_items')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 4) พนักงาน (ล็อกอินแล้ว = role authenticated) ทำได้ทุกอย่าง
create policy staff_all_sessions on sessions for all to authenticated using (true) with check (true);
create policy staff_all_orders on orders for all to authenticated using (true) with check (true);
create policy staff_all_menu_categories on menu_categories for all to authenticated using (true) with check (true);
create policy staff_all_menu_items on menu_items for all to authenticated using (true) with check (true);

-- 5) ลูกค้า (ไม่ล็อกอิน = role anon) ทำได้เท่าที่จำเป็น
-- ดูเมนู
create policy anon_read_menu_categories on menu_categories for select to anon using (true);
create policy anon_read_menu_items on menu_items for select to anon using (true);

-- ดู session ที่ยังเปิด/รอชำระ (เพื่อหา session ของโต๊ะ)
create policy anon_read_sessions on sessions for select to anon
  using (status in ('open', 'billing'));

-- กดเรียกเก็บเงิน: เปลี่ยนได้เฉพาะ open -> billing เท่านั้น
create policy anon_bill_sessions on sessions for update to anon
  using (status = 'open') with check (status = 'billing');

-- ส่งออเดอร์: เพิ่มได้เฉพาะ status = 'received' และต้องเป็น session ที่ยังเปิดอยู่
create policy anon_insert_orders on orders for insert to anon
  with check (
    status = 'received'
    and exists (select 1 from sessions s where s.id = session_id and s.status = 'open')
  );

-- 6) Realtime: ถ้ายังไม่ได้เปิดให้ตาราง orders ให้รันบรรทัดนี้ (ถ้าเปิดแล้วจะ error ว่ามีอยู่แล้ว ไม่เป็นไร)
-- alter publication supabase_realtime add table orders;
