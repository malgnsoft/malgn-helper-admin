// middleware/auth.global.ts
// 모든 라우트에서 인증 체크. 미인증이면 /login으로 리다이렉트.
// /login·/forbidden·/slogin(맑은오피스 SSO)은 예외.

export default defineNuxtRouteMiddleware(async (to) => {
  if (process.server) return; // SSR skip — cookie는 클라이언트에서 검증

  // 인증 불필요 경로 (/slogin = 맑은오피스 SSO 핸드오프, 자체적으로 세션 발급)
  if (to.path === "/login" || to.path === "/forbidden" || to.path === "/slogin") return;

  const userState = useAuthUser();

  // 이미 사용자 정보 있으면 통과
  if (userState.value) return;

  // /auth/me로 cookie 검증
  const me = await fetchMe();
  if (me) {
    userState.value = me;
    return;
  }

  // 미인증 → /login으로 (원래 경로 redirect 파라미터로 보존)
  return navigateTo({ path: "/login", query: { redirect: to.fullPath } });
});
