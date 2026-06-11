<!--
  pages/bots/index.vue — 봇 관리 목록.
  여러 챗봇을 만들고 각 봇의 캐릭터·답변범위·학습소스를 지정. 데이터는 use-bots(localStorage 데모).
-->
<script setup lang="ts">
import { Bot as BotIcon, Plus, Pencil, Trash2, Power } from "lucide-vue-next";

useHead({ title: "봇 관리 · 맑은도우미 Admin" });

const { bots, ensureHydrated, remove, toggleStatus } = useBots();
onMounted(ensureHydrated);

// 필터: 입력(draft)은 '조회'/Enter 로 적용(applied)된다.
const draft = reactive({ q: "", status: "" as "" | BotStatus, service: "", tone: "" as "" | Tone });
const applied = reactive({ q: "", status: "" as "" | BotStatus, service: "", tone: "" as "" | Tone });

const STATUS_FILTER_OPTS = [
  { value: "", label: "전체" },
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
  { value: "draft", label: "초안" },
];
const SERVICE_FILTER_OPTS = [{ value: "", label: "전체" }, ...SERVICE_OPTS];
const TONE_FILTER_OPTS = [
  { value: "", label: "전체" },
  ...TONE_OPTS.map((t) => ({ value: t.value, label: t.label })),
];

function applyFilter() {
  applied.q = draft.q;
  applied.status = draft.status;
  applied.service = draft.service;
  applied.tone = draft.tone;
}
function resetFilter() {
  draft.q = "";
  draft.status = "";
  draft.service = "";
  draft.tone = "";
  applyFilter();
}

const filtered = computed(() => {
  const q = applied.q.trim().toLowerCase();
  return bots.value.filter((b) => {
    if (applied.status && b.status !== applied.status) return false;
    if (applied.service && !b.services.includes(applied.service)) return false;
    if (applied.tone && b.tone !== applied.tone) return false;
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.services.some((s) => serviceLabel(s).toLowerCase().includes(q)) ||
      b.topics.some((t) => t.toLowerCase().includes(q))
    );
  });
});

const activeCount = computed(() => bots.value.filter((b) => b.status === "active").length);

const selectCls =
  "h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500";

const confirmId = ref<string | null>(null);
const confirmTarget = computed(() => bots.value.find((b) => b.id === confirmId.value) ?? null);
const confirmOpen = computed({
  get: () => confirmId.value !== null,
  set: (v) => {
    if (!v) confirmId.value = null;
  },
});
function doRemove() {
  if (confirmId.value) remove(confirmId.value);
  confirmId.value = null;
}

