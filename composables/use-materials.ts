// composables/use-materials.ts
// 학습 자료(소스) 라이브러리 — NotebookLM의 "소스"에 해당.
// 자료 = 파일/URL/텍스트/Q&A 한 건. 봇(use-bots)이 materialSetIds 로 여기서 골라 학습한다.
// 실 백엔드 /materials 연동(GET/POST/DELETE + reindex/download). 업로드는 R2, 색인은 벡터.
//   - 목록/생성/삭제/재색인/다운로드 모두 apiFetch(Bearer) 경유.
//   - index_status: processing|indexed|stored|failed
//       stored = 저장은 되었으나 본문추출 미지원(예: PDF·영상) → 의미검색(벡터) 미적용.

const API_BASE = "https://malgn-helper-api.malgnsoft.workers.dev";

export type MaterialType = "file" | "url" | "text" | "qa";
export type MaterialStatus = "indexed" | "processing" | "stored" | "failed";

/** 서버 응답 행/객체 (camelCase) */
export interface MaterialDto {
  id: number | string;
  name: string;
  type: MaterialType;
  source: string;
  format: string;
  mime: string | null;
  sizeBytes: number | null;
  indexStatus: MaterialStatus;
  summary: string | null;
  chunks: number | null;
  tags: string[] | null;
  services: string[] | null;
  downloadPath: string | null;
  createdBy: string | null;
  createdAt?: string | null;
  error?: string | null;
  /** 상세(GET /materials/:id)에서만 채워짐 */
  extractedTextPreview?: string | null;
}

/** 화면 모델. 표시 가공(sizeBytes→sizeLabel 등)은 여기(fromDto)에서만 한다. */
export interface Material {
  id: string; // 서버 숫자 id를 문자열화(라우팅/키/봇 참조 호환)
  name: string;
  type: MaterialType;
  source: string; // 파일명 / URL / 텍스트 출처
  format: string; // PDF · DOCX · TXT · URL · Q&A
  mime: string; // MIME 타입(원문)
  indexStatus: MaterialStatus;
  summary: string; // 자동 요약(미리보기)
  chunks: number; // 색인 청크 수
  sizeBytes: number; // 원본 바이트
  sizeLabel: string; // "1.2 MB" / "—"
  tags: string[];
  services: string[]; // 연관 서비스 slug (use-bots SERVICE_OPTS)
  downloadPath: string | null; // R2 다운로드 경로(있으면 다운로드 버튼 노출)
  createdBy: string | null;
  addedAt: string; // YYYY-MM-DD (createdAt 표시 가공)
  error?: string; // failed/stored 사유
}

/** 상세 모델 — 본문 미리보기 포함 */
export interface MaterialDetail extends Material {
  extractedTextPreview: string;
}

/** 생성 시 JSON 페이로드(url/text/qa). 파일은 FormData로 별도 전송. */
export type MaterialCreateJson =
  | { type: "url"; url: string; name?: string; tags?: string[]; services?: string[] }
  | { type: "text"; text: string; name?: string; source?: string }
  | { type: "qa"; question?: string; answer?: string; text?: string; name?: string };

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
  stored: { label: "저장됨", cls: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  failed: { label: "실패", cls: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};

export const MATERIAL_TYPE_OPTS: { value: MaterialType; label: string; format: string }[] = [
  { value: "file", label: "파일 (PDF·DOCX·TXT·CSV·MD·HTML)", format: "FILE" },
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
  { value: "stored", label: "저장됨" },
  { value: "failed", label: "실패" },
];

/** 파일 업로드 accept — 문서·텍스트·표·마크업 계열. */
export const MATERIAL_FILE_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.hwp,.hwpx,.txt,.md,.csv,.tsv,.html,.htm";

// ── 표시 가공 ──
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const s = i === 0 || v >= 100 ? Math.round(v).toString() : v.toFixed(1);
  return `${s} ${units[i]}`;
}

