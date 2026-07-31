import {
  Activity,
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Save,
  Search,
  SearchCheck,
  ShieldCheck,
  Share2,
  ShieldOff,
  Trash2,
  UserSearch,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type {
  ProspectListQuery,
  ProspectListResult,
  ProspectQualificationInput,
  ProspectRecord,
  ProspectState,
} from "../../shared/contracts.js";
import { CampaignWorkspace } from "./campaign-workspace.js";

const defaultQuery: ProspectListQuery = {
  confidenceAtLeast: 0,
  direction: "desc",
  owner: "",
  page: 1,
  pageSize: 25,
  search: "",
  sort: "updatedAt",
  state: "all",
  websiteAvailability: "all",
};

type ListState =
  | { type: "loading" }
  | { message: string; type: "error" }
  | { result: ProspectListResult; type: "ready" };
type View = { type: "list" } | { prospect: ProspectRecord; type: "detail" };
type DetailTab = "qualification" | "sources" | "activity";

const stateLabels: Record<ProspectState, string> = {
  new: "New",
  reviewing: "Reviewing",
  qualified: "Qualified",
  "not-qualified": "Not qualified",
  promoted: "Promoted",
  suppressed: "Suppressed",
};

function ProspectStatus(props: { state: ProspectState }): React.JSX.Element {
  return (
    <span className={`prospect-status prospect-status-${props.state}`}>
      {stateLabels[props.state]}
    </span>
  );
}

function ProspectDetail(props: {
  onBack: () => void;
  onDelete: (confirmation: string) => Promise<string | undefined>;
  onPromote: (existingClientId?: string) => Promise<{ clientId: string; nextAction: string }>;
  onSave: (input: ProspectQualificationInput) => Promise<void>;
  onState: (state: ProspectState) => Promise<void>;
  onSuppress: (reason: string, doNotContact: boolean) => Promise<void>;
  onVerify: () => Promise<void>;
  prospect: ProspectRecord;
}): React.JSX.Element {
  const [tab, setTab] = useState<DetailTab>("qualification");
  const [owner, setOwner] = useState(props.prospect.owner ?? "");
  const [confidence, setConfidence] = useState(props.prospect.confidence);
  const [duplicateReviewState, setDuplicateReviewState] = useState(
    props.prospect.duplicateReviewState,
  );
  const [notes, setNotes] = useState(props.prospect.notes ?? "");
  const [tags, setTags] = useState(props.prospect.tags.join(", "));
  const [nextState, setNextState] = useState<ProspectState>(props.prospect.state);
  const [suppressionReason, setSuppressionReason] = useState("");
  const [doNotContact, setDoNotContact] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const [duplicateClientId, setDuplicateClientId] = useState<string>();
  const [promotionMessage, setPromotionMessage] = useState<string>();

  const run = async (operation: () => Promise<void>, fallback: string): Promise<void> => {
    setWorking(true);
    setError(undefined);
    try {
      await operation();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : fallback);
    } finally {
      setWorking(false);
    }
  };

  const save = (): void => {
    void run(
      () =>
        props.onSave({
          confidence,
          duplicateReviewState,
          notes,
          owner,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
        }),
      "Qualification details could not be saved",
    );
  };

  const canChangeState =
    props.prospect.state !== "promoted" && props.prospect.state !== "suppressed";

  return (
    <div className="content-stack">
      <section className="section-block prospect-detail-header">
        <button
          aria-label="Back to prospects"
          className="icon-button"
          onClick={props.onBack}
          title="Back to prospects"
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div className="prospect-identity">
          <h2>{props.prospect.businessName}</h2>
          <span>{props.prospect.normalizedDomain ?? "No website recorded"}</span>
        </div>
        <ProspectStatus state={props.prospect.state} />
        <button
          className="button secondary"
          disabled={working || props.prospect.state === "promoted"}
          onClick={() => void run(props.onVerify, "Prospect verification failed")}
          type="button"
        >
          <ShieldCheck aria-hidden="true" size={16} />
          Verify prospect
        </button>
      </section>

      {error !== undefined && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <dl className="prospect-snapshot section-block">
        <div>
          <dt>Source</dt>
          <dd>{props.prospect.sourceProvider ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Website</dt>
          <dd>{props.prospect.websiteAvailability.replace("-", " ")}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{props.prospect.confidence}%</dd>
        </div>
        <div>
          <dt>Last verified</dt>
          <dd>
            {props.prospect.lastVerifiedAt === null
              ? "Not verified"
              : new Date(props.prospect.lastVerifiedAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>

      <section className="section-block prospect-verification" aria-labelledby="signals-title">
        <div className="section-heading compact">
          <div>
            <h2 id="signals-title">Opportunity signals</h2>
            <p>Pre-audit observations for qualification. These are not audit findings or scores.</p>
          </div>
          <span className={`availability availability-${props.prospect.verificationState}`}>
            {props.prospect.verificationState.replace("-", " ")}
          </span>
        </div>
        {props.prospect.opportunitySignals.length === 0 ? (
          <p className="muted-copy">Verify this prospect to collect website observations.</p>
        ) : (
          <ul className="signal-list">
            {props.prospect.opportunitySignals.map((signal) => (
              <li className={`signal-${signal.tone}`} key={signal.kind}>
                {signal.label}
              </li>
            ))}
          </ul>
        )}
        {props.prospect.verifiedWebsiteUrl !== null && (
          <dl className="verification-facts">
            <div>
              <dt>Verified URL</dt>
              <dd>{props.prospect.verifiedWebsiteUrl}</dd>
            </div>
            <div>
              <dt>Homepage title</dt>
              <dd>{props.prospect.homepageTitle ?? "Not observed"}</dd>
            </div>
            <div>
              <dt>Pages observed</dt>
              <dd>{props.prospect.discoveredPageCount ?? 0}</dd>
            </div>
          </dl>
        )}
        {props.prospect.verificationMessage !== null && (
          <p className="field-error">{props.prospect.verificationMessage}</p>
        )}
        {props.prospect.duplicateCandidates.length > 0 && (
          <div className="duplicate-warning" role="status">
            <strong>Possible duplicate records</strong>
            {props.prospect.duplicateCandidates.map((candidate) => (
              <div key={`${candidate.kind}-${candidate.id}`}>
                <span>{candidate.businessName}</span>
                <span>
                  {candidate.kind} · {candidate.reasons.join(", ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div aria-label="Prospect record" className="tabs" role="tablist">
        {(
          [
            ["qualification", "Qualification"],
            ["sources", "Sources"],
            ["activity", "Activity"],
          ] as const
        ).map(([id, label]) => (
          <button
            aria-selected={tab === id}
            key={id}
            onClick={() => {
              setTab(id);
            }}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <section aria-live="polite" className="section-block prospect-tab-panel" role="tabpanel">
        {tab === "qualification" && (
          <>
            <div className="prospect-business-info">
              <div>
                <h3>Business information</h3>
                <p>Public details retained from the rendered business page.</p>
              </div>
              <dl>
                <div>
                  <dt>
                    <Globe2 aria-hidden="true" size={15} />
                    Website
                  </dt>
                  <dd>{props.prospect.websiteUrl ?? "Not found"}</dd>
                </div>
                <div>
                  <dt>
                    <Phone aria-hidden="true" size={15} />
                    Phone
                  </dt>
                  <dd>{props.prospect.publicPhone ?? "Not found"}</dd>
                </div>
                <div>
                  <dt>
                    <Mail aria-hidden="true" size={15} />
                    Email
                  </dt>
                  <dd>{props.prospect.publicEmail ?? "Not found"}</dd>
                </div>
                <div>
                  <dt>
                    <MapPin aria-hidden="true" size={15} />
                    Address
                  </dt>
                  <dd>{props.prospect.addressLine ?? "Not found"}</dd>
                </div>
                <div>
                  <dt>
                    <Building2 aria-hidden="true" size={15} />
                    Category
                  </dt>
                  <dd>{props.prospect.category ?? "Not found"}</dd>
                </div>
                <div>
                  <dt>
                    <Share2 aria-hidden="true" size={15} />
                    Business profiles
                  </dt>
                  <dd>
                    {props.prospect.socialProfiles.length === 0
                      ? "Not found"
                      : props.prospect.socialProfiles.map(formatProfileLabel).join(", ")}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="prospect-qualification-layout">
              <div className="prospect-edit-panel">
                <div className="section-heading compact">
                  <div>
                    <h2>Qualification details</h2>
                    <p>Internal ownership, review confidence, tags, and notes.</p>
                  </div>
                </div>
                <div className="prospect-form-grid">
                  <label className="form-field">
                    <span>Owner</span>
                    <input
                      maxLength={120}
                      onChange={(event) => {
                        setOwner(event.target.value);
                      }}
                      value={owner}
                    />
                  </label>
                  <label className="form-field" htmlFor="prospect-confidence">
                    <span>Confidence</span>
                    <div className="confidence-input">
                      <input
                        id="prospect-confidence"
                        max={100}
                        min={0}
                        onChange={(event) => {
                          setConfidence(Number(event.target.value));
                        }}
                        type="number"
                        value={confidence}
                      />
                      <span>%</span>
                    </div>
                  </label>
                  <label className="form-field">
                    <span>Duplicate review</span>
                    <select
                      onChange={(event) => {
                        setDuplicateReviewState(
                          event.target.value as ProspectQualificationInput["duplicateReviewState"],
                        );
                      }}
                      value={duplicateReviewState}
                    >
                      <option value="not-reviewed">Not reviewed</option>
                      <option value="possible-duplicate">Possible duplicate</option>
                      <option value="confirmed-distinct">No duplicate</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Tags</span>
                    <input
                      maxLength={1_000}
                      onChange={(event) => {
                        setTags(event.target.value);
                      }}
                      placeholder="Priority, healthcare"
                      value={tags}
                    />
                  </label>
                </div>
                <label className="form-field">
                  <span>Notes</span>
                  <textarea
                    maxLength={5_000}
                    onChange={(event) => {
                      setNotes(event.target.value);
                    }}
                    rows={5}
                    value={notes}
                  />
                </label>
                <button className="button primary" disabled={working} onClick={save} type="button">
                  <Save aria-hidden="true" size={16} />
                  Save details
                </button>
              </div>

              <div className="prospect-controls">
                <section aria-labelledby="promotion-title">
                  <h3 id="promotion-title">Client promotion</h3>
                  <p>
                    Create one client from approved public details. No discovery or audit starts
                    automatically.
                  </p>
                  {promotionMessage !== undefined && (
                    <p className="success-message">{promotionMessage}</p>
                  )}
                  {duplicateClientId !== undefined && (
                    <p className="field-error">
                      A client already uses this domain. Link the existing client after review.
                    </p>
                  )}
                  <button
                    className="button primary"
                    disabled={
                      working ||
                      props.prospect.state !== "qualified" ||
                      props.prospect.promotedClientId !== null
                    }
                    onClick={() =>
                      void run(async () => {
                        try {
                          const result = await props.onPromote(duplicateClientId);
                          setPromotionMessage(
                            result.nextAction === "discover-pages"
                              ? "Client created. Page discovery is ready as the next step."
                              : "Client created. Add a website when one becomes available.",
                          );
                          setDuplicateClientId(undefined);
                        } catch (promotionError) {
                          const message =
                            promotionError instanceof Error
                              ? promotionError.message
                              : "Promotion failed";
                          const match = /^duplicate-client:(.+)$/u.exec(message);
                          if (match?.[1] !== undefined) {
                            setDuplicateClientId(match[1]);
                            return;
                          }
                          throw promotionError;
                        }
                      }, "Prospect could not be promoted")
                    }
                    type="button"
                  >
                    <ExternalLink aria-hidden="true" size={16} />
                    {duplicateClientId === undefined ? "Promote to client" : "Link existing client"}
                  </button>
                </section>

                <section aria-labelledby="lifecycle-title">
                  <h3 id="lifecycle-title">Lifecycle</h3>
                  <p>Record the current qualification decision.</p>
                  <label className="form-field">
                    <span>State</span>
                    <select
                      disabled={!canChangeState || working}
                      onChange={(event) => {
                        setNextState(event.target.value as ProspectState);
                      }}
                      value={nextState}
                    >
                      <option value="new">New</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="qualified">Qualified</option>
                      <option value="not-qualified">Not qualified</option>
                    </select>
                  </label>
                  <button
                    className="button secondary"
                    disabled={!canChangeState || working || nextState === props.prospect.state}
                    onClick={() =>
                      void run(
                        () => props.onState(nextState),
                        "Prospect state could not be changed",
                      )
                    }
                    type="button"
                  >
                    Save state
                  </button>
                </section>

                <section aria-labelledby="suppression-title" className="suppression-control">
                  <h3 id="suppression-title">Suppression</h3>
                  <p>Prevent this source identity and domain from being imported again.</p>
                  <label className="form-field">
                    <span>Reason</span>
                    <textarea
                      disabled={!canChangeState || working}
                      maxLength={500}
                      onChange={(event) => {
                        setSuppressionReason(event.target.value);
                      }}
                      rows={3}
                      value={suppressionReason}
                    />
                  </label>
                  <label className="checkbox-field">
                    <input
                      checked={doNotContact}
                      disabled={!canChangeState || working}
                      onChange={(event) => {
                        setDoNotContact(event.target.checked);
                      }}
                      type="checkbox"
                    />
                    <span>Mark as do not contact</span>
                  </label>
                  <button
                    className="button danger"
                    disabled={!canChangeState || working || suppressionReason.trim().length === 0}
                    onClick={() =>
                      void run(
                        () => props.onSuppress(suppressionReason, doNotContact),
                        "Prospect could not be suppressed",
                      )
                    }
                    type="button"
                  >
                    <ShieldOff aria-hidden="true" size={16} />
                    Suppress prospect
                  </button>
                </section>
              </div>

              <details className="danger-zone prospect-danger-zone">
                <summary>Delete prospect</summary>
                <p>
                  Permanently remove this record. Existing suppression entries remain active. Type{" "}
                  <strong>{props.prospect.businessName}</strong> to confirm.
                </p>
                <div className="danger-actions">
                  <label className="form-field">
                    <span>Business name</span>
                    <input
                      onChange={(event) => {
                        setConfirmation(event.target.value);
                      }}
                      value={confirmation}
                    />
                  </label>
                  <button
                    className="button danger"
                    disabled={working || confirmation.length === 0}
                    onClick={() =>
                      void run(async () => {
                        const deleteError = await props.onDelete(confirmation);
                        if (deleteError !== undefined) throw new Error(deleteError);
                      }, "Prospect could not be deleted")
                    }
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                    Delete permanently
                  </button>
                </div>
              </details>
            </div>
          </>
        )}

        {tab === "sources" && (
          <div className="prospect-source-list">
            {props.prospect.sourceRecords.map((source) => (
              <article key={source.id}>
                <Database aria-hidden="true" size={18} />
                <div>
                  <strong>{source.provider}</strong>
                  <span>Record {source.providerRecordId}</span>
                  <span>Collected {new Date(source.collectedAt).toLocaleDateString()}</span>
                  <span>Retain until {new Date(source.retainedUntil).toLocaleDateString()}</span>
                  <p>{source.retentionPolicy}</p>
                </div>
              </article>
            ))}
          </div>
        )}

        {tab === "activity" && (
          <ol className="activity-list">
            {props.prospect.activities.map((item) => (
              <li key={item.id}>
                <Activity aria-hidden="true" size={17} />
                <div>
                  <strong>{item.summary}</strong>
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function formatProfileLabel(value: string): string {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./u, "");
    const path = url.pathname.replace(/\/$/u, "");
    return `${host}${path}`;
  } catch {
    return value;
  }
}

export function ProspectWorkspace(): React.JSX.Element {
  const [view, setView] = useState<View>({ type: "list" });
  const [workspaceMode, setWorkspaceMode] = useState<"campaigns" | "prospects">("prospects");
  const [query, setQuery] = useState<ProspectListQuery>(defaultQuery);
  const [searchDraft, setSearchDraft] = useState("");
  const [listState, setListState] = useState<ListState>({ type: "loading" });

  const loadProspects = useCallback(async () => {
    setListState({ type: "loading" });
    try {
      setListState({ result: await window.auditTool.listProspects(query), type: "ready" });
    } catch (error) {
      setListState({
        message: error instanceof Error ? error.message : "Prospects could not be loaded",
        type: "error",
      });
    }
  }, [query]);

  useEffect(() => {
    if (view.type === "list") void loadProspects();
  }, [loadProspects, view.type]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery((current) => ({ ...current, page: 1, search: searchDraft }));
    }, 250);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchDraft]);

  const openProspect = async (id: string): Promise<void> => {
    const prospect = await window.auditTool.getProspect({ id });
    if (prospect !== null) setView({ prospect, type: "detail" });
  };

  const replaceDetail = (prospect: ProspectRecord): void => {
    setView({ prospect, type: "detail" });
  };

  if (view.type === "detail") {
    return (
      <ProspectDetail
        onBack={() => {
          setView({ type: "list" });
        }}
        onDelete={async (confirmation) => {
          const result = await window.auditTool.deleteProspect({
            confirmation,
            id: view.prospect.id,
          });
          if (result.ok) {
            setView({ type: "list" });
            return undefined;
          }
          return result.error.message;
        }}
        onSave={async (input) => {
          const result = await window.auditTool.updateProspect({ id: view.prospect.id, input });
          if (!result.ok) throw new Error(result.error.message);
          replaceDetail(result.prospect);
        }}
        onVerify={async () => {
          const result = await window.auditTool.verifyProspect({ id: view.prospect.id });
          if (!result.ok) throw new Error(result.error.message);
          replaceDetail(result.prospect);
        }}
        onPromote={async (existingClientId) => {
          const result = await window.auditTool.promoteProspect({
            ...(existingClientId === undefined ? {} : { existingClientId }),
            id: view.prospect.id,
          });
          if (!result.ok) {
            if (result.error.code === "duplicate-domain" && result.error.clientId !== undefined) {
              throw new Error(`duplicate-client:${result.error.clientId}`);
            }
            throw new Error(result.error.message);
          }
          replaceDetail(result.prospect);
          return { clientId: result.clientId, nextAction: result.nextAction };
        }}
        onState={async (state) => {
          const result = await window.auditTool.setProspectState({
            id: view.prospect.id,
            state,
          });
          if (!result.ok) throw new Error(result.error.message);
          replaceDetail(result.prospect);
        }}
        onSuppress={async (reason, doNotContact) => {
          const result = await window.auditTool.suppressProspect({
            doNotContact,
            id: view.prospect.id,
            reason,
          });
          if (!result.ok) throw new Error(result.error.message);
          replaceDetail(result.prospect);
        }}
        prospect={view.prospect}
      />
    );
  }

  if (workspaceMode === "campaigns") {
    return (
      <CampaignWorkspace
        onBackToProspects={() => {
          setWorkspaceMode("prospects");
        }}
      />
    );
  }

  return (
    <section
      aria-labelledby="prospect-directory-title"
      className="section-block prospect-directory"
    >
      <div className="section-heading">
        <div>
          <h2 id="prospect-directory-title">Prospect workspace</h2>
          <p>Discovered businesses awaiting qualification or suppression.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setWorkspaceMode("campaigns");
          }}
          type="button"
        >
          <SearchCheck aria-hidden="true" size={16} />
          Find prospects
        </button>
      </div>

      <div className="prospect-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search prospects</span>
          <input
            onChange={(event) => {
              setSearchDraft(event.target.value);
            }}
            placeholder="Search prospects"
            type="search"
            value={searchDraft}
          />
        </label>
        <label className="filter-field">
          <span>State</span>
          <select
            onChange={(event) => {
              setQuery((current) => ({
                ...current,
                page: 1,
                state: event.target.value as ProspectListQuery["state"],
              }));
            }}
            value={query.state}
          >
            <option value="all">All states</option>
            {Object.entries(stateLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Website</span>
          <select
            onChange={(event) => {
              setQuery((current) => ({
                ...current,
                page: 1,
                websiteAvailability: event.target.value as ProspectListQuery["websiteAvailability"],
              }));
            }}
            value={query.websiteAvailability}
          >
            <option value="all">All states</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Confidence</span>
          <select
            onChange={(event) => {
              setQuery((current) => ({
                ...current,
                confidenceAtLeast: Number(event.target.value),
                page: 1,
              }));
            }}
            value={query.confidenceAtLeast}
          >
            <option value={0}>Any</option>
            <option value={50}>50%+</option>
            <option value={70}>70%+</option>
            <option value={90}>90%+</option>
          </select>
        </label>
      </div>

      {listState.type === "loading" && (
        <div aria-live="polite" className="table-state" role="status">
          Loading prospects...
        </div>
      )}
      {listState.type === "error" && (
        <div className="table-state table-state-error" role="alert">
          <span>{listState.message}</span>
          <button className="button secondary" onClick={() => void loadProspects()} type="button">
            Try again
          </button>
        </div>
      )}
      {listState.type === "ready" && listState.result.items.length === 0 && (
        <div className="empty-directory">
          <UserSearch aria-hidden="true" size={28} />
          <strong>{query.search.length > 0 ? "No matching prospects" : "No prospects yet"}</strong>
          <p>
            {query.search.length > 0
              ? "Adjust the search or filters."
              : "Businesses collected from approved sources will appear here."}
          </p>
        </div>
      )}
      {listState.type === "ready" && listState.result.items.length > 0 && (
        <div className="table-scroll">
          <table className="prospect-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>State</th>
                <th>Source</th>
                <th>Website</th>
                <th>Confidence</th>
                <th className="prospect-owner-column">Owner</th>
                <th className="prospect-verified-column">Verified</th>
              </tr>
            </thead>
            <tbody>
              {listState.result.items.map((prospect) => (
                <tr key={prospect.id}>
                  <td>
                    <button
                      className="client-link"
                      onClick={() => void openProspect(prospect.id)}
                      type="button"
                    >
                      <strong>{prospect.businessName}</strong>
                      <span>{prospect.normalizedDomain ?? "No website"}</span>
                    </button>
                  </td>
                  <td>
                    <ProspectStatus state={prospect.state} />
                  </td>
                  <td>{prospect.sourceProvider ?? "Unknown"}</td>
                  <td>
                    <span className={`availability availability-${prospect.websiteAvailability}`}>
                      {prospect.websiteAvailability}
                    </span>
                  </td>
                  <td>{prospect.confidence}%</td>
                  <td className="prospect-owner-column">{prospect.owner ?? "Unassigned"}</td>
                  <td className="prospect-verified-column">
                    {prospect.lastVerifiedAt === null ? (
                      "Not verified"
                    ) : (
                      <time dateTime={prospect.lastVerifiedAt}>
                        {new Date(prospect.lastVerifiedAt).toLocaleDateString()}
                      </time>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {listState.type === "ready" && listState.result.total > listState.result.pageSize && (
        <div className="pagination">
          <span>{listState.result.total.toLocaleString()} prospects</span>
          <div>
            <button
              aria-label="Previous page"
              className="icon-button"
              disabled={query.page === 1}
              onClick={() => {
                setQuery((current) => ({ ...current, page: current.page - 1 }));
              }}
              title="Previous page"
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <span>Page {query.page}</span>
            <button
              aria-label="Next page"
              className="icon-button"
              disabled={query.page * query.pageSize >= listState.result.total}
              onClick={() => {
                setQuery((current) => ({ ...current, page: current.page + 1 }));
              }}
              title="Next page"
              type="button"
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
