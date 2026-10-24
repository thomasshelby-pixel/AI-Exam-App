import * as SecureStore from "expo-secure-store";

const DEFAULT_API_BASE_URL = "https://caexamcheckerai.com";
const API_BASE_URL = ((process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
export { API_BASE_URL };
const TOKEN_KEY = "ai_exam_session_token";

const DEVICE_ID_KEY = "ca_exam_checker_device_id";
const DEVICE_TRUST_TOKEN_KEY = "ca_exam_checker_device_trust_token";

/**
 * Stable random installation identifier used only for the backend's device-session
 * and free-trial-abuse controls. It is not an authentication credential.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const current = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (current && /^[a-zA-Z0-9_-]{24,160}$/.test(current)) return current;
  const generated = "mob_" + Array.from({ length: 6 }, () =>
    Math.random().toString(36).slice(2, 12)
  ).join("");
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}


export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveSessionToken(token: string) {
  if (!token.trim()) throw new Error("Cannot store an empty session token.");
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function saveDeviceTrustToken(token?: string | null) {
  if (token && token.trim()) {
    await SecureStore.setItemAsync(DEVICE_TRUST_TOKEN_KEY, token.trim());
  } else {
    await SecureStore.deleteItemAsync(DEVICE_TRUST_TOKEN_KEY);
  }
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(DEVICE_TRUST_TOKEN_KEY),
  ]);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error("The existing AI-Exam API URL is not configured.");
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("API paths must be relative to the configured trusted API host.");

  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const headers = new Headers(init.headers);
  const deviceId = await getOrCreateDeviceId();
  headers.set("X-Device-Id", deviceId);
  const deviceTrustToken = await SecureStore.getItemAsync(DEVICE_TRUST_TOKEN_KEY);
  if (deviceTrustToken) headers.set("X-Device-Trust-Token", deviceTrustToken);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error("Could not reach the AI-Exam server. Check your connection and try again.");
  }

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try { payload = JSON.parse(raw); } catch { payload = raw; }
  }
  if (!response.ok) {
    const responseObject = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : null;
    const serverMessage = typeof responseObject?.error === "string" ? responseObject.error : null;
    const serverCode = typeof responseObject?.code === "string" ? responseObject.code : null;

    // A 401 can mean failed re-authentication (e.g. an incorrect password) rather
    // than an expired bearer token. Only wipe the session for known auth/session
    // failures so account recovery/deletion verification can be retried safely.
    const invalidSession = response.status === 401 && (
      serverCode === "SESSION_EXPIRED" ||
      serverCode === "SESSION_REVOKED" ||
      serverMessage === "Session expired or invalid token. Please log in again." ||
      serverMessage === "User account not found."
    );

    const message = serverMessage
      ?? (response.status === 401 ? "Your session may have expired. Please sign in again if the problem continues."
      : response.status === 403 ? "You do not have permission to access this feature."
      : `The server returned an error (${response.status}).`);

    if (invalidSession) await clearSession();
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export async function downloadAndShareAuthenticatedFile(path: string, filename: string): Promise<void> {
  if (!API_BASE_URL) throw new Error("The existing AI-Exam API URL is not configured.");
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid download path.");
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) throw new Error("Invalid download filename.");
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) throw new Error("Please sign in again before downloading this file.");
  const FileSystem = await import("expo-file-system/legacy");
  const Sharing = await import("expo-sharing");
  if (!FileSystem.documentDirectory) throw new Error("This device does not provide a document storage location.");
  const destination = `${FileSystem.documentDirectory}${filename}`;
  const downloadHeaders: Record<string, string> = {
    Accept: "application/pdf",
    Authorization: `Bearer ${token}`,
    "X-Device-Id": await getOrCreateDeviceId(),
  };
  const deviceTrustToken = await SecureStore.getItemAsync(DEVICE_TRUST_TOKEN_KEY);
  if (deviceTrustToken) downloadHeaders["X-Device-Trust-Token"] = deviceTrustToken;
  const result = await FileSystem.downloadAsync(`${API_BASE_URL}${path}`, destination, { headers: downloadHeaders });
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    if (result.status === 401) await clearSession();
    throw new ApiError(result.status === 403 ? "You do not have permission to download this file." : `The server could not provide the PDF (HTTP ${result.status}).`, result.status);
  }
  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || (typeof info.size === "number" && info.size === 0)) throw new Error("The server returned an empty file.");
  if (!(await Sharing.isAvailableAsync())) throw new Error("Secure file download succeeded, but this device cannot open the share sheet.");
  await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Open or save evaluation PDF" });
}
