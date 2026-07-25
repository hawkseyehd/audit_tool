import {
  ArrowLeft,
  Ban,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  LoaderCircle,
  MapPin,
  Plus,
  RotateCcw,
  SearchCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  CAMPAIGN_STATES,
  discoveryCampaignInputSchema,
  type CampaignState,
  type DiscoveryCampaignListQuery,
  type DiscoveryCampaignListResult,
  type DiscoveryCampaignRecord,
  type DiscoveryProvider,
} from "../../shared/contracts.js";

const defaultQuery: DiscoveryCampaignListQuery = {
  page: 1,
  pageSize: 10,
  state: "all",
};

const campaignStateLabels: Record<CampaignState, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  draft: "Draft",
  failed: "Failed",
  paused: "Paused",
  queued: "Queued",
  running: "Running",
};

type CampaignListState =
  | { type: "loading" }
  | { message: string; type: "error" }
  | { result: DiscoveryCampaignListResult; type: "ready" };

interface CampaignFormState {
  addressRequired: boolean;
  category: string;
  country: string;
  exclusions: string;
  keywords: string;
  latitude: string;
  locality: string;
  longitude: string;
  maxResults: number;
  name: string;
  phoneRequired: boolean;
  radiusEnabled: boolean;
  radiusKm: number;
  region: string;
  requireWebsite: boolean;
}

const initialForm: CampaignFormState = {
  addressRequired: false,
  category: "",
  country: "",
  exclusions: "",
  keywords: "",
  latitude: "",
  locality: "",
  longitude: "",
  maxResults: 100,
  name: "",
  phoneRequired: false,
  radiusEnabled: false,
  radiusKm: 10,
  region: "",
  requireWebsite: true,
};

function CampaignStatus(props: { state: CampaignState }): React.JSX.Element {
  return (
    <span className={`campaign-status campaign-status-${props.state}`}>
      {props.state === "running" && <LoaderCircle aria-hidden="true" className="spin" size={13} />}
      {campaignStateLabels[props.state]}
    </span>
  );
}

