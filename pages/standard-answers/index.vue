<!--
  pages/standard-answers/index.vue — 표준답변 큐레이션 목록 (003 연동).
  목록·검색·분류 필터/배지 + 행 클릭 시 상세·편집 전용 페이지(/standard-answers/:id)로 이동.
  상세·편집·승인 전이는 [id].vue 가 담당한다. 목록에서는 빠른 삭제만 제공.
  API:
    GET    /standard-answers?scope=&topicId=&serviceId=&approvalStatus=&search=  (developer↑)
    DELETE /standard-answers/:id            soft delete (admin)
    GET    /topics · /services             분류 카탈로그 (셀렉트 옵션)
-->
<script setup lang="ts">
import { Plus, Pencil, Trash2, Bookmark } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: 'Q&A 표준답변 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

/* 응답 행 — 서버가 raw SQL(sa.*) + JOIN 으로 snake_case 노출 */
type ApprovalStatus = 'draft' | 'reviewing' | 'approved' | 'rejected' | 'archived'
type Scope = 'common' | 'service'

type SARow = {
  id: number
  label: string
  question: string
  answer: string
  project_id: number | null
  usage_count: number
  created_at?: string
  updated_at: string
  scope: Scope | null
  topic_id: number | null
  service_id: number | null
  topic_slug: string | null
  topic_label: string | null
  service_slug: string | null
  service_name: string | null
  tags: string[]
  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
}

type Topic = { id: number; slug: string; scope: Scope; label: string; active: boolean }
type Service = { id: number; slug: string; name: string; active: boolean }

/* ── 권한 ── */
const meSession = useAuthUser()
const myLevel = computed(() => meSession.value?.level ?? 0)
const canWrite = computed(() => myLevel.value >= 9)        // DELETE = admin

/* ── 승인 상태 표시 ── */
const APPROVAL_META: Record<ApprovalStatus, { label: string; cls: string }> = {
  draft:     { label: '초안',   cls: 'bg-slate-100 text-slate-600' },
  reviewing: { label: '검토중', cls: 'bg-amber-100 text-amber-700' },
  approved:  { label: '승인',   cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { label: '반려',   cls: 'bg-rose-100 text-rose-700' },
  archived:  { label: '보관',   cls: 'bg-slate-200 text-slate-500' },
}
const SCOPE_CLS: Record<Scope, string> = {
  common: 'bg-violet-50 text-violet-700',
  service: 'bg-sky-50 text-sky-700',
}

const APPROVAL_FILTER_OPTS = [
  { value: '', label: '전체' },
  { value: 'draft', label: '초안' },
  { value: 'reviewing', label: '검토중' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '반려' },
  { value: 'archived', label: '보관' },
] as const

const COLUMNS: TableColumn[] = [
  { key: 'id',        label: '#',      class: 'px-5 pr-3 w-14' },
  { key: 'label',     label: '라벨' },
  { key: 'scope',     label: '분류',   align: 'center', class: 'px-3 w-16' },
  { key: 'topic',     label: '토픽',   class: 'px-3 w-32' },
  { key: 'service',   label: '서비스', class: 'px-3 w-32' },
  { key: 'status',    label: '상태',   align: 'center', class: 'px-3 w-20' },
  { key: 'usage',     label: '사용',   align: 'right' },
  { key: 'updatedAt', label: '수정일', align: 'right' },
  { key: 'actions',   label: '',       align: 'right', class: 'px-5 pl-3 w-20' },
]

const selectCls =
  'h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'

/* ── 카탈로그 (필터 옵션용) ── */
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
  } catch { /* 카탈로그 실패는 치명적이지 않음 — 셀렉트만 비게 됨 */ }
}

/* ── 필터(draft → 조회) ── */
const draft = reactive({ scope: '', topicId: '', serviceId: '', approvalStatus: '', q: '' })
const applied = reactive({ scope: '', topicId: '', serviceId: '', approvalStatus: '', q: '' })

/* scope 변경 시 topic 옵션을 해당 scope 로 제한(선택값이 안 맞으면 초기화) */
const topicOpts = computed(() => {
  // 공통: 공통 토픽만. 서비스: 공통 토픽도 함께(범용 주제) + 서비스 토픽.
  if (draft.scope === 'common') return topics.value.filter(t => t.scope === 'common')
  return topics.value
})
watch(() => draft.scope, () => {
  if (draft.scope === 'common') draft.serviceId = ''
  if (draft.topicId && !topicOpts.value.some(t => String(t.id) === draft.topicId)) draft.topicId = ''
})

/* ── 목록 ── */
const rows = ref<SARow[]>([])
const total = ref(0)
const pending = ref(true)
const error = ref<string | null>(null)

