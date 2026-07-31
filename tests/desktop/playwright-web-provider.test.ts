import { describe, expect, it, vi } from "vitest";

import {
  searchPlaywrightWebBusinesses,
  type PlaywrightWebSession,
} from "../../src/discovery/playwright-web-provider.js";
import type { ProviderSearchInput } from "../../src/discovery/provider-contracts.js";

const input: ProviderSearchInput = {
  category: "dentist",
  country: "PK",
  exclusions: ["blocked"],
  keywords: ["orthodontist"],
  limit: 2,
  locality: "Karachi",
  region: "Sindh",
  requireWebsite: false,
};

describe("Playwright web discovery provider", () => {
  it("reads rendered candidates and imports public details from official websites", async () => {
    const fixture = createSession({
      candidates: [
        { title: "Northstar Dental | Official site", url: "https://northstar.example/" },
        { title: "Blocked Dental", url: "https://blocked.example/" },
        { title: "Harbour Orthodontics", url: "https://harbour.example/" },
      ],
      details: new Map([
        [
          "northstar.example",
          {
            addressLine: "12 Sea View Road",
            businessName: "Northstar Dental",
            publicPhone: "+92 21 555 0100",
            sourceUrl: "https://www.google.com/maps/place/Northstar+Dental",
            websiteUrl: "https://northstar.example/",
          },
        ],
        [
          "blocked.example",
          {
            businessName: "Blocked Dental",
            sourceUrl: "https://www.google.com/maps/place/Blocked+Dental",
            websiteUrl: "https://blocked.example/",
          },
        ],
        [
          "harbour.example",
          {
            businessName: "Harbour Orthodontics",
            sourceUrl: "https://www.google.com/maps/place/Harbour+Orthodontics",
            websiteUrl: "https://harbour.example/",
          },
        ],
      ]),
    });

    const result = await searchPlaywrightWebBusinesses(input, {
      createSession: () => Promise.resolve(fixture.session),
      pause: () => Promise.resolve(),
    });

    expect(result.records).toEqual([
      {
        addressLine: "12 Sea View Road",
        businessName: "Northstar Dental",
        category: "dentist",
        country: "PK",
        locality: "Karachi",
        providerRecordId: "northstar.example",
        publicPhone: "+92 21 555 0100",
        region: "Sindh",
        sourceUrl: "https://www.google.com/maps/place/Northstar+Dental",
        websiteUrl: "https://northstar.example/",
      },
      {
        businessName: "Harbour Orthodontics",
        category: "dentist",
        country: "PK",
        locality: "Karachi",
        providerRecordId: "harbour.example",
        region: "Sindh",
        sourceUrl: "https://www.google.com/maps/place/Harbour+Orthodontics",
        websiteUrl: "https://harbour.example/",
      },
    ]);
    expect(fixture.search).toHaveBeenCalledWith(
      "dentist orthodontist in Karachi, Sindh, PK",
      0,
      6,
      undefined,
    );
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("continues safely after an unreadable website and always closes Chromium", async () => {
    const fixture = createSession({
      candidates: [
        { title: "Unavailable Practice", url: "https://unavailable.example/" },
        { title: "Working Practice", url: "https://working.example/" },
      ],
      details: new Map([
        [
          "working.example",
          {
            sourceUrl: "https://www.google.com/maps/place/Working+Practice",
            websiteUrl: "https://working.example/",
          },
        ],
      ]),
    });

    const result = await searchPlaywrightWebBusinesses(
      { ...input, exclusions: [], limit: 1 },
      {
        createSession: () => Promise.resolve(fixture.session),
        pause: () => Promise.resolve(),
      },
    );

    expect(result.records[0]).toMatchObject({
      businessName: "Working Practice",
      websiteUrl: "https://working.example/",
    });
    expect(result.warning).toContain("could not be read");
    expect(fixture.close).toHaveBeenCalledOnce();
  });

  it("keeps a website-less business with public contact details", async () => {
    const fixture = createSession({
      candidates: [
        {
          title: "Civic Dental Studio",
          url: "https://www.google.com/maps/place/Civic+Dental+Studio",
        },
      ],
      details: new Map([
        [
          "www.google.com",
          {
            addressLine: "14 Civic Centre",
            businessName: "Civic Dental Studio",
            publicEmail: "hello@civicdental.example",
            publicPhone: "+92 300 555 0101",
            socialProfiles: ["https://www.linkedin.com/company/civic-dental-studio/"],
            sourceUrl: "https://www.google.com/maps/place/Civic+Dental+Studio",
          },
        ],
      ]),
    });

    const result = await searchPlaywrightWebBusinesses(
      { ...input, exclusions: [], limit: 1 },
      {
        createSession: () => Promise.resolve(fixture.session),
        pause: () => Promise.resolve(),
      },
    );

    expect(result.records[0]).toMatchObject({
      businessName: "Civic Dental Studio",
      publicEmail: "hello@civicdental.example",
      publicPhone: "+92 300 555 0101",
      socialProfiles: ["https://www.linkedin.com/company/civic-dental-studio/"],
    });
    expect(result.records[0]).not.toHaveProperty("websiteUrl");
  });
});

function createSession(options: {
  candidates: readonly { title: string; url: string }[];
  details: ReadonlyMap<
    string,
    {
      addressLine?: string;
      businessName?: string;
      publicEmail?: string;
      publicPhone?: string;
      socialProfiles?: readonly string[];
      sourceUrl: string;
      websiteUrl?: string;
    }
  >;
}): {
  close: ReturnType<typeof vi.fn>;
  inspect: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
  session: PlaywrightWebSession;
} {
  const close = vi.fn(() => Promise.resolve());
  const inspect = vi.fn((candidate: { url: string }) => {
    const hostname = new URL(candidate.url).hostname;
    const details = options.details.get(hostname);
    return details === undefined
      ? Promise.reject(new Error("Website unavailable"))
      : Promise.resolve(details);
  });
  const search = vi.fn(() => Promise.resolve(options.candidates));
  return {
    close,
    inspect,
    search,
    session: { close, inspect, search },
  };
}
