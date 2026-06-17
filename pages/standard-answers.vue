<!--
  pages/standard-answers.vue — 표준답변 큐레이션 (003 연동).
  목록·검색·분류 필터/배지 + 상세 슬라이드오버(분류 셀렉터·승인 전이·중복 경고).
  API:
    GET    /standard-answers?scope=&topicId=&serviceId=&approvalStatus=&search=  (developer↑, JOIN: topic_slug/label·service_slug/name·tags[]·approval_status·scope)
    GET    /standard-answers/:id                                                 (developer↑)
    POST   /standard-answers   body {label,question,answer,scope?,topicId?,serviceId?,tags?}  응답 similar[]
    PATCH  /standard-answers/:id            본문 수정 (admin)
    PATCH  /standard-answers/:id/transition body {to, reason?}  전이 (developer↑)
    DELETE /standard-answers/:id            soft delete (admin)
    GET    /topics · /services             분류 카탈로그 (셀렉트 옵션)
-->
<script setup lang="ts">
import { Plus, Pencil, Trash2, Bookmark, AlertTriangle, CheckCircle2 } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '표준답변 · 맑은도우미 Admin' })

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

type Similar = {
  id: number
  label: string
  question: string
  scope: Scope
  topicId: number | null
  serviceId: number | null
  approvalStatus: ApprovalStatus
  usageCount: number
  score: number
}

type Topic = { id: number; slug: string; scope: Scope; label: string; active: boolean }
type Service = { id: number; slug: string; name: string; active: boolean }

/* ── 권한 ── */
const meSession = useAuthUser()
const myLevel = computed(() => meSession.value?.level ?? 0)
const canWrite = computed(() => myLevel.value >= 9)        // POST/PATCH 본문/DELETE = admin
const canTransition = computed(() => myLevel.value >= 5)   // 전이 = developer↑

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

/* §3-3 전이표 — from → 허용 to (서버 SA_TRANSITIONS 와 동일) */
const TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  draft:     ['reviewing', 'rejected'],
  reviewing: ['approved', 'rejected'],
  approved:  ['archived'],
  rejected:  ['draft'],
  archived:  ['reviewing'],
}
const TRANSITION_META: Record<ApprovalStatus, { label: string; cls: string }> = {
  reviewing: { label: '검토 착수', cls: 'bg-amber-600 hover:bg-amber-700 text-white' },
  approved:  { label: '승인',      cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  rejected:  { label: '반려',      cls: 'bg-rose-600 hover:bg-rose-700 text-white' },
  archived:  { label: '보관',      cls: 'bg-slate-600 hover:bg-slate-700 text-white' },
  draft:     { label: '재작업',    cls: 'bg-slate-600 hover:bg-slate-700 text-white' },
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
  { key: 'class',     label: '분류',   class: 'px-3 w-44' },
  { key: 'status',    label: '상태',   align: 'center', class: 'px-3 w-20' },
  { key: 'usage',     label: '사용',   align: 'right' },
  { key: 'updatedAt', label: '수정일', align: 'right' },
  { key: 'actions',   label: '',       align: 'right', class: 'px-5 pl-3 w-20' },
]

const selectCls =
  'h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'

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
  } catch { /* 카탈로그 실패는 치명적이지 않음 — 셀렉트만 비게 됨 */ }
}
function topicLabel(id: number | null) {
  if (id == null) return null
  return topics.value.find(t => t.id === id)?.label ?? null
}

/* ── 필터(draft → 조회) ── */
const draft = reactive({ scope: '', topicId: '', serviceId: '', approvalStatus: '', q: '' })
const applied = reactive({ scope: '', topicId: '', serviceId: '', approvalStatus: '', q: '' })

