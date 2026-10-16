/**
 * Smoke test สำหรับ route สาธารณะ (Task 10)
 *
 * ต้องรันกับ server ที่ทำงานอยู่จริง:
 *   BASE_URL=http://localhost:3000 node tests/smoke/smoke.mjs
 *
 * ตรวจ:
 * - หน้า public ตอบ 200 และมีเนื้อหาไทย
 * - 404 สำหรับ slug/เส้นทางที่ไม่มีจริง (ไม่ใช่ 200)
 * - /api/health ตอบตามสถานะ DB และไม่เปิดเผยข้อมูลอ่อนไหว
 * - /api/images path ที่ผิดรูปแบบต้อง 404 และไม่ cache
 * - security headers ถูกตั้ง
 *
 * exit code 1 เมื่อมีข้อใดล้มเหลว
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

let pass = 0;
let fail = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function get(path, init) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...init });
  const body = await res.text();
  return { res, body };
}

console.log(`Smoke test กับ ${BASE}\n`);

// ---------- หน้า public ----------
try {
  const home = await get('/');
  ok('/', home.res.status === 200, `status=${home.res.status}`);
  ok('  หน้าแรกมีภาษาไทย', /[\u0E00-\u0E7F]/.test(home.body));
  ok('  มี lang="th"', /<html[^>]+lang="th"/.test(home.body));
} catch (e) {
  ok('/', false, String(e));
}

try {
  const catalog = await get('/phones');
  ok('/phones', catalog.res.status === 200, `status=${catalog.res.status}`);
} catch (e) {
  ok('/phones', false, String(e));
}

try {
  const robots = await get('/robots.txt');
  ok('/robots.txt', robots.res.status === 200, `status=${robots.res.status}`);
  ok('  disallow /admin', robots.body.includes('/admin'));
} catch (e) {
  ok('/robots.txt', false, String(e));
}

try {
  const sm = await get('/sitemap.xml');
  ok('/sitemap.xml', sm.res.status === 200, `status=${sm.res.status}`);
  ok('  เป็น XML', sm.body.includes('<urlset'));
} catch (e) {
  ok('/sitemap.xml', false, String(e));
}

// ---------- 404 ----------
try {
  const bad = await get('/phones/definitely-not-a-real-slug-xyz');
  ok('/phones/<ไม่มีจริง> = 404', bad.res.status === 404, `status=${bad.res.status}`);
} catch (e) {
  ok('/phones/<ไม่มีจริง>', false, String(e));
}

try {
  const nf = await get('/no-such-page-xyz');
  ok('/<ไม่มีจริง> = 404', nf.res.status === 404, `status=${nf.res.status}`);
} catch (e) {
  ok('/<ไม่มีจริง>', false, String(e));
}

// ---------- health ----------
try {
  const h = await get('/api/health');
  ok('/api/health = 200 หรือ 503', [200, 503].includes(h.res.status), `status=${h.res.status}`);
  let json = null;
  try {
    json = JSON.parse(h.body);
  } catch {
    /* ignore */
  }
  ok('  เป็น JSON ที่มี status', json && typeof json.status === 'string');
  ok('  ไม่มี no-store? ต้องมี', (h.res.headers.get('cache-control') || '').includes('no-store'));
  // ต้องไม่เปิดเผยข้อมูลอ่อนไหว
  const leaked = ['postgresql://', 'password', 'DATABASE_URL', 'stack', '/app/', 'node_modules'];
  ok(
    '  ไม่รั่วข้อมูลอ่อนไหว',
    !leaked.some((s) => h.body.toLowerCase().includes(s.toLowerCase())),
    'พบคำต้องห้ามใน response',
  );
} catch (e) {
  ok('/api/health', false, String(e));
}

// ---------- image endpoint ----------
try {
  const bad = await get('/api/images/../../etc/passwd');
  ok('/api/images traversal = 404', bad.res.status === 404, `status=${bad.res.status}`);
} catch (e) {
  ok('/api/images traversal', false, String(e));
}

try {
  const bad2 = await get('/api/images/devices/abc/not-a-uuid.svg');
  ok('/api/images ผิดรูปแบบ = 404', bad2.res.status === 404, `status=${bad2.res.status}`);
  ok(
    '  404 ต้องไม่ถูก cache',
    (bad2.res.headers.get('cache-control') || '').includes('no-store'),
  );
  ok('  ไม่รั่ว path จริง', !bad2.body.includes('/app/') && !bad2.body.includes('uploads'));
} catch (e) {
  ok('/api/images ผิดรูปแบบ', false, String(e));
}

// ---------- security headers ----------
try {
  const home = await get('/');
  ok('X-Content-Type-Options: nosniff', home.res.headers.get('x-content-type-options') === 'nosniff');
  ok('X-Frame-Options: DENY', home.res.headers.get('x-frame-options') === 'DENY');
  ok('มี Referrer-Policy', !!home.res.headers.get('referrer-policy'));
} catch (e) {
  ok('security headers', false, String(e));
}

console.log(`\nสรุป: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
