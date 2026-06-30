<!--
  pages/cost.vue — LLM 비용 대시보드.
  데이터: GET /admin/cost?days=&limit=
-->
<script setup lang="ts">
import { DollarSign, Zap, Database, AlertTriangle } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: 'LLM 비용 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

type CostResp = {
  range: { days: number }
  summary: {
    calls: number
    cacheHits: number
    promptTokens: number
    completionTokens: number
    totalCostUsd: number
    avgLatencyMs: number | null
    errors: number
  }
  byModel: Array<{
    model: string
    calls: number
    cacheHits: number
    promptTokens: number
    completionTokens: number
    costUsd: number
    avgLatencyMs: number | null
    errors: number
  }>
  byEntity: Array<{ entity: string; calls: number; costUsd: number }>
  byDay: Array<{
    date: string
    calls: number
    cacheHits: number
    costUsd: number
    errors: number
  }>
  recent: Array<{
    id: number
    requestAt: string
    route: string
    entityType: string
    entityId: number | null
    model: string
    promptTokens: number | null
    completionTokens: number | null
    latencyMs: number | null
    costUsd: number | null
    cacheHit: boolean
    error: string | null
  }>
}

const DAYS_OPTS = [
  { value: 7, label: '7일' },
  { value: 30, label: '30일' },
  { value: 90, label: '90일' },
]

const MODEL_COLS: TableColumn[] = [
  { key: 'model', label: '모델' },
  { key: 'calls', label: '호출', align: 'right' },
  { key: 'cache', label: '캐시', align: 'right' },
  { key: 'tokens', label: '토큰(P/C)', align: 'right' },
  { key: 'cost', label: '비용', align: 'right' },
  { key: 'latency', label: '평균 지연', align: 'right' },
  { key: 'errors', label: '에러', align: 'right' },
]

const RECENT_COLS: TableColumn[] = [
  { key: 'time', label: '시각' },
  { key: 'entity', label: '엔티티' },
  { key: 'model', label: '모델' },
  { key: 'latency', label: '지연', align: 'right' },
  { key: 'cost', label: '비용', align: 'right' },
]

const days = ref(30)
const data = ref<CostResp | null>(null)
const pending = ref(true)
const error = ref<string | null>(null)

async function load() {
  pending.value = true
  error.value = null
  try {
    const url = new URL(`${API_BASE}/admin/cost`)
    url.searchParams.set('days', String(days.value))
    url.searchParams.set('limit', '50')
    const res = await apiFetch(url, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) throw new Error(`API ${res.status}`)
    data.value = (await res.json()) as CostResp
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    pending.value = false
  }
}
onMounted(load)
watch(days, load)

const cacheRate = computed(() => {
  const s = data.value?.summary
  if (!s || s.calls === 0) return 0
  return Math.round((s.cacheHits / s.calls) * 100)
})
const errorRate = computed(() => {
  const s = data.value?.summary
  if (!s || s.calls === 0) return 0
  return Math.round((s.errors / s.calls) * 100)
})

function fmtCost(v: number) {
  return `$${v.toFixed(4)}`
}
function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
function fmtTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 일별 최대 비용 (bar width 계산)
const maxDayCost = computed(() =>
  Math.max(...(data.value?.byDay.map((x) => x.costUsd) ?? []), 0.001),
)
</script>