/* 서버 페이지네이션 (limit/offset). page = floor(offset/limit)+1 */
const LIMIT = 60
const offset = ref(0)
const page = computed(() => Math.floor(offset.value / LIMIT) + 1)

const badges = useAdminBadges()

async function load() {
  pending.value = true
  error.value = null
  try {
    const url = new URL(`${API_BASE}/standard-answers`)
    url.searchParams.set('limit', String(LIMIT))
    url.searchParams.set('offset', String(offset.value))
    if (applied.scope) url.searchParams.set('scope', applied.scope)
    if (applied.topicId) url.searchParams.set('topicId', applied.topicId)
    if (applied.serviceId) url.searchParams.set('serviceId', applied.serviceId)
    if (applied.approvalStatus) url.searchParams.set('approvalStatus', applied.approvalStatus)
    if (applied.q.trim()) url.searchParams.set('search', applied.q.trim())
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
    if (res.status === 403) throw new Error('admin/developer 권한이 필요합니다.')
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = (await res.json()) as { rows: SARow[]; total: number }
    rows.value = data.rows ?? []
    total.value = data.total ?? rows.value.length
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    pending.value = false
  }
}

/* 승인 대기(draft+reviewing) 카운트 → 사이드바 배지. 필터와 무관한 전수 집계. */
async function refreshPendingBadge() {
  try {
    let count = 0
    for (const st of ['draft', 'reviewing']) {
      const url = new URL(`${API_BASE}/standard-answers`)
      url.searchParams.set('limit', '1')
      url.searchParams.set('approvalStatus', st)
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) return
      const d = (await res.json()) as { total: number }
      count += d.total ?? 0
    }
    badges.value = {
      ...badges.value,
      'standard-answers': count > 0
        ? { value: count, color: 'warning' }
        : { value: 0, color: 'neutral' },
    }
  } catch { /* 배지 실패는 무시 */ }
}

onMounted(() => {
  loadCatalog()
  load()
  refreshPendingBadge()
})

function applyFilter() {
  applied.scope = draft.scope
  applied.topicId = draft.topicId
  applied.serviceId = draft.serviceId
  applied.approvalStatus = draft.approvalStatus
  applied.q = draft.q
  offset.value = 0 // 필터/검색 변경 시 첫 페이지로
  load()
}
function resetFilter() {
  draft.scope = draft.topicId = draft.serviceId = draft.approvalStatus = draft.q = ''
  Object.assign(applied, { scope: '', topicId: '', serviceId: '', approvalStatus: '', q: '' })
  offset.value = 0
  load()
}
function goPage(p: number) {
  offset.value = (p - 1) * LIMIT
  load()
}

/* ── 상세·편집은 전용 페이지로 이동 ── */
function openDetail(row: SARow) {
  navigateTo(`/standard-answers/${row.id}`)
}

