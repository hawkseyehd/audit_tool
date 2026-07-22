import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { DesktopBootstrap } from "../shared/contracts.js";
import { ClientWorkspace } from "./clients/client-workspace.js";

const destinations = [
  { icon: LayoutDashboard, id: "overview", label: "Overview" },
  { icon: Search, id: "prospects", label: "Prospects" },
  { icon: Building2, id: "clients", label: "Clients" },
  { icon: BarChart3, id: "audits", label: "Audits" },
  { icon: FileText, id: "reports", label: "Reports" },
  { icon: Settings, id: "settings", label: "Settings" },
] as const;

type DestinationId = (typeof destinations)[number]["id"];
type LoadState =
  | { type: "loading" }
  | { message: string; type: "error" }
  | { data: DesktopBootstrap; type: "ready" };

function NavigationItem(props: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}): React.JSX.Element {
  const Icon = props.icon;
  return (
    <li>
      <button
        aria-current={props.active ? "page" : undefined}
        className="nav-item"
        onClick={props.onSelect}
        title={props.label}
        type="button"
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
        <span>{props.label}</span>
      </button>
    </li>
  );
}

function LoadingState(): React.JSX.Element {
  return (
    <div aria-label="Loading workspace" aria-live="polite" className="loading-state" role="status">
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-row" />
      <div className="skeleton skeleton-row" />
      <div className="skeleton skeleton-row short" />
      <span className="sr-only">Loading workspace</span>
    </div>
  );
}

function ErrorState(props: { message: string; onRetry: () => void }): React.JSX.Element {
  return (
    <section aria-labelledby="load-error-title" className="state-panel state-panel-error">
      <ShieldCheck aria-hidden="true" size={24} />
      <div>
        <h2 id="load-error-title">Workspace unavailable</h2>
        <p>{props.message}</p>
      </div>
      <button className="button secondary" onClick={props.onRetry} type="button">
        <RefreshCw aria-hidden="true" size={16} />
        Try again
      </button>
    </section>
  );
}

function StatusLabel(props: { label: string; ready: boolean }): React.JSX.Element {
  return (
    <span className={props.ready ? "status status-ready" : "status status-error"}>
      <span aria-hidden="true" className="status-dot" />
      {props.label}
    </span>
  );
}

