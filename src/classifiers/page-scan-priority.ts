import type { PageType, ScannedPage } from "../core/types.js";

const PAGE_SCAN_PRIORITIES: Readonly<Record<PageType, number>> = {
  home: 1_000,
  contact: 950,
  pricing: 940,
  checkout: 930,
  booking: 920,
  auth: 910,
  product: 850,
  service: 840,
  form: 830,
  about: 500,
  blog: 400,
  unknown: 100,
};

export function getPageScanPriority(pageType: PageType): number {
  return PAGE_SCAN_PRIORITIES[pageType];
}

export function prioritizePagesForScanning<T extends Pick<ScannedPage, "pageType">>(
  pages: readonly T[],
): T[] {
  return pages
    .map((page, index) => ({ index, page }))
    .sort(
      (left, right) =>
        getPageScanPriority(right.page.pageType) - getPageScanPriority(left.page.pageType) ||
        left.index - right.index,
    )
    .map(({ page }) => page);
}
