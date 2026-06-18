<!--
  pages/announces.vue — 표준 안내답변(안내글) 큐레이션 (hp_announce 연동).
  Q&A 표준답변(standard-answers.vue)과 동일한 레이아웃·필터·승인 워크플로를 따르되,
  안내글 특성에 맞춘다: title 컬럼 표시 · question 은 없을 수 있음(빈 처리) · 본문은 answer(=body) ·
  출처 source_post_id 컬럼 · 신규 작성은 수집 파이프라인 전용(service token)이라 UI 추가 버튼 없음.

  API (가드):
    GET    /announces?scope=&topicId=&serviceId=&approvalStatus=&search=&limit=&offset=  (developer↑)
             → { rows, total } (JOIN: topic_slug/label·service_slug/name·tags[]·approval_status·scope, body→answer 매핑, source_post_id)
    GET    /announces/:id                                   (developer↑)
    PATCH  /announces/:id            본문/분류 수정 (admin)  body {title?,question?,answer(=body)?,scope?,topicId?,serviceId?,tags?}
    PATCH  /announces/:id/transition body {to, reason?}     승인 전이 (developer↑)
    DELETE /announces/:id            soft delete (admin)
    GET    /topics · /services       분류 카탈로그 (셀렉트 옵션)
  ※ POST /announces 는 service token(수집 파이프라인) 전용 — admin 쿠키 세션으로 생성 불가하므로 [추가] UI 없음.
-->
<script setup lang="ts">
import { Pencil, Trash2, Megaphone, CheckCircle2 } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '안내글 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

/* 응답 행 — 서버가 raw SQL(an.*) + JOIN 으로 snake_case 노출, body→answer 매핑 */
type ApprovalStatus = 'draft' | 'reviewing' | 'approved' | 'rejected' | 'archived'
type Scope = 'common' | 'service'

type AnnounceRow = {
  id: number
  title: string
  label: string | null
  question: string | null     // 안내글은 명시적 질문이 없을 수 있음
  answer: string              // = body
  scope: Scope | null
  topic_id: number | null
  service_id: number | null
  topic_slug: string | null
  topic_label: string | null
  service_slug: string | null
  service_name: string | null
  tags: string[]
  source_post_id: number | null   // 출처 PMS 게시글
  usage_count: number
  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  created_at?: string
  updated_at: string
}

type Topic = { id: number; slug: string; scope: Scope; label: string; active: boolean }
type Service = { id: number; slug: string; name: string; active: boolean }

/* ── 권한 ── */
const meSession = useAuthUser()
const myLevel = computed(() => meSession.value?.level ?? 0)
const canRead = computed(() => myLevel.value >= 5)        // GET = developer↑
const canWrite = computed(() => myLevel.value >= 9)       // PATCH 본문/DELETE = admin
const canTransition = computed(() => myLevel.value >= 5)  // 전이 = developer↑

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

/* 전이표 — from → 허용 to (서버 SA_TRANSITIONS 재사용) */
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
  { key: 'title',     label: '제목' },
  { key: 'scope',     label: '분류',   align: 'center', class: 'px-3 w-16' },
  { key: 'topic',     label: '토픽',   class: 'px-3 w-32' },
  { key: 'service',   label: '서비스', class: 'px-3 w-32' },
  { key: 'status',    label: '상태',   align: 'center', class: 'px-3 w-20' },
  { key: 'source',    label: '출처',   align: 'right', class: 'px-3 w-20' },
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

/* ── 필터(draft → 조회) ── */
const draft = reactive({ scope: '', topicId: '', serviceId: '', approvalStatus: '', q: '' })
const applied = reactive({ scope: '', topicId: '', serviceId: '', approvalStatus: '', q: '' })

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
const rows = ref<AnnounceRow[]>([])
const total = ref(0)
const pending = ref(true)
const error = ref<string | null>(null)

const LIMIT = 60
const offset = ref(0)
const page = computed(() => Math.floor(offset.value / LIMIT) + 1)

const badges = useAdminBadges()

async function load() {
  pending.value = true
  error.value = null
  try {
    const url = new URL(`${API_BASE}/announces`)
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
    const data = (await res.json()) as { rows: AnnounceRow[]; total: number }
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
      const url = new URL(`${API_BASE}/announces`)
      url.searchParams.set('limit', '1')
      url.searchParams.set('approvalStatus', st)
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) return
      const d = (await res.json()) as { total: number }
      count += d.total ?? 0
    }
    badges.value = {
      ...badges.value,
      announces: count > 0
        ? { value: count, color: 'warning' }
        : { value: 0, color: 'neutral' },
    }
  } catch { /* 배지 실패는 무시 */ }
}

