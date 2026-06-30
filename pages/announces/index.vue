<!--
  pages/announces/index.vue — 표준 안내답변(안내글) 큐레이션 목록 (hp_announce 연동).
  Q&A 표준답변(standard-answers/index.vue)과 동일한 레이아웃·필터·승인 워크플로를 따르되,
  안내글 특성에 맞춘다: title 컬럼 표시 · question 은 없을 수 있음 · 본문은 answer(=body) ·
  출처 source_post_id 컬럼 · 신규 작성은 수집 파이프라인 전용(service token)이라 UI 추가 버튼 없음.

  상세·편집·승인 전이는 전용 페이지(/announces/:id)가 담당한다. 목록에서는 빠른 삭제만 제공.
  ※ 정렬 컨트롤은 백엔드 미지원(GET /announces 에 sort 파라미터 없음)이라 생략.

  API (가드):
    GET    /announces?scope=&topicId=&serviceId=&approvalStatus=&search=&limit=&offset=  (developer↑)
             → { rows, total } (JOIN: topic_slug/label·service_slug/name·tags[]·approval_status·scope, body→answer 매핑, source_post_id)
    DELETE /announces/:id            soft delete (admin)
    GET    /topics · /services       분류 카탈로그 (셀렉트 옵션)
  ※ POST /announces 는 service token(수집 파이프라인) 전용 — admin 쿠키 세션으로 생성 불가하므로 [추가] UI 없음.
-->
<script setup lang="ts">
import { Pencil, Trash2, Megaphone } from 'lucide-vue-next'
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
  /* PII 게이트 (§4-B) — 목록 응답 보강 시 채워짐. 미배포 시 undefined → 배지 비표시. */
  pii_text_status?: TextPiiStatus | null
  image_pii_status?: ImagePiiStatus | null
}

type ImagePiiStatus = 'none' | 'pending' | 'suspect' | 'clear' | 'removed' | 'masked' | 'blocked'
type TextPiiStatus = 'pending' | 'clear' | 'masked' | 'blocked'

type Topic = { id: number; slug: string; scope: Scope; label: string; active: boolean }
type Service = { id: number; slug: string; name: string; active: boolean }

/* ── 권한 ── */
const meSession = useAuthUser()
const myLevel = computed(() => meSession.value?.level ?? 0)
const canRead = computed(() => myLevel.value >= 5)        // GET = developer↑
const canWrite = computed(() => myLevel.value >= 9)       // DELETE = admin

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

/* 이미지 PII 상태 배지 (§4-B). pending/suspect 는 검수 필요 강조. */
const IMG_PII_META: Record<ImagePiiStatus, { label: string; cls: string; alert: boolean }> = {
  none:    { label: '—',     cls: 'text-slate-300',                 alert: false },
  pending: { label: '미검수', cls: 'bg-amber-100 text-amber-700',    alert: true },
  suspect: { label: '의심',   cls: 'bg-rose-100 text-rose-700',      alert: true },
  clear:   { label: '통과',   cls: 'bg-emerald-100 text-emerald-700', alert: false },
  removed: { label: '제거',   cls: 'bg-sky-100 text-sky-700',        alert: false },
  masked:  { label: '가림',   cls: 'bg-sky-100 text-sky-700',        alert: false },
  blocked: { label: '차단',   cls: 'bg-rose-200 text-rose-800',      alert: true },
}
const hasPiiCols = computed(() => rows.value.some(r => r.image_pii_status != null || r.pii_text_status != null))

const APPROVAL_FILTER_OPTS = [
  { value: '', label: '전체' },
  { value: 'draft', label: '초안' },
  { value: 'reviewing', label: '검토중' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '반려' },
  { value: 'archived', label: '보관' },
] as const

/* 컬럼 — PII 게이트 컬럼은 목록 응답 보강 시(hasPiiCols) 자동 삽입. */
const COLUMNS = computed<TableColumn[]>(() => [
  { key: 'id',        label: '#',      class: 'px-5 pr-3 w-14' },
  { key: 'title',     label: '제목' },
  { key: 'scope',     label: '분류',   align: 'center', class: 'px-3 w-16' },
  { key: 'topic',     label: '토픽',   class: 'px-3 w-32' },
  { key: 'service',   label: '서비스', class: 'px-3 w-32' },
  { key: 'status',    label: '상태',   align: 'center', class: 'px-3 w-20' },
  ...(hasPiiCols.value ? [{ key: 'pii', label: 'PII', align: 'center', class: 'px-3 w-20' } as TableColumn] : []),
  { key: 'source',    label: '출처',   align: 'right', class: 'px-3 w-20' },
  { key: 'updatedAt', label: '수정일', align: 'right' },
  { key: 'actions',   label: '',       align: 'right', class: 'px-5 pl-3 w-20' },
])

