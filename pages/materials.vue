<!--
  pages/materials.vue — 학습 자료 라이브러리 (NotebookLM의 "소스").
  자료(파일·URL·텍스트·Q&A)를 추가하면 색인되고, 봇 설정에서 이 자료를 골라 학습한다.
  데이터: use-materials(localStorage 데모). 봇 연결: use-bots.
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
  Bot as BotIcon,
} from "lucide-vue-next";

useHead({ title: "학습 자료 · 맑은도우미 Admin" });

const {
  materials,
  ensureHydrated,
  get,
  add,
  remove,
  reindex,
  markIndexed,
  blankMaterial,
} = useMaterials();
const { bots, ensureHydrated: ensureBots, pruneMaterial } = useBots();
onMounted(() => {
  ensureHydrated();
  ensureBots();
});

const TYPE_ICON: Record<MaterialType, unknown> = {
  file: FileText,
  url: LinkIcon,
  text: TypeIcon,
  qa: MessagesSquare,
};

// ── 필터 ──
const draft = reactive({ type: "", status: "", q: "" });
const applied = reactive({ type: "", status: "", q: "" });
function applyFilter() {
  applied.type = draft.type;
  applied.status = draft.status;
  applied.q = draft.q;
}
function resetFilter() {
  draft.type = "";
  draft.status = "";
  draft.q = "";
  applyFilter();
}
const filtered = computed(() => {
  const q = applied.q.trim().toLowerCase();
  return materials.value.filter((m) => {
    if (applied.type && m.type !== applied.type) return false;
    if (applied.status && m.status !== applied.status) return false;
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
});

const stat = computed(() => ({
  total: materials.value.length,
  indexed: materials.value.filter((m) => m.status === "indexed").length,
  processing: materials.value.filter((m) => m.status === "processing").length,
  chunks: materials.value.reduce((a, m) => a + m.chunks, 0),
}));

// ── 재색인 / 삭제 ──
function doReindex(id: string) {
  reindex(id);
  if (import.meta.client) setTimeout(() => markIndexed(id), 1400);
}
const confirmId = ref<string | null>(null);
const confirmTarget = computed(() => materials.value.find((m) => m.id === confirmId.value) ?? null);
const confirmOpen = computed({
  get: () => confirmId.value !== null,
  set: (v) => {
    if (!v) confirmId.value = null;
  },
});
function doRemove() {
  if (confirmId.value) {
    if (detailId.value === confirmId.value) detailId.value = null;
    pruneMaterial(confirmId.value);
    remove(confirmId.value);
  }
  confirmId.value = null;
}

// ── 상세 ──
const detailId = ref<string | null>(null);
const detail = computed(() => (detailId.value ? get(detailId.value) ?? null : null));
const detailOpen = computed({
  get: () => detailId.value !== null,
  set: (v) => {
    if (!v) detailId.value = null;
  },
});
const botsUsing = computed(() =>
  detail.value ? bots.value.filter((b) => b.materialSetIds.includes(detail.value!.id)) : [],
);

// ── 자료 추가 ──
const addOpen = ref(false);
const addForm = reactive<Material>(blankMaterial("file"));
const addNameError = ref(false);
const addTagsText = computed({
  get: () => addForm.tags.join(", "),
  set: (v: string) => {
    addForm.tags = v.split(",").map((s) => s.trim()).filter(Boolean);
  },
});
function openAdd() {
  Object.assign(addForm, blankMaterial("file"));
  addNameError.value = false;
  addOpen.value = true;
}
function toggleSvc(slug: string) {
  const i = addForm.services.indexOf(slug);
  if (i >= 0) addForm.services.splice(i, 1);
  else addForm.services.push(slug);
}
const sourceHint = computed(
  () =>
    ({
      file: "파일명 (예: manual.pdf) — 데모에선 파일명만 입력",
      url: "https://...",
      text: "출처 표기 (예: 사내 위키 발췌)",
      qa: "출처 (예: PMS LMS 일반 카테고리)",
    })[addForm.type],
);
function submitAdd() {
  if (!addForm.name.trim()) {
    addNameError.value = true;
    return;
  }
  const meta = MATERIAL_TYPE_OPTS.find((o) => o.value === addForm.type);
  addForm.format = meta?.format ?? addForm.format;
  addForm.status = "processing";
  addForm.chunks = 0;
  if (!addForm.summary.trim()) addForm.summary = "색인 처리 중 — 요약을 준비하고 있습니다.";
  const created = JSON.parse(JSON.stringify(toRaw(addForm))) as Material;
  add(created);
  addOpen.value = false;
  if (import.meta.client) setTimeout(() => markIndexed(created.id), 1400);
}

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
        <p class="text-[11px] text-slate-400">색인 완료</p>
        <p class="mt-0.5 font-mono text-[20px] font-bold tabular-nums text-emerald-600">{{ stat.indexed }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-[11px] text-slate-400">처리 중</p>
        <p class="mt-0.5 font-mono text-[20px] font-bold tabular-nums text-blue-600">{{ stat.processing }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-[11px] text-slate-400">총 청크</p>
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
        <select v-model="draft.status" :class="selectCls">
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

    <!-- 카드 그리드 -->
    <section v-if="filtered.length" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="m in filtered"
        :key="m.id"
        class="group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-primary-300 hover:shadow-md"
        @click="detailId = m.id"
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
            :class="MATERIAL_STATUS_META[m.status].cls"
          >
            <RefreshCw v-if="m.status === 'processing'" class="size-2.5 animate-spin" />
            <span v-else class="size-1.5 rounded-full" :class="MATERIAL_STATUS_META[m.status].dot" />
            {{ MATERIAL_STATUS_META[m.status].label }}
          </span>
        </div>

        <p class="mt-3 line-clamp-2 text-[12px] leading-relaxed text-slate-500">{{ m.summary }}</p>

        <div class="mt-3 flex flex-wrap gap-1">
          <span v-for="t in m.tags" :key="t" class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-600">#{{ t }}</span>
        </div>

        <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span class="font-mono text-[11px] text-slate-400">
            {{ m.status === "indexed" ? `청크 ${m.chunks}` : m.status === "failed" ? "색인 실패" : "처리 중…" }}
          </span>
          <div class="flex items-center gap-1" @click.stop>
            <button
              v-if="m.status !== 'processing'"
              type="button"
              title="재색인"
              class="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              @click="doReindex(m.id)"
            >
              <RefreshCw class="size-4" />
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

    <AdminEmptyState
      v-else
      title="조건에 맞는 자료가 없습니다"
      :description="materials.length === 0 ? '학습 자료를 추가해 보세요.' : '검색어나 필터를 변경해 보세요.'"
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
      <template v-if="detail">
        <div class="flex items-center gap-3">
          <div class="flex size-11 shrink-0 items-center justify-center rounded-lg" :class="MATERIAL_TYPE_META[detail.type].cls">
            <component :is="TYPE_ICON[detail.type]" class="size-5" />
          </div>
          <div class="min-w-0">
            <span
              class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset"
              :class="MATERIAL_STATUS_META[detail.status].cls"
            >
              <RefreshCw v-if="detail.status === 'processing'" class="size-2.5 animate-spin" />
              {{ MATERIAL_STATUS_META[detail.status].label }}
            </span>
            <p class="mt-1 text-[12px] text-slate-500">
              {{ MATERIAL_TYPE_META[detail.type].label }} · {{ detail.format }} · {{ detail.sizeLabel }}
            </p>
          </div>
        </div>

        <p class="mt-4 text-[13px] leading-relaxed text-slate-700">{{ detail.summary }}</p>

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
              <span v-else>{{ detail.source }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-slate-400">색인 청크</dt>
            <dd class="mt-0.5 font-mono text-slate-700">{{ detail.status === "indexed" ? detail.chunks : "—" }}</dd>
          </div>
          <div>
            <dt class="text-slate-400">추가일</dt>
            <dd class="mt-0.5 font-mono text-slate-700">{{ detail.addedAt }}</dd>
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
        <div v-if="detail" class="flex justify-between">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
            @click="confirmId = detail.id"
          >
            <Trash2 class="size-4" />삭제
          </button>
          <button
            v-if="detail.status !== 'processing'"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
            @click="doReindex(detail.id)"
          >
            <RefreshCw class="size-4" />재색인
          </button>
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
              :class="chipCls(addForm.type === o.value)"
              @click="addForm.type = o.value"
            >
              {{ o.label }}
            </button>
          </div>
        </div>

        <!-- 파일 유형이면 드롭존(데모) -->
        <div
          v-if="addForm.type === 'file'"
          class="flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center"
        >
          <Plus class="size-5 text-slate-400" />
          <p class="text-[12px] font-medium text-slate-600">파일 드래그(데모) — 아래에 파일명을 입력하세요</p>
          <p class="text-[11px] text-slate-400">PDF · DOCX · TXT · PPTX · HWP</p>
        </div>
        <!-- 텍스트 유형이면 본문 입력 -->
        <div v-if="addForm.type === 'text'">
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">텍스트 본문(데모: 요약만 저장)</label>
          <textarea
            v-model="addForm.summary"
            rows="4"
            class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 text-[13px] ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="학습시킬 텍스트를 붙여넣으세요…"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">자료명 <span class="text-rose-500">*</span></label>
          <input
            v-model="addForm.name"
            :class="[inputCls, addNameError && !addForm.name.trim() ? 'ring-rose-400' : '']"
            placeholder="예: STEP 사용자 매뉴얼 v3.2"
            @input="addNameError = false"
          />
          <p v-if="addNameError && !addForm.name.trim()" class="mt-1 text-[11px] text-rose-500">자료명을 입력하세요.</p>
        </div>

        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">출처</label>
          <input v-model="addForm.source" :class="inputCls" :placeholder="sourceHint" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-1.5 block text-[12px] font-medium text-slate-600">크기 표기</label>
            <input v-model="addForm.sizeLabel" :class="inputCls" placeholder="예: 1.2 MB / 8쪽 / 120건" />
          </div>
          <div>
            <label class="mb-1.5 block text-[12px] font-medium text-slate-600">태그(콤마)</label>
            <input v-model="addTagsText" :class="inputCls" placeholder="매뉴얼, LMS" />
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-600">연관 서비스</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="s in SERVICE_OPTS"
              :key="s.value"
              type="button"
              :class="chipCls(addForm.services.includes(s.value))"
              @click="toggleSvc(s.value)"
            >
              {{ s.label }}
            </button>
          </div>
        </div>

        <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-[11.5px] text-slate-400">
          데모: 추가 시 자동으로 "처리 중" → "색인 완료"로 전환됩니다. 실제 R2 업로드·OpenSearch 색인은 API 연동 후 동작합니다.
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
            class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-5 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
            @click="submitAdd"
          >
            <Plus class="size-4" />추가하고 색인
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
            class="rounded-md bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700"
            @click="doRemove"
          >
            삭제
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
