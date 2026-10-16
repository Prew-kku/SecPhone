import { PrismaClient, type AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

/**
 * สร้างหรืออัปเดตผู้ดูแลระบบ 1 คน (ไม่มี public registration)
 *
 * วิธีใช้:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='รหัสผ่านยาวพอ' npm run admin:create
 * หรือระบุผ่าน argument:
 *   npm run admin:create -- --email admin@example.com --password 'รหัสผ่าน' --name 'ผู้ดูแล'
 *
 * ห้าม hardcode รหัสผ่านในโค้ดหรือ commit ลง git
 */
function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const email = (readArg('--email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = readArg('--password') ?? process.env.ADMIN_PASSWORD ?? '';
  const displayName = (readArg('--name') ?? process.env.ADMIN_NAME ?? 'ผู้ดูแลร้าน').trim();
  const roleInput = (readArg('--role') ?? process.env.ADMIN_ROLE ?? 'OWNER').trim().toUpperCase();

  if (!email) {
    throw new Error('ต้องระบุอีเมลผู้ดูแลผ่าน ADMIN_EMAIL หรือ --email');
  }
  if (!password) {
    throw new Error('ต้องระบุรหัสผ่านผ่าน ADMIN_PASSWORD หรือ --password');
  }
  if (password.length < 12) {
    throw new Error('รหัสผ่านต้องยาวอย่างน้อย 12 ตัวอักษร');
  }
  if (roleInput !== 'OWNER' && roleInput !== 'ADMIN') {
    throw new Error('role ต้องเป็น OWNER หรือ ADMIN');
  }
  const role = roleInput as AdminRole;

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, displayName, role, isActive: true },
    create: { email, passwordHash, displayName, role, isActive: true },
  });

  console.log(`สร้าง/อัปเดตผู้ดูแลสำเร็จ: ${admin.email} (role=${admin.role})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('สร้างผู้ดูแลล้มเหลว:', error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
