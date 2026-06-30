// composables/use-auth.ts
// admin 인증 — Bearer 토큰(JWT) 기반.
// 로그인/SSO 응답의 token을 localStorage에 저장하고 모든 API 호출에 Authorization 헤더로 전송.
// cross-site 서드파티 쿠키 차단 대응. (쿠키 폴백도 credentials:'include'로 유지)

export type AuthUser = {
  id: number;
  loginId: string;
  name: string;
  email: string;
  company: string;
  level: number;
};

const API_BASE = "https://malgn-helper-api.malgnsoft.workers.dev";

/** localStorage 토큰 키 */
const TOKEN_KEY = "helper_session_token";

export function useAuthUser() {
  return useState<AuthUser | null>("auth-user", () => null);
}

/** 저장된 세션 토큰 조회. 클라이언트에서만 접근(SSR 안전). 없으면 null. */
export function getAuthToken(): string | null {
  if (!import.meta.client) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** 세션 토큰 저장(클라이언트 전용). */
function setAuthToken(token: string): void {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage 접근 불가 시 무시 */
  }
}

/** 세션 토큰 삭제(클라이언트 전용). */
export function clearAuthToken(): void {
  if (!import.meta.client) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

/** 저장 토큰이 있으면 Authorization: Bearer 헤더를 반환. 없으면 빈 객체. */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** /auth/me 호출. 저장 토큰을 Bearer로 전송. 토큰 없거나 401이면 null. */
export async function fetchMe(): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AuthUser };
    return data.user;
  } catch {
    return null;
  }
}

export async function login(loginId: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `로그인 실패 (${res.status})`);
  }
  const data = (await res.json()) as { user: AuthUser; token?: string };
  if (data.token) setAuthToken(data.token);
  const userState = useAuthUser();
  userState.value = data.user;
  return data.user;
}

/** 맑은오피스 SSO — /slogin?ek=&id= 핸드오프. GET /auth/sso 가 검증 후 token/세션 발급. */
export async function ssoLogin(ek: string, id: string) {
  const url = new URL(`${API_BASE}/auth/sso`);
  url.searchParams.set("ek", ek);
  url.searchParams.set("id", id);
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `SSO 로그인 실패 (${res.status})`);
  }
  const data = (await res.json()) as { user: AuthUser; token?: string };
  if (data.token) setAuthToken(data.token);
  const userState = useAuthUser();
  userState.value = data.user;
  return data.user;
}

export async function logout() {
  // 서버 세션(쿠키) 정리. 토큰은 클라이언트에서 폐기.
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { ...authHeaders() },
  }).catch(() => {
    /* 네트워크 실패해도 로컬 상태는 정리 */
  });
  clearAuthToken();
  const userState = useAuthUser();
  userState.value = null;
}

/**
 * tb_user.level 숫자를 admin/developer/agent 역할로 매핑.
 *   - level ≥ 9 → admin
 *   - level ≥ 5 → developer
 *   - 그 외     → agent
 * 추후 운영 정책에 따라 임계값 조정.
 */
export type Role = "admin" | "developer" | "agent";
export function roleOf(level: number): Role {
  if (level >= 9) return "admin";
  if (level >= 5) return "developer";
  return "agent";
}
