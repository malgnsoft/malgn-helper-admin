// composables/use-materials.ts
// 학습 자료(소스) 라이브러리 — NotebookLM의 "소스"에 해당.
// 자료 = 파일/URL/텍스트/Q&A 한 건. 봇(use-bots)이 materialSetIds 로 여기서 골라 학습한다.
// 현재 백엔드 없이 localStorage 영속(데모). 추후 R2 업로드 + OpenSearch 인덱싱 + /materials API 연동 예정.

export type MaterialType = "file" | "url" | "text" | "qa";
export type MaterialStatus = "indexed" | "processing" | "failed";

export interface Material {
  id: string;
  name: string;
  type: MaterialType;
  source: string; // 파일명 / URL / 텍스트 출처
  format: string; // PDF · DOCX · TXT · URL · Q&A
  status: MaterialStatus;
  summary: string; // 자동 요약(미리보기)
  chunks: number; // 색인 청크 수
  sizeLabel: string; // "1.2 MB" / "8쪽" / "1,146건"
  tags: string[];
  services: string[]; // 연관 서비스 slug (use-bots SERVICE_OPTS)
  addedAt: string; // YYYY-MM-DD
  error?: string; // failed 사유
}

export const MATERIAL_TYPE_META: Record<MaterialType, { label: string; cls: string }> = {
  file: { label: "파일", cls: "bg-violet-50 text-violet-700" },
  url: { label: "URL", cls: "bg-sky-50 text-sky-700" },
  text: { label: "텍스트", cls: "bg-amber-50 text-amber-700" },
  qa: { label: "Q&A", cls: "bg-emerald-50 text-emerald-700" },
};

export const MATERIAL_STATUS_META: Record<
  MaterialStatus,
  { label: string; cls: string; dot: string }
