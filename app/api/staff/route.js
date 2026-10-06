import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(status, message) {
  return NextResponse.json({ error: message }, { status });
}

// ตรวจว่าผู้เรียกเป็นพนักงานที่ล็อกอินอยู่ (มี access token ที่ Supabase ยืนยันได้)
async function requireStaff(request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { error: fail(500, 'ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์') };
  }
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { error: fail(401, 'กรุณาเข้าสู่ระบบ') };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data || !data.user) return { error: fail(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่') };
  return { admin, user: data.user };
}

function toStaff(u) {
  return {
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    invited_at: u.invited_at || null,
    last_sign_in_at: u.last_sign_in_at || null,
    active: !!u.last_sign_in_at,
  };
}

async function listAll(admin) {
  const users = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const batch = (data && data.users) || [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

// สร้างลิงก์จากโดเมนของเว็บเอง (ไม่เชื่อ header Origin ที่ผู้เรียกกำหนดเองได้)
function redirectUrl(request) {
  const base = process.env.SITE_URL || new URL(request.url).origin;
  return `${base.replace(/\/$/, '')}/set-password`;
}

// GET /api/staff -> รายชื่อพนักงานทั้งหมด
export async function GET(request) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  try {
    const users = await listAll(auth.admin);
    const staff = users.map(toStaff).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return NextResponse.json({ staff, me: auth.user.id });
  } catch (e) {
    return fail(500, 'โหลดรายชื่อพนักงานไม่สำเร็จ: ' + (e.message || 'ไม่ทราบสาเหตุ'));
  }
}

// POST /api/staff { email, resend? } -> ส่งอีเมลเชิญพนักงานใหม่
export async function POST(request) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'ข้อมูลไม่ถูกต้อง');
  }
  const email = String((body && body.email) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return fail(400, 'รูปแบบอีเมลไม่ถูกต้อง');

  try {
    const users = await listAll(auth.admin);
    const existing = users.find((u) => (u.email || '').toLowerCase() === email);
    if (existing && (existing.last_sign_in_at || !body.resend)) {
      return fail(409, existing.last_sign_in_at ? 'อีเมลนี้เป็นพนักงานอยู่แล้ว' : 'อีเมลนี้ถูกเชิญแล้ว กด "ส่งใหม่" เพื่อส่งคำเชิญอีกครั้ง');
    }
    // Supabase ส่งคำเชิญซ้ำให้บัญชีที่ยังไม่ยืนยันได้เลย ไม่ต้องลบก่อน (ถ้าส่งไม่สำเร็จ บัญชีเดิมยังอยู่)
    const { data, error } = await auth.admin.auth.admin.inviteUserByEmail(email, { redirectTo: redirectUrl(request) });
    if (error) {
      if (error.code === 'email_exists' || /already been registered/i.test(error.message || '')) {
        return fail(409, 'อีเมลนี้ยืนยันบัญชีแล้ว ให้พนักงานเข้าสู่ระบบด้วยรหัสผ่านของตัวเอง');
      }
      throw error;
    }
    return NextResponse.json({ staff: toStaff(data.user) }, { status: 201 });
  } catch (e) {
    const msg = e.message || 'ไม่ทราบสาเหตุ';
    if (/rate limit/i.test(msg)) return fail(429, 'ส่งอีเมลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');
    return fail(500, 'ส่งคำเชิญไม่สำเร็จ: ' + msg);
  }
}

// DELETE /api/staff?id=... -> ลบบัญชีพนักงาน (เช่น พนักงานลาออก)
export async function DELETE(request) {
  const auth = await requireStaff(request);
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return fail(400, 'ไม่ระบุพนักงาน');
  if (id === auth.user.id) return fail(400, 'ลบบัญชีของตัวเองไม่ได้');
  try {
    const users = await listAll(auth.admin);
    if (!users.some((u) => u.id === id)) return fail(404, 'ไม่พบพนักงานคนนี้');
    const activeOthers = users.filter((u) => u.id !== id && u.last_sign_in_at).length;
    if (activeOthers === 0) return fail(400, 'ต้องมีพนักงานที่ใช้งานได้อย่างน้อย 1 คน');
    const { error } = await auth.admin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(500, 'ลบพนักงานไม่สำเร็จ: ' + (e.message || 'ไม่ทราบสาเหตุ'));
  }
}
