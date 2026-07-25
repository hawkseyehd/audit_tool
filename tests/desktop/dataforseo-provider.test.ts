import { describe, expect, it, vi } from "vitest";

import { searchDataForSeoBusinesses } from "../../src/discovery/dataforseo-provider.js";
import type { ProviderSearchInput } from "../../src/discovery/provider-contracts.js";

const input: ProviderSearchInput = {
  category: "dental_clinic",
  country: "PK",
  exclusions: ["blocked"],
  keywords: [],
  limit: 10,
  locality: "Karachi",
  requireWebsite: true,
};

function successResponse(): Response {
  return Response.json({
    status_code: 20000,
    status_message: "Ok.",
    tasks: [
      {
        result: [
          {
            count: 2,
            items: [
              {
                address: "Clifton, Karachi",
                address_info: {
                  address: "12 Sea View Road",
                  city: "Karachi",
                  country_code: "PK",
                  region: "Sindh",
                  zip: "75600",
                },
                category: "Dental clinic",
                check_url: "https://example.test/source/1",
                description: "Must not be retained",
                phone: "+92 21 555 0100",
                place_id: "place-1",
                rating: { value: 4.8 },
                title: "Northstar Dental",
                url: "https://northstar.example/",
              },
              {
                address: "Blocked district",
                place_id: "place-2",
                title: "Blocked Dental",
                url: "https://blocked.example/",
              },
            ],
            offset_token: "next-page",
            total_count: 200,
          },
        ],
        status_code: 20000,
        status_message: "Ok.",
      },
    ],
  });
}

describe("DataForSEO business listings adapter", () => {
  it("maps only approved public fields and applies exclusions", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(successResponse());
    const page = await searchDataForSeoBusinesses(input, {
      credentials: { login: "account", password: "secret" },
      fetchImplementation,
    });

    expect(page).toEqual({
      continuationToken: "next-page",
      providerRequestCount: 1,
      records: [
        {
          addressLine: "12 Sea View Road",
          businessName: "Northstar Dental",
          category: "Dental clinic",
          country: "PK",
          locality: "Karachi",
          postalCode: "75600",
          providerRecordId: "place-1",
          publicPhone: "+92 21 555 0100",
          region: "Sindh",
          sourceUrl: "https://example.test/source/1",
          websiteUrl: "https://northstar.example/",
        },
      ],
      totalAvailable: 200,
    });
    const request = fetchImplementation.mock.calls[0];
    expect(request?.[0]).toBe(
      "https://api.dataforseo.com/v3/business_data/business_listings/search/live",
    );
    expect(String((request?.[1]?.headers as Record<string, string>).Authorization)).not.toContain(
      "secret",
    );
  });

  it("retries transient HTTP failures with a bounded attempt count", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(successResponse());
    const page = await searchDataForSeoBusinesses(input, {
      credentials: { login: "account", password: "secret" },
      fetchImplementation,
    });

    expect(page.providerRequestCount).toBe(2);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });
});
