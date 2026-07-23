import {
  Ban,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  AuditJobListQuery,
  AuditJobListResult,
  AuditJobRecord,
  AuditJobState,
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
  | { result: AuditJobListResult; type: "ready" };

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
        {ACTIVE_STATES.includes(props.job.state) ? ` · ${String(percent)}%` : ""}
      </span>
    </div>
  );
}

export function AuditJobs(props: { clientId?: string }): React.JSX.Element {
  const [state, setState] = useState<AuditListState>({ type: "loading" });
  const [actionError, setActionError] = useState<string>();
  const [workingId, setWorkingId] = useState<string>();
  const query = useMemo<AuditJobListQuery>(
    () => ({
      ...(props.clientId === undefined ? {} : { clientId: props.clientId }),
      page: 1,
      pageSize: 25,
      states: [],
    }),
    [props.clientId],
  );

  const loadJobs = useCallback(
    async (showLoading = false) => {
      if (showLoading) setState({ type: "loading" });
      try {
        const result = await window.auditTool.listAuditJobs(query);
        setState({ result, type: "ready" });
      } catch (error) {
        setState({
          message: error instanceof Error ? error.message : "Audit jobs could not be loaded",
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
    state.type === "ready" && state.result.items.some((job) => ACTIVE_STATES.includes(job.state));
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

  if (state.type === "loading") {
    return (
      <div aria-live="polite" className="table-state audit-table-state" role="status">
        Loading audits...
      </div>
    );
  }
  if (state.type === "error") {
    return (
      <div className="table-state table-state-error audit-table-state" role="alert">
        <span>{state.message}</span>
        <button className="button secondary" onClick={() => void loadJobs(true)} type="button">
          <RefreshCw aria-hidden="true" size={16} />
          Try again
        </button>
      </div>
    );
  }
  if (state.result.items.length === 0) {
    return (
      <div className="empty-directory audit-empty">
        <Clock3 aria-hidden="true" size={28} />
        <strong>No audits recorded</strong>
        <p>
          Select website pages, lock an audit scope, and start the audit from the client workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="audit-jobs">
      {actionError !== undefined && (
        <div className="form-error audit-action-error" role="alert">
          {actionError}
        </div>
      )}
      <div className="table-scroll">
        <table className="audit-table">
          <thead>
            <tr>
              {props.clientId === undefined && <th>Client</th>}
              <th>Audit</th>
              <th>Status</th>
              <th>Progress</th>
              <th className="audit-updated-column">Updated</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.result.items.map((job) => (
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
                      {job.pagesTotal.toLocaleString()} {job.pagesTotal === 1 ? "page" : "pages"} ·
                      Attempt {job.attempt.toLocaleString()}
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
                <td className="audit-updated-column">
                  <time dateTime={job.updatedAt} title={new Date(job.updatedAt).toLocaleString()}>
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
                        className="button secondary compact-button"
                        disabled={workingId === job.id}
                        onClick={() => void runAction(job, "cancel")}
                        type="button"
                      >
                        <Ban aria-hidden="true" size={15} />
                        Cancel
                      </button>
                    )}
                    {(job.state === "failed" || job.state === "cancelled") && (
                      <button
                        className="button secondary compact-button"
                        disabled={workingId === job.id}
                        onClick={() => void runAction(job, "retry")}
                        type="button"
                      >
                        <RotateCcw aria-hidden="true" size={15} />
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
