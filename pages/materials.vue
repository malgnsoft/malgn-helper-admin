<!--
  pages/materials.vue — 학습 자료 라이브러리 (NotebookLM의 "소스").
  자료(파일·URL·텍스트·Q&A)를 추가하면 R2 저장 + 색인되고, 봇 설정에서 이 자료를 골라 학습한다.
  데이터: use-materials(실 /materials API). 봇 연결: use-bots.
  index_status: processing|indexed|stored|failed (stored = 저장만, 본문추출 미지원).
-->
<script setup lang="ts">
import {
  FileText,
  Link as LinkIcon,
  Type as TypeIcon,
  MessagesSquare,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Download,
  Bot as BotIcon,
  Loader2,
} from "lucide-vue-next";

useHead({ title: "학습 자료 · 맑은도우미 Admin" });

const {
  materials,
  get,
  loadMaterials,
  getMaterial,
  createMaterial,
  deleteMaterial,
  reindexMaterial,
  downloadMaterial,
} = useMaterials();
const { bots, ensureHydrated: ensureBots, pruneMaterial } = useBots();

const TYPE_ICON: Record<MaterialType, unknown> = {
  file: FileText,
  url: LinkIcon,
  text: TypeIcon,
  qa: MessagesSquare,
};

// ── 토스트 ──
const toast = ref<{ msg: string; type: "error" | "success" } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function notify(msg: string, type: "error" | "success" = "success") {
  if (toastTimer) clearTimeout(toastTimer);
  toast.value = { msg, type };
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 4000);
}

// ── 목록 / 필터 / 페이지네이션 ──
const draft = reactive({ type: "", indexStatus: "", q: "" });
const applied = reactive({ type: "", indexStatus: "", q: "" });
const total = ref(0);
const pending = ref(true);
const listError = ref<string | null>(null);

const LIMIT = 60;
const offset = ref(0);
const page = computed(() => Math.floor(offset.value / LIMIT) + 1);

async function load() {
  pending.value = true;
  listError.value = null;
  try {
    const r = await loadMaterials({
      type: (applied.type || "") as MaterialType | "",
      indexStatus: (applied.indexStatus || "") as MaterialStatus | "",
      search: applied.q,
      limit: LIMIT,
      offset: offset.value,
    });
    total.value = r.total;
  } catch (e) {
    listError.value = (e as Error).message;
  } finally {
    pending.value = false;
  }
}

function applyFilter() {
  applied.type = draft.type;
  applied.indexStatus = draft.indexStatus;
  applied.q = draft.q;
  offset.value = 0;
  load();
}
function resetFilter() {
  draft.type = "";
  draft.indexStatus = "";
  draft.q = "";
  applyFilter();
}
function goPage(p: number) {
  offset.value = (p - 1) * LIMIT;
  load();
}

onMounted(() => {
  ensureBots();
  load();
});

const stat = computed(() => ({
  total: total.value,
  indexed: materials.value.filter((m) => m.indexStatus === "indexed").length,
  processing: materials.value.filter((m) => m.indexStatus === "processing").length,
  chunks: materials.value.reduce((a, m) => a + m.chunks, 0),
}));

// ── 재색인 ──
const busyId = ref<string | null>(null);
async function doReindex(id: string) {
  if (busyId.value) return;
  busyId.value = id;
  try {
    const updated = await reindexMaterial(id);
    if (!updated) await load();
    notify("재색인을 요청했습니다.");
  } catch (e) {
    notify((e as Error).message, "error");
  } finally {
    busyId.value = null;
  }
}

// ── 다운로드 ──
async function doDownload(m: Material) {
  if (busyId.value) return;
  busyId.value = m.id;
  try {
    await downloadMaterial(m.id, m.source || m.name);
  } catch (e) {
    notify((e as Error).message, "error");
  } finally {
    busyId.value = null;
  }
}

// ── 삭제 ──
const confirmId = ref<string | null>(null);
const confirmTarget = computed(() => materials.value.find((m) => m.id === confirmId.value) ?? null);
const removing = ref(false);
const confirmOpen = computed({
  get: () => confirmId.value !== null,
  set: (v) => {
    if (!v) confirmId.value = null;
  },
});
async function doRemove() {
  if (!confirmId.value || removing.value) return;
  const id = confirmId.value;
  removing.value = true;
  try {
    await deleteMaterial(id);
    if (detailId.value === id) detailId.value = null;
    pruneMaterial(id);
    confirmId.value = null;
    notify("자료를 삭제했습니다.");
    if (materials.value.length === 0 && offset.value > 0) {
      offset.value = Math.max(0, offset.value - LIMIT);
    }
    await load();
  } catch (e) {
    notify((e as Error).message, "error");
  } finally {
    removing.value = false;
  }
}

