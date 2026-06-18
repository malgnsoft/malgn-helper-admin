// composables/use-admin-menu.ts
// admin 사이드바 메뉴 정의. 기획서(ADMIN-PLAN.md §3-2)와 1:1 매핑.
// 권한: 'admin' | 'developer' | 'agent' — 빈 배열이면 누구나 표시.

export type { Role } from "./use-auth";

export type MenuLeaf = {
  key: string;
  label: string;
  path: string;
  icon: string;          // lucide-vue-next 컴포넌트 이름 (kebab → PascalCase 변환은 컴포넌트에서)
  roles?: Role[];        // 비어있으면 모두
  badge?: { value: number | string; color: "primary" | "warning" | "error" | "neutral" };
  external?: boolean;    // 외부 링크
};

export type MenuGroup = {
  key: string;
  label: string;
  items: MenuLeaf[];
};

export const ADMIN_MENU: MenuGroup[] = [
  {
    key: "ops",
    label: "운영 보드",
    items: [
      { key: "home", label: "홈", path: "/", icon: "home" },
      { key: "uncovered", label: "미커버 질문", path: "/uncovered", icon: "circle-help" },
      { key: "escalations", label: "에스컬레이션", path: "/escalations", icon: "bell-ring" },
      { key: "chat-logs", label: "챗봇 로그", path: "/chat-logs", icon: "message-square-text" },
      { key: "qa-evals", label: "Q&A 평가", path: "/qa-evals", icon: "clipboard-check" },
    ],
  },
  {
    key: "knowledge",
    label: "지식 자산",
    items: [
      { key: "bots", label: "봇 관리", path: "/bots", icon: "bot", roles: ["admin", "developer"] },
      { key: "standard-answers", label: "Q&A 표준답변", path: "/standard-answers", icon: "bookmark" },
      // 안내글(표준 안내답변): staff 첫 작성 안내글 트랙. Q&A 표준답변과 별도 테이블(hp_announce)로 분리.
      // GET /announces 실연동 — 목록/분류/승인 워크플로. 조회 developer↑, 본문수정/삭제 admin. 승인대기 배지 announces.vue 갱신.
      { key: "announces", label: "안내글", path: "/announces", icon: "megaphone", roles: ["admin", "developer"] },
      { key: "materials", label: "학습 자료", path: "/materials", icon: "file-text" },
      { key: "images", label: "이미지 카탈로그", path: "/images", icon: "image" },
      { key: "catalog", label: "토픽·서비스", path: "/catalog", icon: "tag", roles: ["admin", "developer"] },
    ],
  },
  {
    key: "analytics",
    label: "분석·비용",
    items: [
      { key: "cost", label: "LLM 비용", path: "/cost", icon: "dollar-sign", roles: ["admin", "developer"] },
      { key: "quality", label: "응답 품질", path: "/analytics/quality", icon: "trending-up", roles: ["admin", "developer"] },
      { key: "usage", label: "사용량", path: "/analytics/usage", icon: "pie-chart", roles: ["admin", "developer"] },
    ],
  },
  {
    key: "settings",
    label: "설정",
    items: [
      { key: "settings-ai", label: "AI 설정", path: "/settings/ai", icon: "sparkles", roles: ["admin", "developer"] },
      { key: "settings-safety", label: "안전 가드", path: "/settings/safety", icon: "shield-check", roles: ["admin", "developer"] },
      { key: "settings-cache", label: "캐싱", path: "/settings/cache", icon: "database", roles: ["admin", "developer"] },
      { key: "settings-integrations", label: "외부 연동", path: "/settings/integrations", icon: "link", roles: ["admin", "developer"] },
    ],
  },
  {
    key: "system",
    label: "시스템",
    items: [
      { key: "accounts", label: "계정", path: "/accounts", icon: "users", roles: ["admin"] },
      { key: "audit-logs", label: "감사 로그", path: "/audit-logs", icon: "clipboard-list", roles: ["admin", "developer"] },
      {
        key: "api-doc",
        label: "API 문서",
        path: "https://malgn-helper-api.malgnsoft.workers.dev/doc",
        icon: "code-2",
        roles: ["admin", "developer"],
        external: true,
      },
    ],
  },
];

/** 현재 사용자 역할로 필터링한 메뉴 (역할 미설정 시 모두 표시) */
export function useAdminMenu(currentRole?: Role) {
  return computed(() =>
    ADMIN_MENU.map((g) => ({
      ...g,
      items: g.items.filter((it) => !it.roles || !currentRole || it.roles.includes(currentRole)),
    })).filter((g) => g.items.length > 0),
  );
}

/** badge 폴링 — 현재는 stub. 실제 API 연동은 GET /admin/badges */
export function useAdminBadges() {
  return useState<Record<string, { value: number | string; color: "primary" | "warning" | "error" | "neutral" }>>(
    "admin-badges",
    () => ({
      // 데모 값(Phase 2 챗봇 데이터 의존) — 추후 GET /admin/badges로 폴링
      uncovered: { value: 12, color: "error" },
      escalations: { value: 3, color: "warning" },
      // standard-answers 배지는 실데이터 — standard-answers.vue 가 승인 대기(draft+reviewing) 카운트로 갱신.
    }),
  );
}
