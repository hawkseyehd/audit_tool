import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Compass,
  Filter,
  Globe,
  LockKeyhole,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AUDIT_SCOPE_REPORT_FORMATS,
  PAGE_TYPES,
  type AuditScopeConfiguration,
  type AuditScopeRecord,
  type AuditJobRecord,
  type PageSelectionAction,
  type WebsitePageListQuery,
  type WebsitePageListResult,
  type WebsitePageRecord,
} from "../../shared/contracts.js";

type InventoryState =
  | { type: "loading" }
  | { message: string; type: "error" }
  | { result: WebsitePageListResult; type: "ready" };

const defaultScopeConfiguration: AuditScopeConfiguration = {
  includeAccessibility: true,
  includeAnalytics: true,
  includeForms: true,
  includeLighthouse: true,
  includeSecurity: true,
  includeSeo: true,
  includeUxHeuristics: true,
  submitForms: false,
  viewports: ["desktop", "mobile"],
};

function createDefaultQuery(clientId: string): WebsitePageListQuery {
  return {
    availability: "all",
    changeState: "all",
    clientId,
    direction: "desc",
    page: 1,
    pageSize: 25,
    pageType: "all",
    search: "",
    selectionState: "all",
    sort: "lastObservedAt",
    status: "all",
  };
}

function PageStatus(props: { page: WebsitePageRecord }): React.JSX.Element {
  if (props.page.statusCode !== null) {
    const level =
      props.page.statusCode < 300
        ? "success"
        : props.page.statusCode < 400
          ? "redirect"
          : "failure";
    return <span className={`http-status http-status-${level}`}>{props.page.statusCode}</span>;
  }
  return <span className="http-status http-status-failure">Failed</span>;
}

