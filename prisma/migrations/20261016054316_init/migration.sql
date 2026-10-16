-- CreateEnum
CREATE TYPE "ConditionGrade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'SOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_models" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "releaseYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "storageGb" INTEGER NOT NULL,
    "ramGb" INTEGER,
    "color" TEXT NOT NULL,
    "priceThb" INTEGER NOT NULL,
    "conditionGrade" "ConditionGrade" NOT NULL,
    "batteryHealthPct" INTEGER,
    "cosmeticDefects" TEXT,
    "repairHistory" TEXT,
    "accessories" TEXT,
    "warrantyInfo" TEXT,
    "description" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'DRAFT',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_images" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "phone_models_slug_key" ON "phone_models"("slug");

-- CreateIndex
CREATE INDEX "phone_models_brandId_idx" ON "phone_models"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "phone_models_brandId_name_key" ON "phone_models"("brandId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "devices_sku_key" ON "devices"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "devices_slug_key" ON "devices"("slug");

-- CreateIndex
CREATE INDEX "devices_status_publishedAt_idx" ON "devices"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "devices_modelId_idx" ON "devices"("modelId");

-- CreateIndex
CREATE INDEX "devices_priceThb_idx" ON "devices"("priceThb");

-- CreateIndex
CREATE INDEX "devices_conditionGrade_idx" ON "devices"("conditionGrade");

-- CreateIndex
CREATE INDEX "device_images_deviceId_sortOrder_idx" ON "device_images"("deviceId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "phone_models" ADD CONSTRAINT "phone_models_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "phone_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_images" ADD CONSTRAINT "device_images_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
