// composables/use-bots.ts
// 챗봇(봇) 관리 — 페르소나 + 답변범위 + 학습소스 결합 모델.
// 현재는 백엔드 API 없이 localStorage 로 영속(데모). 추후 GET/POST/PATCH/DELETE /admin/bots 연동 예정.
//   - 봇 = 캐릭터(말투·성격·시스템프롬프트) + 답변범위(서비스·가시성·"모름" 정책) + 학습소스(자료셋·표준답변)
//   - 데이터 형태는 백엔드 hp_bot / hp_bot_source 설계와 1:1 매핑되도록 잡았다.

export type BotStatus = "active" | "inactive" | "draft";
export type Tone = "formal" | "friendly" | "concise";
export type UnknownPolicy = "strict" | "normal" | "lenient";
export type Visibility = "public" | "internal";
export type StdAnswerScope = "all" | "service";

export interface Bot {
  id: string;
  name: string;
  avatar: string; // 이모지 1자
  description: string;
  status: BotStatus;

  // ── 캐릭터 / 페르소나 ──
  tone: Tone;
  traits: string[]; // 성격 태그
  greeting: string;
  systemPrompt: string;

  // ── 답변 범위 ──
  services: string[]; // 서비스 slug (SERVICE_OPTS)
  topics: string[]; // 자유 토픽 태그
  visibility: Visibility; // 공개 자료만 / 비공개 포함
  unknownPolicy: UnknownPolicy; // "모르면 모른다" 강도
  escalationThreshold: number; // 0~1, 이 신뢰도 미만이면 상담사 연결
  refusalTopics: string[]; // 답변 금지 주제

  // ── 학습 소스 ──
  materialSetIds: string[]; // 학습 자료셋 (MATERIAL_SETS)
  useStandardAnswers: boolean;
  standardAnswerScope: StdAnswerScope;
  excludeRules: string; // 제외 규칙(자유 텍스트)

  // ── 모델 파라미터 ──
  model: string;
  temperature: number;
  maxTokens: number;

  updatedAt: string; // YYYY-MM-DD HH:mm
}

// ── 선택지 상수 (기획 문서의 서비스 카탈로그와 정합) ──
export const SERVICE_OPTS = [
  { value: "lms-general", label: "LMS 일반" },
  { value: "lms-refund", label: "환불·정산" },
  { value: "lms-public", label: "공공기관" },
  { value: "lms-security", label: "보안·인증" },
  { value: "lms-hybrid", label: "하이브리드 운영" },
  { value: "lms-global", label: "글로벌·다국어" },
];

export const TONE_OPTS: { value: Tone; label: string; hint: string }[] = [
  { value: "formal", label: "정중체", hint: "공식·격식 (공공/대학)" },
  { value: "friendly", label: "친근체", hint: "부드럽고 공감적" },
  { value: "concise", label: "간결체", hint: "핵심만 빠르게" },
];

export const TRAIT_OPTS = [
  "차분함",
  "꼼꼼함",
  "공감적",
  "신속함",
  "단계별 안내",
  "공식적",
  "적극적",
  "보수적(추측 자제)",
];

export const UNKNOWN_POLICY_OPTS: { value: UnknownPolicy; label: string; hint: string }[] = [
  { value: "strict", label: "엄격", hint: '근거 없으면 무조건 "모름"·에스컬레이션' },
  { value: "normal", label: "보통", hint: "근거 부족 시 모름, 일부 일반 안내 허용" },
  { value: "lenient", label: "관대", hint: "일반 상식 보강 허용(환각 위험↑)" },
];

export const VISIBILITY_OPTS: { value: Visibility; label: string; hint: string }[] = [
  { value: "public", label: "공개 자료만", hint: "고객 노출용 — 비공개 댓글/내부자료 제외" },
  { value: "internal", label: "비공개 포함", hint: "상담사 보조용 — 내부자료까지 참조" },
];

export const STD_SCOPE_OPTS: { value: StdAnswerScope; label: string }[] = [
  { value: "all", label: "전사 공통 + 서비스" },
  { value: "service", label: "이 봇의 서비스만" },
];