onMounted(() => {
  if (!canRead.value) { pending.value = false; return }
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
  offset.value = 0
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

/* ── 상세·편집 슬라이드오버 (안내글은 신규 생성 UI 없음 — 항상 편집 모드) ── */
const panelOpen = ref(false)
const editing = ref<AnnounceRow | null>(null)
const saving = ref(false)
const saveErr = ref<string | null>(null)

const form = reactive({
  title: '', question: '', answer: '',
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

function fillForm(row: AnnounceRow) {
  saveErr.value = null
  form.title = row.title
  form.question = row.question ?? ''
  form.answer = row.answer
  form.scope = row.scope ?? ''
  form.topicId = row.topic_id != null ? String(row.topic_id) : ''
  form.serviceId = row.service_id != null ? String(row.service_id) : ''
  form.tagsText = (row.tags ?? []).join(', ')
}

function openEdit(row: AnnounceRow) {
  editing.value = row
  fillForm(row)
  panelOpen.value = true
}

function parseTags(): string[] {
  return form.tagsText.split(',').map(s => s.trim()).filter(Boolean)
}

async function save() {
  if (!editing.value) return
  if (!canWrite.value) { saveErr.value = '저장은 admin 권한이 필요합니다.'; return }
  if (!form.title.trim() || !form.answer.trim()) {
    saveErr.value = '제목 · 본문은 필수입니다.'
    return
  }
  saving.value = true
  saveErr.value = null
  try {
    // 본문 + 분류 PATCH (전이는 별도 엔드포인트). question 은 빈 값이면 NULL 로 해제.
    const res = await fetch(`${API_BASE}/announces/${editing.value.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        question: form.question.trim() || null,
        answer: form.answer.trim(),
        ...(form.scope === 'common' || form.scope === 'service' ? { scope: form.scope } : {}),
        topicId: form.topicId ? Number(form.topicId) : null,
        serviceId: form.serviceId ? Number(form.serviceId) : null,
        tags: parseTags(),
      }),
    })
    if (res.status === 403) throw new Error('수정은 admin 권한이 필요합니다.')
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `API ${res.status}`)
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
    const res = await fetch(`${API_BASE}/announces/${editing.value.id}/transition`, {
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
    const fresh = await fetch(`${API_BASE}/announces/${editing.value.id}`, { credentials: 'include', cache: 'no-store' })
    if (fresh.ok) {
      const r = (await fresh.json()) as AnnounceRow
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
const delTarget = ref<AnnounceRow | null>(null)
const delOpen = ref(false)
const deleting = ref(false)
function openDelete(row: AnnounceRow) { if (!canWrite.value) return; delTarget.value = row; delOpen.value = true }
async function confirmDelete() {
  if (!delTarget.value) return
  deleting.value = true
  try {
    const res = await fetch(`${API_BASE}/announces/${delTarget.value.id}`, {
      method: 'DELETE', credentials: 'include',
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    delOpen.value = false
    if (panelOpen.value && editing.value?.id === delTarget.value?.id) panelOpen.value = false
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
      title="안내글 (표준 안내답변)"
      description="직원이 작성한 공지·정책 안내. 고객 문의(Q&A) 표준답변과 별도 트랙으로 검토·승인합니다. 신규 안내글은 PMS 수집 파이프라인으로 자동 적재되며, 여기서는 분류·승인·본문을 검토·정리합니다."
    />

    <!-- 권한 안내 (developer 미만) -->
    <AdminEmptyState
      v-if="!canRead"
      title="안내글은 developer 이상 권한에서 조회할 수 있습니다"
      description="현재 계정은 안내글 목록을 볼 수 없습니다. 권한이 필요하면 관리자에게 문의하세요."
      class="mt-2"
    >
      <template #icon><Megaphone class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <template v-else>
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
            placeholder="제목·질문·본문 검색 후 Enter"
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
        empty-text="조건에 맞는 안내글이 없습니다."
      >
        <template #footer>
          <AdminPagination :page="page" :page-size="LIMIT" :total="total" @update:page="goPage" />
        </template>
        <template #default="{ row }: { row: AnnounceRow }">
          <tr class="cursor-pointer hover:bg-slate-50" @click="openEdit(row)">
            <td class="px-5 pr-3 py-3 font-mono text-[11px] text-slate-400">#{{ row.id }}</td>
            <td class="px-3 py-3">
              <p class="text-[13px] font-semibold text-slate-900">{{ row.title }}</p>
              <p v-if="row.question" class="mt-0.5 line-clamp-1 max-w-md text-[11.5px] text-slate-500">{{ row.question }}</p>
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
            <td class="px-3 py-3 text-right font-mono text-[11px] text-slate-400">
              <span v-if="row.source_post_id">#{{ row.source_post_id }}</span>
              <span v-else class="text-slate-300">—</span>
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
        title="조건에 맞는 안내글이 없습니다"
        description="안내글은 PMS 수집 파이프라인(직원 첫 글 → 안내글 트랙)으로 적재됩니다. 적재된 항목이 없거나 필터 조건에 맞는 항목이 없습니다."
        class="mt-4"
      >
        <template #icon><Megaphone class="size-5 text-slate-400" /></template>
      </AdminEmptyState>

      <p v-if="!canWrite" class="mt-3 text-[11px] text-slate-400">
        안내글 본문·분류 수정은 admin 권한, 승인/반려/보관은 developer 이상 권한이 필요합니다.
      </p>
    </template>

    <!-- 상세·편집 모달 -->
    <AdminModal
      v-model="panelOpen"
      title="안내글 상세·편집"
      size="2xl"
    >
      <div v-if="editing" class="space-y-5">
        <!-- 현재 상태 -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[12px] text-slate-500">현재 상태</span>
          <span
            class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            :class="APPROVAL_META[editing.approval_status].cls"
          >{{ APPROVAL_META[editing.approval_status].label }}</span>
          <span v-if="editing.approved_by" class="text-[11px] text-slate-400">
            by {{ editing.approved_by }}<template v-if="editing.approved_at"> · {{ fmtDate(editing.approved_at) }}</template>
          </span>
          <span v-if="editing.source_post_id" class="ml-auto font-mono text-[11px] text-slate-400">
            출처 PMS #{{ editing.source_post_id }}
          </span>
        </div>
        <div
          v-if="editing.approval_status === 'rejected' && editing.rejection_reason"
          class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700"
        >
          반려 사유: {{ editing.rejection_reason }}
        </div>

        <!-- 제목 -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">제목 <span class="text-amber-600">*</span></label>
          <input
            v-model="form.title"
            type="text"
            placeholder="e.g. 2026년 시스템 점검 안내"
            :disabled="!canWrite"
            class="h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          />
        </div>

        <!-- 질문 (안내글은 선택 — 없을 수 있음) -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">질문 <span class="text-slate-400">(선택 · 안내글은 비어 있을 수 있음)</span></label>
          <textarea
            v-model="form.question"
            rows="2"
            placeholder="이 안내가 답하는 대표 질문(있으면 입력)"
            :disabled="!canWrite"
            class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
          />
        </div>

        <!-- 본문 (= body) -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">본문 <span class="text-amber-600">*</span></label>
          <AdminRichEditor
            v-model="form.answer"
            :disabled="!canWrite"
            :height="400"
            placeholder="안내 본문 내용을 입력하세요"
          />
        </div>

        <!-- 분류 셀렉터 -->
        <div class="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p class="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">분류</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1.5 block text-[12px] font-medium text-slate-700">분류</label>
              <select v-model="form.scope" :disabled="!canWrite" :class="selectCls">
                <option value="">미지정</option>
                <option value="common">공통</option>
                <option value="service">서비스</option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-[12px] font-medium text-slate-700">서비스</label>
              <select v-model="form.serviceId" :disabled="!canWrite || form.scope === 'common'" :class="selectCls">
                <option value="">미지정</option>
                <option v-for="s in services" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="mb-1.5 block text-[12px] font-medium text-slate-700">토픽</label>
              <select v-model="form.topicId" :disabled="!canWrite" :class="selectCls">
                <option value="">미지정</option>
                <option v-for="t in formTopicOpts" :key="t.id" :value="String(t.id)">{{ t.label }} ({{ t.scope }})</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="mb-1.5 block text-[12px] font-medium text-slate-700">태그 (쉼표 구분)</label>
              <input
                v-model="form.tagsText"
                type="text"
                placeholder="e.g. 점검, 공지"
                :disabled="!canWrite"
                :class="selectCls"
              />
            </div>
          </div>
          <p class="mt-2 text-[11px] text-slate-400">
            분류·태그를 수정하면 [본문 저장] 시 함께 반영됩니다.
          </p>
        </div>

        <!-- 승인 전이 -->
        <div class="rounded-lg border border-slate-200 p-3">
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

          <!-- 반려 사유 -->
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
              {{ saving ? '저장 중…' : '본문 저장' }}
            </button>
          </div>
        </div>
      </template>
    </AdminModal>

    <!-- 삭제 확인 -->
    <AdminModal v-model="delOpen" title="안내글 삭제" size="sm">
      <p class="text-[13px] text-slate-700">
        <span class="font-semibold">{{ delTarget?.title }}</span> 을(를) 삭제하시겠습니까?<br />
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
