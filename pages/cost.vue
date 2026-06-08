<!--
  pages/cost.vue — LLM 비용 대시보드 (admin 톤)
  데이터: GET /admin/cost?days=&limit=
-->
<script setup lang="ts">
import { DollarSign, Zap, Database, AlertTriangle } from "lucide-vue-next";

useHead({ title: "LLM 비용 · 맑은도우미 Admin" });

const API_BASE = "https://malgn-helper-api.malgnsoft.workers.dev";

type CostResp = {
  range: { days: number };
  summary: {
    calls: number;
    cacheHits: number;
    promptTokens: number;
    completionTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number | null;
    errors: number;
  };
  byModel: Array<{ model: string; calls: number; cacheHits: number; promptTokens: number; completionTokens: number; costUsd: number; avgLatencyMs: number | null; errors: number }>;
  byEntity: Array<{ entity: string; calls: number; costUsd: number }>;
  byDay: Array<{ date: string; calls: number; cacheHits: number; costUsd: number; errors: number }>;
  recent: Array<{ id: number; requestAt: string; route: string; entityType: string; entityId: number | null; model: string; promptTokens: number | null; completionTokens: number | null; latencyMs: number | null; costUsd: number | null; cacheHit: boolean; error: string | null }>;
};

const days = ref(30);
const data = ref<CostResp | null>(null);
const pending = ref(true);
const error = ref<string | null>(null);

async function load() {
  pending.value = true;
  error.value = null;
  try {
    const url = new URL(`${API_BASE}/admin/cost`);
    url.searchParams.set("days", String(days.value));
    url.searchParams.set("limit", "50");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    data.value = (await res.json()) as CostResp;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    pending.value = false;
  }
}
onMounted(load);
watch(days, load);

const cacheRate = computed(() => {
  const s = data.value?.summary;
  if (!s || s.calls === 0) return 0;
  return Math.round((s.cacheHits / s.calls) * 100);
});
const errorRate = computed(() => {
  const s = data.value?.summary;
  if (!s || s.calls === 0) return 0;
  return Math.round((s.errors / s.calls) * 100);
});

