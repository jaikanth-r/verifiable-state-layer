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
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(
      `API ${response.status}: ${await response.text()}`
    );
  }

  return response.json() as Promise<T>;
}

export function getResource(resourceId: string) {
  return request<Resource>(`/v1/resources/${resourceId}`);
}

export function getHistory(resourceId: string) {
  return request<{
    resourceId: string;
    versions: Version[];
  }>(`/v1/resources/${resourceId}/history`);
}

export function getBatch(batchId: string) {
  return request<AnchorBatch>(`/v1/batches/${batchId}`);
}

export function verifyEvent(eventId: string) {
  return request<VerificationResult>(`/v1/verify/${eventId}`);
}
