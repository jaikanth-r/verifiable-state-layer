import { getAccessToken } from "./auth-token";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  "http://127.0.0.1:3000"
).replace(/\/+$/, "");

export interface ApiErrorPayload {
  error?: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface Resource {
  id: string;
  resourceType: string;
  externalId: string;
  createdAt: string;
}

export interface Version {
  version: number;
  eventId: string;
  eventType: string;
  actorId: string;
  timestamp: string;
  state: Record<string, unknown>;
  stateHash: string;
  previousStateHash: string | null;
}

export interface AnchorBatch {
  id: string;
  merkleRoot: string;
  protocolVersion: string;
  status: "pending" | "submitted" | "anchored" | "failed";
  blockchainReference: string | null;
  eventCount: number;
  createdAt: string;
  anchoredAt: string | null;
}

export interface VerificationResult {
  valid: boolean;
  eventId: string;
  batchId: string;
  merkleRoot: string;
  proof: {
    leaf: string;
    index: number;
    siblings: string[];
    root: string;
  } | null;
  reason?: string;
}

export interface AuditRecord {
  id: string;
  occurredAt: string;
  tenantId: string;
  userId: string | null;
  action: string;
  outcome: "success" | "failure" | "denied";
  resourceId: string | null;
  requestId: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditPage {
  items: AuditRecord[];
  limit: number;
  offset: number;
  count: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const accessToken = getAccessToken();

  console.log("[VSL API AUTH]", {
    path,
    hasAccessToken: Boolean(accessToken),
    tokenLength: accessToken?.length ?? 0,
    authorizationHeaderBefore: headers.has("authorization")
  });



  if (accessToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;

    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      // Non-JSON response.
    }

    const code =
      typeof payload?.error === "string"
        ? payload.error
        : undefined;

    const message =
      code === "UNAUTHENTICATED"
        ? "Authentication required"
        : code === "FORBIDDEN"
          ? "You do not have permission to perform this action"
          : code === "INVALID_REQUEST"
            ? "The request is invalid"
            : code === "NOT_FOUND"
              ? "The requested resource was not found"
              : `Request failed (${response.status})`;

    throw new ApiError(
      message,
      response.status,
      code,
      payload?.details
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface OverviewSummary {
  resources: number;
  evidenceEvents: number;
  anchoredBatches: number;
  pendingBatches: number;
  failedBatches: number;
  recentResources: Resource[];
  recentAudit: Array<{
    id: string;
    occurredAt: string;
    userId: string | null;
    action: string;
    outcome: "success" | "failure" | "denied";
    resourceId: string | null;
  }>;
}

export function getOverview() {
  return request<OverviewSummary>("/v1/overview");
}

export function listResources() {
  return request<{
    items: Resource[];
  }>("/v1/resources");
}

export function createResource(input: {
  resourceType: string;
}) {
  return request<Resource>("/v1/resources", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export interface EvidenceCreateResult {
  event: Version;
  protection: {
    status: "protected" | "already_protected" | "failed";
    batch: AnchorBatch | null;
    error?: string;
  };
}

export function createEvent(
  resourceId: string,
  input: {
    eventType:
      | "create"
      | "update"
      | "amend"
      | "approve"
      | "complete"
      | "revoke";
    state: Record<string, unknown>;
  }
) {
  return request<EvidenceCreateResult>(
    `/v1/resources/${resourceId}/events`,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
  );
}

export function getHistory(resourceId: string) {
  return request<{
    resourceId: string;
    versions: Version[];
  }>(`/v1/resources/${resourceId}/history`);
}

export function protectResource(resourceId: string) {
  return request<{
    status: "protected" | "already_protected";
    batch: AnchorBatch | null;
  }>(`/v1/resources/${resourceId}/protect`, {
    method: "POST"
  });
}

export function createBatch(batchSize = 100) {
  return request<AnchorBatch | null>("/v1/batches", {
    method: "POST",
    body: JSON.stringify({ batchSize })
  });
}

export function anchorBatch(batchId: string) {
  return request<AnchorBatch>(
    `/v1/batches/${batchId}/anchor`,
    {
      method: "POST"
    }
  );
}

export function getBatch(batchId: string) {
  return request<AnchorBatch>(
    `/v1/batches/${batchId}`
  );
}

export function verifyEvent(eventId: string) {
  return request<VerificationResult>(
    `/v1/verify/${eventId}`
  );
}

export function getAuditEvents(options: {
  limit?: number;
  offset?: number;
  action?: string;
  outcome?: "success" | "failure" | "denied";
} = {}) {
  const params = new URLSearchParams();

  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }

  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }

  if (options.action) {
    params.set("action", options.action);
  }

  if (options.outcome) {
    params.set("outcome", options.outcome);
  }

  const query = params.toString();

  return request<AuditPage>(
    `/v1/audit${query ? `?${query}` : ""}`
  );
}