> = {
  indexed: { label: "색인 완료", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  processing: { label: "처리 중", cls: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  failed: { label: "실패", cls: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

export const MATERIAL_TYPE_OPTS: { value: MaterialType; label: string; format: string }[] = [
  { value: "file", label: "파일 (PDF·DOCX·TXT)", format: "PDF" },
  { value: "url", label: "URL (웹페이지)", format: "URL" },
  { value: "text", label: "텍스트 붙여넣기", format: "TXT" },
  { value: "qa", label: "Q&A 세트", format: "Q&A" },
];

export const MATERIAL_TYPE_FILTER = [
  { value: "", label: "전체 유형" },
  { value: "file", label: "파일" },
  { value: "url", label: "URL" },
  { value: "text", label: "텍스트" },
  { value: "qa", label: "Q&A" },
];

export const MATERIAL_STATUS_FILTER = [
  { value: "", label: "전체 상태" },
  { value: "indexed", label: "색인 완료" },
  { value: "processing", label: "처리 중" },
  { value: "failed", label: "실패" },
];

function nowDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function estimateChunks(m: Pick<Material, "type" | "name">): number {
  const base: Record<MaterialType, number> = { file: 42, url: 16, text: 26, qa: 88 };
  return (base[m.type] ?? 20) + (m.name.length % 24);
}

const SEED_MATERIALS: Material[] = [
  {
    id: "mat-user-manual",
    name: "STEP 온라인 교육시스템 사용자 매뉴얼 v3.2",
    type: "file",
    source: "step-user-manual-v3.2.pdf",
    format: "PDF",
    status: "indexed",
    summary: "로그인·수강신청·진도·과제·수료까지 LMS 사용 전반을 단계별로 설명한 공식 매뉴얼.",
    chunks: 84,
    sizeLabel: "1.2 MB",
    tags: ["매뉴얼", "LMS"],
    services: ["lms-general"],
    addedAt: "2026-05-10",
  },
  {
    id: "mat-admin-manual",
    name: "관리자 매뉴얼 v2 (과정 개설·운영)",
    type: "file",
    source: "admin-manual-v2.pdf",
    format: "PDF",
    status: "indexed",
    summary: "과정 개설, 학습자 관리, 통계, 권한 설정 등 운영자 기능을 다룬 매뉴얼.",
    chunks: 61,
    sizeLabel: "980 KB",
    tags: ["매뉴얼", "관리자"],
    services: ["lms-general", "lms-public"],
    addedAt: "2026-05-12",
  },
  {
    id: "mat-refund-policy",
    name: "환불·정산 정책 안내",
    type: "file",
    source: "refund-policy-2026.docx",
    format: "DOCX",
    status: "indexed",
    summary: "환불 기한, 부분 환불 기준, 세금계산서 발행, 정산 주기 등 환불·정산 규정.",
    chunks: 18,
    sizeLabel: "240 KB",
    tags: ["정책", "환불"],
    services: ["lms-refund"],
    addedAt: "2026-05-18",
  },
  {
    id: "mat-faq",
    name: "자주 묻는 질문 모음 (2026)",
    type: "text",
    source: "붙여넣은 텍스트",
    format: "TXT",
    status: "indexed",
    summary: "로그인 오류, 비밀번호 재설정, 수료증 발급 등 빈출 FAQ를 정리한 문서.",
    chunks: 33,
    sizeLabel: "21 KB",
    tags: ["FAQ"],
    services: ["lms-general"],
    addedAt: "2026-05-20",
  },
  {
    id: "mat-legacy-qa",
    name: "기존 상담 Q&A · LMS 일반",
    type: "qa",
    source: "PMS 누적 상담 추출",
    format: "Q&A",
    status: "indexed",
    summary: "PMS에 누적된 상담 중 LMS 일반 카테고리의 검증된 질의·응답 모음.",
    chunks: 126,
    sizeLabel: "1,146건",
    tags: ["Q&A", "레거시"],
    services: ["lms-general"],
    addedAt: "2026-05-22",
  },
  {
    id: "mat-security-guide",
    name: "보안 설정 가이드",
    type: "url",
    source: "https://help.malgn.co.kr/security",
    format: "URL",
    status: "indexed",
    summary: "2단계 인증, 접근 권한, 감사 로그 설정 등 보안 관련 안내 페이지.",
    chunks: 14,
    sizeLabel: "—",
    tags: ["보안"],
    services: ["lms-security", "lms-public"],
    addedAt: "2026-05-28",
  },
  {
    id: "mat-video-enroll",
    name: "수강신청 교육영상 스크립트",
    type: "text",
    source: "enroll-video-transcript.txt",
    format: "TXT",
    status: "processing",
    summary: "수강신청 화면 흐름을 안내하는 교육영상의 트랜스크립트(색인 처리 중).",
    chunks: 0,
    sizeLabel: "8쪽",
    tags: ["영상", "수강신청"],
    services: ["lms-general"],
    addedAt: "2026-06-09",
  },
  {
    id: "mat-public-guide",
    name: "공공기관 LMS 운영 가이드",
    type: "file",
    source: "public-ops-guide.pdf",
    format: "PDF",
    status: "failed",
    summary: "공공기관 대상 LMS 운영 절차 안내(표 추출 실패로 재색인 필요).",
    chunks: 0,
    sizeLabel: "3.1 MB",
    tags: ["공공"],
    services: ["lms-public"],
    addedAt: "2026-06-10",
    error: "표/이미지 추출 실패 — 재색인이 필요합니다.",
  },
];

const STORAGE_KEY = "malgn-admin-materials-v1";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
function loadFromStorage(): Material[] | null {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Material[]) : null;
  } catch {
    return null;
  }
}

export function useMaterials() {
  const materials = useState<Material[]>("admin-materials", () => clone(SEED_MATERIALS));
  const hydrated = useState<boolean>("admin-materials-hydrated", () => false);

  function ensureHydrated() {
    if (import.meta.client && !hydrated.value) {
      const stored = loadFromStorage();
      if (stored && Array.isArray(stored)) materials.value = stored;
      hydrated.value = true;
    }
  }
  function persist() {
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(materials.value));
      } catch {
        /* quota 무시 */
      }
    }
  }

  function get(id: string) {
    return materials.value.find((m) => m.id === id);
  }
  function byIds(ids: string[]) {
    return ids.map((id) => get(id)).filter((m): m is Material => !!m);
  }

  /** 자료 추가 — 처리중 상태로 들어오고, markIndexed 로 색인 완료 처리(데모) */
  function add(m: Material) {
    materials.value.unshift(clone(m));
    persist();
  }
  function update(m: Material) {
    const i = materials.value.findIndex((x) => x.id === m.id);
    if (i >= 0) materials.value[i] = clone(m);
    persist();
  }
  function remove(id: string) {
    materials.value = materials.value.filter((m) => m.id !== id);
    persist();
  }

  /** 색인 완료 처리(데모 시뮬레이션) */
  function markIndexed(id: string) {
    const m = get(id);
    if (!m) return;
    m.status = "indexed";
    m.error = undefined;
    m.chunks = estimateChunks(m);
    persist();
  }
  /** 재색인 — 처리중으로 되돌림 (호출부에서 markIndexed 예약) */
  function reindex(id: string) {
    const m = get(id);
    if (!m) return;
    m.status = "processing";
    m.chunks = 0;
    m.error = undefined;
    persist();
  }

  function blankMaterial(type: MaterialType = "file"): Material {
    const meta = MATERIAL_TYPE_OPTS.find((o) => o.value === type)!;
    return {
      id: `mat-${Date.now().toString(36)}`,
      name: "",
      type,
      source: "",
      format: meta.format,
      status: "processing",
      summary: "",
      chunks: 0,
      sizeLabel: "—",
      tags: [],
      services: [],
      addedAt: nowDate(),
    };
  }

  return {
    materials,
    ensureHydrated,
    get,
    byIds,
    add,
    update,
    remove,
    markIndexed,
    reindex,
    blankMaterial,
  };
}
