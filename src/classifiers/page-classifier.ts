import type { PageType } from "../core/types.js";

export const CLASSIFICATION_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type ClassificationConfidence = (typeof CLASSIFICATION_CONFIDENCE_LEVELS)[number];

export interface PageClassificationInput {
  readonly autocompleteValues?: readonly string[];
  readonly formActions?: readonly string[];
  readonly formCount?: number;
  readonly headings?: readonly string[];
  readonly inputNames?: readonly string[];
  readonly inputTypes?: readonly string[];
  readonly interactiveLabels?: readonly string[];
  readonly title?: string;
  readonly url: string;
}

export interface PageClassification {
  readonly confidence: ClassificationConfidence;
  readonly matchedSignals: readonly string[];
  readonly pageType: PageType;
  readonly score: number;
}

interface ClassificationRule {
  readonly pageType: Exclude<PageType, "home" | "form" | "unknown">;
  readonly patterns: readonly RegExp[];
}

interface ScoredClassification {
  readonly matchedSignals: Set<string>;
  readonly pageType: ClassificationRule["pageType"] | "form";
  score: number;
}

// Rule order is the deterministic tie-break precedence for equally strong evidence.
const CLASSIFICATION_RULES: readonly ClassificationRule[] = [
  {
    pageType: "checkout",
    patterns: [/(?:^|\s)(?:checkout|cart|basket|payment|billing)(?:\s|$)/u],
  },
  {
    pageType: "booking",
    patterns: [
      /(?:^|\s)(?:booking|appointment|reservation|reserve)(?:\s|$)/u,
      /(?:^|\s)(?:book|schedule)(?:\s+(?:a|an|your))?(?:\s|$)/u,
    ],
  },
  {
    pageType: "auth",
    patterns: [
      /(?:^|\s)(?:login|signin|signup|register|registration)(?:\s|$)/u,
      /(?:^|\s)(?:log|sign)\s+(?:in|up)(?:\s|$)/u,
      /(?:^|\s)(?:forgot|reset)\s+password(?:\s|$)/u,
      /(?:^|\s)create\s+account(?:\s|$)/u,
    ],
  },
  {
    pageType: "contact",
    patterns: [/(?:^|\s)contact(?:\s+us)?(?:\s|$)/u, /(?:^|\s)get\s+in\s+touch(?:\s|$)/u],
  },
  {
    pageType: "pricing",
    patterns: [/(?:^|\s)(?:pricing|plans|packages)(?:\s|$)/u],
  },
  {
    pageType: "product",
    patterns: [/(?:^|\s)(?:product|products|shop|store|catalog)(?:\s|$)/u],
  },
  {
    pageType: "service",
    patterns: [/(?:^|\s)(?:service|services|solution|solutions|offerings)(?:\s|$)/u],
  },
  {
    pageType: "about",
    patterns: [
      /(?:^|\s)about(?:\s+us)?(?:\s|$)/u,
      /(?:^|\s)(?:our\s+story|who\s+we\s+are)(?:\s|$)/u,
      /(?:^|\s)meet\s+(?:our|the)\s+team(?:\s|$)/u,
    ],
  },
  {
    pageType: "blog",
    patterns: [/(?:^|\s)(?:blog|news|article|articles|insights)(?:\s|$)/u],
  },
];

const PATH_WEIGHT = 8;
const TITLE_WEIGHT = 5;
const HEADING_WEIGHT = 4;
const FORM_ACTION_WEIGHT = 5;
const INTERACTIVE_LABEL_WEIGHT = 5;

