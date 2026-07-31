import {
  Activity,
  Archive,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type {
  ClientInput,
  ClientListQuery,
  ClientListResult,
  ClientRecord,
  ClientStatus,
} from "../../shared/contracts.js";
import { AuditJobs } from "../audits/audit-jobs.js";
import { ReportLibrary } from "../reports/report-library.js";
import { ClientForm } from "./client-form.js";
import { WebsitePages } from "./website-pages.js";

const defaultQuery: ClientListQuery = {
  direction: "desc",
  page: 1,
  pageSize: 25,
  search: "",
  sort: "updatedAt",
  status: "active",
};

type WorkspaceView =
  | { type: "list" }
  | { type: "create" }
  | { client: ClientRecord; type: "detail" }
  | { client: ClientRecord; type: "edit" };
type ListState =
  | { type: "loading" }
  | { message: string; type: "error" }
  | { result: ClientListResult; type: "ready" };
type DetailTab = "profile" | "pages" | "audits" | "reports" | "activity";

function ClientStatusLabel(props: { status: ClientStatus }): React.JSX.Element {
  return <span className={`client-status client-status-${props.status}`}>{props.status}</span>;
}

function ClientDetail(props: {
  client: ClientRecord;
  onBack: () => void;
  onDelete: (confirmation: string) => Promise<string | undefined>;
  onEdit: () => void;
  onStatus: (status: ClientStatus) => Promise<void>;
}): React.JSX.Element {
  const [tab, setTab] = useState<DetailTab>("profile");
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [working, setWorking] = useState(false);

  const setStatus = async (status: ClientStatus): Promise<void> => {
    setWorking(true);
    setActionError(undefined);
    try {
      await props.onStatus(status);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Client status could not be changed");
    } finally {
      setWorking(false);
    }
  };

  const deleteClient = async (): Promise<void> => {
    setWorking(true);
    setDeleteError(undefined);
    try {
      setDeleteError(await props.onDelete(confirmation));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Client could not be deleted");
    } finally {
      setWorking(false);
    }
  };

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "pages", label: "Website Pages" },
    { id: "audits", label: "Audits" },
    { id: "reports", label: "Reports" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="content-stack">
      <section className="section-block client-detail-header">
        <button
          aria-label="Back to clients"
          className="icon-button"
          onClick={props.onBack}
          title="Back to clients"
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div className="client-identity">
          <h2>{props.client.businessName}</h2>
          <span>{props.client.normalizedDomain}</span>
        </div>
        <ClientStatusLabel status={props.client.status} />
        <div className="client-header-actions">
          <button className="button secondary" onClick={props.onEdit} type="button">
            <Pencil aria-hidden="true" size={16} />
            Edit
          </button>
          {props.client.status === "active" && (
            <button
              className="button secondary"
              disabled={working}
              onClick={() => void setStatus("paused")}
              type="button"
            >
              <Pause aria-hidden="true" size={16} />
              Pause
            </button>
          )}
          {props.client.status === "paused" && (
            <button
              className="button secondary"
              disabled={working}
              onClick={() => void setStatus("active")}
              type="button"
            >
              <Play aria-hidden="true" size={16} />
              Activate
            </button>
          )}
          {props.client.status === "archived" ? (
            <button
              className="button secondary"
              disabled={working}
              onClick={() => void setStatus("active")}
              type="button"
            >
              <Play aria-hidden="true" size={16} />
              Restore
            </button>
          ) : (
            <button
              className="button secondary"
              disabled={working}
              onClick={() => void setStatus("archived")}
              type="button"
            >
              <Archive aria-hidden="true" size={16} />
              Archive
            </button>
          )}
        </div>
      </section>

      {actionError !== undefined && (
        <div className="form-error" role="alert">
          {actionError}
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Client workspace">
        {tabs.map((item) => (
          <button
            aria-selected={tab === item.id}
            key={item.id}
            onClick={() => {
              setTab(item.id);
            }}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <section aria-live="polite" className="section-block client-tab-panel" role="tabpanel">
        {tab === "profile" && (
          <div>
            <dl className="details-list client-profile-list">
              <div>
                <dt>Website</dt>
                <dd>{props.client.websiteUrl ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{props.client.category ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{props.client.owner ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt>Public phone</dt>
                <dd>{props.client.publicPhone ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Public email</dt>
                <dd>{props.client.publicEmail ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {[props.client.locality, props.client.region, props.client.country]
                    .filter(Boolean)
                    .join(", ") || "Not recorded"}
                </dd>
              </div>
              <div>
                <dt>Tags</dt>
                <dd>{props.client.tags.length === 0 ? "None" : props.client.tags.join(", ")}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd className="profile-notes">{props.client.notes ?? "No internal notes"}</dd>
              </div>
            </dl>
            <details className="danger-zone">
              <summary>Delete client</summary>
              <p>
                Permanently remove this client. Type <strong>{props.client.businessName}</strong> to
                confirm.
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
                  onClick={() => void deleteClient()}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={16} />
                  Delete permanently
                </button>
              </div>
              {deleteError !== undefined && (
                <p className="field-error" role="alert">
                  {deleteError}
                </p>
              )}
            </details>
          </div>
        )}
        {tab === "pages" &&
          (props.client.websiteUrl === null ? (
            <div className="empty-state compact">
              <h3>No website recorded</h3>
              <p>Add a website to this client before discovering pages.</p>
            </div>
          ) : (
            <WebsitePages clientId={props.client.id} websiteUrl={props.client.websiteUrl} />
          ))}
        {tab === "audits" && <AuditJobs clientId={props.client.id} />}
        {tab === "reports" && <ReportLibrary clientId={props.client.id} />}
        {tab === "activity" && (
          <ol className="activity-list">
            {props.client.activities.map((item) => (
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

export function ClientWorkspace(): React.JSX.Element {
  const [view, setView] = useState<WorkspaceView>({ type: "list" });
  const [query, setQuery] = useState<ClientListQuery>(defaultQuery);
  const [searchDraft, setSearchDraft] = useState("");
  const [listState, setListState] = useState<ListState>({ type: "loading" });
  const [formError, setFormError] = useState<string>();
  const [duplicateClientId, setDuplicateClientId] = useState<string>();

  const loadClients = useCallback(async () => {
    setListState({ type: "loading" });
    try {
      const result = await window.auditTool.listClients(query);
      setListState({ result, type: "ready" });
    } catch (error) {
      setListState({
        message: error instanceof Error ? error.message : "Clients could not be loaded",
        type: "error",
      });
    }
  }, [query]);

  useEffect(() => {
    if (view.type === "list") void loadClients();
  }, [loadClients, view.type]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery((current) => ({ ...current, page: 1, search: searchDraft }));
    }, 250);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchDraft]);

  const openClient = async (id: string): Promise<void> => {
    try {
      const client = await window.auditTool.getClient({ id });
      if (client !== null) setView({ client, type: "detail" });
      else setFormError("The selected client no longer exists.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Client could not be opened");
    }
  };

  const saveClient = async (input: ClientInput, client?: ClientRecord): Promise<void> => {
    setFormError(undefined);
    setDuplicateClientId(undefined);
    try {
      const result =
        client === undefined
          ? await window.auditTool.createClient(input)
          : await window.auditTool.updateClient({ id: client.id, input });
      if (result.ok) {
        setView({ client: result.client, type: "detail" });
        return;
      }
      setFormError(result.error.message);
      if (result.error.code === "duplicate-domain") {
        setDuplicateClientId(result.error.clientId);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Client could not be saved");
    }
  };

  if (view.type === "create") {
    return (
      <ClientForm
        error={formError}
        onCancel={() => {
          setView({ type: "list" });
        }}
        onOpenExisting={
          duplicateClientId === undefined ? undefined : () => void openClient(duplicateClientId)
        }
        onSubmit={(input) => saveClient(input)}
      />
    );
  }
  if (view.type === "edit") {
    return (
      <ClientForm
        client={view.client}
        error={formError}
        onCancel={() => {
          setView({ client: view.client, type: "detail" });
        }}
        onOpenExisting={
          duplicateClientId === undefined ? undefined : () => void openClient(duplicateClientId)
        }
        onSubmit={(input) => saveClient(input, view.client)}
      />
    );
  }
  if (view.type === "detail") {
    return (
      <ClientDetail
        client={view.client}
        onBack={() => {
          setView({ type: "list" });
        }}
        onEdit={() => {
          setView({ client: view.client, type: "edit" });
        }}
        onStatus={async (status) => {
          const result = await window.auditTool.setClientStatus({ id: view.client.id, status });
          if (result.ok) setView({ client: result.client, type: "detail" });
        }}
        onDelete={async (confirmation) => {
          const result = await window.auditTool.deleteClient({ confirmation, id: view.client.id });
          if (result.ok) {
            setView({ type: "list" });
            return undefined;
          }
          return result.error.message;
        }}
      />
    );
  }

  return (
    <section aria-labelledby="client-directory-title" className="section-block client-directory">
      <div className="section-heading directory-heading">
        <div>
          <h2 id="client-directory-title">Client directory</h2>
          <p>Managed businesses and their audit workspaces.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setFormError(undefined);
            setDuplicateClientId(undefined);
            setView({ type: "create" });
          }}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          New client
        </button>
      </div>
      <div className="directory-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Search clients</span>
          <input
            onChange={(event) => {
              setSearchDraft(event.target.value);
            }}
            placeholder="Search name or domain"
            type="search"
            value={searchDraft}
          />
        </label>
        <label className="filter-field">
          <span>Status</span>
          <select
            onChange={(event) => {
              setQuery((current) => ({
                ...current,
                page: 1,
                status: event.target.value as ClientListQuery["status"],
              }));
            }}
            value={query.status}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Sort</span>
          <select
            onChange={(event) => {
              setQuery((current) => ({
                ...current,
                page: 1,
                sort: event.target.value as ClientListQuery["sort"],
              }));
            }}
            value={query.sort}
          >
            <option value="updatedAt">Recently updated</option>
            <option value="name">Business name</option>
          </select>
        </label>
      </div>

      {listState.type === "loading" && (
        <div aria-live="polite" className="table-state" role="status">
          Loading clients...
        </div>
      )}
      {listState.type === "error" && (
        <div className="table-state table-state-error" role="alert">
          <span>{listState.message}</span>
          <button className="button secondary" onClick={() => void loadClients()} type="button">
            Try again
          </button>
        </div>
      )}
      {listState.type === "ready" && listState.result.items.length === 0 && (
        <div className="empty-directory">
          <UserRound aria-hidden="true" size={28} />
          <strong>
            {query.search.length > 0
              ? "No matching clients"
              : `No ${query.status === "all" ? "" : `${query.status} `}clients`}
          </strong>
          <p>
            {query.search.length > 0
              ? "Adjust the search or status filter."
              : "Create a client to begin managing website pages and audits."}
          </p>
        </div>
      )}
      {listState.type === "ready" && listState.result.items.length > 0 && (
        <div className="table-scroll">
          <table className="client-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Category</th>
                <th>Owner</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {listState.result.items.map((client) => (
                <tr key={client.id}>
                  <td>
                    <button
                      className="client-link"
                      onClick={() => void openClient(client.id)}
                      type="button"
                    >
                      <strong>{client.businessName}</strong>
                      <span>{client.normalizedDomain}</span>
                    </button>
                  </td>
                  <td>
                    <ClientStatusLabel status={client.status} />
                  </td>
                  <td>{client.category ?? "Not recorded"}</td>
                  <td>{client.owner ?? "Unassigned"}</td>
                  <td>
                    <time dateTime={client.updatedAt}>
                      {new Date(client.updatedAt).toLocaleDateString()}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {listState.type === "ready" && listState.result.total > listState.result.pageSize && (
        <div className="pagination">
          <span>{listState.result.total.toLocaleString()} clients</span>
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
