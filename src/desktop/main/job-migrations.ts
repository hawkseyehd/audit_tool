export const JOB_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "AuditJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "clientBusinessName" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "pagesCompleted" INTEGER NOT NULL DEFAULT 0,
    "pagesTotal" INTEGER NOT NULL,
    "failedPageCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "resultJson" TEXT,
    "outputDirectory" TEXT,
    "cancelRequestedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuditJob_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "AuditScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditJob_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditJob_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AuditJob_scopeId_key" ON "AuditJob"("scopeId")`,
  `CREATE INDEX IF NOT EXISTS "AuditJob_clientId_createdAt_idx"
    ON "AuditJob"("clientId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditJob_state_createdAt_idx"
    ON "AuditJob"("state", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditJob_websiteId_createdAt_idx"
    ON "AuditJob"("websiteId", "createdAt")`,
] as const;