function InventorySummary(props: { result: WebsitePageListResult }): React.JSX.Element {
  const total =
    props.result.summary.available +
    props.result.summary.unavailable +
    props.result.summary.notObserved;
  return (
    <dl className="inventory-summary">
      <div>
        <dt>Known pages</dt>
        <dd>{total.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Available</dt>
        <dd>{props.result.summary.available.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Eligible</dt>
        <dd>{props.result.summary.eligible.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Selected</dt>
        <dd>{props.result.summary.selected.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Unavailable</dt>
        <dd>{props.result.summary.unavailable.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Not observed</dt>
        <dd>{props.result.summary.notObserved.toLocaleString()}</dd>
      </div>
    </dl>
  );
}

function RunNotice(props: { result: WebsitePageListResult }): React.JSX.Element | null {
  const run = props.result.latestRun;
  if (run === null) return null;
  const completed = run.completedAt === null ? null : new Date(run.completedAt);
  return (
    <div className={`discovery-notice discovery-notice-${run.status}`}>
      {run.status === "failed" || run.status === "partial" ? (
        <AlertTriangle aria-hidden="true" size={17} />
      ) : (
        <Compass aria-hidden="true" size={17} />
      )}
      <div>
        <strong>
          {run.status === "running"
            ? "Discovery in progress"
            : run.status === "partial"
              ? "Discovery completed with page failures"
              : run.status === "failed"
                ? "Discovery failed"
                : "Discovery complete"}
        </strong>
        <span>
          {run.status === "failed"
            ? (run.failureMessage ?? "The website could not be discovered.")
            : `${String(run.observedPageCount)} observed, ${String(run.newPageCount)} new, ${String(run.changedPageCount)} changed, ${String(run.noLongerObservedCount)} not observed${completed === null ? "" : ` · ${completed.toLocaleString()}`}`}
        </span>
      </div>
    </div>
  );
}

export function WebsitePages(props: { clientId: string; websiteUrl: string }): React.JSX.Element {
  const [query, setQuery] = useState<WebsitePageListQuery>(() =>
    createDefaultQuery(props.clientId),
  );
  const [searchDraft, setSearchDraft] = useState("");
  const [state, setState] = useState<InventoryState>({ type: "loading" });
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string>();
  const [selectionWorking, setSelectionWorking] = useState(false);
  const [scope, setScope] = useState<AuditScopeRecord>();
  const [job, setJob] = useState<AuditJobRecord>();
  const selectVisibleRef = useRef<HTMLInputElement>(null);

  const loadPages = useCallback(async () => {
    setState({ type: "loading" });
    try {
      setState({ result: await window.auditTool.listWebsitePages(query), type: "ready" });
    } catch (error) {
      setState({
        message: error instanceof Error ? error.message : "Website pages could not be loaded",
        type: "error",
      });
    }
  }, [query]);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery((current) => ({ ...current, page: 1, search: searchDraft }));
    }, 250);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchDraft]);

  const discover = async (): Promise<void> => {
    setDiscovering(true);
    setDiscoveryError(undefined);
    try {
      const result = await window.auditTool.discoverWebsitePages({
        clientId: props.clientId,
        maxPages: 100,
      });
      if (!result.ok) setDiscoveryError(result.error.message);
      await loadPages();
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : "Website discovery could not run");
    } finally {
      setDiscovering(false);
    }
  };

  const applySelection = async (
    action: PageSelectionAction,
    pageIds: readonly string[] = [],
  ): Promise<void> => {
    setSelectionWorking(true);
    setDiscoveryError(undefined);
    try {
      const result = await window.auditTool.applyPageSelection({
        action,
        clientId: props.clientId,
        pageIds: [...pageIds],
      });
      if (!result.ok) setDiscoveryError(result.error.message);
      await loadPages();
    } catch (error) {
      setDiscoveryError(
        error instanceof Error ? error.message : "Page selection could not be updated",
      );
    } finally {
      setSelectionWorking(false);
    }
  };

  const createScope = async (): Promise<void> => {
    setSelectionWorking(true);
    setDiscoveryError(undefined);
    try {
      const result = await window.auditTool.createAuditScope({
        clientId: props.clientId,
        configuration: defaultScopeConfiguration,
        reportFormats: [...AUDIT_SCOPE_REPORT_FORMATS],
      });
      if (result.ok) setScope(result.scope);
      else setDiscoveryError(result.error.message);
    } catch (error) {
      setDiscoveryError(
        error instanceof Error ? error.message : "Audit scope could not be created",
      );
    } finally {
      setSelectionWorking(false);
    }
  };

  const startAudit = async (): Promise<void> => {
    if (scope === undefined) return;
    setSelectionWorking(true);
    setDiscoveryError(undefined);
    try {
      const result = await window.auditTool.startAuditJob({ scopeId: scope.id });
      if (result.ok) setJob(result.job);
      else setDiscoveryError(result.error.message);
    } catch (error) {
      setDiscoveryError(error instanceof Error ? error.message : "The audit could not be started");
    } finally {
      setSelectionWorking(false);
    }
  };

  useEffect(() => {
    if (
      job === undefined ||
      !["queued", "discovering", "scanning", "generating-reports"].includes(job.state)
    ) {
      return;
    }
    const interval = window.setInterval(() => {
      void window.auditTool
        .getAuditJob({ id: job.id })
        .then((updated) => {
          if (updated !== null) setJob(updated);
        })
        .catch((error: unknown) => {
          setDiscoveryError(
            error instanceof Error ? error.message : "Audit progress could not be refreshed",
          );
        });
    }, 1_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [job]);

  const setFilter = <Key extends keyof WebsitePageListQuery>(
    key: Key,
    value: WebsitePageListQuery[Key],
  ): void => {
    setQuery((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const isUnfiltered =
    query.search.length === 0 &&
    query.pageType === "all" &&
    query.availability === "all" &&
    query.changeState === "all" &&
    query.status === "all" &&
    query.selectionState === "all";
  const readyItems = state.type === "ready" ? state.result.items : [];
  const visibleEligibleIds = readyItems
    .filter((page) => page.availability === "available")
    .map((page) => page.id);
  const visibleSelectedCount = readyItems.filter(
    (page) => page.availability === "available" && page.selectionState === "included",
  ).length;
  const allVisibleSelected =
    visibleEligibleIds.length > 0 && visibleSelectedCount === visibleEligibleIds.length;

  useEffect(() => {
    if (selectVisibleRef.current !== null) {
      selectVisibleRef.current.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected;
    }
  }, [allVisibleSelected, visibleSelectedCount]);

  return (
    <div className="page-inventory">
      <div className="page-inventory-heading">
        <div>
          <h3>Website page inventory</h3>
          <p>{props.websiteUrl}</p>
        </div>
        <button
          className="button primary"
          disabled={discovering}
          onClick={() => void discover()}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={discovering ? "spin" : undefined} size={16} />
          {discovering ? "Discovering..." : "Discover pages"}
        </button>
      </div>

      {discoveryError !== undefined && (
        <div className="form-error" role="alert">
          {discoveryError}
        </div>
      )}

      {state.type === "loading" && (
        <div aria-live="polite" className="table-state" role="status">
          Loading website pages...
        </div>
      )}
      {state.type === "error" && (
        <div className="table-state table-state-error" role="alert">
          <span>{state.message}</span>
          <button className="button secondary" onClick={() => void loadPages()} type="button">
            Try again
          </button>
        </div>
      )}
      {state.type === "ready" && (
        <>
          <InventorySummary result={state.result} />
          <RunNotice result={state.result} />
          {scope !== undefined && (
            <div className="scope-notice" role="status">
              <LockKeyhole aria-hidden="true" size={17} />
              <div>
                <strong>Audit scope locked</strong>
                <span>
                  {scope.selectedPageCount.toLocaleString()}{" "}
                  {scope.selectedPageCount === 1 ? "page" : "pages"} · {scope.id.slice(0, 8)}
                </span>
              </div>
              {job === undefined ? (
                <button
                  className="button primary compact-button"
                  disabled={selectionWorking}
                  onClick={() => void startAudit()}
                  type="button"
                >
                  <Play aria-hidden="true" size={15} />
                  Start audit
                </button>
              ) : (
                <span className={`audit-job-status audit-job-status-${job.state}`}>
                  {job.state.replaceAll("-", " ")}
                </span>
              )}
            </div>
          )}

          {state.result.latestRun === null && state.result.total === 0 ? (
            <div className="empty-directory page-inventory-empty">
              <Globe aria-hidden="true" size={28} />
              <strong>No website pages discovered</strong>
              <p>Discover this website to build a safe, reviewable inventory of public pages.</p>
              <button
                className="button primary"
                disabled={discovering}
                onClick={() => void discover()}
                type="button"
              >
                <Compass aria-hidden="true" size={16} />
                Start discovery
              </button>
            </div>
          ) : (
            <>
              <div className="page-filter-toolbar">
                <label className="search-field">
                  <Search aria-hidden="true" size={17} />
                  <span className="sr-only">Search website pages</span>
                  <input
                    onChange={(event) => {
                      setSearchDraft(event.target.value);
                    }}
                    placeholder="Search title or URL"
                    type="search"
                    value={searchDraft}
                  />
                </label>
                <label className="filter-field">
                  <span>Page type</span>
                  <select
                    onChange={(event) => {
                      setFilter("pageType", event.target.value as WebsitePageListQuery["pageType"]);
                    }}
                    value={query.pageType}
                  >
                    <option value="all">All types</option>
                    {PAGE_TYPES.map((pageType) => (
                      <option key={pageType} value={pageType}>
                        {pageType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="filter-field">
                  <span>Availability</span>
                  <select
                    onChange={(event) => {
                      setFilter(
                        "availability",
                        event.target.value as WebsitePageListQuery["availability"],
                      );
                    }}
                    value={query.availability}
                  >
                    <option value="all">All states</option>
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="not-observed">Not observed</option>
                  </select>
                </label>
                <details className="page-more-filters">
                  <summary>
                    <Filter aria-hidden="true" size={16} />
                    More filters
                  </summary>
                  <div>
                    <label className="filter-field">
                      <span>HTTP status</span>
                      <select
                        onChange={(event) => {
                          setFilter("status", event.target.value as WebsitePageListQuery["status"]);
                        }}
                        value={query.status}
                      >
                        <option value="all">All statuses</option>
                        <option value="success">2xx success</option>
                        <option value="redirect">3xx redirect</option>
                        <option value="client-error">4xx client error</option>
                        <option value="server-error">5xx server error</option>
                        <option value="failed">Request failed</option>
                      </select>
                    </label>
                    <label className="filter-field">
                      <span>Discovery change</span>
                      <select
                        onChange={(event) => {
                          setFilter(
                            "changeState",
                            event.target.value as WebsitePageListQuery["changeState"],
                          );
                        }}
                        value={query.changeState}
                      >
                        <option value="all">All changes</option>
                        <option value="new">New</option>
                        <option value="changed">Changed</option>
                        <option value="unchanged">Unchanged</option>
                        <option value="unavailable">Unavailable</option>
                        <option value="not-observed">Not observed</option>
                      </select>
                    </label>
                    <label className="filter-field">
                      <span>Selection</span>
                      <select
                        onChange={(event) => {
                          setFilter(
                            "selectionState",
                            event.target.value as WebsitePageListQuery["selectionState"],
                          );
                        }}
                        value={query.selectionState}
                      >
                        <option value="all">All selection states</option>
                        <option value="default">Not selected</option>
                        <option value="included">Included</option>
                        <option value="excluded">Excluded</option>
                      </select>
                    </label>
                  </div>
                </details>
              </div>

              <div className="selection-toolbar" aria-label="Page selection actions">
                <span>
                  <strong>{state.result.summary.selected.toLocaleString()}</strong> selected ·{" "}
                  {state.result.summary.eligible.toLocaleString()} eligible
                </span>
                <div>
                  <button
                    className="button secondary"
                    disabled={selectionWorking || visibleEligibleIds.length === 0}
                    onClick={() => void applySelection("include", visibleEligibleIds)}
                    type="button"
                  >
                    Select visible
                  </button>
                  <button
                    className="button secondary"
                    disabled={selectionWorking || state.result.summary.eligible === 0}
                    onClick={() => void applySelection("include-recommended")}
                    type="button"
                  >
                    Select recommended
                  </button>
                  <button
                    className="button secondary"
                    disabled={selectionWorking || readyItems.length === 0}
                    onClick={() =>
                      void applySelection(
                        "exclude",
                        readyItems.map((page) => page.id),
                      )
                    }
                    type="button"
                  >
                    Exclude visible
                  </button>
                  <button
                    className="button secondary"
                    disabled={selectionWorking || state.result.summary.selected === 0}
                    onClick={() => void applySelection("clear")}
                    type="button"
                  >
                    Clear selection
                  </button>
                  <button
                    className="button primary"
                    disabled={selectionWorking || state.result.summary.selected === 0}
                    onClick={() => void createScope()}
                    type="button"
                  >
                    <LockKeyhole aria-hidden="true" size={16} />
                    Lock audit scope
                  </button>
                </div>
              </div>

              {state.result.items.length === 0 ? (
                <div className="empty-directory compact-empty">
                  <Search aria-hidden="true" size={24} />
                  <strong>{isUnfiltered ? "No current pages" : "No matching pages"}</strong>
                  <p>
                    {isUnfiltered
                      ? "Run discovery again to refresh this website inventory."
                      : "Adjust the search or filters to see more pages."}
                  </p>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="page-table">
                    <thead>
                      <tr>
                        <th className="selection-column">
                          <input
                            aria-label="Select all eligible pages on this page"
                            checked={allVisibleSelected}
                            disabled={selectionWorking || visibleEligibleIds.length === 0}
                            onChange={() =>
                              void applySelection(
                                allVisibleSelected ? "reset" : "include",
                                visibleEligibleIds,
                              )
                            }
                            ref={selectVisibleRef}
                            type="checkbox"
                          />
                        </th>
                        <th>Page</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Availability</th>
                        <th>Change</th>
                        <th>Recommendation</th>
                        <th>Last observed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.result.items.map((page) => (
                        <tr key={page.id}>
                          <td className="selection-column">
                            <input
                              aria-label={`${page.selectionState === "included" ? "Remove" : "Include"} ${page.title ?? page.normalizedUrl}`}
                              checked={page.selectionState === "included"}
                              disabled={selectionWorking || page.availability !== "available"}
                              onChange={() =>
                                void applySelection(
                                  page.selectionState === "included" ? "reset" : "include",
                                  [page.id],
                                )
                              }
                              type="checkbox"
                            />
                            {page.selectionState === "excluded" && <small>Excluded</small>}
                          </td>
                          <td>
                            <div className="page-identity">
                              <strong>{page.title ?? "Untitled page"}</strong>
                              <span>{page.normalizedUrl}</span>
                              {page.failureMessage !== null && <small>{page.failureMessage}</small>}
                            </div>
                          </td>
                          <td className="capitalized">{page.pageType}</td>
                          <td>
                            <PageStatus page={page} />
                          </td>
                          <td className="capitalized">{page.availability.replace("-", " ")}</td>
                          <td>
                            <span className={`change-state change-state-${page.changeState}`}>
                              {page.changeState.replace("-", " ")}
                            </span>
                          </td>
                          <td>
                            <div className="recommendation-cell">
                              <strong>{page.recommendationState.replace("-", " ")}</strong>
                              <span>{page.recommendationReason}</span>
                            </div>
                          </td>
                          <td>
                            <time dateTime={page.lastObservedAt}>
                              {new Date(page.lastObservedAt).toLocaleDateString()}
                            </time>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {state.result.total > state.result.pageSize && (
                <div className="pagination">
                  <span>{state.result.total.toLocaleString()} pages</span>
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
                      disabled={query.page * query.pageSize >= state.result.total}
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
            </>
          )}
        </>
      )}
    </div>
  );
}
