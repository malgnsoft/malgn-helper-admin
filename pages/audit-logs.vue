<!--
  pages/audit-logs.vue — LLM 호출 감사 로그 (hp_llm_log).
  현재 데이터 소스: GET /admin/cost 의 recent 배열.
  권장: 전용 GET /admin/logs 엔드포인트 신설(API 담당 협의 필요).
-->
<script setup lang="ts">
import { ClipboardList, CheckCircle, XCircle } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '감사 로그 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

type LogRow = {
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
}

const COLUMNS: TableColumn[] = [
  { key: 'time',     label: '시각' },
  { key: 'route',    label: '라우트' },
  { key: 'entity',   label: '엔티티' },
  { key: 'model',    label: '모델' },
  { key: 'tokens',   label: '토큰(P+C)', align: 'right' },
  { key: 'latency',  label: '지연',      align: 'right' },
  { key: 'cost',     label: '비용',      align: 'right' },
  { key: 'cache',    label: '캐시',      align: 'center' },
  { key: 'error',    label: '오류',      align: 'center' },
]

const ENTITY_OPTS = [
  { value: '', label: '전체 엔티티' },
  { value: 'standard_answer', label: '표준답변' },
  { value: 'image_asset', label: '이미지' },
  { value: 'qa_eval', label: 'QA 평가' },
  { value: 'briefing', label: 'briefing' },
]

const days        = ref(7)
const entityType  = ref('')
const errorOnly   = ref(false)
const rows        = ref<LogRow[]>([])
const pending     = ref(true)
const error       = ref<string | null>(null)
const selected    = ref<LogRow | null>(null)
const detailOpen  = computed({
  get: () => !!selected.value,
  set: (v) => { if (!v) selected.value = null },
})

async function load() {
  pending.value = true
  error.value = null
  try {
    // hp_llm_log 전용 엔드포인트가 아직 없으므로 /admin/cost 의 recent 배열 활용
    const url = new URL(`${API_BASE}/admin/cost`)
    url.searchParams.set('days', String(days.value))
    url.searchParams.set('limit', '100')
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = await res.json() as { recent: LogRow[] }
    let list = data.recent ?? []
    if (entityType.value) list = list.filter(r => r.entityType === entityType.value)
    if (errorOnly.value)  list = list.filter(r => !!r.error)
    rows.value = list
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    pending.value = false
  }
}
onMounted(load)
watch([days, entityType, errorOnly], load)

function fmtTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 16)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function fmtCost(v: number | null) { return v != null ? `$${v.toFixed(4)}` : '—' }
function totalTokens(r: LogRow) {
  const p = r.promptTokens ?? 0
  const c = r.completionTokens ?? 0
  if (!p && !c) return '—'
  return `${p + c}`
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="시스템"
      title="감사 로그"
      description="LLM 호출 이력 (hp_llm_log). 향후 계정 액션 감사 로그가 추가됩니다."
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <!-- 기간 -->
          <AdminSegment
            v-model="days"
            :options="[{ value: 7, label: '7일' }, { value: 30, label: '30일' }, { value: 90, label: '90일' }]"
          />
          <!-- 엔티티 필터 -->
          <select
            v-model="entityType"
            class="h-9 rounded-md bg-white px-2 text-[12px] ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option v-for="opt in ENTITY_OPTS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <!-- 에러만 -->
          <label class="flex items-center gap-1.5 text-[12px] text-slate-600">
            <input v-model="errorOnly" type="checkbox" class="size-3.5 rounded border-slate-300" />
            오류만
          </label>
        </div>
      </template>
    </AdminPageHeader>

    <!-- 전용 엔드포인트 안내 -->
    <div class="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-[12px] text-sky-800">
      <span class="font-semibold">참고</span>
      <span>현재 <code class="font-mono">/admin/cost</code> recent 배열을 사용합니다.
        전용 <code class="font-mono">GET /admin/logs</code> 엔드포인트 신설 시 페이지네이션·고급 필터가 활성화됩니다.</span>
    </div>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="rows"
      :pending="pending"
      :error="error"
      :shown="rows.length"
      empty-text="기록된 LLM 호출이 없습니다."
    >
      <template #default="{ row }: { row: LogRow }">
        <tr
          class="cursor-pointer hover:bg-slate-50"
          @click="selected = row"
        >
          <td class="px-5 py-2.5 font-mono text-[11px] text-slate-500">{{ fmtTime(row.requestAt) }}</td>
          <td class="px-3 py-2.5 font-mono text-[11px] text-slate-700">{{ row.route }}</td>
          <td class="px-3 py-2.5">
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
              {{ row.entityType }}
            </span>
          </td>
          <td class="px-3 py-2.5 font-mono text-[11px] text-slate-700">{{ row.model }}</td>
          <td class="px-3 py-2.5 text-right font-mono text-[11px] tabular-nums text-slate-600">
            {{ totalTokens(row) }}
          </td>
          <td class="px-3 py-2.5 text-right font-mono text-[11px] tabular-nums text-slate-500">
            {{ row.latencyMs ?? '—' }}ms
          </td>
          <td class="px-3 py-2.5 text-right font-mono text-[11px] tabular-nums text-slate-700">
            {{ fmtCost(row.costUsd) }}
          </td>
          <td class="px-3 py-2.5 text-center">
            <CheckCircle v-if="row.cacheHit" class="mx-auto size-3.5 text-emerald-500" />
            <span v-else class="text-[11px] text-slate-300">—</span>
          </td>
          <td class="px-5 py-2.5 text-center">
            <XCircle v-if="row.error" class="mx-auto size-3.5 text-rose-600" :title="row.error" />
            <span v-else class="text-[11px] text-slate-300">—</span>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="!pending && !error && !rows.length"
      title="기록된 LLM 호출이 없습니다"
      description="조건을 변경하거나 해당 기간에 API 호출이 없었는지 확인하세요."
      class="mt-4"
    >
      <template #icon><ClipboardList class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <!-- 행 상세 슬라이드오버 -->
    <AdminSlideOver v-model="detailOpen" title="호출 상세" size="md">
      <template v-if="selected">
        <dl class="space-y-4 text-[13px]">
          <div v-for="(item, i) in [
            { label: '시각',     value: fmtTime(selected.requestAt) },
            { label: '라우트',   value: selected.route },
            { label: '엔티티',   value: `${selected.entityType}${selected.entityId ? ' #' + selected.entityId : ''}` },
            { label: '모델',     value: selected.model },
            { label: '프롬프트 토큰', value: String(selected.promptTokens ?? '—') },
            { label: '완성 토큰', value: String(selected.completionTokens ?? '—') },
            { label: '지연',     value: selected.latencyMs != null ? selected.latencyMs + ' ms' : '—' },
            { label: '비용',     value: fmtCost(selected.costUsd) },
            { label: '캐시 히트', value: selected.cacheHit ? '✅ 예' : '아니오' },
          ]" :key="i" class="grid grid-cols-[140px_1fr] gap-2">
            <dt class="text-slate-400">{{ item.label }}</dt>
            <dd class="font-mono font-medium text-slate-800">{{ item.value }}</dd>
          </div>
          <div v-if="selected.error" class="rounded-lg bg-rose-50 p-3">
            <p class="text-[11px] font-semibold text-rose-700">오류</p>
            <p class="mt-1 font-mono text-[12px] text-rose-800">{{ selected.error }}</p>
          </div>
        </dl>
      </template>
    </AdminSlideOver>
  </div>
</template>
