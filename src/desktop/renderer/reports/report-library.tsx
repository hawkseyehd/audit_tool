import {
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  REPORT_ARTIFACT_FORMATS,
  REPORT_ARTIFACT_STATUSES,
  type ReportArtifactFormat,
  type ReportArtifactListQuery,
  type ReportArtifactListResult,
  type ReportArtifactRecord,
  type ReportArtifactStatus,
} from "../../shared/contracts.js";

const formatCopy: Record<ReportArtifactFormat, string> = {
  "client-summary-pdf": "Client summary PDF",
  "summary-pdf": "Audit summary PDF",
  html: "HTML report",
  json: "Canonical JSON",
  markdown: "Markdown report",
  pdf: "Technical PDF",
};

const statusCopy: Record<ReportArtifactStatus, string> = {
  available: "Available",
  expired: "Expired",
  "generation-failed": "Generation failed",
  missing: "Missing",
};

type LibraryState =
  | { type: "loading" }
  | { message: string; type: "error" }
  | { result: ReportArtifactListResult; type: "ready" };

export function ReportLibrary(props: { clientId?: string }): React.JSX.Element {
  const [state, setState] = useState<LibraryState>({ type: "loading" });
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<ReportArtifactListQuery["format"]>("all");
  const [status, setStatus] = useState<ReportArtifactListQuery["status"]>("all");
  const [page, setPage] = useState(1);
  const [workingId, setWorkingId] = useState<string>();
  const [notice, setNotice] = useState<{ error: boolean; message: string }>();

  const query = useMemo<ReportArtifactListQuery>(
    () => ({
      ...(props.clientId === undefined ? {} : { clientId: props.clientId }),
      format,
      page,
      pageSize: 25,
      search,
      status,
    }),
    [format, page, props.clientId, search, status],
  );

  const loadReports = useCallback(
    async (showLoading = false) => {
      if (showLoading) setState({ type: "loading" });
      try {
        const result = await window.auditTool.listReportArtifacts(query);
        setState({ result, type: "ready" });
      } catch (error) {
        setState({
          message: error instanceof Error ? error.message : "Reports could not be loaded",
          type: "error",
        });
      }
    },
    [query],
  );

  useEffect(() => {
    void loadReports(true);
  }, [loadReports]);

  const runAction = async (
    report: ReportArtifactRecord,
    action: "open" | "reveal" | "export",
  ): Promise<void> => {
    setWorkingId(report.id);
    setNotice(undefined);
    try {
      const result =
        action === "open"
          ? await window.auditTool.openReport({ artifactId: report.id })
          : action === "reveal"
            ? await window.auditTool.revealReport({ artifactId: report.id })
            : await window.auditTool.exportReport({ artifactId: report.id });
      if (!result.ok) {
        if (result.error.code !== "cancelled") {
          setNotice({ error: true, message: result.error.message });
        }
      } else if (action === "export") {
        setNotice({ error: false, message: "Report exported." });
      }
      await loadReports();
    } catch (error) {
      setNotice({
        error: true,
        message: error instanceof Error ? error.message : "The report action could not complete",
      });
    } finally {
      setWorkingId(undefined);
    }
  };

  const available = (report: ReportArtifactRecord): boolean => report.status === "available";

  return (
    <div className="report-library">
      <div className="table-toolbar report-filters">
        <label className="toolbar-field toolbar-search">
          <span>Search</span>
          <div className="input-with-icon">
            <Search aria-hidden="true" size={15} />
            <input
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Client, website, or file"
              type="search"
              value={search}
            />
          </div>
        </label>
        <label className="toolbar-field">
          <span>Format</span>
          <select
            onChange={(event) => {
              setPage(1);
              setFormat(event.target.value as ReportArtifactListQuery["format"]);
            }}
            value={format}
          >
            <option value="all">All formats</option>
            {REPORT_ARTIFACT_FORMATS.map((item) => (
              <option key={item} value={item}>
                {formatCopy[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="toolbar-field">
          <span>Availability</span>
          <select
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as ReportArtifactListQuery["status"]);
            }}
            value={status}
          >
            <option value="all">All states</option>
            {REPORT_ARTIFACT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {statusCopy[item]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice !== undefined && (
        <div
          className={notice.error ? "form-error report-notice" : "success-notice report-notice"}
          role={notice.error ? "alert" : "status"}
        >
          {notice.message}
        </div>
      )}
      {state.type === "loading" && (
        <div aria-live="polite" className="table-state" role="status">
          Loading reports...
        </div>
      )}
      {state.type === "error" && (
        <div className="table-state table-state-error" role="alert">
          <span>{state.message}</span>
          <button className="button secondary" onClick={() => void loadReports(true)} type="button">
            <RefreshCw aria-hidden="true" size={16} />
            Try again
          </button>
        </div>
      )}
      {state.type === "ready" && state.result.items.length === 0 && (
        <div className="empty-directory report-empty">
          <FileText aria-hidden="true" size={28} />
          <strong>No matching reports</strong>
          <p>Generated client summaries, technical reports, and structured results appear here.</p>
        </div>
      )}
      {state.type === "ready" && state.result.items.length > 0 && (
        <>
          <div className="table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  {props.clientId === undefined && <th>Client</th>}
                  <th>Report</th>
                  <th>Format</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.result.items.map((report) => (
                  <tr key={report.id}>
                    {props.clientId === undefined && (
                      <td>
                        <strong>{report.clientBusinessName}</strong>
                      </td>
                    )}
                    <td>
                      <div className="report-identity">
                        <strong>{report.fileName}</strong>
                        <span>{new URL(report.targetUrl).hostname}</span>
                      </div>
                    </td>
                    <td>{formatCopy[report.format]}</td>
                    <td>
                      <span className={`report-status report-status-${report.status}`}>
                        {statusCopy[report.status]}
                      </span>
                    </td>
                    <td>
                      <time
                        dateTime={report.createdAt}
                        title={new Date(report.createdAt).toLocaleString()}
                      >
                        {new Date(report.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                    </td>
                    <td>
                      <div className="report-actions">
                        <button
                          aria-label={`Open ${report.fileName}`}
                          className="icon-button compact-icon-button"
                          disabled={!available(report) || workingId === report.id}
                          onClick={() => void runAction(report, "open")}
                          title={available(report) ? "Open report" : statusCopy[report.status]}
                          type="button"
                        >
                          <ExternalLink aria-hidden="true" size={15} />
                        </button>
                        <button
                          aria-label={`Show ${report.fileName} in its folder`}
                          className="icon-button compact-icon-button"
                          disabled={!available(report) || workingId === report.id}
                          onClick={() => void runAction(report, "reveal")}
                          title={available(report) ? "Show in folder" : statusCopy[report.status]}
                          type="button"
                        >
                          <FolderOpen aria-hidden="true" size={15} />
                        </button>
                        <button
                          aria-label={`Export ${report.fileName}`}
                          className="icon-button compact-icon-button"
                          disabled={!available(report) || workingId === report.id}
                          onClick={() => void runAction(report, "export")}
                          title={available(report) ? "Export report" : statusCopy[report.status]}
                          type="button"
                        >
                          <Download aria-hidden="true" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <span>{state.result.total.toLocaleString()} reports</span>
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
