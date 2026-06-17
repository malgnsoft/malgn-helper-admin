<!--
  pages/bots/index.vue — 봇 관리 목록 (서비스별 구분).
  /admin/bots 전체 로드 후 serviceId로 그룹핑(공통 섹션 + 서비스별 섹션). 서비스/상태 필터 제공.
  쓰기(삭제·토글)는 서버가 admin 강제 → 권한 없으면 403 처리.
-->
<script setup lang="ts">
import { Bot as BotIcon, Plus, Pencil, Trash2, Power } from "lucide-vue-next";

useHead({ title: "봇 관리 · 맑은도우미 Admin" });

const { bots, list, remove, toggleStatus } = useBots();
const { services: serviceOpts, load: loadServices, nameOf } = useServiceOptions();

const me = useAuthUser();
const isAdmin = computed(() => (me.value?.level ?? 0) >= 9);

const pending = ref(true);
const error = ref<string | null>(null);

async function load() {
  pending.value = true;
  error.value = null;
  try {
    await Promise.all([list({ limit: 200 }), loadServices()]);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    pending.value = false;
  }
}
onMounted(load);

// 필터: 입력(draft)은 '조회'/Enter 로 적용(applied)된다. (전체 로드 → 클라이언트 필터)
const draft = reactive({ q: "", status: "" as "" | BotStatus, service: "" as "" | "common" | string, tone: "" as "" | Tone });
const applied = reactive({ q: "", status: "" as "" | BotStatus, service: "" as "" | "common" | string, tone: "" as "" | Tone });

const STATUS_FILTER_OPTS = [
  { value: "", label: "전체" },
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
  { value: "draft", label: "초안" },
];
const SERVICE_FILTER_OPTS = computed(() => [
  { value: "", label: "전체" },
  { value: "common", label: "공통(전 서비스)" },
  ...serviceOpts.value.map((s) => ({ value: String(s.id), label: s.name })),
]);
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
    if (applied.service === "common" && b.serviceId !== null) return false;
    if (applied.service && applied.service !== "common" && String(b.serviceId) !== applied.service) return false;
    if (applied.tone && b.tone !== applied.tone) return false;
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      (b.serviceName ?? "").toLowerCase().includes(q) ||
      b.topics.some((t) => t.toLowerCase().includes(q))
    );
  });
});

// ── 서비스별 섹션 그룹핑: 공통(null) 먼저, 그다음 서비스 순서 ──
type Section = { key: string; serviceId: number | null; title: string; bots: typeof filtered.value };
const sections = computed<Section[]>(() => {
  const list = filtered.value;
  const result: Section[] = [];

  // 공통 섹션
  const common = list.filter((b) => b.serviceId === null);
  result.push({ key: "common", serviceId: null, title: "공통 (전 서비스)", bots: common });

  // 서비스별 — /services 정렬을 따르고, 카탈로그에 없는 serviceId는 뒤에 추가
  const seen = new Set<number>();
  for (const s of serviceOpts.value) {
    const group = list.filter((b) => b.serviceId === s.id);
    seen.add(s.id);
    result.push({ key: `svc-${s.id}`, serviceId: s.id, title: s.name, bots: group });
  }
  const orphanIds = [...new Set(list.filter((b) => b.serviceId !== null && !seen.has(b.serviceId!)).map((b) => b.serviceId!))];
  for (const id of orphanIds) {
    result.push({ key: `svc-${id}`, serviceId: id, title: nameOf(id), bots: list.filter((b) => b.serviceId === id) });
  }

  // 특정 서비스/공통 필터가 걸리면 빈 섹션은 숨긴다. 전체일 땐 모든 섹션 노출(빈 섹션 안내).
  if (applied.service) return result.filter((s) => s.bots.length > 0);
  return result;
});

const activeCount = computed(() => bots.value.filter((b) => b.status === "active").length);

const selectCls =
  "h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500";

// ── 삭제 ──
const confirmId = ref<string | null>(null);
const confirmTarget = computed(() => bots.value.find((b) => b.id === confirmId.value) ?? null);
const confirmOpen = computed({
  get: () => confirmId.value !== null,
  set: (v) => {
    if (!v) confirmId.value = null;
  },
});
const actionErr = ref<string | null>(null);
const deleting = ref(false);
async function doRemove() {
  if (!confirmId.value) return;
  deleting.value = true;
  actionErr.value = null;
  try {
    await remove(confirmId.value);
    confirmId.value = null;
  } catch (e) {
    actionErr.value = (e as Error).message;
  } finally {
    deleting.value = false;
  }
}

