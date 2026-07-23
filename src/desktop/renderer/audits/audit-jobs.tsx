import {
  Ban,
  CheckCircle2,
  Clock3,
  FilterX,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AUDIT_JOB_STATES,
  type AuditHistoryListQuery,
  type AuditHistoryListResult,
  type AuditJobRecord,
  type AuditJobState,
} from "../../shared/contracts.js";

const ACTIVE_STATES: readonly AuditJobState[] = [
  "queued",
  "discovering",
  "scanning",
  "generating-reports",
];

type AuditListState =
  | { type: "loading" }
  | { message: string; type: "error" }
  | { result: AuditHistoryListResult; type: "ready" };

const statusCopy: Record<AuditJobState, string> = {
  cancelled: "Cancelled",
  completed: "Completed",
  discovering: "Discovering pages",
  failed: "Failed",
  "generating-reports": "Generating reports",
  "partially-completed": "Partially completed",
  queued: "Queued",
  scanning: "Running checks",
};

function JobStatus(props: { job: AuditJobRecord }): React.JSX.Element {
  const Icon =
    props.job.state === "completed"
      ? CheckCircle2
      : props.job.state === "partially-completed"
        ? TriangleAlert
        : props.job.state === "failed"
          ? XCircle
          : props.job.state === "cancelled"
            ? Ban
            : props.job.state === "queued"
              ? Clock3
              : LoaderCircle;
  return (
    <span className={`audit-job-status audit-job-status-${props.job.state}`}>
      <Icon
        aria-hidden="true"
        className={
          props.job.state !== "queued" && ACTIVE_STATES.includes(props.job.state)
            ? "spin"
            : undefined
        }
        size={15}
      />
      {statusCopy[props.job.state]}
    </span>
  );
}

function JobProgress(props: { job: AuditJobRecord }): React.JSX.Element {
  const percent = Math.round((props.job.pagesCompleted / props.job.pagesTotal) * 100);
  return (
    <div className="audit-progress">
      <progress
        aria-label={`${String(props.job.pagesCompleted)} of ${String(props.job.pagesTotal)} pages completed`}
        max={props.job.pagesTotal}
        value={props.job.pagesCompleted}
      />
      <span>
        {props.job.pagesCompleted.toLocaleString()} of {props.job.pagesTotal.toLocaleString()} pages
        {ACTIVE_STATES.includes(props.job.state) ? ` | ${String(percent)}%` : ""}
      </span>
    </div>
  );
}

