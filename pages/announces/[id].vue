<!--
  pages/announces/[id].vue — 안내글 상세·편집 전용 페이지 (hp_announce 연동).
  안내글은 수집 파이프라인(POST /announces, service token) 전용이라 '신규 생성' 모드가 없다(편집 전용).
  /announces/:id = 기존(GET 로드 → PATCH 저장). 섹션:
    본문(제목 input · 질문 AdminRichEditor(선택) · 본문 answer(=body) AdminRichEditor) ·
    분류(scope/서비스/토픽/태그) · 승인 워크플로(전이 버튼 + 반려 사유).
  본문 저장/삭제 = admin(level≥9). 승인 전이 = developer↑(level≥5).
  API:
    GET    /announces/:id                                                  (developer↑)
    PATCH  /announces/:id            본문/분류 수정 (admin)  body {title?,question?,answer(=body)?,scope?,topicId?,serviceId?,tags?}
    PATCH  /announces/:id/transition body {to, reason?}     승인 전이 (developer↑)
    DELETE /announces/:id            soft delete (admin)
    GET    /topics · /services       분류 카탈로그 (셀렉트 옵션)
-->
<script setup lang="ts">
import { ArrowLeft, Trash2, Save, CheckCircle2 } from 'lucide-vue-next'

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

const route = useRoute()
const router = useRouter()

const routeId = route.params.id as string

/* ── 타입 ── */
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
const canRead = computed(() => myLevel.value >= 5)         // GET = developer↑
const canWrite = computed(() => myLevel.value >= 9)        // PATCH 본문/DELETE = admin
const canTransition = computed(() => myLevel.value >= 5)   // 전이 = developer↑

