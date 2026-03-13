-- CreateTable
CREATE TABLE "LocationCertification" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "certifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decertifiedAt" TIMESTAMP(3),

    CONSTRAINT "LocationCertification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationCertification_staffProfileId_locationId_key" ON "LocationCertification"("staffProfileId", "locationId");

-- AddForeignKey
ALTER TABLE "LocationCertification" ADD CONSTRAINT "LocationCertification_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationCertification" ADD CONSTRAINT "LocationCertification_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