// ── 상세 ──
const detailId = ref<string | null>(null);
const detail = ref<MaterialDetail | null>(null);
const detailPending = ref(false);
const detailOpen = computed({
  get: () => detailId.value !== null,
  set: (v) => {
    if (!v) {
      detailId.value = null;
      detail.value = null;
    }
  },
});
async function openDetail(id: string) {
  detailId.value = id;
  detailPending.value = true;
  detail.value = null;
  try {
    detail.value = await getMaterial(id);
  } catch (e) {
    notify((e as Error).message, "error");
    // 상세 API 실패 시 목록 캐시로 폴백
    const m = get(id);
    if (m) detail.value = { ...m, extractedTextPreview: "" };
  } finally {
    detailPending.value = false;
  }
}
const botsUsing = computed(() =>
  detail.value ? bots.value.filter((b) => b.materialSetIds.includes(detail.value!.id)) : [],
);

// ── 자료 추가 ──
const addOpen = ref(false);
const addType = ref<MaterialType>("file");
const submitting = ref(false);
const addError = ref<string | null>(null);
const form = reactive({
  name: "",
  source: "",
  url: "",
  text: "",
  question: "",
  answer: "",
  tags: [] as string[],
  services: [] as string[],
});
const file = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const addTagsText = computed({
  get: () => form.tags.join(", "),
  set: (v: string) => {
    form.tags = v.split(",").map((s) => s.trim()).filter(Boolean);
  },
});

function openAdd() {
  addType.value = "file";
  form.name = "";
  form.source = "";
  form.url = "";
  form.text = "";
  form.question = "";
  form.answer = "";
  form.tags = [];
  form.services = [];
  file.value = null;
  addError.value = null;
  addOpen.value = true;
}
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
  if (file.value && !form.name.trim()) form.name = file.value.name;
}
function toggleSvc(slug: string) {
  const i = form.services.indexOf(slug);
  if (i >= 0) form.services.splice(i, 1);
  else form.services.push(slug);
}

const canSubmit = computed(() => {
  if (submitting.value) return false;
  if (addType.value === "file") return !!file.value;
  if (addType.value === "url") return !!form.url.trim();
  if (addType.value === "text") return !!form.text.trim();
  if (addType.value === "qa") return !!(form.answer.trim() || form.question.trim() || form.text.trim());
  return false;
});

