CREATE TABLE "DiscoveryCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTermsVersion" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'draft',
    "country" TEXT NOT NULL,
    "region" TEXT,
    "locality" TEXT,
    "radiusKm" REAL,
    "category" TEXT,
    "keywordsJson" TEXT NOT NULL DEFAULT '[]',
    "maxResults" INTEGER NOT NULL,
    "requireWebsite" BOOLEAN NOT NULL DEFAULT true,
    "requiredFieldsJson" TEXT NOT NULL DEFAULT '[]',
    "exclusionRulesJson" TEXT NOT NULL DEFAULT '[]',
    "continuationDataJson" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "failureMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT,
    "promotedClientId" TEXT,
    "businessName" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'new',
    "websiteUrl" TEXT,
    "normalizedWebsiteUrl" TEXT,
    "normalizedDomain" TEXT,
    "category" TEXT,
    "publicPhone" TEXT,
    "publicEmail" TEXT,
    "addressLine" TEXT,
    "locality" TEXT,
    "region" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "serviceArea" TEXT,
    "socialProfilesJson" TEXT NOT NULL DEFAULT '[]',
    "websiteAvailability" TEXT NOT NULL DEFAULT 'unknown',
    "discoveredPageCount" INTEGER,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "duplicateReviewState" TEXT NOT NULL DEFAULT 'not-reviewed',
    "owner" TEXT,
    "notes" TEXT,
    "doNotContactAt" DATETIME,
    "suppressedAt" DATETIME,
    "firstDiscoveredAt" DATETIME NOT NULL,
    "lastVerifiedAt" DATETIME,
    "sourceUpdatedAt" DATETIME,
    "retainedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Prospect_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DiscoveryCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Prospect_promotedClientId_fkey" FOREIGN KEY ("promotedClientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ProspectTag" (
    "prospectId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    PRIMARY KEY ("prospectId", "tagId"),
    CONSTRAINT "ProspectTag_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProspectTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProspectActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProspectActivity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DiscoverySourceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prospectId" TEXT NOT NULL,
    "campaignId" TEXT,
    "provider" TEXT NOT NULL,
    "providerRecordId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "collectedAt" DATETIME NOT NULL,
    "lastVerifiedAt" DATETIME,
    "sourceUpdatedAt" DATETIME,
    "fieldProvenanceJson" TEXT NOT NULL,
    "permittedFieldsJson" TEXT NOT NULL,
    "retentionPolicy" TEXT NOT NULL,
    "retainedUntil" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DiscoverySourceRecord_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiscoverySourceRecord_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DiscoveryCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SuppressionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchKey" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "sourceProspectId" TEXT,
    "lastMatchedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "DiscoveryCampaign_state_updatedAt_idx" ON "DiscoveryCampaign"("state", "updatedAt");
CREATE INDEX "DiscoveryCampaign_provider_createdAt_idx" ON "DiscoveryCampaign"("provider", "createdAt");
CREATE INDEX "Prospect_state_updatedAt_idx" ON "Prospect"("state", "updatedAt");
CREATE INDEX "Prospect_searchText_idx" ON "Prospect"("searchText");
CREATE INDEX "Prospect_normalizedDomain_idx" ON "Prospect"("normalizedDomain");
CREATE INDEX "Prospect_websiteAvailability_lastVerifiedAt_idx" ON "Prospect"("websiteAvailability", "lastVerifiedAt");
CREATE INDEX "Prospect_owner_idx" ON "Prospect"("owner");
CREATE INDEX "Prospect_retainedUntil_idx" ON "Prospect"("retainedUntil");
CREATE INDEX "ProspectTag_tagId_idx" ON "ProspectTag"("tagId");
CREATE INDEX "ProspectActivity_prospectId_createdAt_idx" ON "ProspectActivity"("prospectId", "createdAt");
CREATE UNIQUE INDEX "DiscoverySourceRecord_provider_providerRecordId_key" ON "DiscoverySourceRecord"("provider", "providerRecordId");
CREATE INDEX "DiscoverySourceRecord_prospectId_collectedAt_idx" ON "DiscoverySourceRecord"("prospectId", "collectedAt");
CREATE INDEX "DiscoverySourceRecord_campaignId_idx" ON "DiscoverySourceRecord"("campaignId");
CREATE INDEX "DiscoverySourceRecord_retainedUntil_idx" ON "DiscoverySourceRecord"("retainedUntil");
CREATE UNIQUE INDEX "SuppressionRecord_matchKey_key" ON "SuppressionRecord"("matchKey");
CREATE INDEX "SuppressionRecord_expiresAt_idx" ON "SuppressionRecord"("expiresAt");
CREATE INDEX "SuppressionRecord_sourceProspectId_idx" ON "SuppressionRecord"("sourceProspectId");