export function classifyPage(input: PageClassificationInput): PageClassification {
  const url = new URL(input.url);
  if (url.pathname === "/" || url.pathname.length === 0) {
    return {
      confidence: "high",
      matchedSignals: ["url:root"],
      pageType: "home",
      score: 100,
    };
  }

  const classifications = CLASSIFICATION_RULES.map<ScoredClassification>((rule) => ({
    matchedSignals: new Set<string>(),
    pageType: rule.pageType,
    score: 0,
  }));
  const byType = new Map(
    classifications.map((classification) => [classification.pageType, classification]),
  );
  const normalizedPath = normalizeText(safeDecode(url.pathname));
  const normalizedTitle = normalizeText(input.title ?? "");
  const normalizedHeadings = normalizeTexts(input.headings);
  const normalizedActions = normalizeTexts(input.formActions);
  const normalizedLabels = normalizeTexts(input.interactiveLabels);

  for (const rule of CLASSIFICATION_RULES) {
    const classification = byType.get(rule.pageType);
    if (classification === undefined) {
      continue;
    }

    addTextSignal(classification, rule.patterns, normalizedPath, PATH_WEIGHT, "url:path");
    addTextSignal(classification, rule.patterns, normalizedTitle, TITLE_WEIGHT, "title");
    addCollectionSignal(
      classification,
      rule.patterns,
      normalizedHeadings,
      HEADING_WEIGHT,
      "heading",
    );
    addCollectionSignal(
      classification,
      rule.patterns,
      normalizedActions,
      FORM_ACTION_WEIGHT,
      "form:action",
    );
    addCollectionSignal(
      classification,
      rule.patterns,
      normalizedLabels,
      INTERACTIVE_LABEL_WEIGHT,
      "ui:label",
    );
  }

  addControlSignals(byType, input);

  if ((input.formCount ?? 0) > 0) {
    classifications.push({
      matchedSignals: new Set(["form:present"]),
      pageType: "form",
      score: 4,
    });
  }

  const best = classifications.reduce<ScoredClassification | undefined>((selected, candidate) => {
    if (candidate.score === 0) {
      return selected;
    }
    if (selected === undefined || candidate.score > selected.score) {
      return candidate;
    }
    return selected;
  }, undefined);

  if (best === undefined) {
    return { confidence: "low", matchedSignals: [], pageType: "unknown", score: 0 };
  }

  return {
    confidence: confidenceForScore(best.score),
    matchedSignals: [...best.matchedSignals],
    pageType: best.pageType,
    score: best.score,
  };
}

function addControlSignals(
  classifications: ReadonlyMap<string, ScoredClassification>,
  input: PageClassificationInput,
): void {
  const inputTypes = new Set(normalizeTexts(input.inputTypes));
  const inputNames = normalizeTexts(input.inputNames);
  const autocompleteValues = normalizeTexts(input.autocompleteValues);

  if (
    inputTypes.has("password") ||
    includesPattern(autocompleteValues, /(?:^|\s)(?:current|new) password(?:\s|$)/u)
  ) {
    addScore(classifications.get("auth"), 10, "control:password");
  }

  if (
    includesPattern(autocompleteValues, /(?:^|\s)cc (?:name|number|exp|csc|type)(?:\s|$)/u) ||
    includesPattern(inputNames, /(?:^|\s)(?:card|payment|billing)(?:\s|$)/u)
  ) {
    addScore(classifications.get("checkout"), 10, "control:payment");
  }

  if (
    (input.formCount ?? 0) > 0 &&
    (inputTypes.has("date") || inputTypes.has("datetime local") || inputTypes.has("time"))
  ) {
    addScore(classifications.get("booking"), 7, "control:scheduling");
  }
}

function addTextSignal(
  classification: ScoredClassification,
  patterns: readonly RegExp[],
  text: string,
  weight: number,
  reason: string,
): void {
  if (text.length > 0 && patterns.some((pattern) => pattern.test(text))) {
    addScore(classification, weight, reason);
  }
}

function addCollectionSignal(
  classification: ScoredClassification,
  patterns: readonly RegExp[],
  texts: readonly string[],
  weight: number,
  reason: string,
): void {
  if (patterns.some((pattern) => includesPattern(texts, pattern))) {
    addScore(classification, weight, reason);
  }
}

function addScore(
  classification: ScoredClassification | undefined,
  score: number,
  reason: string,
): void {
  if (classification === undefined || classification.matchedSignals.has(reason)) {
    return;
  }
  classification.score += score;
  classification.matchedSignals.add(reason);
}

function includesPattern(texts: readonly string[], pattern: RegExp): boolean {
  return texts.some((text) => pattern.test(text));
}

function normalizeTexts(texts: readonly string[] | undefined): string[] {
  return (texts ?? []).map(normalizeText).filter((text) => text.length > 0);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}_]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function confidenceForScore(score: number): ClassificationConfidence {
  if (score >= 12) {
    return "high";
  }
  if (score >= 7) {
    return "medium";
  }
  return "low";
}
