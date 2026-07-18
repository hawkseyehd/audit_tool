import { auditSummarySchema } from "../core/schemas.js";
import type {
  AuditFinding,
  AuditSummary,
  FindingCategory,
  FindingCounts,
  FindingSeverity,
} from "../core/types.js";

export const SCORE_CATEGORIES = [
  "performance",
  "accessibility",
  "formsAndConversionUx",
  "seo",
  "securityPrivacy",
  "technicalContentQuality",
] as const;

export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

export const SEVERITY_PENALTIES = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
} as const satisfies Readonly<Record<FindingSeverity, number>>;

export const SCORE_CATEGORY_WEIGHTS = {
  performance: 0.2,
  accessibility: 0.2,
  formsAndConversionUx: 0.2,
  seo: 0.15,
  securityPrivacy: 0.15,
  technicalContentQuality: 0.1,
} as const satisfies Readonly<Record<ScoreCategory, number>>;

export const FINDING_CATEGORY_SCORE_GROUPS = {
  performance: "performance",
  accessibility: "accessibility",
  forms: "formsAndConversionUx",
  ux: "formsAndConversionUx",
  business: "formsAndConversionUx",
  seo: "seo",
  security: "securityPrivacy",
  privacy: "securityPrivacy",
  technical: "technicalContentQuality",
  analytics: "technicalContentQuality",
} as const satisfies Readonly<Record<FindingCategory, ScoreCategory>>;

export type ScoreCategoryScores = Readonly<Record<ScoreCategory, number>>;

export function calculateAuditSummary(findings: readonly AuditFinding[]): AuditSummary {
  const categoryScores = calculateCategoryScores(findings);
  const overallScore = roundScore(
    SCORE_CATEGORIES.reduce(
      (score, category) => score + categoryScores[category] * SCORE_CATEGORY_WEIGHTS[category],
      0,
    ),
  );

  return auditSummarySchema.parse({
    overallScore: clampScore(overallScore),
    categoryScores,
    findingCounts: countFindings(findings),
    topPriorities: selectTopPriorities(findings),
  });
}

export function calculateCategoryScores(findings: readonly AuditFinding[]): ScoreCategoryScores {
  return {
    performance: calculateCategoryScore(findings, "performance"),
    accessibility: calculateCategoryScore(findings, "accessibility"),
    formsAndConversionUx: calculateCategoryScore(findings, "formsAndConversionUx"),
    seo: calculateCategoryScore(findings, "seo"),
    securityPrivacy: calculateCategoryScore(findings, "securityPrivacy"),
    technicalContentQuality: calculateCategoryScore(findings, "technicalContentQuality"),
  };
}

export function countFindings(findings: readonly AuditFinding[]): FindingCounts {
  const counts: FindingCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const finding of findings) counts[finding.severity] += 1;

  return counts;
}

export function selectTopPriorities(findings: readonly AuditFinding[], limit = 10): string[] {
  const priorities: string[] = [];
  const seenTitles = new Set<string>();
  const boundedLimit = Math.max(0, Math.min(20, Math.floor(limit)));
  if (boundedLimit === 0) return priorities;
  const actionable = [...findings]
    .filter((finding) => SEVERITY_PENALTIES[finding.severity] > 0)
    .sort(comparePriority);

  for (const finding of actionable) {
    if (seenTitles.has(finding.title)) continue;
    seenTitles.add(finding.title);
    priorities.push(finding.title.slice(0, 200).trim());
    if (priorities.length >= boundedLimit) break;
  }

  return priorities;
}

function calculateCategoryScore(
  findings: readonly AuditFinding[],
  scoreCategory: ScoreCategory,
): number {
  const penalties = findings.reduce(
    (total, finding) =>
      FINDING_CATEGORY_SCORE_GROUPS[finding.category] === scoreCategory
        ? total + SEVERITY_PENALTIES[finding.severity]
        : total,
    0,
  );

  return clampScore(100 - penalties);
}

function comparePriority(left: AuditFinding, right: AuditFinding): number {
  const severityOrder = SEVERITY_PENALTIES[right.severity] - SEVERITY_PENALTIES[left.severity];
  if (severityOrder !== 0) return severityOrder;

  const categoryOrder =
    SCORE_CATEGORY_WEIGHTS[FINDING_CATEGORY_SCORE_GROUPS[right.category]] -
    SCORE_CATEGORY_WEIGHTS[FINDING_CATEGORY_SCORE_GROUPS[left.category]];
  if (categoryOrder !== 0) return categoryOrder;

  return (
    compareText(left.title, right.title) ||
    compareText(left.url, right.url) ||
    compareText(left.id, right.id)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}
