// composables/use-bots.ts
// 챗봇(봇) 관리 — 서비스별 구분 + 페르소나 + 답변범위 모델.
// 실 백엔드 /admin/bots 연동(GET/POST/PATCH/DELETE). 서비스 옵션은 /services(hp_service)에서 동적 로드.
//   - 봇 = 캐릭터(말투·성격·시스템프롬프트) + 답변범위(서비스 구분·가시성·"모름" 정책) + 모델 파라미터
//   - 봇 1개 = 서비스 1개(serviceId). serviceId === null → 공통(전 서비스) 봇.
//   - 자료(material) 연결은 백엔드 미도입 → 연기. UI는 "준비중"으로 비활성 표기, 백엔드 미전송.

const API_BASE = "https://malgn-helper-api.malgnsoft.workers.dev";

export type BotStatus = "active" | "inactive" | "draft";
export type Tone = "formal" | "friendly" | "concise";
export type UnknownPolicy = "strict" | "normal" | "lenient";
export type Visibility = "public" | "internal";
export type StdAnswerScope = "all" | "service";

/** 백엔드 BotDto (camelCase, /admin/bots) */
export interface BotDto {
  id: number;
  serviceId: number | null;
  serviceName: string | null;
  name: string;
  avatar: string;
  description: string;
  botStatus: BotStatus;
  tone: Tone;
  traits: string[] | null;
  greeting: string;
  systemPrompt: string;
  visibility: Visibility;
  unknownPolicy: UnknownPolicy;
  escalationThreshold: number;
  refusalTopics: string[] | null;
  topics: string[] | null;
  useStandardAnswers: boolean;
  standardAnswerScope: StdAnswerScope;
  model: string;
  temperature: number;
  maxTokens: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 프론트 모델. BotDto와 1:1 매핑하되,
 *  - 상태 필드는 기존 화면 호환 위해 `status`(=botStatus)로 보존.
 *  - 배열 필드는 null 대신 빈 배열로 정규화(폼 바인딩 편의).
 *  - `materialSetIds`는 자료 연결 연기(백엔드 미전송) — 프론트 데모(materials.vue) 호환용으로만 유지.
 */
export interface Bot {
  id: string; // 라우팅 호환 위해 string. 신규는 ""(빈값)
  serviceId: number | null; // null = 공통(전 서비스)
  serviceName: string | null;
  name: string;
  avatar: string; // 이모지 1자
  description: string;
  status: BotStatus; // = BotDto.botStatus

  // ── 캐릭터 / 페르소나 ──
  tone: Tone;
  traits: string[];
  greeting: string;
  systemPrompt: string;

  // ── 답변 범위 ──
  topics: string[];
  visibility: Visibility;
  unknownPolicy: UnknownPolicy;
  escalationThreshold: number; // 0~1
  refusalTopics: string[];

  // ── (연기) 자료 연결 — 백엔드 미전송 ──
  materialSetIds: string[];
  useStandardAnswers: boolean;
  standardAnswerScope: StdAnswerScope;

  // ── 모델 파라미터 ──
  model: string;
  temperature: number;
  maxTokens: number;