export const MATERIAL_SETS = [
  { id: "manuals", label: "매뉴얼 문서", hint: "PDF·DOCX·HWP 등 제품 매뉴얼" },
  { id: "videos", label: "동영상 스크립트", hint: "교육 영상 트랜스크립트" },
  { id: "legacy-qa", label: "기존 Q&A", hint: "PMS 누적 상담 1,358건" },
  { id: "std-answers", label: "표준답변 카탈로그", hint: "검증된 표준답변" },
  { id: "faq", label: "FAQ 모음", hint: "자주 묻는 질문 정리" },
];

export const MODEL_OPTS = [
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 mini (기본)" },
  { value: "openai/gpt-4.1", label: "GPT-4.1" },
  { value: "openai/gpt-4o", label: "GPT-4o" },
  { value: "anthropic/claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
];

export const STATUS_META: Record<BotStatus, { label: string; cls: string; dot: string }> = {
  active: { label: "활성", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  inactive: { label: "비활성", cls: "bg-slate-100 text-slate-500 ring-slate-200", dot: "bg-slate-400" },
  draft: { label: "초안", cls: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
};

export function serviceLabel(slug: string) {
  return SERVICE_OPTS.find((s) => s.value === slug)?.label ?? slug;
}

function nowStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── 시드(데모) ──
const SEED_BOTS: Bot[] = [
  {
    id: "bot-lms-general",
    name: "LMS 일반 상담봇",
    avatar: "🤖",
    description: "LMS 사용법 전반을 안내하는 기본 상담봇. 대부분의 일반 문의를 1차 응대.",
    status: "active",
    tone: "friendly",
    traits: ["공감적", "단계별 안내", "꼼꼼함"],
    greeting: "안녕하세요! 맑은도우미입니다. 무엇을 도와드릴까요?",
    systemPrompt:
      '당신은 맑은소프트 LMS 전문 고객상담 AI입니다. 제공된 문서와 표준답변만 근거로 답변하고, 확인되지 않은 정보는 "모름"으로 처리하세요. 답변에는 항상 출처를 함께 제시하고, 단계가 있는 안내는 번호로 나눠 설명합니다. 항상 한국어로 응답합니다.',
    services: ["lms-general"],
    topics: ["로그인", "수강신청", "진도", "과제"],
    visibility: "public",
    unknownPolicy: "strict",
    escalationThreshold: 0.5,
    refusalTopics: ["환불 금액 확정", "계약 조건 변경"],
    materialSetIds: ["manuals", "faq", "std-answers"],
    useStandardAnswers: true,
    standardAnswerScope: "all",
    excludeRules: "비공개 댓글 본문, 내부 운영 메모는 인용 금지",
    model: "openai/gpt-4.1-mini",
    temperature: 0.3,
    maxTokens: 2048,
    updatedAt: "2026-06-09 14:10",
  },
  {
    id: "bot-lms-refund",
    name: "환불·정산 전문봇",
    avatar: "💳",
    description: "환불·정산 정책처럼 민감하고 정확성이 중요한 문의를 다루는 보수적 봇.",
    status: "active",
    tone: "formal",
    traits: ["보수적(추측 자제)", "공식적", "꼼꼼함"],
    greeting: "환불·정산 관련 문의를 도와드리겠습니다.",
    systemPrompt:
      "당신은 환불·정산 정책 전문 상담 AI입니다. 금액·기한·조건은 반드시 표준답변과 정책 문서에 근거해서만 답하고, 근거가 없으면 즉시 상담사에게 연결하세요. 추측·일반화는 절대 금지합니다.",
    services: ["lms-refund"],
    topics: ["환불 기한", "부분 환불", "세금계산서", "정산"],
    visibility: "public",
    unknownPolicy: "strict",
    escalationThreshold: 0.7,
    refusalTopics: ["개별 환불 금액 확정", "예외 승인"],
    materialSetIds: ["std-answers", "manuals"],
    useStandardAnswers: true,
    standardAnswerScope: "service",
    excludeRules: "금액을 직접 계산해 단정하지 말 것. 항상 담당자 확인 권유.",
    model: "openai/gpt-4.1",
    temperature: 0.1,
    maxTokens: 1536,
    updatedAt: "2026-06-08 17:32",
  },
  {
    id: "bot-public-internal",
    name: "공공기관 전용봇",
    avatar: "🏛️",
    description: "공공기관 고객사 대상 격식체 봇. 내부 자료까지 참조하는 상담사 보조용(초안).",
    status: "draft",
    tone: "formal",
    traits: ["공식적", "차분함", "보수적(추측 자제)"],
    greeting: "안녕하십니까. 공공기관 전용 상담 도우미입니다.",
    systemPrompt:
      "당신은 공공기관 고객사를 응대하는 격식 있는 상담 AI입니다. 공문 톤을 유지하고, 보안·개인정보 관련 안내는 특히 신중하게 처리합니다.",
    services: ["lms-public", "lms-security"],
    topics: ["보안 인증", "접근 권한", "감사 로그"],
    visibility: "internal",
    unknownPolicy: "normal",
    escalationThreshold: 0.6,
    refusalTopics: ["내부 시스템 구조 노출", "개인정보 조회"],
    materialSetIds: ["manuals", "legacy-qa"],
    useStandardAnswers: true,
    standardAnswerScope: "service",
    excludeRules: "고객사 식별정보·개인정보는 마스킹. 내부 자료 출처는 외부에 노출 금지.",
    model: "openai/gpt-4.1-mini",
    temperature: 0.2,
    maxTokens: 2048,
    updatedAt: "2026-06-09 09:05",
  },
];

const STORAGE_KEY = "malgn-admin-bots-v1";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function loadFromStorage(): Bot[] | null {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Bot[]) : null;
  } catch {
    return null;
  }
}

export function useBots() {
  const bots = useState<Bot[]>("admin-bots", () => clone(SEED_BOTS));
  const hydrated = useState<boolean>("admin-bots-hydrated", () => false);

  /** 클라이언트 진입 시 localStorage 에서 1회 복원 */
  function ensureHydrated() {
    if (import.meta.client && !hydrated.value) {
      const stored = loadFromStorage();
      if (stored && Array.isArray(stored)) bots.value = stored;
      hydrated.value = true;
    }
  }

  function persist() {
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bots.value));
      } catch {
        /* quota 무시 */
      }
    }
  }

  function get(id: string): Bot | undefined {
    return bots.value.find((b) => b.id === id);
  }

  function upsert(bot: Bot) {
    bot.updatedAt = nowStr();
    const i = bots.value.findIndex((b) => b.id === bot.id);
    if (i >= 0) bots.value[i] = clone(bot);
    else bots.value.unshift(clone(bot));
    persist();
  }

  function remove(id: string) {
    bots.value = bots.value.filter((b) => b.id !== id);
    persist();
  }

  function toggleStatus(id: string) {
    const b = get(id);
    if (!b) return;
    b.status = b.status === "active" ? "inactive" : "active";
    b.updatedAt = nowStr();
    persist();
  }

  function resetSeed() {
    bots.value = clone(SEED_BOTS);
    persist();
  }

  /** 새 봇 기본값 */
  function blankBot(): Bot {
    const id = `bot-${Date.now().toString(36)}`;
    return {
      id,
      name: "",
      avatar: "🤖",
      description: "",
      status: "draft",
      tone: "friendly",
      traits: [],
      greeting: "안녕하세요! 무엇을 도와드릴까요?",
      systemPrompt:
        '당신은 맑은소프트 솔루션 전문 고객상담 AI입니다. 제공된 문서와 표준답변만 근거로 답변하고, 확인되지 않은 정보는 "모름"으로 처리하세요. 항상 한국어로 응답합니다.',
      services: [],
      topics: [],
      visibility: "public",
      unknownPolicy: "strict",
      escalationThreshold: 0.5,
      refusalTopics: [],
      materialSetIds: ["std-answers"],
      useStandardAnswers: true,
      standardAnswerScope: "all",
      excludeRules: "",
      model: "openai/gpt-4.1-mini",
      temperature: 0.3,
      maxTokens: 2048,
      updatedAt: nowStr(),
    };
  }

  return { bots, ensureHydrated, get, upsert, remove, toggleStatus, resetSeed, blankBot };
}
