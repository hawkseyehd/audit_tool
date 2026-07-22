import { FINDING_CATEGORIES, FINDING_SEVERITIES, auditResultSchema } from "../core/schemas.js";
import type {
  AuditFinding,
  AuditResult,
  FindingCategory,
  FindingSeverity,
} from "../core/types.js";
import { resolveReportSiteName } from "./html-report.js";

const MAX_FIRST_PRIORITIES = 3;
const MAX_ACTIONS_BY_PHASE = { actNow: 3, improveNext: 2, strengthen: 1 } as const;

type BusinessOutcomeId =
  | "conversion"
  | "visibility"
  | "trust"
  | "operations";

interface BusinessOutcomeDefinition {
  readonly id: BusinessOutcomeId;
  readonly label: string;
  readonly summary: string;
}

interface ActionPhase {
  readonly id: keyof typeof MAX_ACTIONS_BY_PHASE;
  readonly label: string;
  readonly objective: string;
  readonly severities: readonly FindingSeverity[];
}

const BUSINESS_OUTCOMES: readonly BusinessOutcomeDefinition[] = [
  {
    id: "conversion",
    label: "Enquiries and conversion",
    summary:
      "How easily visitors understand the offer, complete important journeys, and become customers.",
  },
  {
    id: "visibility",
    label: "Visibility and acquisition",
    summary:
      "How effectively the website attracts qualified visitors and keeps them engaged.",
  },
  {
    id: "trust",
    label: "Trust and access",
    summary:
      "How confidently and inclusively customers can use the website and share information.",
  },
  {
    id: "operations",
    label: "Measurement and operations",
    summary:
      "How reliably the business can measure performance, maintain the site, and make decisions.",
  },
];

const OUTCOME_BY_CATEGORY: Readonly<Record<FindingCategory, BusinessOutcomeId>> = {
  business: "conversion",
  ux: "conversion",
  forms: "conversion",
  performance: "visibility",
  accessibility: "trust",
  seo: "visibility",
  security: "trust",
  privacy: "trust",
  analytics: "operations",
  technical: "operations",
};

const CATEGORY_LABELS: Readonly<Record<FindingCategory, string>> = {
  business: "Business clarity",
  ux: "Customer journey",
  forms: "Enquiry forms",
  performance: "Page speed and stability",
  accessibility: "Accessibility",
  seo: "Search visibility",
  security: "Website security",
  privacy: "Privacy confidence",
  analytics: "Analytics and measurement",
  technical: "Technical quality",
};

const CATEGORY_BUSINESS_EFFECTS: Readonly<Record<FindingCategory, string>> = {
  business:
    "Unclear value or decision paths can make it harder for visitors to understand why they should choose the business.",
  ux: "Journey friction can reduce engagement and make enquiries or purchases less likely.",
  forms:
    "Form problems can prevent or discourage potential customers from completing an enquiry.",
  performance:
    "Slow or unstable pages can increase abandonment, particularly for visitors using mobile devices.",
  accessibility:
    "Access barriers can exclude customers, weaken reputation, and increase compliance exposure.",
  seo: "Search weaknesses can reduce qualified visibility and make important pages harder to discover.",
  security:
    "Visible security weaknesses can damage customer trust and create avoidable operational risk.",
  privacy:
    "Unclear privacy handling can reduce customer confidence and increase regulatory exposure.",
  analytics:
    "Measurement gaps can make marketing and website investment decisions less reliable.",
  technical:
    "Technical inconsistencies can increase maintenance effort and make future changes riskier.",
};

const ACTION_PHASES: readonly ActionPhase[] = [
  {
    id: "actNow",
    label: "Act now",
    objective: "Protect customer trust and remove the most serious journey blockers.",
    severities: ["critical", "high"],
  },
  {
    id: "improveNext",
    label: "Improve next",
    objective: "Reduce friction that can suppress enquiries, reach, and engagement.",
    severities: ["medium"],
  },
  {
    id: "strengthen",
    label: "Strengthen over time",
    objective: "Improve consistency, measurement, and long-term website quality.",
    severities: ["low", "info"],
  },
];

const SEVERITY_ORDER = new Map<FindingSeverity, number>(
  FINDING_SEVERITIES.map((severity, index) => [severity, index]),
);

