-- CreateTable
CREATE TABLE "WebsitePage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "websiteId" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "observedUrl" TEXT NOT NULL,
    "title" TEXT,
    "pageType" TEXT NOT NULL,
    "statusCode" INTEGER,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "availability" TEXT NOT NULL,
    "changeState" TEXT NOT NULL,
    "recommendationState" TEXT NOT NULL,
    "recommendationReason" TEXT NOT NULL,
    "selectionState" TEXT NOT NULL DEFAULT 'default',
    "firstDiscoveredAt" DATETIME NOT NULL,
    "lastObservedAt" DATETIME NOT NULL,
    "lastChangedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebsitePage_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "websiteId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "observedPageCount" INTEGER NOT NULL DEFAULT 0,
    "discoveredUrlCount" INTEGER NOT NULL DEFAULT 0,
    "successfulPageCount" INTEGER NOT NULL DEFAULT 0,
    "failedPageCount" INTEGER NOT NULL DEFAULT 0,
    "newPageCount" INTEGER NOT NULL DEFAULT 0,
    "changedPageCount" INTEGER NOT NULL DEFAULT 0,
    "unavailablePageCount" INTEGER NOT NULL DEFAULT 0,
    "noLongerObservedCount" INTEGER NOT NULL DEFAULT 0,
    "failureMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DiscoveryRun_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePage_websiteId_normalizedUrl_key" ON "WebsitePage"("websiteId", "normalizedUrl");
CREATE INDEX "WebsitePage_websiteId_availability_lastObservedAt_idx" ON "WebsitePage"("websiteId", "availability", "lastObservedAt");
CREATE INDEX "WebsitePage_websiteId_pageType_idx" ON "WebsitePage"("websiteId", "pageType");
CREATE INDEX "WebsitePage_websiteId_changeState_idx" ON "WebsitePage"("websiteId", "changeState");
CREATE INDEX "WebsitePage_websiteId_selectionState_idx" ON "WebsitePage"("websiteId", "selectionState");
CREATE INDEX "DiscoveryRun_websiteId_startedAt_idx" ON "DiscoveryRun"("websiteId", "startedAt");
CREATE INDEX "DiscoveryRun_status_idx" ON "DiscoveryRun"("status");