<template>
  <div>
    <AdminPageHeader
      caption="분석·비용"
      title="LLM 비용"
      description="일·모델·엔티티별 비용·지연·실패 통계"
    >
      <template #actions>
        <AdminSegment v-model="days" :options="DAYS_OPTS" />
      </template>
    </AdminPageHeader>

    <!-- 로딩 / 에러 -->
    <div
      v-if="pending"
      class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
    >
      로딩 중…
    </div>
    <div
      v-else-if="error"
      class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
    >
      {{ error }}
    </div>

    <template v-else-if="data">
      <!-- KPI 4 카드 -->
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminKpiCard
          label="총 비용"
          :value="fmtCost(data.summary.totalCostUsd)"
          :sub="`${data.summary.calls.toLocaleString()}회 호출`"
          value-class="text-primary-600"
        >
          <template #icon><DollarSign class="size-3.5" /></template>
        </AdminKpiCard>

        <AdminKpiCard
          label="캐시 적중"
          :value="`${cacheRate}%`"
          :sub="`${data.summary.cacheHits.toLocaleString()} / ${data.summary.calls.toLocaleString()}`"
          value-class="text-emerald-600"
        >
          <template #icon><Database class="size-3.5" /></template>
        </AdminKpiCard>

        <AdminKpiCard
          label="평균 지연"
          :value="data.summary.avgLatencyMs ?? '—'"
          unit="ms"
          :sub="`토큰 ${fmtTokens(data.summary.promptTokens + data.summary.completionTokens)}`"
        >
          <template #icon><Zap class="size-3.5" /></template>
        </AdminKpiCard>

        <AdminKpiCard
          label="실패율"
          :value="`${errorRate}%`"
          :sub="`에러 ${data.summary.errors}건`"
          :value-class="errorRate > 5 ? 'text-rose-600' : 'text-slate-900'"
        >
          <template #icon><AlertTriangle class="size-3.5" /></template>
        </AdminKpiCard>
      </section>

      <!-- 모델별 통계 -->
      <AdminDataTable
        :columns="MODEL_COLS"
        :rows="data.byModel"
        title="모델별 통계"
        class="mt-8"
      >
        <template #default="{ row }">
          <tr class="hover:bg-slate-50/60">
            <td class="px-5 py-3 font-mono text-[12px] text-slate-800">{{ row.model }}</td>
            <td class="px-3 py-3 text-right font-mono tabular-nums">
              {{ row.calls.toLocaleString() }}
            </td>
            <td class="px-3 py-3 text-right font-mono tabular-nums text-slate-500">
              {{ row.cacheHits }}
            </td>
            <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-600">
              {{ fmtTokens(row.promptTokens) }} / {{ fmtTokens(row.completionTokens) }}
            </td>
            <td
              class="px-3 py-3 text-right font-mono font-semibold tabular-nums text-primary-700"
            >
              {{ fmtCost(row.costUsd) }}
            </td>
            <td class="px-3 py-3 text-right font-mono tabular-nums text-slate-500">
              {{ row.avgLatencyMs ?? '—' }}ms
            </td>
            <td
              class="px-5 py-3 text-right font-mono tabular-nums"
              :class="row.errors > 0 ? 'text-rose-600' : 'text-slate-400'"
            >
              {{ row.errors }}
            </td>
          </tr>
        </template>
      </AdminDataTable>

      <!-- 일별 추이 + 엔티티별 -->
      <section class="mt-6 grid gap-6 lg:grid-cols-2">
        <!-- 일별 추이 -->
        <div class="rounded-xl border border-slate-200 bg-white">
          <header class="border-b border-slate-100 px-5 py-3.5">
            <h2 class="text-[13px] font-semibold text-slate-900">일별 추이</h2>
          </header>
          <ol class="divide-y divide-slate-100">
            <li
              v-for="d in data.byDay.slice(0, 14)"
              :key="d.date"
              class="flex items-center gap-3 px-5 py-2.5"
            >
              <span class="font-mono text-[12px] tabular-nums text-slate-500">
                {{ d.date.slice(5) }}
              </span>
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full bg-primary-500"
                  :style="{
                    width: Math.min(100, (d.costUsd / maxDayCost) * 100) + '%',
                  }"
                />
              </div>
              <span
                class="w-20 text-right font-mono text-[12px] tabular-nums text-slate-700"
              >
                {{ fmtCost(d.costUsd) }}
              </span>
            </li>
            <li
              v-if="!data.byDay.length"
              class="px-5 py-8 text-center text-[13px] text-slate-400"
            >
              데이터 없음
            </li>
          </ol>
        </div>

        <!-- 엔티티별 분포 -->
        <div class="rounded-xl border border-slate-200 bg-white">
          <header class="border-b border-slate-100 px-5 py-3.5">
            <h2 class="text-[13px] font-semibold text-slate-900">엔티티별 분포</h2>
          </header>
          <ol class="divide-y divide-slate-100">
            <li
              v-for="e in data.byEntity"
              :key="e.entity"
              class="flex items-center gap-3 px-5 py-2.5"
            >
              <span
                class="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700"
              >
                {{ e.entity }}
              </span>
              <span class="text-[12px] text-slate-500">{{ e.calls }}회</span>
              <span
                class="ml-auto font-mono text-[12px] font-semibold tabular-nums text-slate-800"
              >
                {{ fmtCost(e.costUsd) }}
              </span>
            </li>
            <li
              v-if="!data.byEntity.length"
              class="px-5 py-8 text-center text-[13px] text-slate-400"
            >
              데이터 없음
            </li>
          </ol>
        </div>
      </section>

      <!-- 최근 호출 -->
      <AdminDataTable
        :columns="RECENT_COLS"
        :rows="data.recent"
        title="최근 호출"
        class="mt-6"
      >
        <template #default="{ row }">
          <tr class="hover:bg-slate-50/60">
            <td class="px-5 py-2.5 font-mono text-[12px] text-slate-500">
              {{ fmtTime(row.requestAt) }}
            </td>
            <td class="px-3 py-2.5">
              <span
                class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700"
              >
                {{ row.entityType }}
              </span>
            </td>
            <td class="px-3 py-2.5 font-mono text-[12px] text-slate-700">{{ row.model }}</td>
            <td class="px-3 py-2.5 text-right font-mono text-[12px] tabular-nums text-slate-600">
              {{ row.latencyMs ?? '—' }}ms
            </td>
            <td
              class="px-5 py-2.5 text-right font-mono text-[12px] font-semibold tabular-nums text-slate-800"
            >
              {{ row.costUsd != null ? fmtCost(row.costUsd) : '—' }}
            </td>
          </tr>
        </template>
      </AdminDataTable>
    </template>
  </div>
</template>