async function submitAdd() {
  if (!canSubmit.value) return;
  submitting.value = true;
  addError.value = null;
  try {
    if (addType.value === "file") {
      if (!file.value) throw new Error("업로드할 파일을 선택하세요.");
      const fd = new FormData();
      fd.append("file", file.value);
      if (form.name.trim()) fd.append("name", form.name.trim());
      if (form.source.trim()) fd.append("source", form.source.trim());
      if (form.tags.length) fd.append("tags", JSON.stringify(form.tags));
      if (form.services.length) fd.append("services", JSON.stringify(form.services));
      await createMaterial(fd);
    } else if (addType.value === "url") {
      await createMaterial({
        type: "url",
        url: form.url.trim(),
        name: form.name.trim() || undefined,
        tags: form.tags.length ? form.tags : undefined,
        services: form.services.length ? form.services : undefined,
      });
    } else if (addType.value === "text") {
      await createMaterial({
        type: "text",
        text: form.text.trim(),
        name: form.name.trim() || undefined,
        source: form.source.trim() || undefined,
      });
    } else {
      await createMaterial({
        type: "qa",
        question: form.question.trim() || undefined,
        answer: form.answer.trim() || undefined,
        text: form.text.trim() || undefined,
        name: form.name.trim() || undefined,
      });
    }
    addOpen.value = false;
    notify("자료를 추가했습니다. 색인이 진행됩니다.");
    offset.value = 0;
    await load();
  } catch (e) {
    addError.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

// ── 스타일 ──
const selectCls =
  "h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500";
const inputCls =
  "h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500";
function chipCls(on: boolean) {
  return on
    ? "rounded-md bg-primary-600 px-2.5 py-1 text-[12px] font-medium text-white"
    : "rounded-md bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-200";
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="학습 자료"
      description="봇이 학습할 자료(파일·URL·텍스트·Q&A)를 추가·색인·관리합니다. 봇 설정에서 이 자료를 골라 사용합니다."
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-primary-700"
          @click="openAdd"
        >
          <Plus class="size-4" />자료 추가
        </button>
      </template>
    </AdminPageHeader>

    <!-- KPI -->
    <section class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-[11px] text-slate-400">전체 자료</p>
        <p class="mt-0.5 font-mono text-[20px] font-bold tabular-nums text-slate-900">{{ stat.total }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-[11px] text-slate-400">색인 완료<span class="ml-1 text-slate-300">(현재 페이지)</span></p>
        <p class="mt-0.5 font-mono text-[20px] font-bold tabular-nums text-emerald-600">{{ stat.indexed }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-[11px] text-slate-400">처리 중<span class="ml-1 text-slate-300">(현재 페이지)</span></p>
        <p class="mt-0.5 font-mono text-[20px] font-bold tabular-nums text-blue-600">{{ stat.processing }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-[11px] text-slate-400">총 청크<span class="ml-1 text-slate-300">(현재 페이지)</span></p>
        <p class="mt-0.5 font-mono text-[20px] font-bold tabular-nums text-slate-900">{{ stat.chunks.toLocaleString() }}</p>
      </div>
    </section>

    <!-- 필터 -->
    <AdminFilterBar @search="applyFilter" @reset="resetFilter">
      <AdminFilterField label="유형">
        <select v-model="draft.type" :class="selectCls">
          <option v-for="o in MATERIAL_TYPE_FILTER" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="상태">
        <select v-model="draft.indexStatus" :class="selectCls">
          <option v-for="o in MATERIAL_STATUS_FILTER" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="검색어" grow>
        <AdminSearchInput
          v-model="draft.q"
          placeholder="자료명 · 요약 · 태그 검색 후 Enter"
          @keyup.enter="applyFilter"
        />
      </AdminFilterField>
    </AdminFilterBar>

    <!-- 로딩 -->
    <div v-if="pending" class="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-[13px] text-slate-500">
      <Loader2 class="size-4 animate-spin" />목록을 불러오는 중…
    </div>

    <!-- 에러 -->
    <div v-else-if="listError" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center">
      <p class="text-[13px] font-medium text-rose-700">{{ listError }}</p>
      <button
        type="button"
        class="mt-3 inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-[12px] font-medium text-rose-600 hover:bg-rose-50"
        @click="load"
      >
        <RefreshCw class="size-3.5" />다시 시도
      </button>
    </div>

    <!-- 카드 그리드 -->
    <template v-else-if="materials.length">
      <section class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="m in materials"
          :key="m.id"
          class="group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-primary-300 hover:shadow-md"
          @click="openDetail(m.id)"
        >
          <div class="flex items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg" :class="MATERIAL_TYPE_META[m.type].cls">
              <component :is="TYPE_ICON[m.type]" class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-[14px] font-bold text-slate-900">{{ m.name }}</h3>
              <p class="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                <span class="font-medium text-slate-500">{{ MATERIAL_TYPE_META[m.type].label }}</span>
                <span>·</span><span>{{ m.format }}</span>
                <span>·</span><span>{{ m.sizeLabel }}</span>
              </p>
            </div>
            <span
              class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset"
              :class="MATERIAL_STATUS_META[m.indexStatus].cls"
            >
              <RefreshCw v-if="m.indexStatus === 'processing'" class="size-2.5 animate-spin" />
              <span v-else class="size-1.5 rounded-full" :class="MATERIAL_STATUS_META[m.indexStatus].dot" />
              {{ MATERIAL_STATUS_META[m.indexStatus].label }}
            </span>
          </div>

          <p class="mt-3 line-clamp-2 text-[12px] leading-relaxed text-slate-500">{{ m.summary || "요약이 아직 준비되지 않았습니다." }}</p>

          <div class="mt-3 flex flex-wrap gap-1">
            <span v-for="t in m.tags" :key="t" class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-600">#{{ t }}</span>
          </div>

          <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span class="font-mono text-[11px] text-slate-400">
              {{
                m.indexStatus === "indexed"
                  ? `청크 ${m.chunks}`
                  : m.indexStatus === "failed"
                    ? "색인 실패"
                    : m.indexStatus === "stored"
                      ? "저장됨(색인 없음)"
                      : "처리 중…"
              }}
            </span>
            <div class="flex items-center gap-1" @click.stop>
              <button
                v-if="m.downloadPath"
                type="button"
                title="다운로드"
                class="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                :disabled="busyId === m.id"
                @click="doDownload(m)"
              >
                <Download class="size-4" />
              </button>
              <button
                v-if="m.indexStatus !== 'processing'"
                type="button"
                title="재색인"
                class="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
                :disabled="busyId === m.id"
                @click="doReindex(m.id)"
              >
                <RefreshCw class="size-4" :class="busyId === m.id ? 'animate-spin' : ''" />
              </button>
              <button
                type="button"
                title="삭제"
                class="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                @click="confirmId = m.id"
              >
                <Trash2 class="size-4" />
              </button>
            </div>
          </div>
        </article>
      </section>

      <AdminPagination class="mt-4" :page="page" :page-size="LIMIT" :total="total" @update:page="goPage" />
    </template>

    <AdminEmptyState
      v-else
      title="조건에 맞는 자료가 없습니다"
      :description="applied.type || applied.indexStatus || applied.q ? '검색어나 필터를 변경해 보세요.' : '학습 자료를 추가해 보세요.'"
    >
      <template #icon><FileText class="size-5 text-slate-400" /></template>
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
          @click="openAdd"
        >
          <Plus class="size-4" />자료 추가
        </button>
      </template>
    </AdminEmptyState>

    <!-- 상세 패널 -->
    <AdminSlideOver v-model="detailOpen" :title="detail?.name ?? '자료 상세'" size="xl">
      <div v-if="detailPending" class="flex items-center justify-center gap-2 py-16 text-[13px] text-slate-500">
        <Loader2 class="size-4 animate-spin" />불러오는 중…
      </div>
      <template v-else-if="detail">
        <div class="flex items-center gap-3">
          <div class="flex size-11 shrink-0 items-center justify-center rounded-lg" :class="MATERIAL_TYPE_META[detail.type].cls">
            <component :is="TYPE_ICON[detail.type]" class="size-5" />
          </div>
          <div class="min-w-0">
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset"
              :class="MATERIAL_STATUS_META[detail.indexStatus].cls"
            >
              <RefreshCw v-if="detail.indexStatus === 'processing'" class="size-2.5 animate-spin" />
              {{ MATERIAL_STATUS_META[detail.indexStatus].label }}
            </span>
            <p class="mt-1 text-[12px] text-slate-500">
              {{ MATERIAL_TYPE_META[detail.type].label }} · {{ detail.format }} · {{ detail.sizeLabel }}
            </p>
          </div>
        </div>

        <p class="mt-4 text-[13px] leading-relaxed text-slate-700">{{ detail.summary || "요약이 아직 준비되지 않았습니다." }}</p>

        <div v-if="detail.indexStatus === 'stored'" class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          본문 추출이 지원되지 않는 형식이라 저장만 되었습니다. 의미검색(벡터)은 추후 지원됩니다.
        </div>
        <div v-if="detail.error" class="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {{ detail.error }}
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
          <div>
            <dt class="text-slate-400">출처</dt>
            <dd class="mt-0.5 break-all font-mono text-slate-700">
              <a v-if="detail.type === 'url'" :href="detail.source" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-primary-600 hover:underline">
                {{ detail.source }}<ExternalLink class="size-3" />
              </a>
              <span v-else>{{ detail.source || "—" }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-slate-400">색인 청크</dt>
            <dd class="mt-0.5 font-mono text-slate-700">{{ detail.indexStatus === "indexed" ? detail.chunks : "—" }}</dd>
          </div>
          <div>
            <dt class="text-slate-400">추가일</dt>
            <dd class="mt-0.5 font-mono text-slate-700">{{ detail.addedAt || "—" }}</dd>
          </div>
          <div>
            <dt class="text-slate-400">등록자</dt>
            <dd class="mt-0.5 font-mono text-slate-700">{{ detail.createdBy || "—" }}</dd>
          </div>
          <div>
            <dt class="text-slate-400">MIME</dt>
            <dd class="mt-0.5 break-all font-mono text-slate-700">{{ detail.mime || "—" }}</dd>
          </div>
          <div>
            <dt class="text-slate-400">연관 서비스</dt>
            <dd class="mt-0.5 flex flex-wrap gap-1">
              <span v-for="s in detail.services" :key="s" class="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">{{ serviceLabel(s) }}</span>
              <span v-if="!detail.services.length" class="text-slate-400">—</span>
            </dd>
          </div>
          <div class="col-span-2">
            <dt class="text-slate-400">태그</dt>
            <dd class="mt-0.5 flex flex-wrap gap-1">
              <span v-for="t in detail.tags" :key="t" class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">#{{ t }}</span>
              <span v-if="!detail.tags.length" class="text-slate-400">—</span>
            </dd>
          </div>
        </dl>

        <!-- 본문 미리보기 -->
        <div v-if="detail.extractedTextPreview" class="mt-5 border-t border-slate-100 pt-4">
          <p class="mb-2 text-[12px] font-semibold text-slate-700">본문 미리보기</p>
          <pre class="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200">{{ detail.extractedTextPreview }}</pre>
        </div>

        <!-- 이 자료를 쓰는 봇 -->
        <div class="mt-5 border-t border-slate-100 pt-4">
          <p class="mb-2 text-[12px] font-semibold text-slate-700">
            이 자료를 학습한 봇 <span class="font-mono text-slate-400">{{ botsUsing.length }}</span>
          </p>
          <div v-if="botsUsing.length" class="space-y-1.5">
            <NuxtLink
              v-for="b in botsUsing"
              :key="b.id"
              :to="`/bots/${b.id}`"
              class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] hover:bg-slate-50"
            >
              <span class="text-[16px]">{{ b.avatar }}</span>
              <span class="font-medium text-slate-800">{{ b.name }}</span>
              <span class="ml-auto text-[11px] text-slate-400">{{ STATUS_META[b.status].label }}</span>
            </NuxtLink>
          </div>
          <p v-else class="flex items-center gap-1.5 text-[12px] text-slate-400">
            <BotIcon class="size-3.5" />아직 이 자료를 쓰는 봇이 없습니다.
          </p>
        </div>
      </template>

      <template #footer>
        <div v-if="detail" class="flex items-center justify-between gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
            @click="confirmId = detail.id"
          >
            <Trash2 class="size-4" />삭제
          </button>
          <div class="flex items-center gap-2">
            <button
              v-if="detail.downloadPath"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              :disabled="busyId === detail.id"
              @click="doDownload(detail)"
            >
              <Download class="size-4" />다운로드
            </button>
            <button
              v-if="detail.indexStatus !== 'processing'"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              :disabled="busyId === detail.id"
              @click="doReindex(detail.id)"
            >
              <RefreshCw class="size-4" :class="busyId === detail.id ? 'animate-spin' : ''" />재색인
            </button>
          </div>
        </div>
      </template>
    </AdminSlideOver>

    <!-- 자료 추가 패널 -->
    <AdminSlideOver v-model="addOpen" title="학습 자료 추가" size="xl">
      <div class="space-y-5">
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">유형</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="o in MATERIAL_TYPE_OPTS"
              :key="o.value"
              type="button"
              :class="chipCls(addType === o.value)"
              @click="addType = o.value"
            >
              {{ o.label }}
            </button>
          </div>
        </div>

        <!-- 파일 업로드 -->
        <div v-if="addType === 'file'">
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">파일 <span class="text-rose-500">*</span></label>
          <div
            class="flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center hover:border-primary-300"
            @click="fileInput?.click()"
          >
            <Plus class="size-5 text-slate-400" />
            <p v-if="!file" class="text-[12px] font-medium text-slate-600">클릭하여 파일 선택</p>
            <p v-else class="text-[12px] font-semibold text-slate-800">{{ file.name }}</p>
            <p class="text-[11px] text-slate-400">PDF · DOCX · PPTX · HWP · TXT · MD · CSV · HTML</p>
          </div>
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            :accept="MATERIAL_FILE_ACCEPT"
            @change="onFileChange"
          />
        </div>

        <!-- URL -->
        <div v-else-if="addType === 'url'">
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">URL <span class="text-rose-500">*</span></label>
          <input v-model="form.url" :class="inputCls" placeholder="https://help.malgn.co.kr/..." />
        </div>

        <!-- 텍스트 -->
        <div v-else-if="addType === 'text'">
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">텍스트 본문 <span class="text-rose-500">*</span></label>
          <textarea
            v-model="form.text"
            rows="6"
            class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 text-[13px] ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="학습시킬 텍스트를 붙여넣으세요…"
          />
        </div>

        <!-- Q&A -->
        <template v-else-if="addType === 'qa'">
          <div>
            <label class="mb-1.5 block text-[12px] font-medium text-slate-600">질문</label>
            <input v-model="form.question" :class="inputCls" placeholder="예: 수료증은 어떻게 발급하나요?" />
          </div>
          <div>
            <label class="mb-1.5 block text-[12px] font-medium text-slate-600">답변</label>
            <textarea
              v-model="form.answer"
              rows="4"
              class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 text-[13px] ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="답변 내용을 입력하세요…"
            />
          </div>
          <p class="text-[11px] text-slate-400">질문·답변 대신 전체 Q&A 텍스트를 아래 본문에 붙여넣어도 됩니다.</p>
          <div>
            <label class="mb-1.5 block text-[12px] font-medium text-slate-600">Q&A 본문(선택)</label>
            <textarea
              v-model="form.text"
              rows="4"
              class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 text-[13px] ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Q: ... / A: ... 형식의 여러 건을 붙여넣기"
            />
          </div>
        </template>

        <!-- 공통: 자료명 -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">자료명<span v-if="addType !== 'file'" class="text-slate-400"> (선택)</span></label>
          <input v-model="form.name" :class="inputCls" placeholder="예: STEP 사용자 매뉴얼 v3.2" />
        </div>

        <!-- 출처 (file/text) -->
        <div v-if="addType === 'file' || addType === 'text'">
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">출처(선택)</label>
          <input
            v-model="form.source"
            :class="inputCls"
            :placeholder="addType === 'file' ? '예: 공식 매뉴얼' : '예: 사내 위키 발췌'"
          />
        </div>

        <!-- 태그 (file/url) -->
        <div v-if="addType === 'file' || addType === 'url'">
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">태그(콤마)</label>
          <input v-model="addTagsText" :class="inputCls" placeholder="매뉴얼, LMS" />
        </div>

        <!-- 연관 서비스 (file/url) -->
        <div v-if="addType === 'file' || addType === 'url'">
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">연관 서비스</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="s in SERVICE_OPTS"
              :key="s.value"
              type="button"
              :class="chipCls(form.services.includes(s.value))"
              @click="toggleSvc(s.value)"
            >
              {{ s.label }}
            </button>
          </div>
        </div>

        <div v-if="addError" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
          {{ addError }}
        </div>
        <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-[11.5px] text-slate-400">
          업로드 후 서버에서 저장·색인이 진행됩니다. 본문추출 미지원 형식(예: 일부 PDF·영상)은 저장만 되며(“저장됨”), 의미검색(벡터)은 추후 지원됩니다.
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="addOpen = false"
          >
            취소
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-5 py-2 text-[13px] font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="!canSubmit"
            @click="submitAdd"
          >
            <Loader2 v-if="submitting" class="size-4 animate-spin" />
            <Plus v-else class="size-4" />추가하고 색인
          </button>
        </div>
      </template>
    </AdminSlideOver>

    <!-- 삭제 확인 -->
    <AdminModal v-model="confirmOpen" title="자료 삭제" size="sm">
      <p class="text-[13px] text-slate-600">
        <span class="font-semibold text-slate-900">{{ confirmTarget?.name }}</span> 자료를 삭제할까요?
        이 자료를 학습한 봇에서도 제외됩니다.
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="confirmOpen = false"
          >
            취소
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            :disabled="removing"
            @click="doRemove"
          >
            <Loader2 v-if="removing" class="size-4 animate-spin" />삭제
          </button>
        </div>
      </template>
    </AdminModal>

    <!-- 토스트 -->
    <Transition name="fade">
      <div
        v-if="toast"
        class="fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-[13px] font-medium shadow-lg"
        :class="toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'"
      >
        {{ toast.msg }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
