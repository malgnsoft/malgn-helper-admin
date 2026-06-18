<!--
  pages/harvest.vue — PMS 문의 수집 미리보기 (scan → 검토 → commit).
  HARVEST 정본(PMS-INQUIRY-HARVEST.md §5) — 읽기 미리보기 스캔으로 후보를 끌어와
  서비스·토픽을 인라인 보정한 뒤, 선택분만 draft 후보로 commit 한다.

  API (developer↑, credentials: include):
    POST /pms/harvest/scan   body {from?,to?,groupId?,limit?,offset?,dryRun?}
      → { scanned, returned, candidates:[{ postId,title,groupName,serviceSlug,serviceId,
           harvestStatus:'ok'|'hold_service', type:'announce'|'qa', topicSlug, topicConfidence, hasAnswer }],
           llmCostUsd }   (미리보기만 — hp_* 미기록)
    POST /pms/harvest/commit  body { items:[{ postId, type:'qa'|'announce', serviceId?, topicId?, scope? }] }
      → { committed:[{postId,table,id}], skipped:[{postId,reason}] }
    GET  /topics · /services   분류 카탈로그 (serviceSlug→name·topicSlug→label 매핑 + 셀렉트 옵션)
-->
<script setup lang="ts">
import { DownloadCloud, AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '문의 수집 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

type Scope = 'common' | 'service'
type Track = 'qa' | 'announce'

type Candidate = {
  postId: number
  title: string
  groupName: string | null
  serviceSlug: string | null
  serviceId: number | null
  harvestStatus: 'ok' | 'hold_service'
  type: Track
  topicSlug: string | null
  topicConfidence: number | null
  hasAnswer: boolean
}

type ScanResponse = {
  scanned: number
  returned: number
  candidates: Candidate[]
  llmCostUsd: number | null
}

type CommitResponse = {
  committed: { postId: number; table: string; id: number }[]
  skipped: { postId: number; reason: string }[]
}

type Topic = { id: number; slug: string; scope: Scope; label: string; active: boolean }
type Service = { id: number; slug: string; name: string; active: boolean }

/* 행 상태 — 후보 + 인라인 보정값 + 선택/등록 상태 */
type HarvestRow = Candidate & {
  selected: boolean
  /** 인라인 보정한 serviceId('' = 미배정). scan 의 serviceId 로 초기화. */
  editServiceId: string
  /** 인라인 보정한 topicId('' = 미분류). topicSlug→id 해석값으로 초기화. */
  editTopicId: string
  /** commit 결과 */
  committed: boolean
  skippedReason: string | null
}

/* ── 권한 ── */
const meSession = useAuthUser()
const myLevel = computed(() => meSession.value?.level ?? 0)
const canHarvest = computed(() => myLevel.value >= 5) // scan/commit = developer↑

/* ── 카탈로그 ── */
const topics = ref<Topic[]>([])
const services = ref<Service[]>([])
async function loadCatalog() {
  try {
    const [tRes, sRes] = await Promise.all([
      fetch(`${API_BASE}/topics`, { credentials: 'include', cache: 'no-store' }),
      fetch(`${API_BASE}/services`, { credentials: 'include', cache: 'no-store' }),
    ])
    if (tRes.ok) topics.value = ((await tRes.json()) as { rows: Topic[] }).rows?.filter(t => t.active) ?? []
    if (sRes.ok) services.value = ((await sRes.json()) as { rows: Service[] }).rows?.filter(s => s.active) ?? []
  } catch { /* 카탈로그 실패는 셀렉트만 비게 됨 — 치명적 아님 */ }
}
const serviceBySlug = computed(() => new Map(services.value.map(s => [s.slug, s])))
const topicBySlug = computed(() => new Map(topics.value.map(t => [t.slug, t])))
const topicById = computed(() => new Map(topics.value.map(t => [t.id, t])))

/* serviceSlug → 표시 이름 (카탈로그에 없으면 slug 그대로) */
function serviceLabel(slug: string | null): string | null {
  if (!slug) return null
  return serviceBySlug.value.get(slug)?.name ?? slug
}
/* topicSlug → 표시 라벨 */
function topicLabel(slug: string | null): string | null {
  if (!slug) return null
  return topicBySlug.value.get(slug)?.label ?? slug
}

/* ── 스캔 폼 ── */
const form = reactive({
  from: '2022-01-01',
  to: '2026-12-31',
  groupId: '' as string,
  limit: '50' as string,
})

const inputCls =
  'h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'
const selectCls = inputCls

/* ── 스캔 결과 ── */
const rows = ref<HarvestRow[]>([])
const scanned = ref(0)
const returned = ref(0)
const llmCostUsd = ref<number | null>(null)
const hasScanned = ref(false)
const scanning = ref(false)
const scanError = ref<string | null>(null)

const TRACK_META: Record<Track, { label: string; cls: string }> = {
  qa: { label: 'Q&A', cls: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200' },
  announce: { label: '안내글', cls: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200' },
}

const COLUMNS: TableColumn[] = [
  { key: 'sel', label: '', align: 'center', class: 'px-5 pr-2 w-10' },
  { key: 'title', label: '제목' },
  { key: 'group', label: '그룹명', class: 'px-3 w-36' },
  { key: 'service', label: '서비스', class: 'px-3 w-44' },
  { key: 'track', label: '트랙', align: 'center', class: 'px-3 w-20' },
  { key: 'topic', label: '토픽', class: 'px-3 w-48' },
  { key: 'answer', label: '답변', align: 'center', class: 'px-3 w-16' },
  { key: 'source', label: '출처', align: 'right', class: 'px-5 pl-3 w-20' },
]

function buildRow(c: Candidate): HarvestRow {
  // scan 은 topicSlug 만 주므로 catalog 로 id 해석. 카탈로그 미로딩/미존재면 ''.
  const topic = c.topicSlug ? topicBySlug.value.get(c.topicSlug) : undefined
  return {
    ...c,
    selected: false,
    editServiceId: c.serviceId != null ? String(c.serviceId) : '',
    editTopicId: topic ? String(topic.id) : '',
    committed: false,
    skippedReason: null,
  }
}

async function runScan() {
  if (!canHarvest.value) { scanError.value = 'scan 은 developer 이상 권한이 필요합니다.'; return }
  scanning.value = true
  scanError.value = null
  try {
    const body: Record<string, unknown> = { dryRun: true }
    if (form.from.trim()) body.from = form.from.trim()
    if (form.to.trim()) body.to = form.to.trim()
    if (form.groupId.trim() && Number.isFinite(Number(form.groupId))) body.groupId = Number(form.groupId)
    const lim = Number(form.limit)
    if (Number.isFinite(lim) && lim > 0) body.limit = Math.min(lim, 200)

    const res = await fetch(`${API_BASE}/pms/harvest/scan`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 403) throw new Error('scan 은 developer 이상 권한이 필요합니다.')
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `API ${res.status}`)
    }
    const data = (await res.json()) as ScanResponse
    rows.value = (data.candidates ?? []).map(buildRow)
    scanned.value = data.scanned ?? 0
    returned.value = data.returned ?? rows.value.length
    llmCostUsd.value = data.llmCostUsd ?? null
    hasScanned.value = true
    commitResult.value = null
  } catch (e) {
    scanError.value = (e as Error).message
  } finally {
    scanning.value = false
  }
}

/* ── 선택 ── */
const selectableRows = computed(() => rows.value.filter(r => !r.committed))
const selectedRows = computed(() => selectableRows.value.filter(r => r.selected))
const allSelected = computed(() =>
  selectableRows.value.length > 0 && selectableRows.value.every(r => r.selected),
)
function toggleAll(checked: boolean) {
  for (const r of rows.value) if (!r.committed) r.selected = checked
}

/* ── commit ── */
const commitResult = ref<CommitResponse | null>(null)
const committing = ref(false)
const commitError = ref<string | null>(null)

async function runCommit() {
  if (!canHarvest.value) { commitError.value = 'commit 은 developer 이상 권한이 필요합니다.'; return }
  const picked = selectedRows.value
  if (!picked.length) { commitError.value = '등록할 후보를 1건 이상 선택하세요.'; return }
  committing.value = true
  commitError.value = null
  try {
    const items = picked.map((r) => {
      const item: Record<string, unknown> = { postId: r.postId, type: r.type }
      if (r.editServiceId) item.serviceId = Number(r.editServiceId)
      if (r.editTopicId) item.topicId = Number(r.editTopicId)
      // scope: 서비스 보정값이 있으면 'service', 없으면 'common'
      item.scope = r.editServiceId ? 'service' : 'common'
      return item
    })
    const res = await fetch(`${API_BASE}/pms/harvest/commit`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (res.status === 403) throw new Error('commit 은 developer 이상 권한이 필요합니다.')
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `API ${res.status}`)
    }
    const data = (await res.json()) as CommitResponse
    commitResult.value = data
    const committedSet = new Set((data.committed ?? []).map(c => c.postId))
    const skippedMap = new Map((data.skipped ?? []).map(s => [s.postId, s.reason]))
    for (const r of rows.value) {
      if (committedSet.has(r.postId)) {
        r.committed = true
        r.selected = false
        r.skippedReason = null
      } else if (skippedMap.has(r.postId)) {
        r.skippedReason = skippedMap.get(r.postId) ?? '건너뜀'
      }
    }
  } catch (e) {
    commitError.value = (e as Error).message
  } finally {
    committing.value = false
  }
}

