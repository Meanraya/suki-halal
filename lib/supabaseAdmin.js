import 'server-only';
import { createClient } from '@supabase/supabase-js';

// ใช้เฉพาะฝั่งเซิร์ฟเวอร์ (Route Handler) เท่านั้น
// SUPABASE_SERVICE_ROLE_KEY ห้ามขึ้นต้นด้วย NEXT_PUBLIC_ และห้าม import ไฟล์นี้จากหน้า 'use client'
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