function fromDto(d: MaterialDto): Material {
  const bytes = typeof d.sizeBytes === "number" ? d.sizeBytes : 0;
  return {
    id: String(d.id),
    name: d.name ?? "",
    type: d.type,
    source: d.source ?? "",
    format: d.format ?? "",
    mime: d.mime ?? "",
    indexStatus: d.indexStatus,
    summary: d.summary ?? "",
    chunks: typeof d.chunks === "number" ? d.chunks : 0,
    sizeBytes: bytes,
    sizeLabel: formatBytes(bytes),
    tags: d.tags ?? [],
    services: d.services ?? [],
    downloadPath: d.downloadPath ?? null,
    createdBy: d.createdBy ?? null,
    addedAt: (d.createdAt ?? "").slice(0, 10),
    error: d.error ?? undefined,
  };
}

/** 서버 에러 메시지 추출(가능하면 body.error, 없으면 상태코드). */
async function readError(res: Response): Promise<string> {
  if (res.status === 401) return "인증이 필요합니다. 다시 로그인해 주세요.";
  if (res.status === 403) return "developer 이상 권한이 필요합니다.";
  if (res.status === 404) return "자료를 찾을 수 없습니다.";
  if (res.status === 413) return "파일 용량이 허용 범위를 초과했습니다.";
  try {
    const j = (await res.json()) as { error?: string };
    if (j.error) return j.error;
  } catch {
    /* JSON 아님 — 무시 */
  }
  return `요청 실패 (API ${res.status})`;
}