function Overview(props: { data: DesktopBootstrap }): React.JSX.Element {
  const entries = [
    ["Clients", props.data.workspace.clients],
    ["Prospects", props.data.workspace.prospects],
    ["Audits", props.data.workspace.audits],
    ["Reports", props.data.workspace.reports],
  ] as const;

  return (
    <div className="content-stack">
      <section aria-labelledby="workspace-title" className="section-block">
        <div className="section-heading">
          <div>
            <h2 id="workspace-title">Workspace</h2>
            <p>Current records available in this desktop workspace.</p>
          </div>
          <StatusLabel
            label={
              props.data.services.database === "ready" ? "Database ready" : "Database unavailable"
            }
            ready={props.data.services.database === "ready"}
          />
        </div>
        <dl className="summary-list">
          {entries.map(([label, value]) => (
            <div className="summary-row" key={label}>
              <dt>{label}</dt>
              <dd>{value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="activity-title" className="section-block">
        <div className="section-heading">
          <div>
            <h2 id="activity-title">Recent activity</h2>
            <p>Completed audits and report updates will appear here.</p>
          </div>
        </div>
        <div className="empty-row">
          <FileText aria-hidden="true" size={20} />
          <div>
            <strong>No activity recorded</strong>
            <p>This workspace is ready for its first client audit.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="services-title" className="section-block">
        <div className="section-heading compact">
          <div>
            <h2 id="services-title">System status</h2>
            <p>Local services required for audits and reports.</p>
          </div>
        </div>
        <div className="service-list">
          <div className="service-row">
            <div>
              <strong>Local database</strong>
              <span>Workspace records and settings</span>
            </div>
            <StatusLabel
              label={props.data.services.database === "ready" ? "Ready" : "Unavailable"}
              ready={props.data.services.database === "ready"}
            />
          </div>
          <div className="service-row">
            <div>
              <strong>Audit worker</strong>
              <span>Background audit processing</span>
            </div>
            <StatusLabel
              label={props.data.services.worker === "ready" ? "Ready" : "Unavailable"}
              ready={props.data.services.worker === "ready"}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

const emptyStateCopy: Record<
  Exclude<DestinationId, "overview" | "settings">,
  { title: string; body: string }
> = {
  audits: {
    title: "No audits yet",
    body: "Audits will appear here after a website scope is selected.",
  },
  clients: {
    title: "No clients yet",
    body: "Client records will keep websites, pages, audits, and reports together.",
  },
  prospects: {
    title: "No prospects yet",
    body: "Qualified businesses will appear here before promotion to clients.",
  },
  reports: {
    title: "No reports yet",
    body: "Generated audit and summary documents will be available here.",
  },
};

function EmptyDestination(props: { destination: keyof typeof emptyStateCopy }): React.JSX.Element {
  const copy = emptyStateCopy[props.destination];
  return (
    <section aria-labelledby="empty-title" className="section-block empty-destination">
      <FileText aria-hidden="true" size={28} />
      <h2 id="empty-title">{copy.title}</h2>
      <p>{copy.body}</p>
    </section>
  );
}

function SettingsView(props: { data: DesktopBootstrap }): React.JSX.Element {
  return (
    <section aria-labelledby="application-title" className="section-block">
      <div className="section-heading">
        <div>
          <h2 id="application-title">Application</h2>
          <p>Installed desktop application information.</p>
        </div>
      </div>
      <dl className="details-list">
        <div>
          <dt>Version</dt>
          <dd>{props.data.app.version}</dd>
        </div>
        <div>
          <dt>Platform</dt>
          <dd>{props.data.app.platform === "win32" ? "Windows" : props.data.app.platform}</dd>
        </div>
        <div>
          <dt>Database</dt>
          <dd>
            <StatusLabel
              label={props.data.services.database === "ready" ? "Ready" : "Unavailable"}
              ready={props.data.services.database === "ready"}
            />
          </dd>
        </div>
        <div>
          <dt>Audit worker</dt>
          <dd>
            <StatusLabel
              label={props.data.services.worker === "ready" ? "Ready" : "Unavailable"}
              ready={props.data.services.worker === "ready"}
            />
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function App(): React.JSX.Element {
  const [destination, setDestination] = useState<DestinationId>("overview");
  const [state, setState] = useState<LoadState>({ type: "loading" });

  const loadBootstrap = useCallback(async () => {
    setState({ type: "loading" });
    try {
      const data = await window.auditTool.getBootstrap();
      setState({ data, type: "ready" });
    } catch (error) {
      setState({
        message: error instanceof Error ? error.message : "The desktop services did not respond.",
        type: "error",
      });
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const activeDestination = destinations.find((item) => item.id === destination) ?? destinations[0];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span aria-hidden="true" className="brand-mark">
            WA
          </span>
          <div>
            <strong>Website Audit</strong>
            <span>Desktop workspace</span>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          <ul>
            {destinations.map((item) => (
              <NavigationItem
                active={destination === item.id}
                icon={item.icon}
                key={item.id}
                label={item.label}
                onSelect={() => {
                  setDestination(item.id);
                }}
              />
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <ShieldCheck aria-hidden="true" size={17} />
          <span>Local workspace</span>
        </div>
      </aside>

      <main className="main-area">
        <header className="page-header">
          <div>
            <h1>{activeDestination.label}</h1>
            <p>
              {destination === "overview"
                ? "Your audit workspace at a glance."
                : "Website audit workspace."}
            </p>
          </div>
          <button
            aria-label="Refresh workspace"
            className="icon-button"
            disabled={state.type === "loading"}
            onClick={() => void loadBootstrap()}
            title="Refresh workspace"
            type="button"
          >
            <RefreshCw aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="page-content">
          {state.type === "loading" && <LoadingState />}
          {state.type === "error" && (
            <ErrorState message={state.message} onRetry={() => void loadBootstrap()} />
          )}
          {state.type === "ready" && destination === "overview" && <Overview data={state.data} />}
          {state.type === "ready" && destination === "clients" && <ClientWorkspace />}
          {state.type === "ready" && destination === "settings" && (
            <SettingsView data={state.data} />
          )}
          {state.type === "ready" &&
            destination !== "overview" &&
            destination !== "clients" &&
            destination !== "settings" && <EmptyDestination destination={destination} />}
        </div>
      </main>
    </div>
  );
}