/* scope 변경 시 topic 옵션을 해당 scope 로 제한(선택값이 안 맞으면 초기화) */
const topicOpts = computed(() => {
  if (draft.scope === 'common') return topics.value.filter(t => t.scope === 'common')
  if (draft.scope === 'service') return topics.value.filter(t => t.scope === 'service')
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

const badges = useAdminBadges()

async function load() {
  pending.value = true
  error.value = null
  try {
    const url = new URL(`${API_BASE}/standard-answers`)
    url.searchParams.set('limit', '60')
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
  load()
}
function resetFilter() {
  draft.scope = draft.topicId = draft.serviceId = draft.approvalStatus = draft.q = ''
  Object.assign(applied, { scope: '', topicId: '', serviceId: '', approvalStatus: '', q: '' })
  load()
}

/* ── 상세·편집 슬라이드오버 ── */
const panelOpen = ref(false)
const editing = ref<SARow | null>(null)   // null = 신규
const saving = ref(false)
const saveErr = ref<string | null>(null)
const similar = ref<Similar[]>([])         // 저장 응답 중복 후보

const form = reactive({
  label: '', question: '', answer: '',
  scope: '' as '' | Scope,
  topicId: '' as string,
  serviceId: '' as string,
  tagsText: '',
})

const formTopicOpts = computed(() => {
  if (form.scope === 'common') return topics.value.filter(t => t.scope === 'common')
  if (form.scope === 'service') return topics.value.filter(t => t.scope === 'service')
  return topics.value
})
watch(() => form.scope, () => {
  if (form.scope === 'common') form.serviceId = ''
  if (form.topicId && !formTopicOpts.value.some(t => String(t.id) === form.topicId)) form.topicId = ''
})

function fillForm(row: SARow | null) {
  similar.value = []
  saveErr.value = null
  if (!row) {
    form.label = form.question = form.answer = ''
    form.scope = ''
    form.topicId = form.serviceId = ''
    form.tagsText = ''
    return
  }
  form.label = row.label
  form.question = row.question
  form.answer = row.answer
  form.scope = row.scope ?? ''
  form.topicId = row.topic_id != null ? String(row.topic_id) : ''
  form.serviceId = row.service_id != null ? String(row.service_id) : ''
  form.tagsText = (row.tags ?? []).join(', ')
}

function openCreate() {
  if (!canWrite.value) return
  editing.value = null
  fillForm(null)
  panelOpen.value = true
}
function openEdit(row: SARow) {
  editing.value = row
  fillForm(row)
  panelOpen.value = true
}

function parseTags(): string[] {
  return form.tagsText.split(',').map(s => s.trim()).filter(Boolean)
}

async function save() {
  if (!canWrite.value) { saveErr.value = '저장은 admin 권한이 필요합니다.'; return }
  if (!form.label.trim() || !form.question.trim() || !form.answer.trim()) {
    saveErr.value = '라벨 · 질문 · 답변은 필수입니다.'
    return
  }
  saving.value = true
  saveErr.value = null
  try {
    if (editing.value) {
      // 본문만 PATCH (분류/전이는 별도 엔드포인트 — 본 PATCH는 label/question/answer만 수용)
      const res = await fetch(`${API_BASE}/standard-answers/${editing.value.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label.trim(),
          question: form.question.trim(),
          answer: form.answer.trim(),
        }),
      })
      if (res.status === 403) throw new Error('수정은 admin 권한이 필요합니다.')
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `API ${res.status}`)
      }
    } else {
      const body: Record<string, unknown> = {
        label: form.label.trim(),
        question: form.question.trim(),
        answer: form.answer.trim(),
        tags: parseTags(),
      }
      if (form.scope) body.scope = form.scope
      if (form.topicId) body.topicId = Number(form.topicId)
      if (form.serviceId) body.serviceId = Number(form.serviceId)
      const res = await fetch(`${API_BASE}/standard-answers`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `API ${res.status}`)
      }
      const data = (await res.json()) as { id: number; similar?: Similar[] }
      // 중복 후보가 있으면 패널을 닫지 않고 경고 — 운영자 확인
      if (data.similar && data.similar.length) {
        similar.value = data.similar
        await load()
        await refreshPendingBadge()
        saving.value = false
        return
      }
    }
    panelOpen.value = false
    await load()
    await refreshPendingBadge()
  } catch (e) {
    saveErr.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

/* ── 승인 전이 ── */
const transitioning = ref(false)
const transErr = ref<string | null>(null)
const rejectReason = ref('')
const allowedTransitions = computed<ApprovalStatus[]>(() =>
  editing.value ? TRANSITIONS[editing.value.approval_status] ?? [] : [],
)

async function doTransition(to: ApprovalStatus) {
  if (!editing.value || !canTransition.value) {
    transErr.value = '승인/반려/보관은 developer 이상 권한이 필요합니다.'
    return
  }
  if (to === 'rejected' && !rejectReason.value.trim()) {
    transErr.value = '반려 사유는 필수입니다.'
    return
  }
  transitioning.value = true
  transErr.value = null
  try {
    const body: Record<string, unknown> = { to }
    if (to === 'rejected') body.reason = rejectReason.value.trim()
    const res = await fetch(`${API_BASE}/standard-answers/${editing.value.id}/transition`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 403) throw new Error('권한이 부족합니다 (developer 이상 필요).')
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `API ${res.status}`)
    }
    rejectReason.value = ''
    // 슬라이드오버 내 현재 행 상태 즉시 갱신
    const fresh = await fetch(`${API_BASE}/standard-answers/${editing.value.id}`, { credentials: 'include', cache: 'no-store' })
    if (fresh.ok) {
      const r = (await fresh.json()) as SARow
      editing.value = r
    }
    await load()
    await refreshPendingBadge()
  } catch (e) {
    transErr.value = (e as Error).message
  } finally {
    transitioning.value = false
  }
}

/* ── 삭제 ── */
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
    if (panelOpen.value && editing.value?.id === delTarget.value?.id) panelOpen.value = false
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
      title="표준답변"
      description="챗봇 응답 1순위 소스. 분류·승인 워크플로로 검증된 답변만 챗봇에 노출됩니다."
    >
      <template #actions>
        <button
          type="button"
          :disabled="!canWrite"
          :title="canWrite ? '새 표준답변' : '추가는 admin 권한 필요'"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold transition"
          :class="canWrite
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'"
          @click="openCreate"
        >
          <Plus class="size-4" />새 표준답변
        </button>
      </template>
    </AdminPageHeader>

    <!-- 필터 -->
    <AdminFilterBar @search="applyFilter" @reset="resetFilter">
      <AdminFilterField label="scope">
        <select v-model="draft.scope" :class="selectCls">
          <option value="">전체</option>
          <option value="common">common</option>
          <option value="service">service</option>
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
      <template #default="{ row }: { row: SARow }">
        <tr class="cursor-pointer hover:bg-slate-50" @click="openEdit(row)">
          <td class="px-5 pr-3 py-3 font-mono text-[11px] text-slate-400">#{{ row.id }}</td>
          <td class="px-3 py-3">
            <p class="text-[13px] font-semibold text-slate-900">{{ row.label }}</p>
            <p class="mt-0.5 line-clamp-1 max-w-md text-[11.5px] text-slate-500">{{ row.question }}</p>
          </td>
          <td class="px-3 py-3">
            <div class="flex flex-wrap items-center gap-1">
              <span
                v-if="row.scope"
                class="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                :class="SCOPE_CLS[row.scope]"
              >{{ row.scope }}</span>
              <span
                v-if="row.topic_label"
                class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
              >{{ row.topic_label }}</span>
              <span
                v-if="row.service_name"
                class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
              >{{ row.service_name }}</span>
              <span v-if="!row.scope && !row.topic_label && !row.service_name" class="text-[11px] text-slate-300">미분류</span>
            </div>
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
              <button
                type="button"
                class="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="상세·편집"
                @click="openEdit(row)"
              >
                <Pencil class="size-3.5" />
              </button>
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
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
          @click="openCreate"
        >
          <Plus class="size-4" />새 표준답변 추가
        </button>
      </template>
    </AdminEmptyState>

    <!-- 상세·편집 슬라이드오버 -->
    <AdminSlideOver
      v-model="panelOpen"
      :title="editing ? '표준답변 상세·편집' : '새 표준답변'"
      size="xl"
    >
      <div class="space-y-5">
        <!-- 현재 상태 (편집 시) -->
        <div v-if="editing" class="flex flex-wrap items-center gap-2">
          <span class="text-[12px] text-slate-500">현재 상태</span>
          <span
            class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            :class="APPROVAL_META[editing.approval_status].cls"
          >{{ APPROVAL_META[editing.approval_status].label }}</span>
          <span v-if="editing.approved_by" class="text-[11px] text-slate-400">
            by {{ editing.approved_by }}<template v-if="editing.approved_at"> · {{ fmtDate(editing.approved_at) }}</template>
          </span>
        </div>
        <div
          v-if="editing && editing.approval_status === 'rejected' && editing.rejection_reason"
          class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700"
        >
          반려 사유: {{ editing.rejection_reason }}
        </div>

        <!-- 중복 경고 패널 (저장 응답 similar[]) -->
        <div
          v-if="similar.length"
          class="rounded-lg border border-amber-300 bg-amber-50 p-3"
        >
          <p class="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-amber-800">
            <AlertTriangle class="size-4" />유사 표준답변 {{ similar.length }}건 — 중복 여부를 확인하세요
          </p>
          <ul class="space-y-1.5">
            <li
              v-for="s in similar"
              :key="s.id"
              class="flex items-center gap-2 rounded bg-white/70 px-2 py-1.5"
            >
              <span class="font-mono text-[10px] text-amber-700">{{ (s.score * 100).toFixed(0) }}%</span>
              <span class="flex-1 truncate text-[12px] text-slate-700">
                <span class="font-medium">{{ s.label }}</span>
                <span class="ml-1 text-slate-400">{{ s.question }}</span>
              </span>
              <span
                class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                :class="APPROVAL_META[s.approvalStatus].cls"
              >{{ APPROVAL_META[s.approvalStatus].label }}</span>
            </li>
          </ul>
          <p class="mt-2 text-[11px] text-amber-700">
            저장은 완료되었습니다(초안). 중복이면 위 항목을 편집하거나 본 항목을 검토 후 정리하세요.
          </p>
        </div>

        <!-- 라벨 -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">라벨 <span class="text-amber-600">*</span></label>
          <input
            v-model="form.label"
            type="text"
            placeholder="e.g. STEP 로그인 방법"
            :disabled="!canWrite"
            class="h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          />
        </div>

        <!-- 질문 -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">질문 <span class="text-amber-600">*</span></label>
          <textarea
            v-model="form.question"
            rows="2"
            placeholder="대표 질문 문장"
            :disabled="!canWrite"
            class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          />
        </div>

        <!-- 답변 -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">답변 <span class="text-amber-600">*</span></label>
          <textarea
            v-model="form.answer"
            rows="5"
            placeholder="표준 답변 내용 (마크다운 사용 가능)"
            :disabled="!canWrite"
            class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          />
        </div>

        <!-- 분류 셀렉터 -->
        <div class="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">분류</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1.5 block text-[12px] font-medium text-slate-700">scope</label>
              <select v-model="form.scope" :disabled="!canWrite || !!editing" :class="selectCls">
                <option value="">미지정</option>
                <option value="common">common</option>
                <option value="service">service</option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-[12px] font-medium text-slate-700">서비스</label>
              <select v-model="form.serviceId" :disabled="!canWrite || !!editing || form.scope === 'common'" :class="selectCls">
                <option value="">미지정</option>
                <option v-for="s in services" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="mb-1.5 block text-[12px] font-medium text-slate-700">토픽</label>
              <select v-model="form.topicId" :disabled="!canWrite || !!editing" :class="selectCls">
                <option value="">미지정</option>
                <option v-for="t in formTopicOpts" :key="t.id" :value="String(t.id)">{{ t.label }} ({{ t.scope }})</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="mb-1.5 block text-[12px] font-medium text-slate-700">태그 (쉼표 구분)</label>
              <input
                v-model="form.tagsText"
                type="text"
                placeholder="e.g. 환불, 자동결제"
                :disabled="!canWrite || !!editing"
                :class="selectCls"
              />
            </div>
          </div>
          <p v-if="editing" class="mt-2 text-[11px] text-slate-400">
            분류·태그는 신규 저장 시에만 지정합니다. 기존 항목의 분류 변경은 카탈로그 정책상 별도 처리됩니다.
          </p>
          <!-- 편집 시 현 분류/태그 표시 -->
          <div v-if="editing" class="mt-2 flex flex-wrap items-center gap-1">
            <span v-for="(tag, i) in editing.tags" :key="i" class="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200">#{{ tag }}</span>
            <span v-if="!editing.tags.length" class="text-[11px] text-slate-300">태그 없음</span>
          </div>
        </div>

        <!-- 승인 전이 (편집 시) -->
        <div v-if="editing" class="rounded-lg border border-slate-200 p-3">
          <p class="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <CheckCircle2 class="size-3.5" />승인 워크플로
          </p>
          <div v-if="allowedTransitions.length" class="flex flex-wrap gap-2">
            <button
              v-for="to in allowedTransitions"
              :key="to"
              type="button"
              :disabled="!canTransition || transitioning"
              class="rounded-md px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              :class="TRANSITION_META[to].cls"
              :title="canTransition ? '' : 'developer 이상 권한 필요'"
              @click="doTransition(to)"
            >
              {{ TRANSITION_META[to].label }}
            </button>
          </div>
          <p v-else class="text-[12px] text-slate-400">현재 상태에서 가능한 전이가 없습니다.</p>

          <!-- 반려 사유 (reviewing/draft → rejected 가능 시) -->
          <div v-if="allowedTransitions.includes('rejected')" class="mt-3">
            <label class="mb-1.5 block text-[12px] font-medium text-slate-700">반려 사유 <span class="text-slate-400">(반려 시 필수)</span></label>
            <textarea
              v-model="rejectReason"
              rows="2"
              placeholder="반려 사유를 입력하세요"
              :disabled="!canTransition"
              class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
            />
          </div>

          <p v-if="!canTransition" class="mt-2 text-[11px] text-amber-600">
            승인/반려/보관은 developer 이상 권한이 필요합니다. 현재 계정은 조회만 가능합니다.
          </p>
          <div v-if="transErr" class="mt-2 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ transErr }}</div>
        </div>

        <!-- 저장 에러 -->
        <div v-if="saveErr" class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ saveErr }}</div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-2">
          <button
            v-if="editing && canWrite"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
            @click="openDelete(editing)"
          >
            <Trash2 class="size-3.5" />삭제
          </button>
          <div class="ml-auto flex items-center gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              @click="panelOpen = false"
            >
              닫기
            </button>
            <button
              v-if="canWrite"
              type="button"
              :disabled="saving"
              class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              @click="save"
            >
              {{ saving ? '저장 중…' : (editing ? '본문 저장' : '추가') }}
            </button>
          </div>
        </div>
      </template>
    </AdminSlideOver>

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
