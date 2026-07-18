import { load } from "cheerio";

import type { PageClassificationInput } from "../classifiers/page-classifier.js";
import {
  evaluateCrawlCandidate,
  type CrawlRejectionReason,
  type CrawlScope,
} from "../url/crawl-scope.js";

const MAX_LINKS_PER_PAGE = 1_000;
const MAX_HEADINGS_PER_PAGE = 50;
const MAX_FORMS_PER_PAGE = 100;
const MAX_CONTROLS_PER_PAGE = 250;
const MAX_INTERACTIVE_LABELS_PER_PAGE = 100;
const MAX_SIGNAL_LENGTH = 300;

export type PageClassificationSignals = Omit<PageClassificationInput, "title" | "url">;

export interface ExtractedPage {
  readonly classificationSignals: PageClassificationSignals;
  readonly title?: string;
  readonly links: readonly string[];
  readonly rejectionCounts: Readonly<Partial<Record<CrawlRejectionReason, number>>>;
}

export function extractPageLinks(html: string, pageUrl: string, scope: CrawlScope): ExtractedPage {
  const document = load(html);
  const titleText = document("title").first().text().replace(/\s+/gu, " ").trim();
  const links = new Set<string>();
  const rejectionCounts: Partial<Record<CrawlRejectionReason, number>> = {};

  document("a[href], area[href]").each((_index, element) => {
    const href = document(element).attr("href");
    if (href === undefined) {
      return;
    }

    const decision = evaluateCrawlCandidate(href, pageUrl, scope);
    if (decision.accepted) {
      if (!links.has(decision.url) && links.size >= MAX_LINKS_PER_PAGE) {
        rejectionCounts["link-limit"] = (rejectionCounts["link-limit"] ?? 0) + 1;
        return;
      }
      links.add(decision.url);
      return;
    }

    rejectionCounts[decision.reason] = (rejectionCounts[decision.reason] ?? 0) + 1;
  });

  return {
    classificationSignals: extractClassificationSignals(document),
    ...(titleText.length > 0 ? { title: titleText } : {}),
    links: [...links],
    rejectionCounts,
  };
}

function extractClassificationSignals(
  document: ReturnType<typeof load>,
): PageClassificationSignals {
  const forms = document("form");
  const formCount = Math.min(forms.length, MAX_FORMS_PER_PAGE);
  const formActions = collectAttributes(document, "form[action]", "action", MAX_FORMS_PER_PAGE);
  const inputTypes = collectAttributes(document, "input[type]", "type", MAX_CONTROLS_PER_PAGE);
  const inputNames = collectAttributes(
    document,
    "input[name], select[name], textarea[name]",
    "name",
    MAX_CONTROLS_PER_PAGE,
  );
  const autocompleteValues = collectAttributes(
    document,
    "input[autocomplete], select[autocomplete], textarea[autocomplete]",
    "autocomplete",
    MAX_CONTROLS_PER_PAGE,
  );
  const headings = collectElementText(document, "h1, h2, h3", MAX_HEADINGS_PER_PAGE);
  const interactiveLabels = collectInteractiveLabels(document);

  return {
    autocompleteValues,
    formActions,
    formCount,
    headings,
    inputNames,
    inputTypes,
    interactiveLabels,
  };
}

function collectAttributes(
  document: ReturnType<typeof load>,
  selector: string,
  attribute: string,
  limit: number,
): string[] {
  const values = new Set<string>();
  document(selector)
    .slice(0, limit)
    .each((_index, element) => {
      const value = cleanSignal(document(element).attr(attribute));
      if (value !== undefined) {
        values.add(value);
      }
    });
  return [...values];
}

function collectElementText(
  document: ReturnType<typeof load>,
  selector: string,
  limit: number,
): string[] {
  const values = new Set<string>();
  document(selector)
    .slice(0, limit)
    .each((_index, element) => {
      const value = cleanSignal(document(element).text());
      if (value !== undefined) {
        values.add(value);
      }
    });
  return [...values];
}

function collectInteractiveLabels(document: ReturnType<typeof load>): string[] {
  const labels = new Set(
    collectElementText(
      document,
      "button, [role='button'], input[type='submit'], input[type='button']",
      MAX_INTERACTIVE_LABELS_PER_PAGE,
    ),
  );

  document("button[aria-label], [role='button'][aria-label], input[type='submit'][value]")
    .slice(0, MAX_INTERACTIVE_LABELS_PER_PAGE)
    .each((_index, element) => {
      const label = cleanSignal(
        document(element).attr("aria-label") ?? document(element).attr("value"),
      );
      if (label !== undefined && labels.size < MAX_INTERACTIVE_LABELS_PER_PAGE) {
        labels.add(label);
      }
    });

  return [...labels];
}

function cleanSignal(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim().slice(0, MAX_SIGNAL_LENGTH);
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}
