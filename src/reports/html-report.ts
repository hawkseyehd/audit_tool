import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { auditResultSchema, FINDING_CATEGORIES, FINDING_SEVERITIES } from "../core/schemas.js";
import type {
  AuditEvidence,
  AuditFinding,
  AuditResult,
  FindingCategory,
  FindingSeverity,
  ScannedPage,
} from "../core/types.js";
import { ACCESSIBILITY_AUTOMATION_DISCLAIMER } from "../scanners/accessibility/accessibility-scanner.js";
import { SCORE_CATEGORIES, SCORE_CATEGORY_WEIGHTS } from "../scoring/scoring-engine.js";
import type { ScoreCategory } from "../scoring/scoring-engine.js";

const SCORE_LABELS: Readonly<Record<ScoreCategory, string>> = {
  performance: "Performance",
  accessibility: "Accessibility",
  formsAndConversionUx: "Forms and conversion UX",
  seo: "SEO",
  securityPrivacy: "Security and privacy basics",
  technicalContentQuality: "Technical and content quality",
};

const CATEGORY_LABELS: Readonly<Record<FindingCategory, string>> = {
  business: "Business",
  ux: "Conversion UX",
  forms: "Forms",
  performance: "Performance",
  accessibility: "Accessibility",
  seo: "SEO",
  security: "Security",
  privacy: "Privacy",
  analytics: "Analytics",
  technical: "Technical",
};

const SEVERITY_LABELS: Readonly<Record<FindingSeverity, string>> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Informational",
};

const SEVERITY_ORDER = new Map<FindingSeverity, number>(
  FINDING_SEVERITIES.map((severity, index) => [severity, index]),
);