function CampaignForm(props: {
  onCancel: () => void;
  onCreated: () => void;
  provider: DiscoveryProvider;
}): React.JSX.Element {
  const [form, setForm] = useState<CampaignFormState>(initialForm);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const set = <Key extends keyof CampaignFormState>(
    key: Key,
    value: CampaignFormState[Key],
  ): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    const requiredFields = [
      "businessName" as const,
      ...(form.requireWebsite ? (["websiteUrl"] as const) : []),
      ...(form.phoneRequired ? (["publicPhone"] as const) : []),
      ...(form.addressRequired ? (["addressLine"] as const) : []),
    ];
    const parsed = discoveryCampaignInputSchema.safeParse({
      category: form.category,
      country: form.country,
      exclusionRules: splitLines(form.exclusions),
      keywords: splitComma(form.keywords),
      ...(form.radiusEnabled ? { latitude: Number(form.latitude) } : {}),
      locality: form.locality,
      ...(form.radiusEnabled ? { longitude: Number(form.longitude) } : {}),
      maxResults: form.maxResults,
      name: form.name,
      provider: props.provider.id,
      providerTermsVersion: props.provider.termsVersion,
      ...(form.radiusEnabled ? { radiusKm: form.radiusKm } : {}),
      region: form.region,
      requireWebsite: form.requireWebsite,
      requiredFields,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the campaign fields");
      return;
    }
    setSubmitting(true);
    try {
      const result = await window.auditTool.createDiscoveryCampaign({ input: parsed.data });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      props.onCreated();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Campaign could not be created",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="campaign-form-title" className="section-block campaign-form-shell">
      <header className="campaign-form-header">
        <button
          aria-label="Back to campaigns"
          className="icon-button"
          onClick={props.onCancel}
          title="Back to campaigns"
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div>
          <h2 id="campaign-form-title">New discovery campaign</h2>
          <p>DataForSEO Business Listings</p>
        </div>
      </header>

      {!props.provider.configured && (
        <div className="campaign-provider-warning" role="alert">
          <Ban aria-hidden="true" size={18} />
          <div>
            <strong>Provider credentials required</strong>
            <span>Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD, then restart the app.</span>
          </div>
        </div>
      )}

      {error !== undefined && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <form className="campaign-form" onSubmit={(event) => void submit(event)}>
        <div className="campaign-form-section">
          <div className="campaign-form-section-heading">
            <span>Campaign</span>
            <p>Name and result controls.</p>
          </div>
          <div className="campaign-form-grid">
            <label className="form-field campaign-span-two">
              <span>Campaign name *</span>
              <input
                maxLength={200}
                onChange={(event) => {
                  set("name", event.target.value);
                }}
                placeholder="Karachi dental practices"
                value={form.name}
              />
            </label>
            <label className="form-field">
              <span>Maximum results *</span>
              <input
                max={props.provider.maxResults}
                min={1}
                onChange={(event) => {
                  set("maxResults", Number(event.target.value));
                }}
                type="number"
                value={form.maxResults}
              />
            </label>
            <label className="check-field campaign-check-field">
              <input
                checked={form.requireWebsite}
                onChange={(event) => {
                  set("requireWebsite", event.target.checked);
                }}
                type="checkbox"
              />
              <span>Only businesses with websites</span>
            </label>
          </div>
        </div>

        <div className="campaign-form-section">
          <div className="campaign-form-section-heading">
            <span>Search area</span>
            <p>Provider geography filters.</p>
          </div>
          <div className="campaign-form-grid">
            <label className="form-field">
              <span>Country code *</span>
              <input
                autoCapitalize="characters"
                maxLength={2}
                onChange={(event) => {
                  set("country", event.target.value.toUpperCase());
                }}
                placeholder="PK"
                value={form.country}
              />
            </label>
            <label className="form-field">
              <span>State or region</span>
              <input
                maxLength={120}
                onChange={(event) => {
                  set("region", event.target.value);
                }}
                placeholder="Sindh"
                value={form.region}
              />
            </label>
            <label className="form-field">
              <span>City or locality</span>
              <input
                maxLength={120}
                onChange={(event) => {
                  set("locality", event.target.value);
                }}
                placeholder="Karachi"
                value={form.locality}
              />
            </label>
          </div>

          {props.provider.supportsRadius && (
            <div className="campaign-radius">
              <label className="check-field">
                <input
                  checked={form.radiusEnabled}
                  onChange={(event) => {
                    set("radiusEnabled", event.target.checked);
                  }}
                  type="checkbox"
                />
                <span>Limit by coordinate radius</span>
              </label>
              {form.radiusEnabled && (
                <div className="campaign-form-grid">
                  <label className="form-field">
                    <span>Latitude *</span>
                    <input
                      max={90}
                      min={-90}
                      onChange={(event) => {
                        set("latitude", event.target.value);
                      }}
                      step="any"
                      type="number"
                      value={form.latitude}
                    />
                  </label>
                  <label className="form-field">
                    <span>Longitude *</span>
                    <input
                      max={180}
                      min={-180}
                      onChange={(event) => {
                        set("longitude", event.target.value);
                      }}
                      step="any"
                      type="number"
                      value={form.longitude}
                    />
                  </label>
                  <label className="form-field">
                    <span>Radius (km) *</span>
                    <input
                      max={500}
                      min={1}
                      onChange={(event) => {
                        set("radiusKm", Number(event.target.value));
                      }}
                      type="number"
                      value={form.radiusKm}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="campaign-form-section">
          <div className="campaign-form-section-heading">
            <span>Business criteria</span>
            <p>Category, keywords, and exclusions.</p>
          </div>
          <div className="campaign-form-grid">
            <label className="form-field">
              <span>Category</span>
              <input
                maxLength={120}
                onChange={(event) => {
                  set("category", event.target.value);
                }}
                placeholder="dental_clinic"
                value={form.category}
              />
            </label>
            <label className="form-field campaign-span-two">
              <span>Keywords</span>
              <input
                maxLength={1_000}
                onChange={(event) => {
                  set("keywords", event.target.value);
                }}
                placeholder="dentist, orthodontist"
                value={form.keywords}
              />
            </label>
            <label className="form-field campaign-span-three">
              <span>Exclusions</span>
              <textarea
                maxLength={4_000}
                onChange={(event) => {
                  set("exclusions", event.target.value);
                }}
                placeholder={"Existing client name\nexcluded-domain.example"}
                rows={3}
                value={form.exclusions}
              />
            </label>
          </div>
        </div>

        <fieldset className="campaign-required-fields">
          <legend>Additional required fields</legend>
          <label className="check-field">
            <input
              checked={form.phoneRequired}
              onChange={(event) => {
                set("phoneRequired", event.target.checked);
              }}
              type="checkbox"
            />
            <span>Public phone</span>
          </label>
          <label className="check-field">
            <input
              checked={form.addressRequired}
              onChange={(event) => {
                set("addressRequired", event.target.checked);
              }}
              type="checkbox"
            />
            <span>Street address</span>
          </label>
        </fieldset>

        <footer className="campaign-form-footer">
          <div>
            <strong>Paid provider request</strong>
            <span>Up to 5 API requests. Charges depend on the configured DataForSEO account.</span>
          </div>
          <button className="button secondary" onClick={props.onCancel} type="button">
            Cancel
          </button>
          <button
            className="button primary"
            disabled={!props.provider.configured || submitting}
            type="submit"
          >
            {submitting ? (
              <LoaderCircle aria-hidden="true" className="spin" size={16} />
            ) : (
              <SearchCheck aria-hidden="true" size={16} />
            )}
            {submitting ? "Starting..." : "Start discovery"}
          </button>
        </footer>
      </form>
    </section>
  );
}

export function CampaignWorkspace(props: { onBackToProspects: () => void }): React.JSX.Element {
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState<DiscoveryProvider>();
  const [query, setQuery] = useState<DiscoveryCampaignListQuery>(defaultQuery);
  const [listState, setListState] = useState<CampaignListState>({ type: "loading" });
  const [actionError, setActionError] = useState<string>();

  const load = useCallback(
    async (showLoading = true): Promise<void> => {
      if (showLoading) setListState({ type: "loading" });
      try {
        const [nextProvider, result] = await Promise.all([
          window.auditTool.getDiscoveryProvider(),
          window.auditTool.listDiscoveryCampaigns(query),
        ]);
        setProvider(nextProvider);
        setListState({ result, type: "ready" });
      } catch (error) {
        setListState({
          message: error instanceof Error ? error.message : "Campaigns could not be loaded",
          type: "error",
        });
      }
    },
    [query],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      listState.type !== "ready" ||
      !listState.result.items.some((campaign) => ["queued", "running"].includes(campaign.state))
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      void load(false);
    }, 1_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [listState, load]);

  const act = async (
    campaign: DiscoveryCampaignRecord,
    action: "cancel" | "resume",
  ): Promise<void> => {
    setActionError(undefined);
    const result =
      action === "cancel"
        ? await window.auditTool.cancelDiscoveryCampaign({ id: campaign.id })
        : await window.auditTool.resumeDiscoveryCampaign({ id: campaign.id });
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    await load(false);
  };

  if (creating && provider !== undefined) {
    return (
      <CampaignForm
        onCancel={() => {
          setCreating(false);
        }}
        onCreated={() => {
          setCreating(false);
          void load(false);
        }}
        provider={provider}
      />
    );
  }

  return (
    <section
      aria-labelledby="campaign-directory-title"
      className="section-block campaign-directory"
    >
      <div className="section-heading campaign-directory-heading">
        <div className="campaign-title-group">
          <button
            aria-label="Back to prospects"
            className="icon-button"
            onClick={props.onBackToProspects}
            title="Back to prospects"
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
          <div>
            <h2 id="campaign-directory-title">Discovery campaigns</h2>
            <p>Bounded searches through approved business-data providers.</p>
          </div>
        </div>
        <button
          className="button primary"
          disabled={provider === undefined}
          onClick={() => {
            setCreating(true);
          }}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          New campaign
        </button>
      </div>

      {provider !== undefined && !provider.configured && (
        <div className="campaign-provider-warning" role="status">
          <Ban aria-hidden="true" size={18} />
          <div>
            <strong>DataForSEO is not configured</strong>
            <span>Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD, then restart the app.</span>
          </div>
        </div>
      )}

      {actionError !== undefined && (
        <div className="form-error" role="alert">
          {actionError}
        </div>
      )}

      <div className="campaign-toolbar">
        <label className="filter-field">
          <span>State</span>
          <select
            onChange={(event) => {
              setQuery((current) => ({
                ...current,
                page: 1,
                state: event.target.value as DiscoveryCampaignListQuery["state"],
              }));
            }}
            value={query.state}
          >
            <option value="all">All states</option>
            {CAMPAIGN_STATES.map((state) => (
              <option key={state} value={state}>
                {campaignStateLabels[state]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {listState.type === "loading" && (
        <div aria-live="polite" className="table-state" role="status">
          Loading campaigns...
        </div>
      )}
      {listState.type === "error" && (
        <div className="table-state table-state-error" role="alert">
          <span>{listState.message}</span>
          <button className="button secondary" onClick={() => void load()} type="button">
            Try again
          </button>
        </div>
      )}
      {listState.type === "ready" && listState.result.items.length === 0 && (
        <div className="empty-directory">
          <MapPin aria-hidden="true" size={28} />
          <strong>No discovery campaigns</strong>
          <p>Create a bounded location and category search to collect prospects.</p>
        </div>
      )}
      {listState.type === "ready" && listState.result.items.length > 0 && (
        <>
          <div aria-label="Campaign list" className="table-scroll" tabIndex={0}>
            <table className="campaign-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>State</th>
                  <th>Progress</th>
                  <th>Saved</th>
                  <th className="campaign-updated-column">Updated</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listState.result.items.map((campaign) => {
                  const progress =
                    campaign.maxResults === 0
                      ? 0
                      : Math.min(100, (campaign.processedCount / campaign.maxResults) * 100);
                  return (
                    <tr key={campaign.id}>
                      <td>
                        <div className="campaign-identity">
                          <strong>{campaign.name}</strong>
                          <span>
                            {[campaign.locality, campaign.region, campaign.country]
                              .filter(Boolean)
                              .join(", ")}
                            {" · "}
                            {campaign.category ?? campaign.keywords.join(", ")}
                          </span>
                          {campaign.warningMessage !== null && (
                            <small>{campaign.warningMessage}</small>
                          )}
                          {campaign.failureMessage !== null && (
                            <small className="campaign-failure">{campaign.failureMessage}</small>
                          )}
                        </div>
                      </td>
                      <td>
                        <CampaignStatus state={campaign.state} />
                      </td>
                      <td>
                        <div className="campaign-progress">
                          <div aria-hidden="true">
                            <span style={{ width: `${String(progress)}%` }} />
                          </div>
                          <span>
                            {campaign.processedCount.toLocaleString()} /{" "}
                            {campaign.maxResults.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="campaign-counts">
                          <strong>{campaign.resultCount.toLocaleString()}</strong>
                          {campaign.suppressedCount > 0 && (
                            <span>{campaign.suppressedCount} suppressed</span>
                          )}
                        </div>
                      </td>
                      <td className="campaign-updated-column">
                        {new Date(campaign.updatedAt).toLocaleString()}
                      </td>
                      <td>
                        {["queued", "running"].includes(campaign.state) && (
                          <button
                            aria-label={`Cancel ${campaign.name}`}
                            className="icon-button"
                            onClick={() => void act(campaign, "cancel")}
                            title="Cancel campaign"
                            type="button"
                          >
                            <Ban aria-hidden="true" size={16} />
                          </button>
                        )}
                        {["cancelled", "failed", "paused"].includes(campaign.state) && (
                          <button
                            aria-label={`Resume ${campaign.name}`}
                            className="icon-button"
                            disabled={provider?.configured !== true}
                            onClick={() => void act(campaign, "resume")}
                            title="Resume campaign"
                            type="button"
                          >
                            {campaign.hasContinuation ? (
                              <CirclePlay aria-hidden="true" size={16} />
                            ) : (
                              <RotateCcw aria-hidden="true" size={16} />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>
              Page {listState.result.page} · {listState.result.total.toLocaleString()} campaigns
            </span>
            <div>
              <button
                aria-label="Previous campaign page"
                className="icon-button"
                disabled={query.page === 1}
                onClick={() => {
                  setQuery((current) => ({ ...current, page: current.page - 1 }));
                }}
                title="Previous page"
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={17} />
              </button>
              <button
                aria-label="Next campaign page"
                className="icon-button"
                disabled={query.page * query.pageSize >= listState.result.total}
                onClick={() => {
                  setQuery((current) => ({ ...current, page: current.page + 1 }));
                }}
                title="Next page"
                type="button"
              >
                <ChevronRight aria-hidden="true" size={17} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function splitComma(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/gu)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
