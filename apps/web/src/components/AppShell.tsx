import type { ReactNode } from "react";

export type AppSection =
  | "dashboard"
  | "records"
  | "verify"
  | "audit";

interface AppShellProps {
  section: AppSection;
  onSectionChange: (section: AppSection) => void;
  children: ReactNode;
}

const navigation: Array<{
  id: AppSection;
  label: string;
  description: string;
}> = [
  {
    id: "dashboard",
    label: "Overview",
    description: "System status"
  },
  {
    id: "records",
    label: "Records",
    description: "Protected state"
  },
  {
    id: "verify",
    label: "Verify",
    description: "Independent proof"
  },
  {
    id: "audit",
    label: "Audit",
    description: "Security activity"
  }
];

export function AppShell({
  section,
  onSectionChange,
  children
}: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">V</div>

          <div>
            <strong>VSL</strong>
            <span>Verifiable State Layer</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = item.id === section;

            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => onSectionChange(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <span className="online-dot" />
          <div>
            <strong>System operational</strong>
            <small>Protection services online</small>
          </div>
        </div>
      </aside>

      <main className="shell-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">VERIFIABLE STATE LAYER</p>
            <h1>Evidence you can verify.</h1>
          </div>

          <div className="topbar-status">
            <span className="online-dot" />
            Operational
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
