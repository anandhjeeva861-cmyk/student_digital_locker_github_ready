const API_BASE_KEY = "sdl_api_base";
const TOKEN_KEY = "sdl_api_token";

export const API_BASE = localStorage.getItem(API_BASE_KEY) || "http://localhost:3000/api";

export function setApiBase(url) {
  localStorage.setItem(API_BASE_KEY, url.replace(/\/$/, ""));
}

export function token() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(value) {
  localStorage.setItem(TOKEN_KEY, value);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function headers(extra = {}) {
  const authToken = token();
  return {
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...extra
  };
}

async function parse(response) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === "object" ? body.error : body;
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return body;
}

export async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, { headers: headers() });
  return parse(response);
}

export async function apiPost(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body)
  });
  return parse(response);
}

export async function apiUpload(path, formData) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: formData
  });
  return parse(response);
}

export async function apiDelete(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: headers()
  });
  return parse(response);
}

export function fileUrl(relativeUrl) {
  if (!relativeUrl) return "";
  if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;
  const separator = relativeUrl.includes("?") ? "&" : "?";
  const authToken = token();
  return `${API_BASE.replace(/\/api$/, "")}${relativeUrl}${authToken ? `${separator}token=${encodeURIComponent(authToken)}` : ""}`;
}