const togglingId = ref<string | null>(null);
async function doToggle(id: string) {
  if (togglingId.value) return;
  togglingId.value = id;
  actionErr.value = null;
  try {
    await toggleStatus(id);
  } catch (e) {
    actionErr.value = (e as Error).message;
  } finally {
    togglingId.value = null;
  }
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
      description="봇을 서비스(솔루션)별로 구분해 관리합니다. 각 봇의 구분·캐릭터·답변 범위·모델을 설정하세요."
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

    <!-- 액션 오류 -->
    <div v-if="actionErr" class="mb-3 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ actionErr }}</div>

    <!-- 로딩 -->
    <div v-if="pending" class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
      불러오는 중…
    </div>

    <!-- 로드 오류 -->
    <div v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
      봇 목록을 불러오지 못했습니다 — {{ error }}
    </div>

    <!-- 전체 빈 상태 -->
    <AdminEmptyState
      v-else-if="filtered.length === 0"
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

    <!-- 서비스별 섹션 -->
    <div v-else class="space-y-7">
      <section v-for="sec in sections" :key="sec.key">
        <div class="mb-3 flex items-center gap-2">
          <h2 class="text-[14px] font-bold text-slate-800">{{ sec.title }}</h2>
          <span
            class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            :class="sec.serviceId === null ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'"
          >
            {{ sec.serviceId === null ? "공통" : "서비스" }}
          </span>
          <span class="font-mono text-[11px] text-slate-400">{{ sec.bots.length }}개</span>
        </div>

        <!-- 카드 그리드 -->
        <div
          v-if="sec.bots.length"
          class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <article
            v-for="b in sec.bots"
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

            <!-- 메타: 구분 + 말투 -->
            <dl class="mt-4 space-y-2 text-[12px]">
              <div class="flex items-center gap-2">
                <dt class="w-12 shrink-0 text-slate-400">구분</dt>
                <dd>
                  <span
                    class="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                    :class="b.serviceId === null ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'"
                  >{{ b.serviceId === null ? "공통" : b.serviceName ?? nameOf(b.serviceId) }}</span>
                </dd>
              </div>
              <div class="flex items-center gap-2">
                <dt class="w-12 shrink-0 text-slate-400">말투</dt>
                <dd class="font-medium text-slate-700">{{ toneLabel(b.tone) }}</dd>
                <span class="text-slate-300">·</span>
                <dd class="text-slate-500">
                  {{ b.visibility === "internal" ? "비공개 포함" : "공개 자료만" }}
                </dd>
              </div>
              <div class="flex items-center gap-2">
                <dt class="w-12 shrink-0 text-slate-400">답변</dt>
                <dd class="text-slate-600">
                  {{ b.useStandardAnswers ? "표준답변 우선" : "표준답변 미사용" }}
                  <span class="text-slate-300">·</span>
                  모름 {{ UNKNOWN_POLICY_OPTS.find((o) => o.value === b.unknownPolicy)?.label }}
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
              <span class="font-mono text-[11px] text-slate-400">{{ b.updatedAt || "—" }}</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  :disabled="!isAdmin || togglingId === b.id"
                  :title="!isAdmin ? 'admin 권한 필요' : b.status === 'active' ? '비활성화' : '활성화'"
                  class="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  @click="doToggle(b.id)"
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
                  :disabled="!isAdmin"
                  :title="!isAdmin ? 'admin 권한 필요' : '삭제'"
                  class="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                  @click="confirmId = b.id"
                >
                  <Trash2 class="size-4" />
                </button>
              </div>
            </div>
          </article>
        </div>

        <!-- 빈 서비스 섹션(전체 조회 시) -->
        <p
          v-else
          class="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-[12px] text-slate-400"
        >
          이 구분에 등록된 봇이 없습니다.
        </p>
      </section>
    </div>

    <p v-if="!pending && !error && !isAdmin" class="mt-4 text-[11px] text-slate-400">
      봇 생성·편집·삭제·상태 변경은 admin 권한이 필요합니다. 현재 계정은 조회만 가능합니다.
    </p>

    <!-- 삭제 확인 -->
    <AdminModal v-model="confirmOpen" title="봇 삭제" size="sm">
      <p class="text-[13px] text-slate-600">
        <span class="font-semibold text-slate-900">{{ confirmTarget?.name }}</span> 봇을
        삭제할까요? 되돌릴 수 없습니다.
      </p>
      <p v-if="actionErr" class="mt-2 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ actionErr }}</p>
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
            :disabled="deleting"
            class="rounded-md bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            @click="doRemove"
          >
            {{ deleting ? "삭제 중…" : "삭제" }}
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
