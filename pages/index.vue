<!--
  pages/index.vue — admin 홈. KPI 4 카드 + 최근 활동.
  API: GET /admin/kpi
-->
<script setup lang="ts">
import { FileText, Bookmark, Image as ImageIcon, DollarSign, CircleHelp } from "lucide-vue-next";

useHead({ title: "홈 · 맑은도우미 Admin" });

const API_BASE = "https://malgn-helper-api.malgnsoft.workers.dev";

type Kpi = {
  standardAnswers: number;
  images: number;
  evals: number;
  evalsAvgScore: number | null;
  briefings: number;
  monthCostUsd: number;
  monthCalls: number;
};

type RecentItem = {
  kind: "qa_eval" | "image" | "standard_answer";
  id: number;
  title: string | null;
  refId: number | null;
  createdAt: string;
};

const kpi = ref<Kpi | null>(null);
const recent = ref<RecentItem[]>([]);
const pending = ref(true);
const error = ref<string | null>(null);

async function load() {
  pending.value = true;
  try {
    const res = await fetch(`${API_BASE}/admin/kpi`, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = (await res.json()) as { kpi: Kpi; recent: RecentItem[] };
    kpi.value = data.kpi;
    recent.value = data.recent;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    pending.value = false;
  }
}
onMounted(load);

function fmtCost(v: number) {
  return `$${v.toFixed(2)}`;
}
function fmtTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const KIND_LABEL: Record<RecentItem["kind"], string> = {
  qa_eval: "Q&A 평가",
  image: "이미지 캡션",
  standard_answer: "표준답변",
};
const KIND_COLOR: Record<RecentItem["kind"], string> = {
  qa_eval: "bg-violet-50 text-violet-700",
  image: "bg-emerald-50 text-emerald-700",
  standard_answer: "bg-amber-50 text-amber-700",
};
</script>

<template>
  <div>
    <header class="mb-6">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">DASHBOARD</p>
      <h1 class="mt-1 text-[22px] font-bold tracking-tight text-slate-900">홈</h1>
      <p class="mt-1.5 text-[13px] text-slate-500">시스템 현황과 최근 활동을 한눈에 봅니다.</p>
    </header>

    <!-- 로딩/에러 -->
    <div v-if="pending" class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
      로딩 중…
    </div>
    <div v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
      {{ error }}
    </div>

    <template v-else-if="kpi">
      <!-- KPI 4 카드 -->
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <NuxtLink
          to="/standard-answers"
          class="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary-300 hover:shadow-sm"
        >
          <div class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <Bookmark class="size-3.5" />
            <span>표준답변</span>
          </div>
          <p class="mt-2 text-[22px] font-bold tabular-nums text-slate-900">
            {{ kpi.standardAnswers }}<span class="ml-0.5 text-[13px] font-medium text-slate-400">건</span>
          </p>
          <p class="mt-0.5 text-[11px] text-slate-500">활성 카탈로그</p>
        </NuxtLink>

        <NuxtLink
          to="/images"
          class="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary-300 hover:shadow-sm"
        >
          <div class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <ImageIcon class="size-3.5" />
            <span>이미지 자산</span>
          </div>
          <p class="mt-2 text-[22px] font-bold tabular-nums text-slate-900">
            {{ kpi.images }}<span class="ml-0.5 text-[13px] font-medium text-slate-400">건</span>
          </p>
          <p class="mt-0.5 text-[11px] text-slate-500">자동 캡션 누적</p>
        </NuxtLink>

        <NuxtLink
          to="/qa-evals"
          class="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary-300 hover:shadow-sm"
        >
          <div class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <FileText class="size-3.5" />
            <span>Q&A 평가</span>
          </div>
          <p class="mt-2 text-[22px] font-bold tabular-nums text-slate-900">
            {{ kpi.evals }}<span class="ml-0.5 text-[13px] font-medium text-slate-400">건</span>
          </p>
          <p class="mt-0.5 text-[11px] text-slate-500">
            평균 ★ <span class="font-semibold">{{ kpi.evalsAvgScore ?? "—" }}</span> / 5
          </p>
        </NuxtLink>

        <NuxtLink
          to="/cost"
          class="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary-300 hover:shadow-sm"
        >
          <div class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <DollarSign class="size-3.5" />
            <span>이번 달 비용</span>
          </div>
          <p class="mt-2 text-[22px] font-bold tabular-nums text-primary-600">
            {{ fmtCost(kpi.monthCostUsd) }}
          </p>
          <p class="mt-0.5 text-[11px] text-slate-500">호출 {{ kpi.monthCalls.toLocaleString() }}회</p>
        </NuxtLink>
      </section>

      <!-- 최근 활동 -->
      <section class="mt-8 rounded-xl border border-slate-200 bg-white">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 class="text-[13px] font-semibold text-slate-900">📜 최근 활동</h2>
          <span class="text-[11px] text-slate-400">최근 10건</span>
        </header>
        <ol v-if="recent.length > 0" class="divide-y divide-slate-100">
          <li v-for="(a, i) in recent" :key="i" class="flex items-start gap-3 px-5 py-3">
            <span class="font-mono text-[11px] tabular-nums text-slate-400">{{ fmtTime(a.createdAt) }}</span>
            <span
              class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
              :class="KIND_COLOR[a.kind]"
            >
              {{ KIND_LABEL[a.kind] }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] text-slate-800">{{ a.title || "(제목 없음)" }}</p>
              <p v-if="a.refId" class="mt-0.5 text-[11px] text-slate-500">
                <span class="font-mono">ref #{{ a.refId }}</span>
              </p>
            </div>
          </li>
        </ol>
        <div v-else class="flex min-h-[120px] items-center justify-center text-[13px] text-slate-400">
          <CircleHelp class="mr-2 size-4" /> 아직 활동 없음
        </div>
      </section>
    </template>
  </div>
</template>