/* ── 승인 상태 표시 ── */
const APPROVAL_META: Record<ApprovalStatus, { label: string; cls: string }> = {
  draft:     { label: '초안',   cls: 'bg-slate-100 text-slate-600' },
  reviewing: { label: '검토중', cls: 'bg-amber-100 text-amber-700' },
  approved:  { label: '승인',   cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { label: '반려',   cls: 'bg-rose-100 text-rose-700' },
  archived:  { label: '보관',   cls: 'bg-slate-200 text-slate-500' },
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

const selectCls =
  'h-9 w-full rounded-md bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60'
const inputCls =
  'h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60'

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

/* ── 로드 상태 ── */
const ready = ref(false)
const notFound = ref(false)
const loadErr = ref<string | null>(null)
const current = ref<AnnounceRow | null>(null)   // 편집 대상 원본(상태 배지·전이·출처용).

/* ── 폼 ── */
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

async function fetchOne(id: number | string): Promise<AnnounceRow> {
  const res = await fetch(`${API_BASE}/announces/${id}`, { credentials: 'include', cache: 'no-store' })
  if (res.status === 404) throw new Error('찾을 수 없음')
  if (res.status === 403) throw new Error('admin/developer 권한이 필요합니다.')
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as AnnounceRow
}

onMounted(async () => {
  if (!canRead.value) { ready.value = true; loadErr.value = '안내글은 developer 이상 권한에서 조회할 수 있습니다.'; return }
  await loadCatalog()
  try {
    const row = await fetchOne(routeId)
    current.value = row
    fillForm(row)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('찾을 수 없')) notFound.value = true
    else loadErr.value = msg
  } finally {
    ready.value = true
  }
})

useHead(() => ({
  title: `${form.title || '안내글 편집'} · 맑은도우미 Admin`,
}))

/* ── 사이드바 승인 대기 배지 갱신 (목록과 동일 집계) ── */
const badges = useAdminBadges()
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

/* ── 저장 ── */
const saving = ref(false)
const saveErr = ref<string | null>(null)

function parseTags(): string[] {
  return form.tagsText.split(',').map(s => s.trim()).filter(Boolean)
}

async function doSave() {
  if (!current.value) return
  if (!canWrite.value) { saveErr.value = '저장은 admin 권한이 필요합니다.'; return }
  if (!form.title.trim() || !form.answer.trim()) {
    saveErr.value = '제목 · 본문은 필수입니다.'
    return
  }
  saving.value = true
  saveErr.value = null
  try {
    // 본문 + 분류 PATCH (전이는 별도 엔드포인트). question 은 빈 값이면 NULL 로 해제.
    const res = await fetch(`${API_BASE}/announces/${current.value.id}`, {
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
    await refreshPendingBadge()
    router.push('/announces')
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
  current.value ? TRANSITIONS[current.value.approval_status] ?? [] : [],
)

async function doTransition(to: ApprovalStatus) {
  if (!current.value || !canTransition.value) {
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
    const res = await fetch(`${API_BASE}/announces/${current.value.id}/transition`, {
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
    // 현재 행 재조회로 상태(승인자·일시·반려사유) 즉시 갱신
    const fresh = await fetchOne(current.value.id)
    current.value = fresh
    await refreshPendingBadge()
  } catch (e) {
    transErr.value = (e as Error).message
  } finally {
    transitioning.value = false
  }
}

/* ── 삭제 ── */
const confirmDelete = ref(false)
const deleting = ref(false)
async function doDelete() {
  if (!current.value) return
  deleting.value = true
  saveErr.value = null
  try {
    const res = await fetch(`${API_BASE}/announces/${current.value.id}`, {
      method: 'DELETE', credentials: 'include',
    })
    if (res.status === 403) throw new Error('삭제는 admin 권한이 필요합니다.')
    if (!res.ok) throw new Error(`API ${res.status}`)
    await refreshPendingBadge()
    router.push('/announces')
  } catch (e) {
    saveErr.value = (e as Error).message
    confirmDelete.value = false
  } finally {
    deleting.value = false
  }
}

/* ── 포맷 ── */
function fmtDate(iso?: string | null) { return iso ? iso.slice(0, 10) : '—' }
</script>

<template>
  <div>
    <!-- 상단: 뒤로 + 액션 -->
    <div class="mb-5 flex items-center justify-between gap-3">
      <NuxtLink
        to="/announces"
        class="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft class="size-4" />안내글 목록
      </NuxtLink>
      <div v-if="ready && !notFound && !loadErr && current" class="flex items-center gap-2">
        <button
          type="button"
          :disabled="!canWrite"
          :title="canWrite ? '삭제' : 'admin 권한 필요'"
          class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          @click="confirmDelete = true"
        >
          <Trash2 class="size-4" />삭제
        </button>
        <button
          type="button"
          :disabled="saving || !canWrite"
          :title="canWrite ? '' : 'admin 권한 필요'"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
          @click="doSave"
        >
          <Save class="size-4" />{{ saving ? '저장 중…' : '본문 저장' }}
        </button>
      </div>
    </div>

    <!-- 없음 -->
    <AdminEmptyState
      v-if="ready && notFound"
      title="안내글을 찾을 수 없습니다"
      description="삭제되었거나 잘못된 주소입니다."
    >
      <template #actions>
        <NuxtLink
          to="/announces"
          class="rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
        >목록으로</NuxtLink>
      </template>
    </AdminEmptyState>

    <!-- 로드 오류 -->
    <div
      v-else-if="ready && loadErr"
      class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
    >
      안내글을 불러오지 못했습니다 — {{ loadErr }}
    </div>

    <template v-else-if="ready && current">
      <!-- 헤더(타이틀 + 상태 배지) -->
      <header class="mb-6">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          지식 자산 · 안내글
        </p>
        <div class="mt-0.5 flex flex-wrap items-center gap-2.5">
          <h1 class="text-[22px] font-bold tracking-tight text-slate-900">
            {{ form.title || '제목 없음' }}
          </h1>
          <span
            class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            :class="APPROVAL_META[current.approval_status].cls"
          >{{ APPROVAL_META[current.approval_status].label }}</span>
          <span v-if="current.approved_by" class="text-[11px] text-slate-400">
            by {{ current.approved_by }}<template v-if="current.approved_at"> · {{ fmtDate(current.approved_at) }}</template>
          </span>
          <span v-if="current.source_post_id" class="ml-auto font-mono text-[11px] text-slate-400">
            출처 PMS #{{ current.source_post_id }}
          </span>
        </div>
        <div
          v-if="current.approval_status === 'rejected' && current.rejection_reason"
          class="mt-2 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700"
        >
          반려 사유: {{ current.rejection_reason }}
        </div>
      </header>

      <div v-if="!canWrite" class="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
        조회 전용입니다. 안내글 본문 저장·삭제는 admin 권한이 필요합니다.
      </div>

      <div class="space-y-6">
        <!-- 1. 본문 -->
        <AdminSettingsSection
          title="본문"
          description="제목·본문은 챗봇 노출 내용입니다. 질문은 이 안내가 답하는 대표 질문(선택). (제목·본문 필수)"
        >
          <AdminFormRow label="제목" required>
            <input
              v-model="form.title"
              type="text"
              placeholder="e.g. 2026년 시스템 점검 안내"
              :disabled="!canWrite"
              :class="inputCls"
            />
          </AdminFormRow>
          <AdminFormRow label="질문" hint="이 안내가 답하는 대표 질문 (선택 · 비어 있을 수 있음)">
            <AdminRichEditor
              v-model="form.question"
              :disabled="!canWrite"
              :height="360"
              placeholder="이 안내가 답하는 대표 질문(있으면 입력)"
            />
          </AdminFormRow>
          <AdminFormRow label="본문" required hint="안내 본문 내용">
            <AdminRichEditor
              v-model="form.answer"
              :disabled="!canWrite"
              :height="720"
              placeholder="안내 본문 내용을 입력하세요"
            />
          </AdminFormRow>
        </AdminSettingsSection>

        <!-- 2. 분류 -->
        <AdminSettingsSection
          title="분류"
          description="공통(전 서비스) 또는 특정 서비스로 구분하고 토픽·태그를 지정합니다. 본문 저장 시 함께 반영됩니다."
        >
          <AdminFormRow label="분류">
            <select v-model="form.scope" :disabled="!canWrite" :class="selectCls">
              <option value="">미지정</option>
              <option value="common">공통</option>
              <option value="service">서비스</option>
            </select>
          </AdminFormRow>
          <AdminFormRow label="서비스" hint="분류가 공통이면 비활성">
            <select v-model="form.serviceId" :disabled="!canWrite || form.scope === 'common'" :class="selectCls">
              <option value="">미지정</option>
              <option v-for="s in services" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
            </select>
          </AdminFormRow>
          <AdminFormRow label="토픽">
            <select v-model="form.topicId" :disabled="!canWrite" :class="selectCls">
              <option value="">미지정</option>
              <option v-for="t in formTopicOpts" :key="t.id" :value="String(t.id)">{{ t.label }} ({{ t.scope }})</option>
            </select>
          </AdminFormRow>
          <AdminFormRow label="태그" hint="쉼표(,)로 구분">
            <input
              v-model="form.tagsText"
              type="text"
              placeholder="e.g. 점검, 공지"
              :disabled="!canWrite"
              :class="inputCls"
            />
          </AdminFormRow>
        </AdminSettingsSection>

        <!-- 3. 승인 워크플로 -->
        <AdminSettingsSection
          title="승인 워크플로"
          description="검증된 안내만 챗봇에 노출됩니다. 승인/반려/보관은 developer 이상 권한이 필요합니다."
        >
          <AdminFormRow label="현재 상태">
            <div class="flex items-center gap-2 pt-1.5">
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                :class="APPROVAL_META[current.approval_status].cls"
              >{{ APPROVAL_META[current.approval_status].label }}</span>
              <span v-if="current.approved_by" class="text-[11px] text-slate-400">
                by {{ current.approved_by }}<template v-if="current.approved_at"> · {{ fmtDate(current.approved_at) }}</template>
              </span>
            </div>
          </AdminFormRow>
          <AdminFormRow label="상태 전이">
            <div class="space-y-3">
              <div v-if="allowedTransitions.length" class="flex flex-wrap gap-2">
                <button
                  v-for="to in allowedTransitions"
                  :key="to"
                  type="button"
                  :disabled="!canTransition || transitioning"
                  class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  :class="TRANSITION_META[to].cls"
                  :title="canTransition ? '' : 'developer 이상 권한 필요'"
                  @click="doTransition(to)"
                >
                  <CheckCircle2 class="size-3.5" />{{ TRANSITION_META[to].label }}
                </button>
              </div>
              <p v-else class="text-[12px] text-slate-400">현재 상태에서 가능한 전이가 없습니다.</p>

              <!-- 반려 사유 -->
              <div v-if="allowedTransitions.includes('rejected')">
                <label class="mb-1.5 block text-[12px] font-medium text-slate-700">
                  반려 사유 <span class="text-slate-400">(반려 시 필수)</span>
                </label>
                <textarea
                  v-model="rejectReason"
                  rows="2"
                  placeholder="반려 사유를 입력하세요"
                  :disabled="!canTransition"
                  class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
                />
              </div>

              <p v-if="!canTransition" class="text-[11px] text-amber-600">
                승인/반려/보관은 developer 이상 권한이 필요합니다. 현재 계정은 조회만 가능합니다.
              </p>
              <div v-if="transErr" class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ transErr }}</div>
            </div>
          </AdminFormRow>
        </AdminSettingsSection>

        <!-- 저장 오류 -->
        <div v-if="saveErr" class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ saveErr }}</div>

        <!-- 하단 저장 -->
        <div class="flex items-center justify-end gap-2 pb-2">
          <NuxtLink
            to="/announces"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >취소</NuxtLink>
          <button
            type="button"
            :disabled="saving || !canWrite"
            :title="canWrite ? '' : 'admin 권한 필요'"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
            @click="doSave"
          >
            <Save class="size-4" />{{ saving ? '저장 중…' : '본문 저장' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 로딩 -->
    <div v-else class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
      로딩 중…
    </div>

    <!-- 삭제 확인 -->
    <AdminModal v-model="confirmDelete" title="안내글 삭제" size="sm">
      <p class="text-[13px] text-slate-700">
        <span class="font-semibold">{{ form.title }}</span> 을(를) 삭제하시겠습니까?<br />
        삭제 후 복구할 수 없습니다.
      </p>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="confirmDelete = false"
          >
            취소
          </button>
          <button
            type="button"
            :disabled="deleting"
            class="rounded-md bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            @click="doDelete"
          >
            {{ deleting ? '삭제 중…' : '삭제' }}
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
