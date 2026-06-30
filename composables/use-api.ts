// composables/use-api.ts
// 공통 API 래퍼 — 저장 토큰을 Authorization: Bearer 헤더로 자동 첨부하고
// 쿠키 폴백(credentials:'include')도 유지한다.
// 401 응답 시 토큰·사용자 상태를 정리하고 /login으로 자연스럽게 리다이렉트한다.

/**
 * 표준 fetch 시그니처와 호환. 기존 `fetch(url, init)` 호출을 그대로 `apiFetch(url, init)`로
 * 교체할 수 있다.
 *
 * 동작:
 *  - `credentials: 'include'` 기본 적용(쿠키 폴백).
 *  - 저장 토큰이 있으면 `Authorization: Bearer <token>` 헤더 자동 첨부
 *    (호출부가 명시한 헤더가 우선).
 *  - 401 응답 시: 토큰·userState 정리 후 `/login?redirect=...`로 이동.
 *    단 현재 경로가 /login·/slogin 이면 리다이렉트 생략(루프 방지).
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {});

  // 저장 토큰이 있고, 호출부가 Authorization을 직접 지정하지 않았다면 자동 첨부.
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(input, {
    credentials: "include",
    ...init,
    headers,
  });

  if (res.status === 401) {
    handleUnauthorized();
  }

  return res;
}

/** 401 처리: 토큰·사용자 상태 정리 후 /login으로 리다이렉트(클라이언트 전용). */
function handleUnauthorized(): void {
  if (!import.meta.client) return;

  clearAuthToken();
  const userState = useAuthUser();
  userState.value = null;

  const route = useRoute();
  const path = route.path;
  // 로그인/SSO 핸드오프 화면에서는 리다이렉트 생략(루프 방지).
  if (path === "/login" || path === "/slogin") return;

  navigateTo({ path: "/login", query: { redirect: route.fullPath } });
}
