const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  "http://172.20.10.2:3000";

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
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = new Headers(options?.headers);

  if (options?.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(
      `API ${response.status}: ${await response.text()}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function createResource(input: {
  resourceType: string;
  externalId?: string;
}) {
  return request<Resource>("/v1/resources", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function createEvent(
  resourceId: string,
  input: {
    eventId: string;
    eventType:
      | "create"
      | "update"
      | "amend"
      | "approve"
      | "complete"
      | "revoke";
    actorId: string;
    timestamp: string;
    state: Record<string, unknown>;
  }
) {
  return request<Version>(
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
  return request<AnchorBatch>(`/v1/batches/${batchId}`);
}

export function verifyEvent(eventId: string) {
  return request<VerificationResult>(
    `/v1/verify/${eventId}`
  );
}
