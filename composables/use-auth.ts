// composables/use-auth.ts
// admin 인증 — API의 helper_session cookie + GET /auth/me로 사용자 정보 동기화.

export type AuthUser = {
  id: number;
  loginId: string;
  name: string;
  email: string;
  company: string;
  level: number;
};

const API_BASE = "https://malgn-helper-api.malgnsoft.workers.dev";

export function useAuthUser() {
  return useState<AuthUser | null>("auth-user", () => null);
}

/** /auth/me 호출. cookie가 유효하면 사용자 정보를 가져온다. 401이면 null. */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
      cache: "no-store",
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
    throw new Error((body as any).error || `로그인 실패 (${res.status})`);
  }
  const data = (await res.json()) as { user: AuthUser };
  const userState = useAuthUser();
  userState.value = data.user;
  return data.user;
}

export async function logout() {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
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
