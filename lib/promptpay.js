// สร้างข้อความ PromptPay QR (Thai QR Payment / EMV) พร้อมยอดเงิน
// id = เบอร์มือถือ 10 หลัก (ขึ้นต้น 0) หรือเลขบัตรประชาชน/ภาษี 13 หลัก

function tlv(id, value) {
  return id + String(value.length).padStart(2, '0') + value;
}

export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildPromptPayPayload(id, amount) {
  const digits = String(id || '').replace(/\D/g, '');
  let accountType;
  let account;
  if (digits.length === 13) {
    accountType = '02';
    account = digits;
  } else if (digits.length === 10 && digits.startsWith('0')) {
    accountType = '01';
    account = '0066' + digits.slice(1);
  } else {
    return null; // ไม่ได้ตั้งค่า หรือรูปแบบไม่ถูกต้อง
  }

  const hasAmount = Number(amount) > 0;
  const merchant = tlv('00', 'A000000677010111') + tlv(accountType, account);
  let payload =
    tlv('00', '01') +
    tlv('01', hasAmount ? '12' : '11') +
    tlv('29', merchant) +
    tlv('53', '764');
  if (hasAmount) payload += tlv('54', Number(amount).toFixed(2));
  payload += tlv('58', 'TH') + '6304';
  return payload + crc16(payload);
}