export function generateHtmlReport(auditResult: AuditResult): string {
  const result = auditResultSchema.parse(auditResult);
  const siteName = resolveReportSiteName(result);
  const findings = sortFindings(result.findings);
  const failedPageCount = result.scannedPages.filter((page) => page.error !== undefined).length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' data:; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'none'; object-src 'none'; base-uri 'none'">
  <title>Audit Report - ${escapeHtml(siteName)}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <main class="report">
    ${renderCover(result, siteName, failedPageCount)}
    ${renderExecutiveSummary(result, failedPageCount)}
    ${renderCategoryScores(result)}
    ${renderPriorities(result)}
    ${renderScope(result)}
    ${renderCategorySummary(findings)}
    ${renderFindings(findings)}
    ${renderActionPlan(findings)}
    ${renderLimitations(result, failedPageCount)}
  </main>
</body>
</html>
`;
}

export async function writeHtmlReport(
  htmlDirectory: string,
  auditResult: AuditResult,
): Promise<AuditResult> {
  const validatedResult = auditResultSchema.parse(auditResult);
  const destinationPath = resolve(htmlDirectory, "audit-report.html");
  const temporaryPath = resolve(htmlDirectory, `.audit-report-${randomUUID()}.tmp`);
  const resultWithOutput = auditResultSchema.parse({
    ...validatedResult,
    outputs: { ...validatedResult.outputs, htmlReportPath: destinationPath },
  });

  try {
    await writeFile(temporaryPath, generateHtmlReport(resultWithOutput), {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, destinationPath);
    return resultWithOutput;
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export function resolveReportSiteName(result: AuditResult): string {
  const titledPages = result.scannedPages.filter(
    (page): page is ScannedPage & { readonly title: string } =>
      page.title !== undefined && page.title.trim().length > 0,
  );
  const title = titledPages.find((page) => page.pageType === "home")?.title ?? titledPages[0]?.title;

  if (title !== undefined) return title.trim();

  try {
    return new URL(result.normalizedUrl).hostname.replace(/^www\./u, "");
  } catch {
    return "Website audit";
  }
}

function renderCover(result: AuditResult, siteName: string, failedPageCount: number): string {
  const counts = result.summary.findingCounts;
  const actionable = counts.critical + counts.high + counts.medium + counts.low;
  const score = formatScore(result.summary.overallScore);
  const scoreBand = getScoreBand(result.summary.overallScore);

  return `<section class="cover" aria-labelledby="report-title">
    <div class="cover-rule"></div>
    <p class="eyebrow">Website quality assessment</p>
    <h1 id="report-title">Audit Report</h1>
    <p class="site-name">${escapeHtml(siteName)}</p>
    <div class="cover-overview">
      <dl class="metadata">
        ${metadataItem("Website", result.normalizedUrl)}
        ${metadataItem("Audit completed", formatTimestamp(result.completedAt))}
        ${metadataItem("Pages reviewed", String(result.scannedPages.length))}
        ${metadataItem("Audit ID", result.auditId)}
      </dl>
      <div class="score-panel" aria-label="Overall audit score">
        <span class="score-label">Overall score</span>
        <strong><span>${score}</span><small>/100</small></strong>
        <span class="score-band score-band--${scoreBand.className}">${scoreBand.label}</span>
      </div>
    </div>
    <div class="cover-summary">
      <div>
        <span>Actionable findings</span>
        <strong>${String(actionable)}</strong>
      </div>
      <div>
        <span>Critical and high</span>
        <strong>${String(counts.critical + counts.high)}</strong>
      </div>
      <div>
        <span>Inspection failures</span>
        <strong>${String(failedPageCount)}</strong>
      </div>
    </div>
    <p class="cover-note">Point-in-time automated assessment. Findings support prioritization and expert review; they are not a certification or guarantee.</p>
  </section>`;
}

function renderExecutiveSummary(result: AuditResult, failedPageCount: number): string {
  const counts = result.summary.findingCounts;
  const actionable = counts.critical + counts.high + counts.medium + counts.low;
  const partial =
    failedPageCount === 0
      ? ""
      : `<div class="notice notice--warning"><strong>Partial coverage</strong><span>${String(failedPageCount)} page${failedPageCount === 1 ? "" : "s"} recorded an inspection error. Review the scope before treating the audit as complete.</span></div>`;

  return `<section class="report-section" aria-labelledby="executive-summary">
    ${sectionHeading("01", "Executive summary", "executive-summary")}
    <p class="lead">The audit scored <strong>${formatScore(result.summary.overallScore)} out of 100</strong> across ${String(result.scannedPages.length)} scanned pages. It identified <strong>${String(actionable)} actionable ${actionable === 1 ? "finding" : "findings"}</strong>, including ${String(counts.critical)} critical and ${String(counts.high)} high-severity issues.</p>
    ${partial}
    <div class="severity-grid" aria-label="Finding counts by severity">
      ${FINDING_SEVERITIES.map((severity) => severityMetric(severity, counts[severity])).join("")}
    </div>
  </section>`;
}

function renderCategoryScores(result: AuditResult): string {
  const rows = SCORE_CATEGORIES.map((category) => {
    const score = result.summary.categoryScores[category];
    const displayScore = score === undefined ? "Not available" : `${formatScore(score)} / 100`;
    const width = score ?? 0;
    const band = score === undefined ? undefined : getScoreBand(score);
    return `<tr>
      <th scope="row">${SCORE_LABELS[category]}</th>
      <td>${String(SCORE_CATEGORY_WEIGHTS[category] * 100)}%</td>
      <td><span class="score-value">${displayScore}</span>${band === undefined ? "" : `<span class="table-status table-status--${band.className}">${band.label}</span>`}</td>
      <td><div class="score-track" role="img" aria-label="${escapeHtml(SCORE_LABELS[category])}: ${displayScore}"><span style="width:${String(width)}%"></span></div></td>
    </tr>`;
  }).join("");

  return `<section class="report-section" aria-labelledby="category-scores">
    ${sectionHeading("02", "Category scores", "category-scores")}
    <p class="section-intro">The overall score is the weighted combination of six audit areas. Findings reduce category scores according to severity.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Category</th><th scope="col">Weight</th><th scope="col">Score</th><th scope="col">Progress</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderPriorities(result: AuditResult): string {
  const priorities = result.summary.topPriorities;
  const content =
    priorities.length === 0
      ? emptyState("No actionable automated findings were prioritized.")
      : `<ol class="priority-list">${priorities.map((priority) => `<li><span>${escapeHtml(priority)}</span></li>`).join("")}</ol>`;

  return `<section class="report-section" aria-labelledby="top-priorities">
    ${sectionHeading("03", "Top priorities", "top-priorities")}
    ${content}
  </section>`;
}

function renderScope(result: AuditResult): string {
  const rows =
    result.scannedPages.length === 0
      ? `<tr><td colspan="4">No pages were recorded. Audit coverage is incomplete.</td></tr>`
      : result.scannedPages.map(renderPageRow).join("");

  return `<section class="report-section" aria-labelledby="scope">
    ${sectionHeading("04", "Scope and scanned pages", "scope")}
    <dl class="scope-meta">
      ${metadataItem("Requested target", result.targetUrl)}
      ${metadataItem("Normalized target", result.normalizedUrl)}
      ${metadataItem("Started", formatTimestamp(result.startedAt))}
      ${metadataItem("Completed", formatTimestamp(result.completedAt))}
    </dl>
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">Page</th><th scope="col">Type</th><th scope="col">HTTP</th><th scope="col">Inspection</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderPageRow(page: ScannedPage): string {
  const status =
    page.error === undefined
      ? `<span class="status status--complete">Completed</span>`
      : `<span class="status status--failed">Failed</span><span class="status-detail">${escapeHtml(page.error.message)}${page.error.code === undefined ? "" : ` (${escapeHtml(page.error.code)})`}</span>`;
  return `<tr>
    <th scope="row"><a href="${escapeHtml(page.url)}">${escapeHtml(page.title ?? page.url)}</a><span class="cell-detail">${escapeHtml(page.url)}</span></th>
    <td>${escapeHtml(titleCase(page.pageType))}</td>
    <td>${page.statusCode === undefined ? "Not available" : String(page.statusCode)}</td>
    <td>${status}</td>
  </tr>`;
}

function renderCategorySummary(findings: readonly AuditFinding[]): string {
  const rows = FINDING_CATEGORIES.map((category) => {
    const matching = findings.filter((finding) => finding.category === category);
    const highest = FINDING_SEVERITIES.find((severity) =>
      matching.some((finding) => finding.severity === severity),
    );
    return `<tr>
      <th scope="row">${CATEGORY_LABELS[category]}</th>
      <td>${String(matching.length)}</td>
      <td>${highest === undefined ? "No findings" : severityLabel(highest)}</td>
    </tr>`;
  }).join("");

  return `<section class="report-section" aria-labelledby="finding-overview">
    ${sectionHeading("05", "Finding overview", "finding-overview")}
    <div class="table-wrap table-wrap--compact">
      <table>
        <thead><tr><th scope="col">Audit area</th><th scope="col">Findings</th><th scope="col">Highest severity</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderFindings(findings: readonly AuditFinding[]): string {
  const content =
    findings.length === 0
      ? emptyState("No automated findings were recorded.")
      : findings.map((finding, index) => renderFinding(finding, index + 1)).join("");

  return `<section class="report-section findings-section" aria-labelledby="detailed-findings">
    ${sectionHeading("06", "Detailed findings", "detailed-findings")}
    <p class="section-intro">Findings are ordered by severity, category, page, and stable rule ID. Each record preserves the detected impact, recommended response, and available evidence.</p>
    <div class="finding-list">${content}</div>
  </section>`;
}

function renderFinding(finding: AuditFinding, index: number): string {
  return `<article class="finding finding--${finding.severity}" aria-labelledby="finding-${String(index)}">
    <header class="finding-header">
      <div>
        <span class="severity severity--${finding.severity}">${severityLabel(finding.severity)}</span>
        <span class="finding-category">${CATEGORY_LABELS[finding.category]}</span>
      </div>
      <span class="finding-index">Finding ${String(index)}</span>
    </header>
    <h3 id="finding-${String(index)}">${escapeHtml(finding.title)}</h3>
    <dl class="finding-meta">
      ${metadataItem("Page", finding.url, true)}
      ${metadataItem("Rule", finding.ruleId)}
      ${metadataItem("Scanner", titleCase(finding.scanner))}
      ${metadataItem("Detected", formatTimestamp(finding.detectedAt))}
    </dl>
    ${findingBlock("Description", finding.description)}
    ${findingBlock("Impact", finding.impact)}
    ${findingBlock("Recommendation", finding.recommendation)}
    ${finding.evidence === undefined ? "" : renderEvidence(finding.evidence)}
  </article>`;
}

function renderEvidence(evidence: AuditEvidence): string {
  const items = [
    evidenceItem("Source", titleCase(evidence.source)),
    evidence.selector === undefined ? "" : evidenceItem("Selector", evidence.selector, true),
    evidence.metric === undefined ? "" : evidenceItem("Metric", evidence.metric),
    evidence.value === undefined ? "" : evidenceItem("Observed", String(evidence.value)),
    evidence.expected === undefined ? "" : evidenceItem("Expected", String(evidence.expected)),
  ].join("");
  const screenshot = renderScreenshot(evidence.screenshotPath);

  return `<section class="evidence" aria-label="Finding evidence">
    <h4>Evidence</h4>
    <dl>${items}</dl>
    ${screenshot}
  </section>`;
}

function renderScreenshot(path: string | undefined): string {
  if (path === undefined) return "";
  const href = safeScreenshotHref(path);
  if (href === undefined) {
    return `<p class="artifact-reference">Screenshot reference: <code>${escapeHtml(path)}</code></p>`;
  }
  return `<figure class="evidence-image">
    <img src="${href}" alt="Captured website evidence">
    <figcaption>Screenshot evidence: <a href="${href}">${escapeHtml(path)}</a></figcaption>
  </figure>`;
}

function renderActionPlan(findings: readonly AuditFinding[]): string {
  const phases: readonly [string, string, readonly FindingSeverity[]][] = [
    ["Days 1-7", "Confirm scope, assign owners, and resolve critical risks", ["critical"]],
    ["Days 8-14", "Resolve high-severity trust and conversion blockers", ["high"]],
    ["Days 15-21", "Address medium-severity quality and usability issues", ["medium"]],
    ["Days 22-30", "Complete lower-risk improvements and retest all changes", ["low"]],
  ];
  const content = findings.some((finding) => finding.severity !== "info")
    ? phases.map(([period, objective, severities]) => renderPlanPhase(period, objective, findings, severities)).join("")
    : renderManualReviewPlan();

  return `<section class="report-section" aria-labelledby="action-plan">
    ${sectionHeading("07", "Recommended 30-day action plan", "action-plan")}
    <div class="plan">${content}</div>
  </section>`;
}

function renderPlanPhase(
  period: string,
  objective: string,
  findings: readonly AuditFinding[],
  severities: readonly FindingSeverity[],
): string {
  const titles = [
    ...new Set(
      findings
        .filter((finding) => severities.includes(finding.severity))
        .map((finding) => finding.title),
    ),
  ].slice(0, 3);
  const detail =
    titles.length === 0
      ? "No issues at this severity were recorded; use this phase for manual review."
      : `Priorities: ${titles.join("; ")}.`;
  return `<article class="plan-phase"><span>${period}</span><div><h3>${escapeHtml(objective)}</h3><p>${escapeHtml(detail)}</p></div></article>`;
}

function renderManualReviewPlan(): string {
  const phases: readonly (readonly [string, string])[] = [
    ["Days 1-7", "Manually validate the automated results and confirm the audit scope."],
    ["Days 8-14", "Complete keyboard, screen-reader, conversion-path, security, and analytics reviews."],
    ["Days 15-21", "Establish monitoring for performance, forms, crawl health, and regressions."],
    ["Days 22-30", "Re-run the audit, compare evidence, and document accepted residual risk."],
  ];
  return phases
    .map(([period, detail]) => `<article class="plan-phase"><span>${period}</span><div><p>${detail}</p></div></article>`)
    .join("");
}

function renderLimitations(result: AuditResult, failedPageCount: number): string {
  const partial =
    failedPageCount === 0
      ? ""
      : `<li>${String(failedPageCount)} page${failedPageCount === 1 ? "" : "s"} failed inspection, so this report contains partial results.</li>`;
  return `<section class="report-section limitations" aria-labelledby="limitations">
    ${sectionHeading("08", "Disclaimer and audit limitations", "limitations")}
    <ul>
      <li>${escapeHtml(ACCESSIBILITY_AUTOMATION_DISCLAIMER)}</li>
      <li>Lighthouse values are controlled lab measurements, not field data or a guarantee of real-user performance.</li>
      <li>Conversion UX, analytics, content, and technical heuristics require business and user validation.</li>
      <li>Security checks cover observable basics and do not replace penetration testing, code review, or compliance assessment.</li>
      <li>Results reflect the pages, viewports, permissions, and site state available during this audit; authenticated and dynamic workflows may be outside scope.</li>
      <li>The audit is non-destructive by default and does not prove that forms or transactional workflows function after submission.</li>
      ${partial}
    </ul>
    <p class="report-version">Audit schema ${escapeHtml(result.schemaVersion)} · Generated from canonical audit result ${escapeHtml(result.auditId)}</p>
  </section>`;
}

function sectionHeading(number: string, title: string, id: string): string {
  return `<header class="section-heading"><span>${number}</span><h2 id="${id}">${title}</h2></header>`;
}

function metadataItem(label: string, value: string, link = false): string {
  const content = link ? `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>` : escapeHtml(value);
  return `<div><dt>${escapeHtml(label)}</dt><dd>${content}</dd></div>`;
}

function severityMetric(severity: FindingSeverity, count: number): string {
  return `<div class="severity-metric severity-metric--${severity}"><span>${severityLabel(severity)}</span><strong>${String(count)}</strong></div>`;
}

function findingBlock(label: string, content: string): string {
  return `<section class="finding-block"><h4>${label}</h4>${paragraphs(content)}</section>`;
}

function evidenceItem(label: string, value: string, code = false): string {
  return `<div><dt>${label}</dt><dd>${code ? `<code>${escapeHtml(value)}</code>` : escapeHtml(value)}</dd></div>`;
}

function emptyState(message: string): string {
  return `<p class="empty-state">${escapeHtml(message)}</p>`;
}

function paragraphs(value: string): string {
  return value
    .split(/\r?\n/u)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function sortFindings(findings: readonly AuditFinding[]): AuditFinding[] {
  return [...findings].sort((left, right) => {
    const severity =
      (SEVERITY_ORDER.get(left.severity) ?? Number.MAX_SAFE_INTEGER) -
      (SEVERITY_ORDER.get(right.severity) ?? Number.MAX_SAFE_INTEGER);
    if (severity !== 0) return severity;
    return (
      left.category.localeCompare(right.category) ||
      left.url.localeCompare(right.url) ||
      left.ruleId.localeCompare(right.ruleId) ||
      left.id.localeCompare(right.id)
    );
  });
}

function safeScreenshotHref(path: string): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    isAbsolute(path) ||
    segments[0] !== "screenshots" ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    return undefined;
  }
  return `../${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function getScoreBand(score: number): { readonly className: string; readonly label: string } {
  if (score >= 90) return { className: "excellent", label: "Excellent" };
  if (score >= 75) return { className: "good", label: "Good" };
  if (score >= 60) return { className: "attention", label: "Needs attention" };
  return { className: "priority", label: "Priority action" };
}

function severityLabel(severity: FindingSeverity): string {
  return SEVERITY_LABELS[severity];
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(2).replace(/0+$/u, "");
}

function formatTimestamp(timestamp: string): string {
  return timestamp.replace("T", " ").replace(/\.\d{3}Z$/u, " UTC");
}

function titleCase(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const REPORT_STYLES = String.raw`
:root {
  color-scheme: light;
  --paper: #ffffff;
  --canvas: #eef2f7;
  --ink: #152033;
  --muted: #5d697a;
  --rule: #d8e0ea;
  --primary: #1f5fbf;
  --primary-tint: #eaf2ff;
  --critical: #b42318;
  --critical-tint: #feeceb;
  --high: #c2410c;
  --high-tint: #fff0e6;
  --medium: #865000;
  --medium-tint: #fff6d8;
  --low: #176b52;
  --low-tint: #e8f7f1;
  --info: #36618f;
  --info-tint: #edf4fb;
  font-family: Arial, "Helvetica Neue", sans-serif;
  font-synthesis: none;
}

* { box-sizing: border-box; }

html { background: var(--canvas); color: var(--ink); }

body { margin: 0; font-size: 15px; line-height: 1.55; }

a { color: #174f9f; overflow-wrap: anywhere; text-decoration-thickness: 1px; text-underline-offset: 2px; }

p, h1, h2, h3, h4, dl, figure { margin-top: 0; }

.report {
  width: min(100%, 980px);
  margin: 32px auto;
  padding: 0 56px 64px;
  background: var(--paper);
  box-shadow: 0 10px 32px rgb(21 32 51 / 12%);
}

.cover {
  min-height: 820px;
  padding: 56px 0 44px;
  display: flex;
  flex-direction: column;
  break-after: page;
}

.cover-rule { width: 100%; height: 4px; margin-bottom: 72px; background: var(--primary); }
.eyebrow { margin-bottom: 12px; color: var(--primary); font-size: 13px; font-weight: 700; text-transform: uppercase; }
.cover h1 { margin-bottom: 8px; font-size: 52px; line-height: 1.05; letter-spacing: 0; }
.site-name { max-width: 720px; margin-bottom: 64px; color: var(--muted); font-size: 24px; line-height: 1.3; }

.cover-overview { display: grid; grid-template-columns: minmax(0, 1fr) 250px; gap: 48px; align-items: stretch; }
.metadata, .scope-meta, .finding-meta { margin: 0; }
.metadata > div, .scope-meta > div, .finding-meta > div { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 12px; padding: 7px 0; }
dt { color: var(--muted); font-size: 13px; font-weight: 700; }
dd { margin: 0; overflow-wrap: anywhere; }

.score-panel { border: 1px solid #aebed4; padding: 26px; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.score-label { color: var(--primary); font-size: 12px; font-weight: 700; text-transform: uppercase; }
.score-panel strong { margin: 8px 0; color: var(--primary); font-size: 54px; line-height: 1; }
.score-panel small { color: var(--ink); font-size: 22px; font-weight: 500; }
.score-band, .severity, .status, .table-status { display: inline-block; font-weight: 700; }
.score-band--excellent, .score-band--good, .table-status--excellent, .table-status--good { color: #11643e; }
.score-band--attention, .table-status--attention { color: var(--medium); }
.score-band--priority, .table-status--priority { color: var(--critical); }

.cover-summary { margin-top: 64px; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); display: grid; grid-template-columns: repeat(3, 1fr); }
.cover-summary > div { padding: 20px 24px 20px 0; }
.cover-summary > div + div { padding-left: 24px; border-left: 1px solid var(--rule); }
.cover-summary span { display: block; color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
.cover-summary strong { display: block; margin-top: 3px; font-size: 28px; }
.cover-note { max-width: 680px; margin: auto 0 0; color: var(--muted); font-size: 13px; }

.report-section { padding: 52px 0 8px; }
.section-heading { margin-bottom: 24px; padding-bottom: 10px; border-bottom: 2px solid var(--primary); display: flex; gap: 14px; align-items: baseline; }
.section-heading > span { color: var(--primary); font-size: 13px; font-weight: 700; }
.section-heading h2 { margin: 0; font-size: 25px; line-height: 1.2; }
.lead { max-width: 800px; font-size: 18px; line-height: 1.6; }
.section-intro { max-width: 780px; color: var(--muted); }

.notice { margin: 22px 0; padding: 14px 16px; border-left: 4px solid var(--medium); background: var(--medium-tint); display: grid; gap: 3px; }
.notice strong { color: #6f4300; }

.severity-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid var(--rule); }
.severity-metric { min-height: 92px; padding: 16px; border-top: 4px solid var(--info); }
.severity-metric + .severity-metric { border-left: 1px solid var(--rule); }
.severity-metric span { display: block; color: var(--muted); font-size: 12px; font-weight: 700; }
.severity-metric strong { display: block; margin-top: 4px; font-size: 26px; }
.severity-metric--critical { border-top-color: var(--critical); }
.severity-metric--high { border-top-color: var(--high); }
.severity-metric--medium { border-top-color: var(--medium); }
.severity-metric--low { border-top-color: var(--low); }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead { display: table-header-group; }
th, td { padding: 12px 10px; border-bottom: 1px solid var(--rule); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
thead th { border-top: 1px solid var(--rule); background: #f7f9fc; color: #3f4c5f; font-size: 11px; text-transform: uppercase; }
tbody th { font-weight: 700; }
.score-value { display: block; white-space: nowrap; }
.table-status { margin-top: 2px; font-size: 11px; }
.score-track { width: 100%; min-width: 110px; height: 8px; margin-top: 6px; background: #dce3ec; }
.score-track span { display: block; height: 100%; background: var(--primary); }
.cell-detail, .status-detail { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; overflow-wrap: anywhere; }
.status--complete { color: var(--low); }
.status--failed { color: var(--critical); }

.priority-list { margin: 0; padding: 0; list-style: none; counter-reset: priority; }
.priority-list li { min-height: 52px; padding: 13px 12px; border-bottom: 1px solid var(--rule); display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 12px; align-items: center; counter-increment: priority; }
.priority-list li::before { content: counter(priority, decimal-leading-zero); color: var(--primary); font-weight: 700; }
.empty-state { padding: 18px; border: 1px solid var(--rule); color: var(--muted); background: #f8fafc; }

.scope-meta { margin-bottom: 22px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 36px; }
.scope-meta > div { grid-template-columns: 120px minmax(0, 1fr); border-bottom: 1px solid var(--rule); }
.table-wrap--compact { max-width: 700px; }

.finding-list { display: grid; gap: 24px; }
.finding { padding: 22px 24px 24px; border: 1px solid var(--rule); border-left: 5px solid var(--info); break-inside: avoid-page; }
.finding--critical { border-left-color: var(--critical); }
.finding--high { border-left-color: var(--high); }
.finding--medium { border-left-color: var(--medium); }
.finding--low { border-left-color: var(--low); }
.finding-header { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
.severity { padding: 3px 8px; font-size: 11px; text-transform: uppercase; }
.severity--critical { color: var(--critical); background: var(--critical-tint); }
.severity--high { color: var(--high); background: var(--high-tint); }
.severity--medium { color: var(--medium); background: var(--medium-tint); }
.severity--low { color: var(--low); background: var(--low-tint); }
.severity--info { color: var(--info); background: var(--info-tint); }
.finding-category { margin-left: 8px; color: var(--muted); font-size: 12px; font-weight: 700; }
.finding-index { color: var(--muted); font-size: 12px; }
.finding h3 { margin: 14px 0 16px; font-size: 20px; line-height: 1.3; }
.finding h4 { margin-bottom: 4px; color: var(--primary); font-size: 13px; }
.finding-meta { padding: 8px 0 12px; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
.finding-meta > div { grid-template-columns: 78px minmax(0, 1fr); }
.finding-block { margin-top: 18px; }
.finding-block p { margin-bottom: 6px; }

.evidence { margin-top: 18px; padding: 16px; background: #f7f9fc; }
.evidence dl { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 22px; }
.evidence dl > div { min-width: 0; }
.evidence dd { font-size: 13px; }
code { font-family: Consolas, "Courier New", monospace; font-size: 12px; overflow-wrap: anywhere; }
.artifact-reference { margin: 12px 0 0; color: var(--muted); }
.evidence-image { margin: 16px 0 0; break-inside: avoid; }
.evidence-image img { display: block; width: 100%; max-height: 420px; border: 1px solid var(--rule); object-fit: contain; object-position: top; }
.evidence-image figcaption { margin-top: 6px; color: var(--muted); font-size: 11px; }

.plan { border-top: 1px solid var(--rule); }
.plan-phase { padding: 18px 0; border-bottom: 1px solid var(--rule); display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 22px; break-inside: avoid; }
.plan-phase > span { color: var(--primary); font-weight: 700; }
.plan-phase h3 { margin-bottom: 4px; font-size: 15px; }
.plan-phase p { margin-bottom: 0; }

.limitations ul { padding-left: 20px; }
.limitations li { margin-bottom: 8px; }
.report-version { margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 11px; }

@media (max-width: 760px) {
  .report { margin: 0; padding: 0 22px 40px; box-shadow: none; }
  .cover { min-height: auto; }
  .cover-rule { margin-bottom: 48px; }
  .cover h1 { font-size: 40px; }
  .cover-overview, .scope-meta, .finding-meta { grid-template-columns: 1fr; }
  .score-panel { min-height: 190px; }
  .cover-summary { grid-template-columns: 1fr; }
  .cover-summary > div + div { padding-left: 0; border-top: 1px solid var(--rule); border-left: 0; }
  .severity-grid { grid-template-columns: 1fr 1fr; }
  .severity-metric + .severity-metric { border-left: 0; }
  .severity-metric:nth-child(even) { border-left: 1px solid var(--rule); }
  .finding-header { align-items: flex-start; }
  .evidence dl { grid-template-columns: 1fr; }
}

@page { size: A4; margin: 18mm 16mm 20mm; }

@media print {
  :root { font-size: 10pt; }
  html, body { background: var(--paper); print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  body { font-size: 10pt; line-height: 1.48; }
  .report { width: auto; margin: 0; padding: 0; box-shadow: none; }
  .cover { min-height: 242mm; padding: 4mm 0 0; }
  .cover-rule { margin-bottom: 24mm; }
  .cover h1 { font-size: 30pt; }
  .site-name { margin-bottom: 20mm; font-size: 16pt; }
  .cover-overview { grid-template-columns: minmax(0, 1fr) 52mm; gap: 12mm; }
  .score-panel { padding: 6mm; }
  .score-panel strong { font-size: 34pt; }
  .cover-summary { margin-top: 18mm; }
  .cover-note { font-size: 8.5pt; }
  .report-section { padding: 10mm 0 1mm; }
  .section-heading { margin-bottom: 5mm; }
  .section-heading h2 { font-size: 17pt; }
  .lead { font-size: 11.5pt; }
  table { font-size: 8.5pt; }
  th, td { padding: 2.5mm 2mm; }
  thead th { font-size: 7.5pt; }
  tr, .notice, .severity-grid, .priority-list li, .plan-phase { break-inside: avoid; }
  .finding { padding: 5mm; break-inside: auto; }
  .finding-header, .finding h3, .finding-meta, .finding-block h4, .evidence h4 { break-after: avoid; }
  .finding h3 { font-size: 13pt; }
  .finding-block, .evidence, .evidence-image { break-inside: avoid; }
  .evidence-image img { max-height: 105mm; }
  a { color: #174f9f; }
}
`;
