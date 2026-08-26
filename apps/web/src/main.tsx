import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  AppShell,
  type AppSection
} from "./components/AppShell";
import { DashboardView } from "./views/DashboardView";
import { RecordsView } from "./views/RecordsView";
import { VerifyView } from "./views/VerifyView";
import { AuditView } from "./views/AuditView";

import "./styles.css";

function App() {
  const [section, setSection] =
    useState<AppSection>("dashboard");

  function handleSectionChange(nextSection: AppSection) {
    setSection(nextSection);
  }

  function renderSection() {
    switch (section) {
      case "dashboard":
        return (
          <DashboardView
            onCreateRecord={() => setSection("records")}
            onVerify={() => setSection("verify")}
            onAudit={() => setSection("audit")}
          />
        );

      case "records":
        return <RecordsView />;

      case "verify":
        return <VerifyView />;

      case "audit":
        return <AuditView />;
    }
  }

  return (
    <AppShell
      section={section}
      onSectionChange={handleSectionChange}
    >
      {renderSection()}
    </AppShell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