  updatedAt: string;
}

/** BotInput — POST/PATCH 전송 페이로드. materialSetIds·status 별칭 제외, botStatus 사용. */
export interface BotInput {
  serviceId: number | null;
  name: string;
  avatar: string;
  description: string;
  botStatus: BotStatus;
  tone: Tone;
  traits: string[];
  greeting: string;
  systemPrompt: string;
  visibility: Visibility;
  unknownPolicy: UnknownPolicy;
  escalationThreshold: number;
  refusalTopics: string[];
  topics: string[];
  useStandardAnswers: boolean;
  standardAnswerScope: StdAnswerScope;
  model: string;
  temperature: number;
  maxTokens: number;
}

// ── 선택지 상수 ──
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

/**
 * @deprecated 봇 화면은 useServiceOptions()(동적 /services 로드)를 사용한다.
 * materials.vue(localStorage 데모, 범위 밖)의 정적 서비스 칩 호환용으로만 잔존.
 */
export const SERVICE_OPTS = [
  { value: "lms-general", label: "LMS 일반" },
  { value: "lms-public", label: "공공기관" },
  { value: "step", label: "STEP" },
];

/** @deprecated SERVICE_OPTS와 함께 materials.vue 호환용. */
export function serviceLabel(slug: string) {
  return SERVICE_OPTS.find((s) => s.value === slug)?.label ?? slug;
}

// ── 서비스 옵션 동적 로드 (/services = hp_service 카탈로그) ──
export interface ServiceOption {
  id: number;
  slug: string;
  name: string;
}

/** GET /services 결과를 캐싱해 봇 화면의 서비스 드롭다운에 사용. */
export function useServiceOptions() {
  const services = useState<ServiceOption[]>("admin-service-options", () => []);
  const loaded = useState<boolean>("admin-service-options-loaded", () => false);
  const pending = useState<boolean>("admin-service-options-pending", () => false);

  async function load(force = false) {
    if (pending.value) return;
    if (loaded.value && !force) return;
    pending.value = true;
    try {
      const res = await fetch(`${API_BASE}/services`, { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const rows = ((await res.json()) as { rows?: ServiceOption[] }).rows ?? [];
        services.value = rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name }));
        loaded.value = true;
      }
    } catch {
      /* 서비스 로드 실패는 무시 — 드롭다운엔 '공통'만 노출 */
    } finally {
      pending.value = false;
    }
  }

  /** serviceId → 표시명. null이면 '공통(전 서비스)'. */
  function nameOf(serviceId: number | null): string {
    if (serviceId === null || serviceId === undefined) return "공통(전 서비스)";
    return services.value.find((s) => s.id === serviceId)?.name ?? `서비스 #${serviceId}`;
  }

  return { services, loaded, pending, load, nameOf };
}

// ── DTO ↔ Bot 매핑 ──
function fromDto(d: BotDto): Bot {
  return {
    id: String(d.id),
    serviceId: d.serviceId ?? null,
    serviceName: d.serviceName ?? null,
    name: d.name ?? "",
    avatar: d.avatar || "🤖",
    description: d.description ?? "",
    status: d.botStatus ?? "draft",
    tone: d.tone ?? "friendly",
    traits: d.traits ?? [],
    greeting: d.greeting ?? "",
    systemPrompt: d.systemPrompt ?? "",
    topics: d.topics ?? [],
    visibility: d.visibility ?? "public",
    unknownPolicy: d.unknownPolicy ?? "strict",
    escalationThreshold: typeof d.escalationThreshold === "number" ? d.escalationThreshold : 0.5,
    refusalTopics: d.refusalTopics ?? [],
    materialSetIds: [], // 연기 — 백엔드 미보유
    useStandardAnswers: d.useStandardAnswers ?? true,
    standardAnswerScope: d.standardAnswerScope ?? "all",
    model: d.model ?? "openai/gpt-4.1-mini",
    temperature: typeof d.temperature === "number" ? d.temperature : 0.3,
    maxTokens: d.maxTokens ?? 2048,
    updatedAt: (d.updatedAt ?? "").slice(0, 16).replace("T", " "),
  };
}

function toInput(b: Bot): BotInput {
  return {
    serviceId: b.serviceId ?? null,
    name: b.name.trim(),
    avatar: b.avatar || "🤖",
    description: b.description,
    botStatus: b.status,
    tone: b.tone,
    traits: b.traits,
    greeting: b.greeting,
    systemPrompt: b.systemPrompt,
    visibility: b.visibility,
    unknownPolicy: b.unknownPolicy,
    escalationThreshold: b.escalationThreshold,
    refusalTopics: b.refusalTopics,
    topics: b.topics,
    useStandardAnswers: b.useStandardAnswers,
    standardAnswerScope: b.standardAnswerScope,
    model: b.model,
    temperature: b.temperature,
    maxTokens: b.maxTokens,
  };
}