const selectCls =
  'h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'

/* ── 카탈로그 (필터 옵션용) ── */
const topics = ref<Topic[]>([])
const services = ref<Service[]>([])
async function loadCatalog() {
  try {
    const [tRes, sRes] = await Promise.all([
      apiFetch(`${API_BASE}/topics`, { credentials: 'include', cache: 'no-store' }),
      apiFetch(`${API_BASE}/services`, { credentials: 'include', cache: 'no-store' }),
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

/* PII 검수 우선 보기 — 현재 페이지 내에서 pending/suspect/blocked 를 위로 정렬(클라이언트). */
const piiFirst = ref(false)
const IMG_PRIORITY: Record<ImagePiiStatus, number> = {
  blocked: 0, pending: 1, suspect: 2, removed: 3, masked: 3, clear: 4, none: 5,
}
const displayRows = computed<AnnounceRow[]>(() => {
  if (!piiFirst.value || !hasPiiCols.value) return rows.value
  return [...rows.value].sort((a, b) => {
    const ta = a.pii_text_status === 'blocked' ? -1 : 0
    const tb = b.pii_text_status === 'blocked' ? -1 : 0
    if (ta !== tb) return ta - tb
    const pa = IMG_PRIORITY[a.image_pii_status ?? 'none']
    const pb = IMG_PRIORITY[b.image_pii_status ?? 'none']
    return pa - pb
  })
})

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
    const res = await apiFetch(url, { credentials: 'include', cache: 'no-store' })
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
      const res = await apiFetch(url, { credentials: 'include', cache: 'no-store' })
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

/* ── 상세·편집은 전용 페이지로 이동 ── */
function openDetail(row: AnnounceRow) {
  navigateTo(`/announces/${row.id}`)
}

/* ── 삭제 (목록에서 빠른 삭제) ── */
const delTarget = ref<AnnounceRow | null>(null)
const delOpen = ref(false)
const deleting = ref(false)
function openDelete(row: AnnounceRow) { if (!canWrite.value) return; delTarget.value = row; delOpen.value = true }
async function confirmDelete() {
  if (!delTarget.value) return
  deleting.value = true
  try {
    const res = await apiFetch(`${API_BASE}/announces/${delTarget.value.id}`, {
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
        :rows="displayRows"
        :pending="pending"
        :error="error"
        title="전체 "
        :total="total"
        :shown="rows.length"
        empty-text="조건에 맞는 안내글이 없습니다."
      >
        <template v-if="hasPiiCols" #headerRight>
          <label class="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <input v-model="piiFirst" type="checkbox" class="size-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            PII 검수 우선
          </label>
        </template>
        <template #footer>
          <AdminPagination :page="page" :page-size="LIMIT" :total="total" @update:page="goPage" />
        </template>
        <template #default="{ row }: { row: AnnounceRow }">
          <tr class="cursor-pointer hover:bg-slate-50" @click="openDetail(row)">
            <td class="px-5 pr-3 py-3 font-mono text-[11px] text-slate-400">#{{ row.id }}</td>
            <td class="px-3 py-3">
              <div class="flex items-center gap-1.5">
                <p class="text-[13px] font-semibold text-slate-900">{{ row.title }}</p>
                <span
                  v-if="row.pii_text_status === 'blocked'"
                  class="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-200 text-rose-800"
                  title="텍스트 PII 차단 — 고유식별정보 발견. 마스킹 후 재상신 필요."
                >PII 차단</span>
              </div>
              <div
                v-if="row.question"
                class="qa-preview mt-0.5 max-w-xl text-[11.5px] leading-relaxed text-slate-500"
                v-html="row.question"
              />
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
            <td v-if="hasPiiCols" class="px-3 py-3 text-center">
              <span
                v-if="row.image_pii_status"
                class="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                :class="IMG_PII_META[row.image_pii_status].cls"
                :title="`이미지 PII: ${IMG_PII_META[row.image_pii_status].label}`"
              >{{ IMG_PII_META[row.image_pii_status].label }}</span>
              <span v-else class="text-[11px] text-slate-300">—</span>
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
                <NuxtLink
                  :to="`/announces/${row.id}`"
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