function toBoundary(value: string, endOfDay: boolean): string | undefined {
  if (value.length === 0) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function AuditJobs(props: { clientId?: string }): React.JSX.Element {
  const [state, setState] = useState<AuditListState>({ type: "loading" });
  const [actionError, setActionError] = useState<string>();
  const [workingId, setWorkingId] = useState<string>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AuditHistoryListQuery["state"]>("all");
  const [resultState, setResultState] = useState<AuditHistoryListQuery["resultState"]>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const query = useMemo<AuditHistoryListQuery>(() => {
    const from = toBoundary(dateFrom, false);
    const to = toBoundary(dateTo, true);
    return {
      ...(props.clientId === undefined ? {} : { clientId: props.clientId }),
      ...(from === undefined ? {} : { dateFrom: from }),
      ...(to === undefined ? {} : { dateTo: to }),
      page,
      pageSize: 25,
      resultState,
      search,
      state: status,
    };
  }, [dateFrom, dateTo, page, props.clientId, resultState, search, status]);

  const loadJobs = useCallback(
    async (showLoading = false) => {
      if (showLoading) setState({ type: "loading" });
      try {
        const result = await window.auditTool.listAuditHistory(query);
        setState({ result, type: "ready" });
      } catch (error) {
        setState({
          message: error instanceof Error ? error.message : "Audit history could not be loaded",
          type: "error",
        });
      }
    },
    [query],
  );

  useEffect(() => {
    void loadJobs(true);
  }, [loadJobs]);

  const hasActiveJobs =
    state.type === "ready" &&
    state.result.items.some((item) => ACTIVE_STATES.includes(item.job.state));
  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = window.setInterval(() => {
      void loadJobs();
    }, 1_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [hasActiveJobs, loadJobs]);

  const runAction = async (job: AuditJobRecord, action: "cancel" | "retry"): Promise<void> => {
    setWorkingId(job.id);
    setActionError(undefined);
    try {
      const result =
        action === "cancel"
          ? await window.auditTool.cancelAuditJob({ id: job.id })
          : await window.auditTool.retryAuditJob({ id: job.id });
      if (!result.ok) setActionError(result.error.message);
      await loadJobs();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The audit action could not complete",
      );
    } finally {
      setWorkingId(undefined);
    }
  };

  const resetFilters = (): void => {
    setSearch("");
    setStatus("all");
    setResultState("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="audit-jobs">
      <div className="table-toolbar audit-history-filters">
        <label className="toolbar-field toolbar-search">
          <span>Search</span>
          <input
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Client or website"
            type="search"
            value={search}
          />
        </label>
        <label className="toolbar-field">
          <span>Status</span>
          <select
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as AuditHistoryListQuery["state"]);
            }}
            value={status}
          >
            <option value="all">All statuses</option>
            {AUDIT_JOB_STATES.map((item) => (
              <option key={item} value={item}>
                {statusCopy[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="toolbar-field">
          <span>Result</span>
          <select
            onChange={(event) => {
              setPage(1);
              setResultState(event.target.value as AuditHistoryListQuery["resultState"]);
            }}
            value={resultState}
          >
            <option value="all">All results</option>
            <option value="completed">Completed</option>
            <option value="partially-completed">Partial</option>
            <option value="unavailable">No result</option>
          </select>
        </label>
        <label className="toolbar-field toolbar-date">
          <span>From</span>
          <input
            max={dateTo || undefined}
            onChange={(event) => {
              setPage(1);
              setDateFrom(event.target.value);
            }}
            type="date"
            value={dateFrom}
          />
        </label>
        <label className="toolbar-field toolbar-date">
          <span>To</span>
          <input
            min={dateFrom || undefined}
            onChange={(event) => {
              setPage(1);
              setDateTo(event.target.value);
            }}
            type="date"
            value={dateTo}
          />
        </label>
        <button
          aria-label="Clear audit filters"
          className="icon-button toolbar-reset"
          onClick={resetFilters}
          title="Clear filters"
          type="button"
        >
          <FilterX aria-hidden="true" size={17} />
        </button>
      </div>

      {actionError !== undefined && (
        <div className="form-error audit-action-error" role="alert">
          {actionError}
        </div>
      )}
      {state.type === "loading" && (
        <div aria-live="polite" className="table-state audit-table-state" role="status">
          Loading audit history...
        </div>
      )}
      {state.type === "error" && (
        <div className="table-state table-state-error audit-table-state" role="alert">
          <span>{state.message}</span>
          <button className="button secondary" onClick={() => void loadJobs(true)} type="button">
            <RefreshCw aria-hidden="true" size={16} />
            Try again
          </button>
        </div>
      )}
      {state.type === "ready" && state.result.items.length === 0 && (
        <div className="empty-directory audit-empty">
          <Clock3 aria-hidden="true" size={28} />
          <strong>No matching audits</strong>
          <p>Completed, running, failed, and cancelled audits will remain available here.</p>
        </div>
      )}
      {state.type === "ready" && state.result.items.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="audit-table">
              <thead>
                <tr>
                  {props.clientId === undefined && <th>Client</th>}
                  <th>Audit</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Score</th>
                  <th className="audit-updated-column">Updated</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.result.items.map(({ job, result }) => (
                  <tr key={job.id}>
                    {props.clientId === undefined && (
                      <td>
                        <strong>{job.clientBusinessName}</strong>
                      </td>
                    )}
                    <td>
                      <div className="audit-identity">
                        <strong>{new URL(job.targetUrl).hostname}</strong>
                        <span>
                          {job.pagesTotal.toLocaleString()}{" "}
                          {job.pagesTotal === 1 ? "page" : "pages"} | Attempt{" "}
                          {job.attempt.toLocaleString()}
                        </span>
                        {job.failure !== null && (
                          <small className="audit-failure-message">{job.failure.message}</small>
                        )}
                        {job.failure === null && job.warnings[0] !== undefined && (
                          <small className="audit-warning-message">{job.warnings[0]}</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <JobStatus job={job} />
                      {job.warningCount > 0 && (
                        <span className="audit-warning-count">
                          {job.warningCount.toLocaleString()}{" "}
                          {job.warningCount === 1 ? "warning" : "warnings"}
                        </span>
                      )}
                    </td>
                    <td>
                      <JobProgress job={job} />
                    </td>
                    <td>
                      {result === null ? (
                        <span className="muted-value">Unavailable</span>
                      ) : (
                        <span className="audit-score">{result.overallScore}</span>
                      )}
                    </td>
                    <td className="audit-updated-column">
                      <time
                        dateTime={job.updatedAt}
                        title={new Date(job.updatedAt).toLocaleString()}
                      >
                        {new Date(job.updatedAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                    </td>
                    <td>
                      <div className="audit-row-actions">
                        {job.cancelAvailable && (
                          <button
                            aria-label={`Cancel audit for ${job.clientBusinessName}`}
                            className="icon-button compact-icon-button"
                            disabled={workingId === job.id}
                            onClick={() => void runAction(job, "cancel")}
                            title="Cancel audit"
                            type="button"
                          >
                            <Ban aria-hidden="true" size={15} />
                          </button>
                        )}
                        {(job.state === "failed" || job.state === "cancelled") && (
                          <button
                            aria-label={`Retry audit for ${job.clientBusinessName}`}
                            className="icon-button compact-icon-button"
                            disabled={workingId === job.id}
                            onClick={() => void runAction(job, "retry")}
                            title="Retry audit"
                            type="button"
                          >
                            <RotateCcw aria-hidden="true" size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>{state.result.total.toLocaleString()} audits</span>
            <div>
              <button
                className="button secondary compact-button"
                disabled={page === 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                type="button"
              >
                Previous
              </button>
              <span>Page {page.toLocaleString()}</span>
              <button
                className="button secondary compact-button"
                disabled={page * state.result.pageSize >= state.result.total}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
