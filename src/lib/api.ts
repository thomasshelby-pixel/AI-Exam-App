import * as SecureStore from "expo-secure-store";

const DEFAULT_API_BASE_URL = "https://caexamcheckerai.com";
const API_BASE_URL = ((process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
export { API_BASE_URL };
const TOKEN_KEY = "ai_exam_session_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function saveSessionToken(token: string) {
  if (!token.trim()) throw new Error("Cannot store an empty session token.");
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error("The existing AI-Exam API URL is not configured.");
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("API paths must be relative to the configured trusted API host.");

  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const headers = new Headers(init.headers);
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
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : response.status === 401 ? "Your session has expired. Please sign in again."
      : response.status === 403 ? "You do not have permission to access this feature."
      : `The server returned an error (${response.status}).`;
    if (response.status === 401) await clearSession();
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
  const result = await FileSystem.downloadAsync(`${API_BASE_URL}${path}`, destination, { headers: { Accept: "application/pdf", Authorization: `Bearer ${token}` } });
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