function fmtCost(v: number) {
  return `$${v.toFixed(4)}`;
}
function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
function fmtTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<template>
  <div>
    <header class="mb-6 flex items-end justify-between gap-3">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">분석·비용</p>
        <h1 class="mt-1 text-[22px] font-bold tracking-tight text-slate-900">LLM 비용</h1>
        <p class="mt-1.5 text-[13px] text-slate-500">일·모델·엔티티별 비용·지연·실패 통계</p>
      </div>
      <div class="flex items-center gap-1 rounded-md bg-white p-0.5 text-[12px] ring-1 ring-slate-200">
        <button
          v-for="d in [7, 30, 90]"
          :key="d"
          type="button"
          class="rounded px-3 py-1.5 transition"
          :class="days === d ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-slate-600 hover:text-slate-900'"
          @click="days = d"
        >{{ d }}일</button>
      </div>
    </header>

    <div v-if="pending" class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">로딩 중…</div>
    <div v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{{ error }}</div>

    <template v-else-if="data">
      <!-- KPI 4 -->
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <DollarSign class="size-3.5" /><span>총 비용</span>
          </div>
          <p class="mt-2 text-[22px] font-bold tabular-nums text-primary-600">{{ fmtCost(data.summary.totalCostUsd) }}</p>
          <p class="mt-0.5 text-[11px] text-slate-500">{{ data.summary.calls.toLocaleString() }}회 호출</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <Database class="size-3.5" /><span>캐시 적중</span>
          </div>
          <p class="mt-2 text-[22px] font-bold tabular-nums text-emerald-600">{{ cacheRate }}<span class="text-[14px]">%</span></p>
          <p class="mt-0.5 text-[11px] text-slate-500">{{ data.summary.cacheHits.toLocaleString() }} / {{ data.summary.calls.toLocaleString() }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <Zap class="size-3.5" /><span>평균 지연</span>
          </div>
          <p class="mt-2 text-[22px] font-bold tabular-nums text-slate-900">{{ data.summary.avgLatencyMs ?? "—" }}<span class="ml-0.5 text-[14px] font-medium text-slate-400">ms</span></p>
          <p class="mt-0.5 text-[11px] text-slate-500">토큰 {{ fmtTokens(data.summary.promptTokens + data.summary.completionTokens) }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <div class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <AlertTriangle class="size-3.5" /><span>실패율</span>
          </div>
          <p class="mt-2 text-[22px] font-bold tabular-nums" :class="errorRate > 5 ? 'text-rose-600' : 'text-slate-900'">{{ errorRate }}<span class="text-[14px]">%</span></p>
          <p class="mt-0.5 text-[11px] text-slate-500">에러 {{ data.summary.errors }}건</p>
        </div>
      </section>

      <!-- 모델별 표 -->
      <section class="mt-8 rounded-xl border border-slate-200 bg-white">
        <header class="border-b border-slate-100 px-5 py-3.5">
          <h2 class="text-[13px] font-semibold text-slate-900">모델별 통계</h2>
        </header>
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-5 py-2.5 text-left font-medium">모델</th>
                <th class="px-3 py-2.5 text-right font-medium">호출</th>
                <th class="px-3 py-2.5 text-right font-medium">캐시</th>
                <th class="px-3 py-2.5 text-right font-medium">토큰(P/C)</th>
                <th class="px-3 py-2.5 text-right font-medium">비용</th>
                <th class="px-3 py-2.5 text-right font-medium">평균 지연</th>
                <th class="px-5 py-2.5 text-right font-medium">에러</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="m in data.byModel" :key="m.model" class="hover:bg-slate-50/60">
                <td class="px-5 py-3 font-mono text-[12px] text-slate-800">{{ m.model }}</td>
                <td class="px-3 py-3 text-right font-mono tabular-nums">{{ m.calls.toLocaleString() }}</td>
                <td class="px-3 py-3 text-right font-mono tabular-nums text-slate-500">{{ m.cacheHits }}</td>
                <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-600">{{ fmtTokens(m.promptTokens) }} / {{ fmtTokens(m.completionTokens) }}</td>
                <td class="px-3 py-3 text-right font-mono font-semibold tabular-nums text-primary-700">{{ fmtCost(m.costUsd) }}</td>
                <td class="px-3 py-3 text-right font-mono tabular-nums text-slate-500">{{ m.avgLatencyMs ?? "—" }}ms</td>
                <td class="px-5 py-3 text-right font-mono tabular-nums" :class="m.errors > 0 ? 'text-rose-600' : 'text-slate-400'">{{ m.errors }}</td>
              </tr>
              <tr v-if="!data.byModel.length"><td colspan="7" class="px-5 py-8 text-center text-[13px] text-slate-400">데이터 없음</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 일별 추이 + 엔티티별 -->
      <section class="mt-6 grid gap-6 lg:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white">
          <header class="border-b border-slate-100 px-5 py-3.5">
            <h2 class="text-[13px] font-semibold text-slate-900">일별 추이</h2>
          </header>
          <ol class="divide-y divide-slate-100">
            <li v-for="d in data.byDay.slice(0, 14)" :key="d.date" class="flex items-center gap-3 px-5 py-2.5">
              <span class="font-mono text-[12px] tabular-nums text-slate-500">{{ d.date.slice(5) }}</span>
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-primary-500"
                  :style="{ width: Math.min(100, (d.costUsd / Math.max(...data.byDay.map(x => x.costUsd), 0.001)) * 100) + '%' }"
                />
              </div>
              <span class="w-20 text-right font-mono text-[12px] tabular-nums text-slate-700">{{ fmtCost(d.costUsd) }}</span>
            </li>
            <li v-if="!data.byDay.length" class="px-5 py-8 text-center text-[13px] text-slate-400">데이터 없음</li>
          </ol>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white">
          <header class="border-b border-slate-100 px-5 py-3.5">
            <h2 class="text-[13px] font-semibold text-slate-900">엔티티별 분포</h2>
          </header>
          <ol class="divide-y divide-slate-100">
            <li v-for="e in data.byEntity" :key="e.entity" class="flex items-center gap-3 px-5 py-2.5">
              <span class="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">{{ e.entity }}</span>
              <span class="text-[12px] text-slate-500">{{ e.calls }}회</span>
              <span class="ml-auto font-mono text-[12px] font-semibold tabular-nums text-slate-800">{{ fmtCost(e.costUsd) }}</span>
            </li>
            <li v-if="!data.byEntity.length" class="px-5 py-8 text-center text-[13px] text-slate-400">데이터 없음</li>
          </ol>
        </div>
      </section>

      <!-- 최근 호출 -->
      <section class="mt-6 rounded-xl border border-slate-200 bg-white">
        <header class="border-b border-slate-100 px-5 py-3.5">
          <h2 class="text-[13px] font-semibold text-slate-900">최근 호출</h2>
        </header>
        <div class="overflow-x-auto">
          <table class="w-full text-[12px]">
            <thead class="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-5 py-2 text-left font-medium">시각</th>
                <th class="px-3 py-2 text-left font-medium">엔티티</th>
                <th class="px-3 py-2 text-left font-medium">모델</th>
                <th class="px-3 py-2 text-right font-medium">지연</th>
                <th class="px-5 py-2 text-right font-medium">비용</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="r in data.recent" :key="r.id" class="hover:bg-slate-50/60">
                <td class="px-5 py-2.5 font-mono text-slate-500">{{ fmtTime(r.requestAt) }}</td>
                <td class="px-3 py-2.5"><span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">{{ r.entityType }}</span></td>
                <td class="px-3 py-2.5 font-mono text-slate-700">{{ r.model }}</td>
                <td class="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">{{ r.latencyMs ?? "—" }}ms</td>
                <td class="px-5 py-2.5 text-right font-mono font-semibold tabular-nums text-slate-800">{{ r.costUsd != null ? fmtCost(r.costUsd) : "—" }}</td>
              </tr>
              <tr v-if="!data.recent.length"><td colspan="5" class="px-5 py-8 text-center text-slate-400">데이터 없음</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