/* ── 보정값 변경 시: 서비스를 비우면 토픽도 공통 토픽으로 한정(선택값 정합) ── */
function onServiceChange(r: HarvestRow) {
  if (!r.editServiceId && r.editTopicId) {
    const t = topicById.value.get(Number(r.editTopicId))
    if (t && t.scope === 'service') r.editTopicId = ''
  }
}

/* 행별 토픽 옵션 — 서비스 보정 여부로 scope 한정 */
function topicOptsFor(r: HarvestRow): Topic[] {
  return r.editServiceId
    ? topics.value.filter(t => t.scope === 'service')
    : topics.value.filter(t => t.scope === 'common')
}

onMounted(() => {
  if (!canHarvest.value) return
  loadCatalog()
})

/* ── 포맷 ── */
function fmtCost(v: number | null): string {
  if (v == null) return '—'
  return `$${v.toFixed(6)}`
}
function fmtConf(v: number | null): string | null {
  if (v == null) return null
  return `${(v * 100).toFixed(0)}%`
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="문의 수집"
      description="PMS(tb_post)에 누적된 문의·답변을 스캔해 표준답변(Q&A)·안내글 후보로 미리보기합니다. 서비스·토픽을 보정한 뒤 선택분만 draft 로 등록합니다. (스캔은 읽기 미리보기 — 자동 등록 안 함)"
    />

    <!-- 권한 안내 (developer 미만) -->
    <AdminEmptyState
      v-if="!canHarvest"
      title="문의 수집은 developer 이상 권한에서 사용할 수 있습니다"
      description="현재 계정은 PMS 문의 스캔·등록을 실행할 수 없습니다. 권한이 필요하면 관리자에게 문의하세요."
      class="mt-2"
    >
      <template #icon><DownloadCloud class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <template v-else>
      <!-- 스캔 폼 -->
      <section class="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
        <div class="flex flex-wrap items-end gap-x-3 gap-y-3">
          <div class="flex flex-col gap-1" style="min-width: 150px">
            <label class="text-[12px] font-medium text-slate-500">시작일 (from)</label>
            <input v-model="form.from" type="date" :class="inputCls" />
          </div>
          <div class="flex flex-col gap-1" style="min-width: 150px">
            <label class="text-[12px] font-medium text-slate-500">종료일 (to)</label>
            <input v-model="form.to" type="date" :class="inputCls" />
          </div>
          <div class="flex flex-col gap-1" style="min-width: 130px">
            <label class="text-[12px] font-medium text-slate-500">그룹 ID <span class="text-slate-400">(선택)</span></label>
            <input v-model="form.groupId" type="number" inputmode="numeric" placeholder="전체" :class="inputCls" />
          </div>
          <div class="flex flex-col gap-1" style="min-width: 110px">
            <label class="text-[12px] font-medium text-slate-500">limit <span class="text-slate-400">(최대 200)</span></label>
            <input v-model="form.limit" type="number" inputmode="numeric" min="1" max="200" :class="inputCls" />
          </div>
          <div class="ml-auto flex items-center gap-1.5 self-end pb-0.5">
            <button
              type="button"
              :disabled="scanning"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
              @click="runScan"
            >
              <DownloadCloud class="size-3.5" />{{ scanning ? '스캔 중…' : '스캔' }}
            </button>
          </div>
        </div>
        <p class="mt-2 text-[11px] text-slate-400">
          스캔은 미리보기(읽기 전용)입니다 — 제외 룰·서비스 자동 배정·트랙 분기·토픽 LLM 분류가 적용되며 hp_* 에 기록하지 않습니다.
        </p>
      </section>

      <!-- 스캔 에러 -->
      <div v-if="scanError" class="mb-4 rounded-md bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
        {{ scanError }}
      </div>

      <!-- 스캔 요약 -->
      <div
        v-if="hasScanned && !scanError"
        class="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[12px]"
      >
        <span class="text-slate-500">스캔 대상 <span class="font-mono font-semibold text-slate-800">{{ scanned.toLocaleString() }}</span>건</span>
        <span class="text-slate-500">반환 후보 <span class="font-mono font-semibold text-slate-800">{{ returned.toLocaleString() }}</span>건</span>
        <span class="text-slate-500">LLM 분류 비용 <span class="font-mono font-semibold text-slate-800">{{ fmtCost(llmCostUsd) }}</span></span>
        <span class="text-slate-500">선택 <span class="font-mono font-semibold text-primary-700">{{ selectedRows.length }}</span>건</span>
      </div>

      <!-- commit 결과 요약 -->
      <div
        v-if="commitResult"
        class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3"
      >
        <p class="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-800">
          <CheckCircle2 class="size-4" />
          등록 완료 — committed {{ commitResult.committed.length }}건 / skipped {{ commitResult.skipped.length }}건
        </p>
        <ul v-if="commitResult.skipped.length" class="mt-2 space-y-1">
          <li
            v-for="s in commitResult.skipped"
            :key="s.postId"
            class="flex items-center gap-2 text-[12px] text-amber-700"
          >
            <AlertTriangle class="size-3.5 shrink-0" />
            <span class="font-mono text-amber-600">#{{ s.postId }}</span>
            <span>{{ s.reason }}</span>
          </li>
        </ul>
      </div>

      <!-- commit 에러 -->
      <div v-if="commitError" class="mb-4 rounded-md bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
        {{ commitError }}
      </div>

      <!-- 후보 테이블 -->
      <AdminDataTable
        v-if="hasScanned && !scanError"
        :columns="COLUMNS"
        :rows="rows"
        :pending="scanning"
        :error="null"
        title="후보 "
        :total="returned"
        :shown="rows.length"
        empty-text="조건에 맞는 수집 후보가 없습니다."
      >
        <template #headerRight>
          <button
            type="button"
            :disabled="committing || !selectedRows.length"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            @click="runCommit"
          >
            <CheckCircle2 class="size-3.5" />{{ committing ? '등록 중…' : `선택 등록 (${selectedRows.length})` }}
          </button>
        </template>
        <template #default="{ row }: { row: HarvestRow }">
          <tr :class="row.committed ? 'bg-emerald-50/40' : 'hover:bg-slate-50'">
            <!-- 체크박스 -->
            <td class="px-5 pr-2 py-3 text-center align-top">
              <input
                v-if="!row.committed"
                v-model="row.selected"
                type="checkbox"
                class="size-4 rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-500"
                :aria-label="`후보 #${row.postId} 선택`"
              />
              <span
                v-else
                class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700"
                title="등록됨"
              >
                <CheckCircle2 class="size-3" />
              </span>
            </td>
            <!-- 제목 -->
            <td class="px-3 py-3 align-top">
              <p class="text-[13px] font-semibold text-slate-900">{{ row.title || '(제목 없음)' }}</p>
              <p
                v-if="row.committed"
                class="mt-0.5 text-[11px] font-medium text-emerald-700"
              >등록됨 (draft)</p>
              <p
                v-else-if="row.skippedReason"
                class="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700"
              ><AlertTriangle class="size-3" />{{ row.skippedReason }}</p>
            </td>
            <!-- 그룹명 -->
            <td class="px-3 py-3 align-top">
              <span v-if="row.groupName" class="text-[12px] text-slate-600">{{ row.groupName }}</span>
              <span v-else class="text-[11px] text-slate-300">—</span>
            </td>
            <!-- 서비스 (인라인 보정) -->
            <td class="px-3 py-3 align-top">
              <select
                v-model="row.editServiceId"
                :disabled="row.committed"
                class="h-8 w-full rounded-md bg-white px-2 text-[12px] text-slate-700 ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
                :class="(!row.editServiceId || row.harvestStatus === 'hold_service') ? 'ring-amber-300 bg-amber-50/40' : 'ring-slate-200'"
                :aria-label="`후보 #${row.postId} 서비스`"
                @change="onServiceChange(row)"
              >
                <option value="">미배정</option>
                <option v-for="s in services" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
              </select>
              <p
                v-if="row.harvestStatus === 'hold_service' && !row.editServiceId"
                class="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600"
              ><AlertTriangle class="size-3" />자동배정 보류 — 보정 필요</p>
              <p
                v-else-if="row.serviceSlug && serviceLabel(row.serviceSlug)"
                class="mt-0.5 text-[10px] text-slate-400"
              >자동: {{ serviceLabel(row.serviceSlug) }}</p>
            </td>
            <!-- 트랙 -->
            <td class="px-3 py-3 text-center align-top">
              <span
                class="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                :class="TRACK_META[row.type].cls"
              >{{ TRACK_META[row.type].label }}</span>
            </td>
            <!-- 토픽 (인라인 보정) -->
            <td class="px-3 py-3 align-top">
              <select
                v-model="row.editTopicId"
                :disabled="row.committed"
                class="h-8 w-full rounded-md bg-white px-2 text-[12px] text-slate-700 ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
                :class="!row.editTopicId ? 'ring-amber-300 bg-amber-50/40' : 'ring-slate-200'"
                :aria-label="`후보 #${row.postId} 토픽`"
              >
                <option value="">미분류</option>
                <option v-for="t in topicOptsFor(row)" :key="t.id" :value="String(t.id)">{{ t.label }}</option>
              </select>
              <p
                v-if="row.topicSlug"
                class="mt-0.5 text-[10px] text-slate-400"
              >
                자동: {{ topicLabel(row.topicSlug) }}
                <span v-if="fmtConf(row.topicConfidence)" class="font-mono">({{ fmtConf(row.topicConfidence) }})</span>
              </p>
              <p v-else class="mt-0.5 text-[10px] text-amber-600">자동 미분류 (저신뢰·해당없음)</p>
            </td>
            <!-- 답변유무 -->
            <td class="px-3 py-3 text-center align-top">
              <span
                v-if="row.hasAnswer"
                class="inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"
              >있음</span>
              <span
                v-else
                class="inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400"
              >없음</span>
            </td>
            <!-- 출처 -->
            <td class="px-5 pl-3 py-3 text-right align-top font-mono text-[11px] text-slate-400">
              #{{ row.postId }}
            </td>
          </tr>
        </template>
        <template #footer>
          <div class="flex items-center justify-between gap-3">
            <label class="flex items-center gap-2 text-[12px] text-slate-600">
              <input
                type="checkbox"
                :checked="allSelected"
                :disabled="!selectableRows.length"
                class="size-4 rounded border-slate-300 text-primary-600 focus:ring-2 focus:ring-primary-500 disabled:opacity-40"
                @change="toggleAll(($event.target as HTMLInputElement).checked)"
              />
              전체 선택 ({{ selectableRows.length }}건 중 {{ selectedRows.length }} 선택)
            </label>
            <button
              type="button"
              :disabled="committing || !selectedRows.length"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              @click="runCommit"
            >
              <CheckCircle2 class="size-3.5" />{{ committing ? '등록 중…' : `선택 등록 (${selectedRows.length})` }}
            </button>
          </div>
        </template>
      </AdminDataTable>

      <!-- 초기 빈 상태 (스캔 전) -->
      <AdminEmptyState
        v-else-if="!scanError"
        title="스캔으로 수집 후보를 미리보기하세요"
        description="기간·그룹 ID·limit 를 지정하고 [스캔]을 누르면 PMS 문의 후보가 표시됩니다. 서비스·토픽을 보정한 뒤 선택분만 draft 로 등록합니다."
        class="mt-2"
      >
        <template #icon><RotateCcw class="size-5 text-slate-400" /></template>
      </AdminEmptyState>
    </template>
  </div>
</template>
