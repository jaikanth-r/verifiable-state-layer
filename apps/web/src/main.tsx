import { StrictMode, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "react-oidc-context";
import { createRoot } from "react-dom/client";

import {
  AppShell,
  type AppSection
} from "./components/AppShell";
import { DashboardView } from "./views/DashboardView";
import { RecordsView } from "./views/RecordsView";
import { oidcConfig } from "./oidc";
import { setAccessToken } from "./auth-token";
import { VerifyView } from "./views/VerifyView";
import { AuditView } from "./views/AuditView";

import "./styles.css";

function App() {
  const auth = useAuth();

  useEffect(() => {
    setAccessToken(auth.user?.access_token ?? null);
  }, [auth.user?.access_token]);

  const [section, setSection] =
    useState<AppSection>("dashboard");

  if (auth.isLoading) {
    return <div>Loading authentication…</div>;
  }

  if (auth.error) {
    return (
      <main>
        <h1>Authentication error</h1>
        <p>{auth.error.message}</p>
        <button type="button" onClick={() => auth.signinRedirect()}>
          Try again
        </button>
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <main>
        <h1>VSL</h1>
        <p>Sign in to access the Verifiable State Layer.</p>
        <button type="button" onClick={() => auth.signinRedirect()}>
          Sign in
        </button>
      </main>
    );
  }

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
    <AuthProvider
      {...oidcConfig}
      onSigninCallback={() => {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }}
    >
      <App />
    </AuthProvider>
  </StrictMode>
);