export function generateClientSummaryReport(auditResult: AuditResult): string {
  const result = auditResultSchema.parse(auditResult);
  const siteName = resolveReportSiteName(result);
  const rankedFindings = rankFindings(result);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Website Improvement Summary - ${escapeHtml(siteName)}</title>
  <style>${CLIENT_SUMMARY_STYLES}</style>
</head>
<body>
  <main class="client-summary">
    ${renderBusinessSnapshot(result, siteName, rankedFindings)}
    ${renderBusinessImpact(result)}
    ${renderRecommendedWork(result, rankedFindings)}
  </main>
</body>
</html>
`;
}

function renderBusinessSnapshot(
  result: AuditResult,
  siteName: string,
  rankedFindings: readonly AuditFinding[],
): string {
  const scoreBand = getScoreBand(result.summary.overallScore);
  const firstPriorities = rankedFindings
    .filter((finding) => finding.severity !== "info")
    .slice(0, MAX_FIRST_PRIORITIES);

  return `<section class="client-page client-page--opening" aria-labelledby="client-summary-title">
    <header class="opening-header">
      <div class="top-rule"></div>
      <p class="document-type">Client website review</p>
      <h1 id="client-summary-title">Website Improvement Summary</h1>
      <p class="site-name">${escapeHtml(compactText(siteName, 150))}</p>
    </header>
    <div class="overview-band" aria-label="Website improvement overview">
      <div><span>Website health</span><strong>${formatScore(result.summary.overallScore)} / 100</strong><small>${scoreBand.label}</small></div>
      <div><span>Pages reviewed</span><strong>${String(result.scannedPages.length)}</strong><small>across the website</small></div>
      <div><span>Improvements identified</span><strong>${String(result.findings.length)}</strong><small>across all business areas</small></div>
    </div>
    <section class="business-verdict" aria-labelledby="business-verdict">
      <h2 id="business-verdict">What this means for the business</h2>
      <p>${renderBusinessVerdict(result)}</p>
    </section>
    <section aria-labelledby="business-outcomes">
      <h2 id="business-outcomes">Where the website affects business performance</h2>
      <div class="outcome-overview">
        ${BUSINESS_OUTCOMES.map((outcome) => renderOutcomeOverview(result, outcome)).join("")}
      </div>
    </section>
    <section class="focus-section" aria-labelledby="focus-first">
      <h2 id="focus-first">Where to focus first</h2>
      ${firstPriorities.length === 0 ? `<p class="empty-state">No immediate website changes were identified. Continue monitoring customer journeys and business performance.</p>` : `<ol>${firstPriorities.map(renderFocusPriority).join("")}</ol>`}
    </section>
  </section>`;
}

function renderOutcomeOverview(
  result: AuditResult,
  outcome: BusinessOutcomeDefinition,
): string {
  const findings = findingsForOutcome(result, outcome.id);
  const status = getBusinessStatus(findings);
  return `<article class="outcome-row">
    <div><h3>${escapeHtml(outcome.label)}</h3><p>${escapeHtml(outcome.summary)}</p></div>
    <div class="outcome-result"><strong>${String(findings.length)}</strong><span>${pluralize(findings.length, "improvement")}</span><em class="business-status business-status--${status.className}">${status.label}</em></div>
  </article>`;
}

function renderFocusPriority(finding: AuditFinding, index: number): string {
  return `<li>
    <span class="priority-rank">${String(index + 1)}</span>
    <h3>${escapeHtml(compactText(finding.title, 145))}</h3>
    <p>${escapeHtml(compactText(finding.impact, 175))}</p>
  </li>`;
}

function renderBusinessImpact(result: AuditResult): string {
  const totalFindings = result.findings.length;
  return `<section class="client-page" aria-labelledby="business-impact">
    ${pageHeader("What should improve and why", "Every identified issue is grouped below by the part of the business it can affect.", "business-impact")}
    <div class="impact-groups">
      ${BUSINESS_OUTCOMES.map((outcome) => renderImpactGroup(result, outcome)).join("")}
    </div>
    <p class="accounting-statement"><strong>${String(totalFindings)} ${pluralize(totalFindings, "finding")} represented.</strong> Larger risks and smaller improvements are both included in the business areas above.</p>
  </section>`;
}

function renderImpactGroup(
  result: AuditResult,
  outcome: BusinessOutcomeDefinition,
): string {
  const categories = FINDING_CATEGORIES.filter(
    (category) =>
      OUTCOME_BY_CATEGORY[category] === outcome.id &&
      result.findings.some((finding) => finding.category === category),
  );
  const findingCount = categories.reduce(
    (total, category) =>
      total + result.findings.filter((finding) => finding.category === category).length,
    0,
  );
  const categoryRows =
    categories.length === 0
      ? `<p class="group-empty">No improvements were identified in this business area.</p>`
      : `<div class="category-impact-list">${categories
          .map((category) => renderCategoryImpact(result, category))
          .join("")}</div>`;

  return `<section class="impact-group" data-outcome="${outcome.id}" aria-labelledby="impact-${outcome.id}">
    <header><div><h3 id="impact-${outcome.id}">${escapeHtml(outcome.label)}</h3><p>${escapeHtml(outcome.summary)}</p></div><strong>${String(findingCount)}</strong></header>
    ${categoryRows}
  </section>`;
}

function renderCategoryImpact(result: AuditResult, category: FindingCategory): string {
  const count = result.findings.filter((finding) => finding.category === category).length;
  return `<article class="category-impact" data-category="${category}" data-finding-count="${String(count)}">
    <div><h4>${CATEGORY_LABELS[category]}</h4><span>${String(count)} ${pluralize(count, "improvement")}</span></div>
    <p>${CATEGORY_BUSINESS_EFFECTS[category]}</p>
  </article>`;
}

function renderRecommendedWork(
  result: AuditResult,
  rankedFindings: readonly AuditFinding[],
): string {
  const failedPageCount = result.scannedPages.filter((page) => page.error !== undefined).length;
  return `<section class="client-page" aria-labelledby="recommended-work">
    ${pageHeader("Recommended order of work", "A focused sequence for protecting value now and improving the website over time.", "recommended-work")}
    <div class="action-phases">
      ${ACTION_PHASES.map((phase) => renderActionPhase(rankedFindings, phase)).join("")}
    </div>
    <section class="expected-result" aria-labelledby="expected-result">
      <h3 id="expected-result">The intended business result</h3>
      <p>${renderExpectedResult(result)}</p>
    </section>
    ${failedPageCount === 0 ? "" : `<p class="coverage-note">Some areas of the website could not be fully assessed, so these recommendations reflect the available information.</p>`}
  </section>`;
}

function renderActionPhase(
  rankedFindings: readonly AuditFinding[],
  phase: ActionPhase,
): string {
  const findings = rankedFindings
    .filter((finding) => phase.severities.includes(finding.severity))
    .slice(0, MAX_ACTIONS_BY_PHASE[phase.id]);
  const content =
    findings.length === 0
      ? `<p class="phase-empty">No specific actions are currently assigned to this stage.</p>`
      : `<ol>${findings.map(renderBusinessAction).join("")}</ol>`;
  return `<section class="action-phase action-phase--${phase.id}" aria-labelledby="phase-${phase.id}">
    <header><h3 id="phase-${phase.id}">${phase.label}</h3><p>${phase.objective}</p></header>
    ${content}
  </section>`;
}

function renderBusinessAction(finding: AuditFinding, index: number): string {
  return `<li>
    <span>${String(index + 1)}</span>
    <div class="action-title"><h4>${escapeHtml(compactText(finding.title, 120))}</h4><small>${CATEGORY_LABELS[finding.category]}</small></div>
    <div class="action-detail"><p><strong>Business effect:</strong> ${escapeHtml(compactText(finding.impact, 145))}</p><p><strong>Recommended change:</strong> ${escapeHtml(compactText(finding.recommendation, 155))}</p></div>
  </li>`;
}

function renderBusinessVerdict(result: AuditResult): string {
  const counts = result.summary.findingCounts;
  const actionableCount = getActionableCount(result);

  if (counts.critical > 0) {
    return `The website has issues that may directly affect customer trust, access, or important customer journeys. Address the most urgent changes before moving to lower-impact improvements.`;
  }
  if (counts.high > 0) {
    return `Several website issues could materially affect enquiries, visibility, trust, or customer experience. Prioritizing the highest-impact changes should produce the clearest business benefit.`;
  }
  if (actionableCount > 0) {
    return `The website has a workable foundation, with ${String(actionableCount)} recommended ${pluralize(actionableCount, "improvement")} that can reduce friction and strengthen business performance over time.`;
  }
  if (result.findings.length > 0) {
    return "The website has a workable foundation, with smaller opportunities to strengthen consistency and business performance over time.";
  }
  return "No immediate website improvements were identified. Continue reviewing real customer journeys and business performance as the website evolves.";
}

function renderExpectedResult(result: AuditResult): string {
  const represented = BUSINESS_OUTCOMES.filter(
    (outcome) => findingsForOutcome(result, outcome.id).length > 0,
  ).map((outcome) => outcome.label.toLowerCase());

  if (represented.length === 0) {
    return "Maintain a clear, accessible, trustworthy website and continue measuring how well it supports customers and business goals.";
  }

  return `Completing the recommended work should strengthen ${joinNaturalLanguage(represented)}. Results should be checked through customer feedback, journey completion, website performance, and business measurement where available.`;
}

function pageHeader(title: string, description: string, id: string): string {
  return `<header class="page-header"><div class="top-rule"></div><h2 id="${escapeHtml(id)}">${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></header>`;
}

function rankFindings(result: AuditResult): AuditFinding[] {
  const sorted = [...result.findings].sort(compareFindings);
  const selected = new Set<AuditFinding>();
  const ranked: AuditFinding[] = [];

  for (const title of result.summary.topPriorities) {
    const finding = sorted.find(
      (candidate) => !selected.has(candidate) && candidate.title === title,
    );
    if (finding !== undefined) {
      selected.add(finding);
      ranked.push(finding);
    }
  }

  for (const finding of sorted) {
    if (!selected.has(finding)) ranked.push(finding);
  }

  return ranked;
}

function compareFindings(left: AuditFinding, right: AuditFinding): number {
  return (
    (SEVERITY_ORDER.get(left.severity) ?? FINDING_SEVERITIES.length) -
      (SEVERITY_ORDER.get(right.severity) ?? FINDING_SEVERITIES.length) ||
    left.category.localeCompare(right.category) ||
    left.title.localeCompare(right.title) ||
    left.url.localeCompare(right.url) ||
    left.ruleId.localeCompare(right.ruleId)
  );
}

function findingsForOutcome(
  result: AuditResult,
  outcomeId: BusinessOutcomeId,
): AuditFinding[] {
  return result.findings.filter(
    (finding) => OUTCOME_BY_CATEGORY[finding.category] === outcomeId,
  );
}

function getBusinessStatus(findings: readonly AuditFinding[]): {
  readonly className: string;
  readonly label: string;
} {
  if (findings.some((finding) => finding.severity === "critical")) {
    return { className: "urgent", label: "Act now" };
  }
  if (findings.some((finding) => finding.severity === "high")) {
    return { className: "important", label: "Prioritize" };
  }
  if (findings.some((finding) => finding.severity === "medium")) {
    return { className: "next", label: "Improve next" };
  }
  if (findings.some((finding) => finding.severity === "low")) {
    return { className: "planned", label: "Plan ahead" };
  }
  if (findings.length > 0) return { className: "monitor", label: "Monitor" };
  return { className: "clear", label: "No issues identified" };
}

function getScoreBand(score: number): { readonly className: string; readonly label: string } {
  if (score >= 90) return { className: "strong", label: "Strong foundation" };
  if (score >= 75) return { className: "good", label: "Good foundation" };
  if (score >= 60) return { className: "attention", label: "Needs improvement" };
  return { className: "priority", label: "Priority work recommended" };
}

function getActionableCount(result: AuditResult): number {
  const counts = result.summary.findingCounts;
  return counts.critical + counts.high + counts.medium + counts.low;
}

function compactText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= limit) return normalized;

  const candidate = normalized.slice(0, limit - 3);
  const lastSpace = candidate.lastIndexOf(" ");
  const end = lastSpace >= Math.floor(limit * 0.7) ? lastSpace : candidate.length;
  return `${candidate.slice(0, end).trimEnd()}...`;
}

function joinNaturalLanguage(values: readonly string[]): string {
  if (values.length === 1) return values[0] ?? "website performance";
  if (values.length === 2) return `${values[0] ?? ""} and ${values[1] ?? ""}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1) ?? ""}`;
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function pluralize(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const CLIENT_SUMMARY_STYLES = String.raw`
:root {
  color-scheme: light;
  --paper: #ffffff;
  --ink: #152033;
  --muted: #5d697a;
  --rule: #d8e0ea;
  --soft: #f5f7fa;
  --primary: #1f5fbf;
  --primary-tint: #eaf2ff;
  --critical: #b42318;
  --critical-tint: #feeceb;
  --high: #c2410c;
  --high-tint: #fff0e6;
  --medium: #8a5200;
  --medium-tint: #fff6d8;
  --low: #176b52;
  --low-tint: #e8f7f1;
  --info: #36618f;
  --info-tint: #edf4fb;
}

