ALTER TABLE "DiscoveryCampaign" ADD COLUMN "latitude" REAL;
ALTER TABLE "DiscoveryCampaign" ADD COLUMN "longitude" REAL;
ALTER TABLE "DiscoveryCampaign" ADD COLUMN "processedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DiscoveryCampaign" ADD COLUMN "suppressedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DiscoveryCampaign" ADD COLUMN "providerRequestCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DiscoveryCampaign" ADD COLUMN "warningMessage" TEXT;