export interface MaterialListFilters {
  type?: MaterialType | "";
  indexStatus?: MaterialStatus | "";
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MaterialListResult {
  rows: Material[];
  total: number;
  limit: number;
  offset: number;
}

/** 의미(벡터) 검색 결과 한 건 — GET /materials/search 응답 items. */
export interface MaterialSearchHit {
  materialId: number;
  name: string;
  type: string;
  score: number; // 0~1 유사도
  snippets: string[];
}

/** 의미 검색 응답 전체. */
export interface MaterialSearchResult {
  results: MaterialSearchHit[];
  /** true면 벡터 검색 인프라(Vectorize) 미준비. */
  vectorizeUnavailable: boolean;
}

export function useMaterials() {
  // 현재 로드된 목록(현재 페이지). 상세/삭제/재색인이 이 상태를 갱신한다.
  const materials = useState<Material[]>("admin-materials", () => []);

  function get(id: string): Material | undefined {
    return materials.value.find((m) => m.id === id);
  }
  function byIds(ids: string[]): Material[] {
    return ids.map((id) => get(id)).filter((m): m is Material => !!m);
  }

  /** 목록 조회 — 필터/페이지네이션 서버 전달. materials 상태를 갱신. */
  async function loadMaterials(filters: MaterialListFilters = {}): Promise<MaterialListResult> {
    const url = new URL(`${API_BASE}/materials`);
    if (filters.type) url.searchParams.set("type", filters.type);
    if (filters.indexStatus) url.searchParams.set("indexStatus", filters.indexStatus);
    if (filters.search && filters.search.trim()) url.searchParams.set("search", filters.search.trim());
    url.searchParams.set("limit", String(filters.limit ?? 60));
    url.searchParams.set("offset", String(filters.offset ?? 0));

    const res = await apiFetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(await readError(res));

    const data = (await res.json()) as {
      total?: number;
      limit?: number;
      offset?: number;
      rows?: MaterialDto[];
    };
    const rows = (data.rows ?? []).map(fromDto);
    materials.value = rows;
    return {
      rows,
      total: data.total ?? rows.length,
      limit: data.limit ?? filters.limit ?? 60,
      offset: data.offset ?? filters.offset ?? 0,
    };
  }

  /**
   * 의미(벡터) 검색 — 자료 본문 임베딩 기반 유사도 검색.
   * 키워드 LIKE 필터(loadMaterials)와 별개이며, materials 상태를 건드리지 않는다.
   *   - q: 질의(공백만이면 호출하지 않음), topK: 상위 n건(기본 8).
   */
  async function searchMaterials(q: string, topK = 8): Promise<MaterialSearchResult> {
    const query = q.trim();
    if (!query) return { results: [], vectorizeUnavailable: false };
    const url = new URL(`${API_BASE}/materials/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("topK", String(topK));

    const res = await apiFetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) throw new Error(await readError(res));

    const data = (await res.json()) as {
      results?: MaterialSearchHit[];
      vectorizeUnavailable?: boolean;
    };
    return {
      results: (data.results ?? []).map((r) => ({
        materialId: r.materialId,
        name: r.name ?? "",
        type: r.type ?? "",
        score: typeof r.score === "number" ? r.score : 0,
        snippets: Array.isArray(r.snippets) ? r.snippets.filter(Boolean) : [],
      })),
      vectorizeUnavailable: data.vectorizeUnavailable === true,
    };
  }

  /** 상세 조회 — 본문 미리보기 포함. */
  async function getMaterial(id: string): Promise<MaterialDetail> {
    const res = await apiFetch(`${API_BASE}/materials/${id}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await readError(res));
    const d = (await res.json()) as MaterialDto;
    return { ...fromDto(d), extractedTextPreview: d.extractedTextPreview ?? "" };
  }

  /**
   * 자료 생성.
   *  - 파일: FormData(field `file` 등)를 그대로 전달 → multipart POST (Content-Type 미지정: 브라우저가 boundary 설정).
   *  - url/text/qa: MaterialCreateJson → application/json POST.
   */
  async function createMaterial(payload: FormData | MaterialCreateJson): Promise<Material> {
    const isForm = typeof FormData !== "undefined" && payload instanceof FormData;
    const init: RequestInit = {
      method: "POST",
      credentials: "include",
    };
    if (isForm) {
      init.body = payload;
    } else {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(payload);
    }
    const res = await apiFetch(`${API_BASE}/materials`, init);
    if (!res.ok) throw new Error(await readError(res));
    const d = (await res.json()) as MaterialDto;
    const created = fromDto(d);
    // 새 자료를 현재 목록 상단에 반영(이후 페이지에서 loadMaterials로 재동기화).
    materials.value = [created, ...materials.value.filter((m) => m.id !== created.id)];
    return created;
  }

  /** 삭제(soft). 성공 시 목록 상태에서 제거. */
  async function deleteMaterial(id: string): Promise<void> {
    const res = await apiFetch(`${API_BASE}/materials/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error(await readError(res));
    materials.value = materials.value.filter((m) => m.id !== id);
  }

  /** 재색인 요청. 응답에 자료 dto가 오면 상태 갱신. */
  async function reindexMaterial(id: string): Promise<Material | null> {
    const res = await apiFetch(`${API_BASE}/materials/${id}/reindex`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error(await readError(res));
    let updated: Material | null = null;
    try {
      const d = (await res.json()) as MaterialDto;
      if (d && d.id !== undefined) {
        updated = fromDto(d);
        const i = materials.value.findIndex((m) => m.id === updated!.id);
        if (i >= 0) materials.value[i] = updated;
      }
    } catch {
      /* 응답 바디 없음 — 호출부가 loadMaterials로 재동기화 */
    }
    return updated;
  }

  /**
   * 다운로드 — 인증(apiFetch)으로 blob을 받아 브라우저 저장을 트리거.
   * filename 미지정 시 Content-Disposition → 자료명 순으로 사용.
   */
  async function downloadMaterial(id: string, filename?: string): Promise<void> {
    if (!import.meta.client) return;
    const res = await apiFetch(`${API_BASE}/materials/${id}/download`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await readError(res));

    let name = filename ?? "";
    if (!name) {
      const cd = res.headers.get("Content-Disposition") ?? "";
      const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
      const plain = /filename="?([^";]+)"?/i.exec(cd);
      if (star?.[1]) name = decodeURIComponent(star[1].trim());
      else if (plain?.[1]) name = plain[1].trim();
    }
    if (!name) name = get(id)?.source || get(id)?.name || `material-${id}`;

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return {
    materials,
    get,
    byIds,
    loadMaterials,
    searchMaterials,
    getMaterial,
    createMaterial,
    deleteMaterial,
    reindexMaterial,
    downloadMaterial,
  };
}
