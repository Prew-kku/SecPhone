import { PrismaClient, type ConditionGrade, type DeviceStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * ข้อมูลสาธิตของ SecondPhone Store
 * - SKU ขึ้นต้น DEMO- เพื่อแยกจากข้อมูลจริง
 * - idempotent: ใช้ upsert อิง slug (Brand/PhoneModel/Device) และ sku (Device)
 * - วันที่ถูกกำหนดตายตัวเพื่อให้ผลลัพธ์ทำซ้ำได้ (deterministic)
 * - ไม่สร้าง DeviceImage เพราะยังไม่มีไฟล์รูปจริง (UI แสดง placeholder แทน)
 */

type DeviceSeed = {
  sku: string;
  modelSlug: string;
  storageGb: number;
  ramGb?: number;
  color: string;
  priceThb: number;
  conditionGrade: ConditionGrade;
  batteryHealthPct?: number;
  cosmeticDefects?: string;
  repairHistory?: string;
  accessories?: string;
  warrantyInfo?: string;
  description: string;
  status: DeviceStatus;
  isFeatured: boolean;
  publishedAt: Date | null;
  createdAt: Date;
};

const brands = [
  { name: 'Apple', slug: 'apple' },
  { name: 'Samsung', slug: 'samsung' },
  { name: 'Google', slug: 'google' },
  { name: 'Xiaomi', slug: 'xiaomi' },
  { name: 'OPPO', slug: 'oppo' },
];

const phoneModels = [
  { slug: 'iphone-13-pro', brandSlug: 'apple', name: 'iPhone 13 Pro', releaseYear: 2021 },
  { slug: 'iphone-14', brandSlug: 'apple', name: 'iPhone 14', releaseYear: 2022 },
  { slug: 'iphone-15-pro-max', brandSlug: 'apple', name: 'iPhone 15 Pro Max', releaseYear: 2023 },
  { slug: 'galaxy-s22-ultra', brandSlug: 'samsung', name: 'Galaxy S22 Ultra', releaseYear: 2022 },
  { slug: 'galaxy-a54', brandSlug: 'samsung', name: 'Galaxy A54', releaseYear: 2023 },
  { slug: 'pixel-7-pro', brandSlug: 'google', name: 'Pixel 7 Pro', releaseYear: 2022 },
  { slug: 'pixel-8', brandSlug: 'google', name: 'Pixel 8', releaseYear: 2023 },
  { slug: 'xiaomi-13t-pro', brandSlug: 'xiaomi', name: 'Xiaomi 13T Pro', releaseYear: 2023 },
  { slug: 'redmi-note-12-pro', brandSlug: 'xiaomi', name: 'Redmi Note 12 Pro', releaseYear: 2022 },
  { slug: 'reno-10-pro', brandSlug: 'oppo', name: 'OPPO Reno 10 Pro', releaseYear: 2023 },
];

const devices: DeviceSeed[] = [
  {
    sku: 'DEMO-IP13P-256-GD-001',
    modelSlug: 'iphone-13-pro',
    storageGb: 256,
    ramGb: 6,
    color: 'ทอง',
    priceThb: 21900,
    conditionGrade: 'A',
    batteryHealthPct: 89,
    cosmeticDefects: 'มีรอยขนแมวเบาบางบริเวณขอบเครื่อง มองเห็นได้เมื่อเอียงรับแสง',
    repairHistory: 'ไม่เคยซ่อม เปลี่ยนเฉพาะแบตเตอรี่แท้ศูนย์เมื่อปี 2025',
    accessories: 'กล่องเดิม สายชาร์จ Type-C to Lightning',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'iPhone 13 Pro ความจุ 256GB สีทอง สภาพสวยเกรด A หน้าจอ ProMotion 120Hz ไม่มีจุด dead pixel ผ่านการตรวจสภาพโดยช่างของร้านแล้ว แบตเตอรี่เปลี่ยนแท้ศูนย์ เหมาะกับผู้ที่ต้องการเรือธงในราคาที่จับต้องได้',
    status: 'AVAILABLE',
    isFeatured: true,
    publishedAt: new Date('2026-09-28T03:00:00.000Z'),
    createdAt: new Date('2026-09-27T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-IP13P-128-SL-002',
    modelSlug: 'iphone-13-pro',
    storageGb: 128,
    ramGb: 6,
    color: 'เงิน',
    priceThb: 18900,
    conditionGrade: 'B',
    batteryHealthPct: 84,
    cosmeticDefects: 'มีรอยขีดข่วนบริเวณมุมล่างซ้ายเล็กน้อย ไม่มีผลต่อการใช้งาน',
    repairHistory: 'ไม่เคยซ่อม ไม่เคยเปิดฝาเครื่อง',
    accessories: 'กล่องเดิม สายชาร์จ',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'iPhone 13 Pro ความจุ 128GB สีเงิน สภาพเกรด B ตัวเครื่องแข็งแรง หน้าจอเดิมไม่เคยเปลี่ยน กล้องหลังและหน้าใช้งานได้ปกติทุกโหมด เหมาะกับผู้ที่เน้นใช้งานจริงในงบประหยัด',
    status: 'AVAILABLE',
    isFeatured: false,
    publishedAt: new Date('2026-09-30T03:00:00.000Z'),
    createdAt: new Date('2026-09-29T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-IP14-128-BK-003',
    modelSlug: 'iphone-14',
    storageGb: 128,
    ramGb: 6,
    color: 'ดำ',
    priceThb: 23900,
    conditionGrade: 'A',
    batteryHealthPct: 92,
    cosmeticDefects: 'ไม่มีรอยสึก สภาพเหมือนใหม่',
    repairHistory: 'ไม่เคยซ่อม ไม่เคยเปิดฝาเครื่อง',
    accessories: 'กล่องเดิม สายชาร์จ อะแดปเตอร์',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'iPhone 14 ความจุ 128GB สีดำ สภาพเกรด A ตัวเครื่องใหม่มาก สุขภาพแบตเตอรี่ 92% ผ่านการใช้งานมาน้อย กล้องคู่ 12MP ถ่ายภาพกลางคืนได้ดี ระบบยังรองรับอัปเดต iOS ล่าสุด',
    status: 'AVAILABLE',
    isFeatured: true,
    publishedAt: new Date('2026-10-02T03:00:00.000Z'),
    createdAt: new Date('2026-10-01T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-IP15PM-256-NB-004',
    modelSlug: 'iphone-15-pro-max',
    storageGb: 256,
    ramGb: 8,
    color: 'น้ำเงิน',
    priceThb: 38900,
    conditionGrade: 'A',
    batteryHealthPct: 96,
    cosmeticDefects: 'ไม่มีตำหนิ มองไม่เห็นรอย',
    repairHistory: 'ไม่เคยซ่อม',
    accessories: 'กล่องเดิม สายชาร์จ Type-C',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'iPhone 15 Pro Max ความจุ 256GB สีไทเทเนียมน้ำเงิน สภาพเกรด A เกือบใหม่ สุขภาพแบตเตอรี่ 96% ตัวเครื่องไทเทเนียมน้ำหนักเบา กล้องซูม 5x พร้อมพอร์ต USB-C รองรับการชาร์จเร็ว',
    status: 'AVAILABLE',
    isFeatured: true,
    publishedAt: new Date('2026-10-05T03:00:00.000Z'),
    createdAt: new Date('2026-10-04T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-IP15PM-512-TI-005',
    modelSlug: 'iphone-15-pro-max',
    storageGb: 512,
    ramGb: 8,
    color: 'ทองคำ',
    priceThb: 44500,
    conditionGrade: 'B',
    batteryHealthPct: 93,
    cosmeticDefects: 'มีรอยเล็กรอบกรอบไทเทเนียมด้านข้าง 2 จุด',
    repairHistory: 'เปลี่ยนหน้าจอแท้ศูนย์ 1 ครั้ง เมื่อ 2025',
    accessories: 'กล่องเดิม สายชาร์จ',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'iPhone 15 Pro Max ความจุ 512GB สีไทเทเนียมทอง สภาพเกรด B หน้าจอเปลี่ยนแท้ศูนย์พร้อมใบเสร็จ ความจุสูงเหมาะกับผู้ที่ถ่ายวิดีโอ 4K และเก็บไฟล์จำนวนมาก จอแสดงผล ProMotion 120Hz',
    status: 'SOLD',
    isFeatured: false,
    publishedAt: new Date('2026-09-20T03:00:00.000Z'),
    createdAt: new Date('2026-09-19T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-S22U-256-BK-006',
    modelSlug: 'galaxy-s22-ultra',
    storageGb: 256,
    ramGb: 12,
    color: 'ดำ',
    priceThb: 17900,
    conditionGrade: 'B',
    batteryHealthPct: 85,
    cosmeticDefects: 'มีรอยขนแมวบนฝาหลัง มองเห็นได้เล็กน้อย',
    repairHistory: 'ไม่เคยซ่อม',
    accessories: 'กล่องเดิม สายชาร์จ Type-C',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'Galaxy S22 Ultra ความจุ 256GB สีดำ สภาพเกรด B มาพร้อมปากกา S Pen ในตัว หน้าจอ Dynamic AMOLED 2X กล้อง 108MP ถ่ายภาพระยะไกลได้คมชัด แบตเตอรี่ 5000mAh',
    status: 'AVAILABLE',
    isFeatured: true,
    publishedAt: new Date('2026-09-25T03:00:00.000Z'),
    createdAt: new Date('2026-09-24T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-S22U-128-WH-007',
    modelSlug: 'galaxy-s22-ultra',
    storageGb: 128,
    ramGb: 12,
    color: 'ขาว',
    priceThb: 15400,
    conditionGrade: 'C',
    batteryHealthPct: 78,
    cosmeticDefects: 'มีรอยบุบเล็กน้อยที่มุมขวาบน และรอยขีดข่วนบนหน้าจอหลายจุด',
    repairHistory: 'เปลี่ยนจอเทียบ 1 ครั้ง เมื่อ 2024',
    accessories: 'สายชาร์จ Type-C',
    warrantyInfo: 'รับประกันร้าน 15 วัน',
    description:
      'Galaxy S22 Ultra ความจุ 128GB สีขาว สภาพเกรด C หน้าจอผ่านการเปลี่ยน ดังนั้นราคาจึงย่อมเยา เหมาะกับผู้ที่ต้องการเรือธงราคาประหยัดและไม่ได้เน้นสภาพภายนอก ฟังก์ชันการใช้งานปกติทั้งหมด',
    status: 'AVAILABLE',
    isFeatured: false,
    publishedAt: new Date('2026-09-22T03:00:00.000Z'),
    createdAt: new Date('2026-09-21T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-A54-256-GN-008',
    modelSlug: 'galaxy-a54',
    storageGb: 256,
    ramGb: 8,
    color: 'เขียว',
    priceThb: 8900,
    conditionGrade: 'A',
    batteryHealthPct: 94,
    cosmeticDefects: 'ไม่มีตำหนิชัดเจน',
    repairHistory: 'ไม่เคยซ่อม',
    accessories: 'กล่องเดิม สายชาร์จ',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'Galaxy A54 ความจุ 256GB สีเขียว สภาพเกรด A รุ่นกลางที่คุ้มค่า หน้าจอ Super AMOLED 120Hz กล้อง 50MP พร้อมกันสั่น กันน้ำกันฝุ่น IP67 แบตเตอรี่ 5000mAh ใช้งานได้เต็มวัน',
    status: 'AVAILABLE',
    isFeatured: false,
    publishedAt: new Date('2026-10-08T03:00:00.000Z'),
    createdAt: new Date('2026-10-07T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-P7P-128-GY-009',
    modelSlug: 'pixel-7-pro',
    storageGb: 128,
    ramGb: 12,
    color: 'เทา',
    priceThb: 15900,
    conditionGrade: 'A',
    batteryHealthPct: 88,
    cosmeticDefects: 'รอยขนแมวบางเบาที่กรอบอลูมิเนียม',
    repairHistory: 'ไม่เคยซ่อม',
    accessories: 'กล่องเดิม สายชาร์จ',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'Pixel 7 Pro ความจุ 128GB สีเทา สภาพเกรด A จุดเด่นคือกล้องที่ประมวลผลด้วย AI ถ่ายภาพกลางคืนและซูม 5x ได้ยอดเยี่ยม หน้าจอ LTPO 120Hz ระบบ Android สะอาด ไม่อัดแอป',
    status: 'AVAILABLE',
    isFeatured: true,
    publishedAt: new Date('2026-09-26T03:00:00.000Z'),
    createdAt: new Date('2026-09-25T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-P8-256-OB-010',
    modelSlug: 'pixel-8',
    storageGb: 256,
    ramGb: 8,
    color: 'ฟ้า',
    priceThb: 19900,
    conditionGrade: 'A',
    batteryHealthPct: 95,
    cosmeticDefects: 'สภาพสวย ไม่มีรอย',
    repairHistory: 'ไม่เคยซ่อม',
    accessories: 'กล่องเดิม สายชาร์จ',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'Pixel 8 ความจุ 256GB สีฟ้า สภาพเกรด A ตัวเครื่องกะทัดรัดจับถนัดมือ หน้าจอ Actua 120Hz รับประกันอัปเดต Android 7 ปี เหมาะกับผู้ที่ชอบกล้องคุณภาพและระบบลื่นไหล',
    status: 'AVAILABLE',
    isFeatured: false,
    publishedAt: new Date('2026-10-10T03:00:00.000Z'),
    createdAt: new Date('2026-10-09T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-13TP-512-BL-011',
    modelSlug: 'xiaomi-13t-pro',
    storageGb: 512,
    ramGb: 12,
    color: 'น้ำเงิน',
    priceThb: 13900,
    conditionGrade: 'A',
    batteryHealthPct: 91,
    cosmeticDefects: 'ไม่มีตำหนิ',
    repairHistory: 'ไม่เคยซ่อม',
    accessories: 'กล่องเดิม สายชาร์จ หัวชาร์จ 120W',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'Xiaomi 13T Pro ความจุ 512GB สีน้ำเงิน สภาพเกรด A ชิป Dimensity 9200+ แรงเพียงพอสำหรับเกมหนัก หน้าจอ AMOLED 144Hz ชาร์จเร็ว 120W เต็มแบตภายในเวลาประมาณ 20 นาที',
    status: 'AVAILABLE',
    isFeatured: true,
    publishedAt: new Date('2026-10-12T03:00:00.000Z'),
    createdAt: new Date('2026-10-11T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-RN12P-128-PU-012',
    modelSlug: 'redmi-note-12-pro',
    storageGb: 128,
    ramGb: 8,
    color: 'ม่วง',
    priceThb: 5900,
    conditionGrade: 'B',
    batteryHealthPct: 87,
    cosmeticDefects: 'มีรอยเล็กที่ขอบล่าง',
    repairHistory: 'ไม่เคยซ่อม',
    accessories: 'สายชาร์จ',
    warrantyInfo: 'รับประกันร้าน 15 วัน',
    description:
      'Redmi Note 12 Pro ความจุ 128GB สีม่วง สภาพเกรด B ราคาย่อมเยาเหมาะกับเครื่องสำรองหรือผู้เริ่มใช้งาน หน้าจอ AMOLED 120Hz กล้อง 50MP แบตเตอรี่ 5000mAh พร้อมชาร์จเร็ว 67W',
    status: 'AVAILABLE',
    isFeatured: false,
    publishedAt: new Date('2026-10-13T03:00:00.000Z'),
    createdAt: new Date('2026-10-12T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-RENO10P-256-PK-013',
    modelSlug: 'reno-10-pro',
    storageGb: 256,
    ramGb: 12,
    color: 'ชมพู',
    priceThb: 9900,
    conditionGrade: 'A',
    batteryHealthPct: 93,
    cosmeticDefects: 'สภาพสวย',
    repairHistory: 'ไม่เคยซ่อม',
    accessories: 'กล่องเดิม สายชาร์จ',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'OPPO Reno 10 Pro ความจุ 256GB สีชมพู สภาพเกรด A ดีไซน์บางเบา กล้องพอร์ตเทรตคุณภาพสูง เหมาะกับผู้ที่ชอบถ่ายภาพบุคคล หน้าจอ AMOLED 120Hz และชาร์จเร็ว SUPERVOOC',
    status: 'AVAILABLE',
    isFeatured: false,
    publishedAt: new Date('2026-10-14T03:00:00.000Z'),
    createdAt: new Date('2026-10-13T02:00:00.000Z'),
  },
  {
    sku: 'DEMO-IP14-256-WH-014',
    modelSlug: 'iphone-14',
    storageGb: 256,
    ramGb: 6,
    color: 'ขาว',
    priceThb: 26500,
    conditionGrade: 'A',
    batteryHealthPct: 94,
    cosmeticDefects: 'ไม่มีตำหนิ',
    repairHistory: 'ไม่เคยซ่อม',
    accessories: 'กล่องเดิม สายชาร์จ',
    warrantyInfo: 'รับประกันร้าน 30 วัน',
    description:
      'iPhone 14 ความจุ 256GB สีขาว สภาพเกรด A สุขภาพแบตเตอรี่ 94% ตัวเครื่องสวยพร้อมใช้งาน กล้องคู่พร้อมระบบ Action mode สำหรับวิดีโอที่นิ่งขึ้น เหมาะกับผู้ที่ต้องการ iPhone ในราคาสมเหตุสมผล',
    status: 'SOLD',
    isFeatured: false,
    publishedAt: new Date('2026-09-15T03:00:00.000Z'),
    createdAt: new Date('2026-09-14T02:00:00.000Z'),
  },
];

async function main() {
  console.log('เริ่ม seed ข้อมูลสาธิต SecondPhone Store...');

  const brandIdBySlug = new Map<string, string>();
  for (const brand of brands) {
    const row = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name },
      create: { name: brand.name, slug: brand.slug },
    });
    brandIdBySlug.set(brand.slug, row.id);
  }

  const modelIdBySlug = new Map<string, string>();
  for (const model of phoneModels) {
    const brandId = brandIdBySlug.get(model.brandSlug);
    if (!brandId) throw new Error(`ไม่พบแบรนด์ slug "${model.brandSlug}"`);
    const row = await prisma.phoneModel.upsert({
      where: { slug: model.slug },
      update: { name: model.name, brandId, releaseYear: model.releaseYear },
      create: {
        slug: model.slug,
        name: model.name,
        brandId,
        releaseYear: model.releaseYear,
      },
    });
    modelIdBySlug.set(model.slug, row.id);
  }

  for (const device of devices) {
    const modelId = modelIdBySlug.get(device.modelSlug);
    if (!modelId) throw new Error(`ไม่พบรุ่น slug "${device.modelSlug}"`);

    const fields = {
      modelId,
      storageGb: device.storageGb,
      ramGb: device.ramGb ?? null,
      color: device.color,
      priceThb: device.priceThb,
      conditionGrade: device.conditionGrade,
      batteryHealthPct: device.batteryHealthPct ?? null,
      cosmeticDefects: device.cosmeticDefects ?? null,
      repairHistory: device.repairHistory ?? null,
      accessories: device.accessories ?? null,
      warrantyInfo: device.warrantyInfo ?? null,
      description: device.description,
      status: device.status,
      isFeatured: device.isFeatured,
      publishedAt: device.publishedAt,
    };

    await prisma.device.upsert({
      where: { sku: device.sku },
      update: fields,
      create: {
        sku: device.sku,
        slug: device.sku.toLowerCase(),
        createdAt: device.createdAt,
        ...fields,
      },
    });
  }

  const [brandCount, modelCount, deviceCount, imageCount] = await Promise.all([
    prisma.brand.count(),
    prisma.phoneModel.count(),
    prisma.device.count(),
    prisma.deviceImage.count(),
  ]);

  console.log(
    `seed เสร็จสิ้น: brands=${brandCount} models=${modelCount} devices=${deviceCount} images=${imageCount}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('seed ล้มเหลว:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