/** 새 봇 기본값 */
export function blankBot(): Bot {
  return {
    id: "",
    serviceId: null,
    serviceName: null,
    name: "",
    avatar: "🤖",
    description: "",
    status: "draft",
    tone: "friendly",
    traits: [],
    greeting: "안녕하세요! 무엇을 도와드릴까요?",
    systemPrompt:
      '당신은 맑은소프트 솔루션 전문 고객상담 AI입니다. 제공된 문서와 표준답변만 근거로 답변하고, 확인되지 않은 정보는 "모름"으로 처리하세요. 항상 한국어로 응답합니다.',
    topics: [],
    visibility: "public",
    unknownPolicy: "strict",
    escalationThreshold: 0.5,
    refusalTopics: [],
    materialSetIds: [],
    useStandardAnswers: true,
    standardAnswerScope: "all",
    model: "openai/gpt-4.1-mini",
    temperature: 0.3,
    maxTokens: 2048,
    updatedAt: "",
  };
}

export interface BotListParams {
  serviceId?: number | "common" | "";
  botStatus?: BotStatus | "";
  limit?: number;
  offset?: number;
}

/**
 * 봇 목록·CRUD. GET은 developer, 쓰기는 서버가 admin(level≥9) 강제.
 * 데이터량이 적으므로 목록은 전체 로드 후 화면에서 serviceId로 그룹핑.
 */
export function useBots() {
  const bots = useState<Bot[]>("admin-bots", () => []);

  async function list(params: BotListParams = {}): Promise<{ rows: Bot[]; total: number }> {
    const qs = new URLSearchParams();
    if (params.serviceId !== undefined && params.serviceId !== "") qs.set("service_id", String(params.serviceId));
    if (params.botStatus) qs.set("bot_status", params.botStatus);
    qs.set("limit", String(params.limit ?? 200));
    qs.set("offset", String(params.offset ?? 0));
    const res = await fetch(`${API_BASE}/admin/bots?${qs.toString()}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error("developer 권한이 필요합니다.");
      throw new Error(`API ${res.status}`);
    }
    const data = (await res.json()) as { rows: BotDto[]; total: number };
    const rows = (data.rows ?? []).map(fromDto);
    bots.value = rows;
    return { rows, total: data.total ?? rows.length };
  }

  async function getOne(id: string): Promise<Bot> {
    const res = await fetch(`${API_BASE}/admin/bots/${id}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) {
      if (res.status === 403) throw new Error("developer 권한이 필요합니다.");
      if (res.status === 404) throw new Error("봇을 찾을 수 없습니다.");
      throw new Error(`API ${res.status}`);
    }
    return fromDto((await res.json()) as BotDto);
  }

  /** 신규(POST) 또는 수정(PATCH). 신규는 b.id === "". */
  async function save(b: Bot): Promise<Bot> {
    const isNew = !b.id;
    const url = isNew ? `${API_BASE}/admin/bots` : `${API_BASE}/admin/bots/${b.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toInput(b)),
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error("admin 권한이 필요합니다.");
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error || `API ${res.status}`);
    }
    return fromDto((await res.json()) as BotDto);
  }

  async function remove(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/bots/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      if (res.status === 403) throw new Error("admin 권한이 필요합니다.");
      throw new Error(`API ${res.status}`);
    }
    bots.value = bots.value.filter((b) => b.id !== id);
  }

  /** 활성/비활성 토글 (PATCH botStatus). */
  async function toggleStatus(id: string): Promise<void> {
    const b = bots.value.find((x) => x.id === id);
    if (!b) return;
    const next: BotStatus = b.status === "active" ? "inactive" : "active";
    const res = await fetch(`${API_BASE}/admin/bots/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botStatus: next }),
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error("admin 권한이 필요합니다.");
      throw new Error(`API ${res.status}`);
    }
    b.status = next;
  }

  // ── 연기/호환 stub ──
  // materials.vue(localStorage 데모, 범위 밖)가 호출. 자료 연결 백엔드 도입 전까지 no-op.
  function ensureHydrated() {
    /* 실 API 연동 — localStorage 복원 불필요. materials.vue 호환용 no-op. */
  }
  /** 자료 연결 연기 — 자료 삭제 시 봇에서 제거할 대상이 없으므로 no-op. */
  function pruneMaterial(_materialId: string) {
    /* 자료 연결(materialSetIds) 백엔드 미도입 — no-op */
  }

  return { bots, list, getOne, save, remove, toggleStatus, blankBot, ensureHydrated, pruneMaterial };
}
