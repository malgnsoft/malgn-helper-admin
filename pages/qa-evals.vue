<!--
  pages/qa-evals.vue — Q&A 평가 목록.
  API: GET /admin/evals
  상세 모달: AdminModal + PMS iframe embed (/posts/:postId/eval).
-->
<script setup lang="ts">
import { Star } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: 'Q&A 평가 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'
const PMS_BASE = 'https://malgn-helper-pms.pages.dev'

type EvalRow = {
  id: number
  postId: number
  projectId: number
  generatedAt: string
  generator: string
  llmModel: string | null
  overallScore: number | null
  overallVerdict: string | null
  latencyMs: number | null
  postSubject: string | null
  projectName: string | null
  groupName: string | null
}

const SORT_OPTS = [
  { value: 'recent', label: '최신' },
  { value: 'score_asc', label: '점수↑(취약)' },
  { value: 'score_desc', label: '점수↓(모범)' },
  { value: 'latency', label: '지연↑' },
] as const

const COLUMNS: TableColumn[] = [
  { key: 'id', label: 'ID' },
  { key: 'post', label: '게시글' },
  { key: 'project', label: '프로젝트' },
  { key: 'score', label: '점수', align: 'right' },
  { key: 'verdict', label: '한 줄 평' },
  { key: 'generatedAt', label: '생성', align: 'right' },
  { key: 'latency', label: '지연', align: 'right' },
]

// 필터: draft 입력 → '조회'/Enter 시 적용. 정렬·빈결과는 서버 재조회, 검색어는 클라이언트 필터.
const draftSort = ref<string>('recent')
const draftIncludeEmpty = ref(false)
const draftQ = ref('')
const sort = ref<string>('recent')
const includeEmpty = ref(false)
const appliedQ = ref('')
const rows = ref<EvalRow[]>([])
const total = ref(0)
const pending = ref(true)
const error = ref<string | null>(null)

/* 서버 페이지네이션 (limit/offset). page = floor(offset/limit)+1 */
const LIMIT = 50
const offset = ref(0)
const page = computed(() => Math.floor(offset.value / LIMIT) + 1)

const selectedPostId = ref<number | null>(null)
const modalOpen = computed({
  get: () => selectedPostId.value !== null,
  set: (v) => { if (!v) selectedPostId.value = null },
})

async function load() {
  pending.value = true
  error.value = null
  try {
    const url = new URL(`${API_BASE}/admin/evals`)
    url.searchParams.set('limit', String(LIMIT))
    url.searchParams.set('offset', String(offset.value))
    url.searchParams.set('sort', sort.value)
    if (includeEmpty.value) url.searchParams.set('includeEmpty', '1')
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = (await res.json()) as { rows: EvalRow[]; total: number }
    rows.value = data.rows
    total.value = data.total
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    pending.value = false
  }
}
onMounted(load)

function applyFilter() {
  sort.value = draftSort.value
  includeEmpty.value = draftIncludeEmpty.value
  appliedQ.value = draftQ.value
  offset.value = 0 // 필터/정렬 변경 시 첫 페이지로
  load()
}
function resetFilter() {
  draftSort.value = 'recent'
  draftIncludeEmpty.value = false
  draftQ.value = ''
  sort.value = 'recent'
  includeEmpty.value = false
  appliedQ.value = ''
  offset.value = 0
  load()
}
function goPage(p: number) {
  offset.value = (p - 1) * LIMIT
  load()
}
const filteredRows = computed(() => {
  const q = appliedQ.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(
    (r) =>
      (r.postSubject ?? '').toLowerCase().includes(q) ||
      (r.projectName ?? '').toLowerCase().includes(q) ||
      (r.overallVerdict ?? '').toLowerCase().includes(q) ||
      String(r.postId).includes(q),
  )
})

const selectCls =
  'h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'

function fmtTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function scoreClass(s: number | null) {
  if (s == null) return 'text-slate-400'
  if (s >= 4) return 'text-emerald-600'
  if (s >= 3) return 'text-amber-600'
  return 'text-rose-600'
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="운영 보드"
      title="Q&A 평가"
      description="상담사 응대를 5축으로 평가한 결과 — 행 클릭 시 PMS 평가 카드 열림"
    />

    <!-- 필터 바 -->
    <AdminFilterBar @search="applyFilter" @reset="resetFilter">
      <AdminFilterField label="정렬">
        <select v-model="draftSort" :class="selectCls">
          <option v-for="o in SORT_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="빈 결과">
        <select v-model="draftIncludeEmpty" :class="selectCls">
          <option :value="false">제외</option>
          <option :value="true">포함</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="검색어" grow>
        <AdminSearchInput
          v-model="draftQ"
          placeholder="게시글 제목 · 프로젝트 · 한 줄 평 검색 후 Enter"
          @keyup.enter="applyFilter"
        />
      </AdminFilterField>
    </AdminFilterBar>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="filteredRows"
      :pending="pending"
      :error="error"
      title="전체 "
      :total="total"
      :shown="filteredRows.length"
      empty-text="조건에 맞는 평가 결과 없음"
    >
      <template #footer>
        <AdminPagination :page="page" :page-size="LIMIT" :total="total" @update:page="goPage" />
      </template>
      <template #default="{ row }: { row: EvalRow }">
        <tr
          class="cursor-pointer hover:bg-slate-50"
          @click="selectedPostId = row.postId"
        >
          <td class="px-5 py-3 font-mono text-[11px] text-slate-500">#{{ row.id }}</td>
          <td class="px-3 py-3">
            <p class="truncate text-[12.5px] font-medium text-slate-800">
              {{ row.postSubject || '(제목 없음)' }}
            </p>
            <p class="mt-0.5 font-mono text-[10.5px] text-slate-400">
              post #{{ row.postId }}
            </p>
          </td>
          <td class="px-3 py-3">
            <p class="text-[12px] text-slate-700">{{ row.projectName || '—' }}</p>
            <p v-if="row.groupName" class="mt-0.5 text-[10.5px] text-slate-400">
              {{ row.groupName }}
            </p>
          </td>
          <td class="px-3 py-3 text-right">
            <span
              class="inline-flex items-center gap-1 font-mono font-semibold tabular-nums"
              :class="scoreClass(row.overallScore)"
            >
              <Star v-if="row.overallScore != null" class="size-3.5 fill-current" />
              {{ row.overallScore != null ? row.overallScore.toFixed(1) : '—' }}
            </span>
          </td>
          <td class="px-3 py-3">
            <p class="line-clamp-1 max-w-md text-[12px] text-slate-600">
              {{ row.overallVerdict || '—' }}
            </p>
          </td>
          <td class="px-3 py-3 text-right font-mono text-[11px] tabular-nums text-slate-500">
            {{ fmtTime(row.generatedAt) }}
          </td>
          <td class="px-5 py-3 text-right font-mono text-[11px] tabular-nums text-slate-500">
            {{ row.latencyMs ?? '—' }}ms
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- PMS 평가 카드 iframe 모달 -->
    <AdminModal
      v-model="modalOpen"
      size="xl"
      height="h-[92vh]"
      no-pad
    >
      <iframe
        v-if="selectedPostId != null"
        :src="`${PMS_BASE}/posts/${selectedPostId}/eval`"
        class="size-full border-0"
        allow="clipboard-write"
      />
    </AdminModal>
  </div>
</template>
