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
  const token = auth.user?.access_token ?? null;
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    console.log("[VSL AUTH]", {
      isAuthenticated: auth.isAuthenticated,
      hasAccessToken: Boolean(token),
      tokenLength: token?.length ?? 0,
      tokenSegments: token ? token.split(".").length : 0,
      expiresAt: auth.user?.expires_at ?? null
    });

    setAccessToken(token);

    if (auth.isAuthenticated && token) {
      setTokenReady(true);
    } else {
      setTokenReady(false);
    }
  }, [
    auth.isAuthenticated,
    token,
    auth.user?.expires_at
  ]);

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
      <main className="vsl-auth">
        <div className="vsl-status">
          <span className="vsl-status-dot" />
          System operational
        </div>

        <div className="vsl-brand">
          <h1>VSL</h1>
          <p>VERIFIABLE STATE LAYER</p>
        </div>

        <p className="vsl-tagline">
          Cryptographic evidence, Merkle integrity, and blockchain
          anchoring for application state you can independently verify.
        </p>

        <button
          type="button"
          className="vsl-signin"
          onClick={() => auth.signinRedirect()}
        >
          Sign in
        </button>

        <p className="vsl-footnote">Secured with ZITADEL · OIDC</p>
      </main>
    );
  }

  if (!tokenReady) {
    return <div>Preparing authenticated session…</div>;
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