/* ── 삭제 (목록에서 빠른 삭제) ── */
const delTarget = ref<SARow | null>(null)
const delOpen = ref(false)
const deleting = ref(false)
function openDelete(row: SARow) { if (!canWrite.value) return; delTarget.value = row; delOpen.value = true }
async function confirmDelete() {
  if (!delTarget.value) return
  deleting.value = true
  try {
    const res = await fetch(`${API_BASE}/standard-answers/${delTarget.value.id}`, {
      method: 'DELETE', credentials: 'include',
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    delOpen.value = false
    delTarget.value = null
    await load()
    await refreshPendingBadge()
  } catch { /* silent */ } finally {
    deleting.value = false
  }
}

/* ── 포맷 ── */
function fmtDate(iso?: string | null) { return iso ? iso.slice(0, 10) : '—' }
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="Q&A 표준답변"
      description="고객 문의(Q&A) 기반의 검증된 답변. 직원 안내글은 별도 [안내글] 메뉴에서 관리합니다. 분류·승인 워크플로로 검증된 답변만 챗봇에 노출됩니다."
    >
      <template #actions>
        <NuxtLink
          v-if="canWrite"
          to="/standard-answers/new"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-primary-700"
        >
          <Plus class="size-4" />새 표준답변
        </NuxtLink>
        <span
          v-else
          title="추가는 admin 권한 필요"
          class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-400"
        >
          <Plus class="size-4" />새 표준답변
        </span>
      </template>
    </AdminPageHeader>

    <!-- 필터 -->
    <AdminFilterBar @search="applyFilter" @reset="resetFilter">
      <AdminFilterField label="분류">
        <select v-model="draft.scope" :class="selectCls">
          <option value="">전체</option>
          <option value="common">공통</option>
          <option value="service">서비스</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="토픽">
        <select v-model="draft.topicId" :class="selectCls">
          <option value="">전체</option>
          <option v-for="t in topicOpts" :key="t.id" :value="String(t.id)">{{ t.label }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="서비스">
        <select v-model="draft.serviceId" :class="selectCls" :disabled="draft.scope === 'common'">
          <option value="">전체</option>
          <option v-for="s in services" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="승인상태">
        <select v-model="draft.approvalStatus" :class="selectCls">
          <option v-for="o in APPROVAL_FILTER_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="검색어" grow>
        <AdminSearchInput
          v-model="draft.q"
          placeholder="라벨·질문·답변 검색 후 Enter"
          @keyup.enter="applyFilter"
        />
      </AdminFilterField>
    </AdminFilterBar>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="rows"
      :pending="pending"
      :error="error"
      title="전체 "
      :total="total"
      :shown="rows.length"
      empty-text="조건에 맞는 표준답변이 없습니다."
    >
      <template #footer>
        <AdminPagination :page="page" :page-size="LIMIT" :total="total" @update:page="goPage" />
      </template>
      <template #default="{ row }: { row: SARow }">
        <tr class="cursor-pointer hover:bg-slate-50" @click="openDetail(row)">
          <td class="px-5 pr-3 py-3 font-mono text-[11px] text-slate-400">#{{ row.id }}</td>
          <td class="px-3 py-3">
            <p class="text-[13px] font-semibold text-slate-900">{{ row.label }}</p>
            <div class="qa-preview mt-0.5 max-w-xl text-[11.5px] leading-relaxed text-slate-500" v-html="row.question" />
          </td>
          <td class="px-3 py-3 text-center">
            <span
              v-if="row.scope"
              class="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              :class="SCOPE_CLS[row.scope]"
            >{{ row.scope === 'common' ? '공통' : '서비스' }}</span>
            <span v-else class="text-[11px] text-slate-300">—</span>
          </td>
          <td class="px-3 py-3">
            <span v-if="row.topic_label" class="text-[12px] text-slate-700">{{ row.topic_label }}</span>
            <span v-else class="text-[11px] text-slate-300">—</span>
          </td>
          <td class="px-3 py-3">
            <span v-if="row.service_name" class="text-[12px] text-slate-700">{{ row.service_name }}</span>
            <span v-else class="text-[11px] text-slate-300">—</span>
          </td>
          <td class="px-3 py-3 text-center">
            <span
              class="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="APPROVAL_META[row.approval_status].cls"
            >{{ APPROVAL_META[row.approval_status].label }}</span>
          </td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-500">
            {{ row.usage_count ?? 0 }}
          </td>
          <td class="px-3 py-3 text-right font-mono text-[11px] text-slate-400">
            {{ fmtDate(row.updated_at) }}
          </td>
          <td class="px-5 pl-3 py-3 text-right" @click.stop>
            <div class="flex items-center justify-end gap-1">
              <NuxtLink
                :to="`/standard-answers/${row.id}`"
                class="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="상세·편집"
              >
                <Pencil class="size-3.5" />
              </NuxtLink>
              <button
                type="button"
                :disabled="!canWrite"
                class="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                :title="canWrite ? '삭제' : 'admin 권한 필요'"
                @click="openDelete(row)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="!pending && !error && !rows.length"
      title="조건에 맞는 표준답변이 없습니다"
      description="PMS Q&A 분석에서 '표준답변으로 저장'하거나 [+ 새 표준답변]으로 직접 추가하세요."
      class="mt-4"
    >
      <template #icon><Bookmark class="size-5 text-slate-400" /></template>
      <template v-if="canWrite" #actions>
        <NuxtLink
          to="/standard-answers/new"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
        >
          <Plus class="size-4" />새 표준답변 추가
        </NuxtLink>
      </template>
    </AdminEmptyState>

    <!-- 삭제 확인 -->
    <AdminModal v-model="delOpen" title="표준답변 삭제" size="sm">
      <p class="text-[13px] text-slate-700">
        <span class="font-semibold">{{ delTarget?.label }}</span> 을(를) 삭제하시겠습니까?<br />
        삭제 후 복구할 수 없습니다.
      </p>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="delOpen = false"
          >
            취소
          </button>
          <button
            type="button"
            :disabled="deleting"
            class="rounded-md bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            @click="confirmDelete"
          >
            {{ deleting ? '삭제 중…' : '삭제' }}
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>

<style scoped>
/* 목록 질문 미리보기 — 태그를 제거하지 않고 서식(줄바꿈)을 렌더. 높이만 제한, 이미지는 숨김. */
.qa-preview {
  max-height: 4em;
  overflow: hidden;
}
.qa-preview :deep(p) { margin: 0; }
.qa-preview :deep(ul),
.qa-preview :deep(ol) { margin: 0; padding-left: 1.1em; }
.qa-preview :deep(img) { display: none; }
.qa-preview :deep(*) { font-size: inherit !important; font-weight: inherit; color: inherit; }
</style>
