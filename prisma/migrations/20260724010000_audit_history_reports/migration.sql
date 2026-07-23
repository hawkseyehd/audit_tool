CREATE TABLE "AuditResultRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL,
  "resultState" TEXT NOT NULL,
  "overallScore" REAL NOT NULL,
  "findingCountsJson" TEXT NOT NULL,
  "categoryScoresJson" TEXT NOT NULL,
  "canonicalResultJson" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL,
  "completedAt" DATETIME NOT NULL,
  "retainedUntil" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AuditResultRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AuditJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AuditResultRecord_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "AuditScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AuditResultRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AuditResultRecord_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ReportArtifact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "resultId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "websiteId" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storedPath" TEXT,
  "status" TEXT NOT NULL,
  "verifiedAt" DATETIME,
  "retainedUntil" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ReportArtifact_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "AuditResultRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReportArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AuditJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReportArtifact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReportArtifact_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AuditResultRecord_jobId_key" ON "AuditResultRecord"("jobId");
CREATE UNIQUE INDEX "AuditResultRecord_scopeId_key" ON "AuditResultRecord"("scopeId");
CREATE UNIQUE INDEX "AuditResultRecord_auditId_key" ON "AuditResultRecord"("auditId");
CREATE INDEX "AuditResultRecord_clientId_completedAt_idx" ON "AuditResultRecord"("clientId", "completedAt");
CREATE INDEX "AuditResultRecord_resultState_completedAt_idx" ON "AuditResultRecord"("resultState", "completedAt");
CREATE INDEX "AuditResultRecord_websiteId_completedAt_idx" ON "AuditResultRecord"("websiteId", "completedAt");
CREATE UNIQUE INDEX "ReportArtifact_jobId_format_key" ON "ReportArtifact"("jobId", "format");
CREATE INDEX "ReportArtifact_clientId_createdAt_idx" ON "ReportArtifact"("clientId", "createdAt");
CREATE INDEX "ReportArtifact_resultId_idx" ON "ReportArtifact"("resultId");
CREATE INDEX "ReportArtifact_status_createdAt_idx" ON "ReportArtifact"("status", "createdAt");
CREATE INDEX "ReportArtifact_websiteId_createdAt_idx" ON "ReportArtifact"("websiteId", "createdAt");
