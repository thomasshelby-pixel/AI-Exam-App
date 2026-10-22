import * as SecureStore from "expo-secure-store";

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
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