function toneLabel(t: Tone) {
  return TONE_OPTS.find((o) => o.value === t)?.label ?? t;
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="봇 관리"
      description="여러 챗봇을 만들고 봇마다 캐릭터(말투·성격) · 답변 범위 · 학습 소스를 지정합니다."
    >
      <template #actions>
        <NuxtLink
          to="/bots/new"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          <Plus class="size-4" />새 봇
        </NuxtLink>
      </template>
    </AdminPageHeader>

    <!-- 필터 바 -->
    <AdminFilterBar @search="applyFilter" @reset="resetFilter">
      <AdminFilterField label="구분(서비스)">
        <select v-model="draft.service" :class="selectCls">
          <option v-for="o in SERVICE_FILTER_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="상태">
        <select v-model="draft.status" :class="selectCls">
          <option v-for="o in STATUS_FILTER_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="말투">
        <select v-model="draft.tone" :class="selectCls">
          <option v-for="o in TONE_FILTER_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="검색어" grow>
        <AdminSearchInput
          v-model="draft.q"
          placeholder="봇 이름 · 서비스 · 토픽 검색 후 Enter"
          @keyup.enter="applyFilter"
        />
      </AdminFilterField>
    </AdminFilterBar>

    <!-- 결과 수 -->
    <div class="mb-3 flex items-center justify-end text-[12px] text-slate-500">
      활성
      <span class="mx-1 font-mono font-semibold tabular-nums text-emerald-600">{{ activeCount }}</span>
      / 총
      <span class="mx-1 font-mono font-semibold tabular-nums text-slate-800">{{ bots.length }}</span>개
      <span class="ml-2 text-slate-400">· 표시 {{ filtered.length }}</span>
    </div>

    <!-- 카드 그리드 -->
    <section
      v-if="filtered.length > 0"
      class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      <article
        v-for="b in filtered"
        :key="b.id"
        class="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-primary-300 hover:shadow-md"
      >
        <!-- 헤더: 아바타 + 이름 + 상태 -->
        <div class="flex items-start gap-3">
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[22px] leading-none"
          >
            {{ b.avatar }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="truncate text-[15px] font-bold text-slate-900">{{ b.name }}</h3>
              <span
                class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset"
                :class="STATUS_META[b.status].cls"
              >
                <span class="size-1.5 rounded-full" :class="STATUS_META[b.status].dot" />
                {{ STATUS_META[b.status].label }}
              </span>
            </div>
            <p class="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
              {{ b.description || "설명 없음" }}
            </p>
          </div>
        </div>

        <!-- 메타: 말투 + 서비스 -->
        <dl class="mt-4 space-y-2 text-[12px]">
          <div class="flex items-center gap-2">
            <dt class="w-12 shrink-0 text-slate-400">말투</dt>
            <dd class="font-medium text-slate-700">{{ toneLabel(b.tone) }}</dd>
            <span class="text-slate-300">·</span>
            <dd class="text-slate-500">
              {{ b.visibility === "internal" ? "비공개 포함" : "공개 자료만" }}
            </dd>
          </div>
          <div class="flex items-start gap-2">
            <dt class="w-12 shrink-0 pt-0.5 text-slate-400">범위</dt>
            <dd class="flex flex-wrap gap-1">
              <span
                v-for="s in b.services"
                :key="s"
                class="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700"
                >{{ serviceLabel(s) }}</span
              >
              <span v-if="!b.services.length" class="text-[11px] text-slate-400">미지정</span>
            </dd>
          </div>
          <div class="flex items-center gap-2">
            <dt class="w-12 shrink-0 text-slate-400">학습</dt>
            <dd class="text-slate-600">
              <span class="font-mono font-semibold text-slate-700">{{ b.materialSetIds.length }}</span>개 자료
              <span class="text-slate-300">·</span>
              {{ b.useStandardAnswers ? "표준답변 사용" : "표준답변 미사용" }}
            </dd>
          </div>
          <div v-if="b.traits.length" class="flex items-start gap-2">
            <dt class="w-12 shrink-0 pt-0.5 text-slate-400">성격</dt>
            <dd class="flex flex-wrap gap-1">
              <span
                v-for="t in b.traits"
                :key="t"
                class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600"
                >{{ t }}</span
              >
            </dd>
          </div>
        </dl>

        <!-- 푸터: 갱신 + 액션 -->
        <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span class="font-mono text-[11px] text-slate-400">{{ b.updatedAt }}</span>
          <div class="flex items-center gap-1">
            <button
              type="button"
              :title="b.status === 'active' ? '비활성화' : '활성화'"
              class="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              @click="toggleStatus(b.id)"
            >
              <Power class="size-4" />
            </button>
            <NuxtLink
              :to="`/bots/${b.id}`"
              title="편집"
              class="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Pencil class="size-4" />
            </NuxtLink>
            <button
              type="button"
              title="삭제"
              class="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"
              @click="confirmId = b.id"
            >
              <Trash2 class="size-4" />
            </button>
          </div>
        </div>
      </article>
    </section>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-else
      title="조건에 맞는 봇이 없습니다"
      :description="bots.length === 0 ? '새 봇을 추가해 보세요.' : '검색어나 필터를 변경해 보세요.'"
    >
      <template #icon>
        <BotIcon class="size-5 text-slate-400" />
      </template>
      <template #actions>
        <NuxtLink
          to="/bots/new"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
        >
          <Plus class="size-4" />새 봇 만들기
        </NuxtLink>
      </template>
    </AdminEmptyState>

    <!-- 삭제 확인 -->
    <AdminModal v-model="confirmOpen" title="봇 삭제" size="sm">
      <p class="text-[13px] text-slate-600">
        <span class="font-semibold text-slate-900">{{ confirmTarget?.name }}</span> 봇을
        삭제할까요? 되돌릴 수 없습니다.
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