* { box-sizing: border-box; }

html { background: var(--paper); }

body {
  margin: 0;
  color: var(--ink);
  background: var(--paper);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
  line-height: 1.45;
  letter-spacing: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

p, h1, h2, h3, h4 { margin-top: 0; }

.client-summary { width: 100%; }

.client-page {
  min-height: 248mm;
  padding-top: 2mm;
  break-after: page;
}

.client-page:last-child { break-after: auto; }
.client-page--opening { padding-top: 6mm; }

.top-rule { width: 100%; height: 2mm; margin-bottom: 5mm; background: var(--primary); }

.opening-header { margin-bottom: 5mm; }
.document-type { margin-bottom: 2mm; color: var(--primary); font-size: 9pt; font-weight: 700; }
.opening-header h1 { max-width: 155mm; margin-bottom: 2mm; font-size: 27pt; line-height: 1.08; letter-spacing: 0; text-wrap: balance; }
.site-name { display: -webkit-box; max-width: 155mm; margin-bottom: 0; overflow: hidden; color: var(--muted); font-size: 16pt; line-height: 1.25; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }

.overview-band { display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 6mm; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.overview-band > div { min-height: 20mm; padding: 3mm 5mm; border-right: 1px solid var(--rule); }
.overview-band > div:last-child { border-right: 0; }
.overview-band span, .overview-band small { display: block; color: var(--muted); font-size: 8pt; }
.overview-band strong { display: block; margin: 1mm 0; font-size: 17pt; line-height: 1.1; }

.business-verdict { margin-bottom: 5mm; padding: 4mm 6mm; border: 1px solid #bdd0eb; border-radius: 6px; background: var(--primary-tint); }
.business-verdict h2 { margin-bottom: 1.5mm; color: #244a79; font-size: 12.5pt; }
.business-verdict p { max-width: 145mm; margin-bottom: 0; color: #244a79; font-size: 9.5pt; line-height: 1.45; }

.client-page h2 { margin-bottom: 2mm; font-size: 14pt; line-height: 1.25; }
.outcome-overview { margin-bottom: 5mm; border-top: 1px solid var(--rule); }
.outcome-row { display: grid; grid-template-columns: 1fr 42mm; gap: 6mm; align-items: center; min-height: 17mm; padding: 2mm 0; border-bottom: 1px solid var(--rule); break-inside: avoid; }
.outcome-row h3 { margin-bottom: 0.5mm; font-size: 9.8pt; }
.outcome-row p { max-width: 110mm; margin-bottom: 0; color: var(--muted); font-size: 8.2pt; line-height: 1.35; }
.outcome-result { display: grid; grid-template-columns: 10mm 1fr; align-items: baseline; }
.outcome-result > strong { font-size: 15pt; }
.outcome-result > span { color: var(--muted); font-size: 8pt; }
.business-status { grid-column: 1 / -1; justify-self: start; margin-top: 1mm; padding: 0.7mm 2mm; border-radius: 4px; font-size: 7.5pt; font-style: normal; font-weight: 700; }
.business-status--urgent { color: var(--critical); background: var(--critical-tint); }
.business-status--important { color: var(--high); background: var(--high-tint); }
.business-status--next { color: var(--medium); background: var(--medium-tint); }
.business-status--planned, .business-status--clear { color: var(--low); background: var(--low-tint); }
.business-status--monitor { color: var(--info); background: var(--info-tint); }

.focus-section h2 { margin-bottom: 2mm; }
.focus-section ol, .action-phase ol { margin: 0; padding: 0; list-style: none; }
.focus-section li { display: grid; grid-template-columns: 9mm 58mm 1fr; gap: 3mm; align-items: start; padding: 2mm 0; border-bottom: 1px solid var(--rule); break-inside: avoid; }
.priority-rank { display: flex; width: 7mm; height: 7mm; align-items: center; justify-content: center; border-radius: 50%; color: #ffffff; background: var(--primary); font-size: 7.5pt; font-weight: 700; }
.focus-section h3 { display: -webkit-box; margin-bottom: 0; overflow: hidden; font-size: 9pt; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.focus-section li p { display: -webkit-box; margin-bottom: 0; overflow: hidden; color: var(--muted); font-size: 8.2pt; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.empty-state, .group-empty, .phase-empty { margin-bottom: 0; padding: 4mm; border: 1px solid var(--rule); border-radius: 6px; color: var(--muted); background: var(--soft); font-size: 9pt; }

.page-header { margin-bottom: 4mm; }
.page-header h2 { margin-bottom: 1.5mm; font-size: 21pt; line-height: 1.15; letter-spacing: 0; text-wrap: balance; }
.page-header p { max-width: 135mm; margin-bottom: 0; color: var(--muted); font-size: 9.5pt; }

.impact-groups { border-top: 1px solid var(--rule); }
.impact-group { padding: 2mm 0; border-bottom: 1px solid var(--rule); break-inside: avoid; }
.impact-group > header { display: grid; grid-template-columns: 1fr 13mm; gap: 5mm; align-items: start; margin-bottom: 1.5mm; }
.impact-group > header h3 { margin-bottom: 0.5mm; font-size: 11.5pt; }
.impact-group > header p { margin-bottom: 0; color: var(--muted); font-size: 7.6pt; }
.impact-group > header > strong { color: var(--primary); font-size: 17pt; line-height: 1; text-align: right; }
.category-impact-list { display: grid; }
.category-impact { display: grid; grid-template-columns: 45mm 1fr; gap: 5mm; padding: 1.2mm 0; border-top: 1px solid #e8edf3; break-inside: avoid; }
.category-impact h4 { margin-bottom: 0.3mm; font-size: 8.3pt; }
.category-impact span { color: var(--muted); font-size: 7.5pt; }
.category-impact p { margin-bottom: 0; color: #34435a; font-size: 7.8pt; line-height: 1.3; }
.group-empty { padding: 2.5mm 3mm; font-size: 8pt; }
.accounting-statement { margin-top: 3mm; margin-bottom: 0; padding: 3mm 4mm; border: 1px solid #bdd0eb; border-radius: 6px; color: #244a79; background: var(--primary-tint); font-size: 8.4pt; }

.action-phases { margin-bottom: 4mm; border-top: 1px solid var(--rule); }
.action-phase { padding: 2.5mm 0; border-bottom: 1px solid var(--rule); break-inside: avoid; }
.action-phase > header { display: grid; grid-template-columns: 38mm 1fr; gap: 5mm; align-items: baseline; margin-bottom: 1mm; }
.action-phase > header h3 { margin-bottom: 0; color: var(--primary); font-size: 12pt; }
.action-phase > header p { margin-bottom: 0; color: var(--muted); font-size: 8.5pt; }
.action-phase li { display: grid; grid-template-columns: 7mm 48mm 1fr; gap: 4mm; padding: 1.8mm 0; border-top: 1px solid #e8edf3; break-inside: avoid; }
.action-phase li > span { display: flex; width: 6mm; height: 6mm; align-items: center; justify-content: center; border: 1px solid var(--rule); border-radius: 50%; color: var(--muted); font-size: 7pt; font-weight: 700; }
.action-title h4 { display: -webkit-box; margin-bottom: 0.4mm; overflow: hidden; font-size: 8.3pt; line-height: 1.3; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.action-title small { color: var(--muted); font-size: 7.3pt; }
.action-detail p { display: -webkit-box; margin-bottom: 0.7mm; overflow: hidden; color: #34435a; font-size: 7.5pt; line-height: 1.32; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.action-detail p:last-child { margin-bottom: 0; }
.action-detail strong { color: var(--ink); }
.phase-empty { padding: 2.5mm 3mm; font-size: 8pt; }

.expected-result { margin-top: 3mm; padding: 4mm 6mm; border: 1px solid #bdd0eb; border-radius: 6px; background: var(--primary-tint); }
.expected-result h3 { margin-bottom: 1.5mm; color: #244a79; font-size: 11pt; }
.expected-result p { margin-bottom: 0; color: #244a79; font-size: 8.7pt; }
.coverage-note { margin-top: 3mm; margin-bottom: 0; padding: 2.5mm 4mm; border: 1px solid #ead39c; border-radius: 6px; color: #694100; background: var(--medium-tint); font-size: 8pt; }

@page { size: A4; }

@media print {
  html, body { background: #ffffff; }
  .client-page { min-height: 248mm; }
}
`;
