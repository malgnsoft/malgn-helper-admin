<!--
  pages/announces/[id].vue — 안내글 상세·편집 전용 페이지 (hp_announce 연동).
  안내글은 수집 파이프라인(POST /announces, service token) 전용이라 '신규 생성' 모드가 없다(편집 전용).
  /announces/:id = 기존(GET 로드 → PATCH 저장). 섹션:
    본문(제목 input · 질문 AdminRichEditor(선택) · 본문 answer(=body) AdminRichEditor) ·
    분류(scope/서비스/토픽/태그) · 버전 체인 배너 · 최신성 배지 ·
    CK 체크리스트 패널(reviewing 상태 전용) · 승인 워크플로(전이 버튼 + 반려 사유 모달).
  본문 저장/삭제 = admin(level≥9). 승인 전이 = developer↑(level≥5).
  API:
    GET    /announces/:id                                                  (developer↑)
    PATCH  /announces/:id            본문/분류 수정 (admin)  body {title?,question?,answer(=body)?,scope?,topicId?,serviceId?,tags?}
    PATCH  /announces/:id/transition body {to, reason?, archivedReason?}  승인 전이 (developer↑)
    DELETE /announces/:id            soft delete (admin)
    GET    /topics · /services       분류 카탈로그 (셀렉트 옵션)
  QUALITY §10-4 승인 UI (§1-2 준용):
    - CK 체크리스트(자동 2 + 수동 8, 안내글 특성 반영)
    - 반려 사유 ERR_* 12코드 다중선택 + 자유 메모 모달
    - 보관 사유(archived_reason) 드롭다운
    - 버전 체인(supersedes_id / superseded_by_id) 배너
    - 최신성(last_verified_at 180일) 배지
    - 422(ERR_CLASSIFY/ERR_PII) 자동 항목 강조
-->
<script setup lang="ts">
import { ArrowLeft, Trash2, Save, CheckCircle2, XCircle, MinusCircle, GitBranch, Clock } from 'lucide-vue-next'

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

const route = useRoute()
const router = useRouter()

const routeId = route.params.id as string

/* ── 타입 ── */
type ApprovalStatus = 'draft' | 'reviewing' | 'approved' | 'rejected' | 'archived'
type Scope = 'common' | 'service'

/* PII 게이트 컬럼 (P2-EXPOSURE-GUARD §4-B) — 상세 응답(an.*)에 포함됨 */
type ImagePiiStatus = 'none' | 'pending' | 'suspect' | 'clear' | 'removed' | 'masked' | 'blocked'
type TextPiiStatus = 'pending' | 'clear' | 'masked' | 'blocked'

/* QUALITY §10-2 버전·최신성 컬럼 — 미배포 환경에서는 null */
type ArchivedReason = 'superseded' | 'outdated' | 'domain_closed'

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
  /* PII 게이트 (§4-B) — 미배포 응답 대비 optional */
  pii_text_status?: TextPiiStatus | null
  image_pii_status?: ImagePiiStatus | null
  private_source_flag?: 0 | 1 | null
  pii_checked_by?: string | null
  pii_checked_at?: string | null
  /* QUALITY §10-2 버전·최신성 컬럼 — 미배포 시 null */
  last_verified_at?: string | null
  supersedes_id?: number | null
  superseded_by_id?: number | null
  archived_reason?: ArchivedReason | null
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

/* ── 재검증 필요 배지 (QUALITY §8-1, §10-4) ── */
async function refreshVerificationBadge() {
  try {
    const url = new URL(`${API_BASE}/announces`)
    url.searchParams.set('needsVerification', 'true')
    url.searchParams.set('limit', '1')
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) return
    const d = (await res.json()) as { total?: number; needsVerificationSkipped?: boolean }
    if (d.needsVerificationSkipped) return   // 컬럼 미적용 환경 — 배지 비표시
    badges.value = {
      ...badges.value,
      'announces-verify': d.total != null && d.total > 0
        ? { value: d.total, color: 'warning' }
        : { value: 0, color: 'neutral' },
    }
  } catch { /* 무시 */ }
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

/* ── 버전 체인 (QUALITY §6, §10-4) ── */
const versionChain = computed(() => {
  if (!current.value) return null
  const supersedes = current.value.supersedes_id ?? null
  const supersededBy = current.value.superseded_by_id ?? null
  if (!supersedes && !supersededBy) return null
  return { supersedes, supersededBy }
})

/* ── 최신성 (QUALITY §2-⑦, §8-1) ── */
const VERIFY_DAYS = 180
const verifyStatus = computed<'ok' | 'overdue' | 'skip' | null>(() => {
  if (!current.value) return null
  const lv = current.value.last_verified_at
  if (lv === undefined) return null           // 컬럼 미배포 — 숨김
  if (!lv) return 'overdue'                   // null = 검증 기록 없음
  const days = (Date.now() - new Date(lv).getTime()) / 86400000
  return days > VERIFY_DAYS ? 'overdue' : 'ok'
})
function fmtVerifiedAt() {
  const lv = current.value?.last_verified_at
  if (!lv) return ''
  return lv.slice(0, 10)
}

/* ── 보관 사유 (archived 전이 시) ── */
const archiveReasonModal = ref(false)
const selectedArchiveReason = ref<ArchivedReason | ''>('')
const ARCHIVE_REASON_OPTS: { value: ArchivedReason; label: string }[] = [
  { value: 'superseded',    label: '신버전으로 대체(superseded)' },
  { value: 'outdated',      label: '노후화(outdated)' },
  { value: 'domain_closed', label: '도메인 폐기(domain_closed)' },
]

/* ── CK 체크리스트 (QUALITY §3 준용, 안내글 특성 반영) ──
   자동(A) 2개: 분류 정합(CK-2), PII 상태(CK-4)
   수동(M) 8개: 안내글 특성에 맞춰 조정 */
type AutoCheckResult = 'pass' | 'fail' | 'skip'

const ckAutoClassify = computed<AutoCheckResult>(() => {
  if (!current.value) return 'skip'
  if (current.value.scope === 'service' && !current.value.service_id) return 'fail'
  return 'pass'
})

const ckAutoPii = computed<AutoCheckResult>(() => {
  if (!current.value) return 'skip'
  const txt = current.value.pii_text_status
  const img = current.value.image_pii_status
  if (txt === undefined && img === undefined) return 'skip'
  if (txt === 'blocked') return 'fail'
  if (img === 'suspect' || img === 'pending' || img === 'blocked') return 'fail'
  return 'pass'
})

/* 서버 422 응답 시 강조할 자동 항목 */
const ck422Classify = ref(false)
const ck422Pii = ref(false)

/* 수동 체크박스 — 8개 (안내글 준용) */
const manualCks = reactive<Record<string, boolean>>({
  ck5: false,   // 분류·라벨 정합
  ck6: false,   // 사실 정확성
  ck7: false,   // 명확성·가독성
  ck8: false,   // 톤·격식
  ck9: false,   // 구조·마크업
  ck10: false,  // 최신성
  ck11: false,  // PII·비공개 없음
  ck12: false,  // 재사용 가능·중복 없음
})

const MANUAL_CK_META: { key: keyof typeof manualCks; label: string; hint: string }[] = [
  { key: 'ck5',  label: '분류·라벨 정합',       hint: '지정된 topic이 안내 내용과 실제 일치함 확인' },
  { key: 'ck6',  label: '사실 정확성',           hint: '언급된 모든 기능·절차·수치가 현행 제품·정책과 일치' },
  { key: 'ck7',  label: '명확성·가독성',         hint: '단계 번호화, 전문용어 풀어쓰기, 200자 단락 규칙' },
  { key: 'ck8',  label: '톤·격식',               hint: '공지·안내 상황에 맞는 격식 톤, 경어 일관성' },
  { key: 'ck9',  label: '구조·마크업',           hint: '챗봇 렌더링 안전, 이미지 절대 URL, 마크다운 적절' },
  { key: 'ck10', label: '최신성',                hint: 'last_verified_at 180일 이내 또는 이번 승인이 최신성 확인 포함' },
  { key: 'ck11', label: 'PII·비공개 없음',       hint: '본문·이미지 캡션 PII 없음, 고유식별정보 없음' },
  { key: 'ck12', label: '재사용 가능',           hint: '특정 날짜·단일 고객사 조건에 묶이지 않음(일회성 이면 이관 검토)' },
]

const showCkPanel = computed(() => current.value?.approval_status === 'reviewing')

const ckAutoFail = computed(() =>
  ckAutoClassify.value === 'fail' || ckAutoPii.value === 'fail'
)
const ckManualAllChecked = computed(() =>
  Object.values(manualCks).every(v => v)
)
const ckApproveBlocked = computed(() => ckAutoFail.value || !ckManualAllChecked.value)

const ckBlockReasons = computed<string[]>(() => {
  const msgs: string[] = []
  if (ckAutoClassify.value === 'fail') msgs.push('분류 정합 실패 — scope=service인데 service_id 미지정')
  if (ckAutoPii.value === 'fail') {
    const txt = current.value?.pii_text_status
    const img = current.value?.image_pii_status
    if (txt === 'blocked') msgs.push('텍스트 PII 차단(blocked)')
    if (img === 'suspect') msgs.push('이미지 PII 의심(suspect)')
    if (img === 'pending') msgs.push('이미지 PII 미검수(pending)')
    if (img === 'blocked') msgs.push('이미지 PII 차단(blocked)')
  }
  if (!ckManualAllChecked.value) {
    const unchecked = MANUAL_CK_META.filter(m => !manualCks[m.key]).map(m => m.label)
    msgs.push(`미체크 항목: ${unchecked.join(', ')}`)
  }
  return msgs
})

function ckGateOk(): boolean {
  return !ckApproveBlocked.value
}

function resetCks() {
  for (const k of Object.keys(manualCks) as (keyof typeof manualCks)[]) {
    manualCks[k] = false
  }
  ck422Classify.value = false
  ck422Pii.value = false
}

/* ── 승인 전이 ── */
const transitioning = ref(false)
const transErr = ref<string | null>(null)
const allowedTransitions = computed<ApprovalStatus[]>(() =>
  current.value ? TRANSITIONS[current.value.approval_status] ?? [] : [],
)

/* ── PII 승인 게이트 (P2-EXPOSURE-GUARD §4-2) ── */
const bodyHasImages = computed(() => /<img\b[^>]*\bsrc\s*=/i.test(current.value?.answer ?? ''))
const imageGateOk = computed(() => {
  const s = current.value?.image_pii_status ?? (bodyHasImages.value ? 'pending' : 'none')
  return s === 'none' || s === 'clear' || s === 'removed' || s === 'masked'
})
const textBlocked = computed(() => current.value?.pii_text_status === 'blocked')
const piiBlockReason = computed<string | null>(() => {
  if (!imageGateOk.value) {
    const s = current.value?.image_pii_status ?? 'pending'
    return `이미지 PII 게이트 미통과(${s}) — 인용 이미지 검수를 clear/removed/masked 로 확정해야 승인할 수 있습니다.`
  }
  if (textBlocked.value) return '텍스트 PII 차단(blocked) — 본문에서 고유식별정보가 발견되어 승인할 수 없습니다. 마스킹 후 재시도하세요.'
  return null
})
function transitionBlocked(to: ApprovalStatus): boolean {
  if (to === 'approved' && piiBlockReason.value !== null) return true
  if (to === 'approved' && ckApproveBlocked.value) return true
  return false
}

/* ── 반려 사유 모달 (QUALITY §7 ERR_* 12코드) ── */
const rejectModal = ref(false)
const rejectCodeMap = reactive<Record<string, boolean>>({
  ERR_FACT: false,
  ERR_OUTDATED: false,
  ERR_SCOPE: false,
  ERR_SPECULATIVE: false,
  ERR_UNCLEAR: false,
  ERR_TONE: false,
  ERR_MARKUP: false,
  ERR_CLASSIFY: false,
  ERR_PII: false,
  ERR_REUSE: false,
  ERR_INCOMPLETE: false,
  ERR_DUPLICATE: false,
})
const rejectMemo = ref('')

const REJECT_CODES: { code: string; label: string; hint: string }[] = [
  { code: 'ERR_FACT',       label: '사실 오류',       hint: 'B1·B2 — 잘못된 기능/절차/수치' },
  { code: 'ERR_OUTDATED',   label: '최신성 부재',      hint: '폐기된 UI명칭·구버전 절차·만료 정책' },
  { code: 'ERR_SCOPE',      label: '범위 이탈',        hint: 'B3 — 질문이 묻지 않은 단언·과잉 정보' },
  { code: 'ERR_SPECULATIVE',label: '추측·단정',        hint: 'B4 — "~일 것입니다" 등 추측 표현' },
  { code: 'ERR_UNCLEAR',    label: '불명확·가독성',    hint: 'C1~C5 — 중의적 표현·구조 없는 장문' },
  { code: 'ERR_TONE',       label: '톤·격식 불일치',   hint: 'E1~E5 — 혼용 경어·과잉 다짐·부정 어조' },
  { code: 'ERR_MARKUP',     label: '마크업 오류',      hint: 'D2·D3 — 렌더링 깨짐·상대 경로 이미지' },
  { code: 'ERR_CLASSIFY',   label: '분류 불일치',      hint: 'CK-1·2·5 — topic/service 지정 오류' },
  { code: 'ERR_PII',        label: 'PII·비공개 포함',  hint: 'P2 §4-2 — 개인정보·비공개 파생 내용' },
  { code: 'ERR_REUSE',      label: '재사용성 부족',    hint: 'D4 — 특정 날짜·고객사에 묶인 1회성 내용' },
  { code: 'ERR_INCOMPLETE', label: '완전성 부족',      hint: '핵심 시나리오 누락·다음 단계 안내 없음' },
  { code: 'ERR_DUPLICATE',  label: '중복',             hint: '동일 topic에 이미 approved 안내글이 존재' },
]

function openRejectModal() {
  for (const k of Object.keys(rejectCodeMap)) rejectCodeMap[k] = false
  rejectMemo.value = ''
  rejectModal.value = true
}

function buildRejectReason(): string {
  const codes = Object.entries(rejectCodeMap)
    .filter(([, v]) => v)
    .map(([k]) => k)
  if (!codes.length) return rejectMemo.value.trim()
  const memo = rejectMemo.value.trim()
  return memo ? `${codes.join(',')} | ${memo}` : codes.join(',')
}

const rejectReasonValid = computed(() =>
  Object.values(rejectCodeMap).some(v => v)
)

/* ── 토스트 메시지 ── */
const toast = ref<{ msg: string; type: 'error' | 'success' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string, type: 'error' | 'success' = 'error') {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { msg, type }
  toastTimer = setTimeout(() => { toast.value = null }, 4000)
}

async function doTransition(to: ApprovalStatus, overrideReason?: string) {
  if (!current.value || !canTransition.value) {
    transErr.value = '승인/반려/보관은 developer 이상 권한이 필요합니다.'
    return
  }

  if (to === 'archived' && !selectedArchiveReason.value) {
    archiveReasonModal.value = true
    return
  }

  if (to === 'rejected' && overrideReason === undefined) {
    openRejectModal()
    return
  }

  if (to === 'approved' && piiBlockReason.value) {
    transErr.value = piiBlockReason.value
    return
  }
  if (to === 'approved' && !ckGateOk()) {
    transErr.value = `체크리스트 미통과 — ${ckBlockReasons.value.join('; ')}`
    return
  }

  transitioning.value = true
  transErr.value = null
  try {
    const body: Record<string, unknown> = { to }
    if (to === 'rejected' && overrideReason) body.reason = overrideReason
    if (to === 'archived' && selectedArchiveReason.value) body.archivedReason = selectedArchiveReason.value
    const res = await fetch(`${API_BASE}/announces/${current.value.id}/transition`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 403) throw new Error('권한이 부족합니다 (developer 이상 필요).')
    if (res.status === 422) {
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        code?: 'ERR_CLASSIFY' | 'ERR_PII'
        failed?: string[]
        gate?: { classification?: 'pass' | 'fail'; pii?: 'pass' | 'skip' | 'fail' }
      }
      if (j.code === 'ERR_CLASSIFY' || j.gate?.classification === 'fail') ck422Classify.value = true
      if (j.code === 'ERR_PII' || j.gate?.pii === 'fail') ck422Pii.value = true
      try { current.value = await fetchOne(current.value.id) } catch { /* keep */ }
      const msg = j.code === 'ERR_CLASSIFY'
        ? '분류 검사 실패 — topic_id/service_id를 올바르게 지정한 후 다시 승인하세요.'
        : j.code === 'ERR_PII'
        ? 'PII 게이트 실패 — 본문·이미지 PII를 처리한 후 다시 승인하세요.'
        : (j.error || '승인 게이트에 의해 거부되었습니다.')
      showToast(msg, 'error')
      throw new Error(msg)
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `API ${res.status}`)
    }
    selectedArchiveReason.value = ''
    archiveReasonModal.value = false
    rejectModal.value = false
    resetCks()
    const fresh = await fetchOne(current.value.id)
    current.value = fresh
    await Promise.all([refreshPendingBadge(), refreshVerificationBadge()])
    if (to === 'approved') showToast('승인되었습니다.', 'success')
  } catch (e) {
    transErr.value = (e as Error).message
  } finally {
    transitioning.value = false
  }
}

async function confirmReject() {
  if (!rejectReasonValid.value) return
  const reason = buildRejectReason()
  rejectModal.value = false
  await doTransition('rejected', reason)
}

async function confirmArchive() {
  if (!selectedArchiveReason.value) return
  archiveReasonModal.value = false
  await doTransition('archived')
}

/* ── PII 검수 후 current 재조회 ── */
async function onPiiReviewed() {
  if (!current.value) return
  try { current.value = await fetchOne(current.value.id) } catch { /* keep */ }
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
    <!-- 토스트 -->
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="toast"
        class="fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl px-4 py-3 text-[13px] font-medium shadow-lg"
        :class="toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'"
      >
        {{ toast.msg }}
      </div>
    </Transition>

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
          <!-- archived_reason 표기 -->
          <span
            v-if="current.archived_reason"
            class="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500"
          >
            {{ current.archived_reason === 'superseded' ? '대체됨' : current.archived_reason === 'outdated' ? '노후화' : '도메인폐기' }}
          </span>
          <span v-if="current.approved_by" class="text-[11px] text-slate-400">
            by {{ current.approved_by }}<template v-if="current.approved_at"> · {{ fmtDate(current.approved_at) }}</template>
          </span>
          <span v-if="current.source_post_id" class="ml-auto font-mono text-[11px] text-slate-400">
            출처 PMS #{{ current.source_post_id }}
          </span>
          <!-- 최신성 배지 -->
          <template v-if="verifyStatus !== null && current.approval_status === 'approved'">
            <span
              v-if="verifyStatus === 'ok'"
              class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700"
            >
              <Clock class="size-3" />최종 검증: {{ fmtVerifiedAt() }}
            </span>
            <span
              v-else-if="verifyStatus === 'overdue'"
              class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
            >
              <Clock class="size-3" />재검증 필요
            </span>
          </template>
        </div>
        <div
          v-if="current.approval_status === 'rejected' && current.rejection_reason"
          class="mt-2 rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700"
        >
          반려 사유: {{ current.rejection_reason }}
        </div>
      </header>

      <!-- 버전 체인 배너 -->
      <div
        v-if="versionChain"
        class="mb-4 flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
      >
        <div class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <GitBranch class="size-3.5" />버전 체인
        </div>
        <div v-if="versionChain.supersedes" class="flex items-center gap-2 text-[12px] text-slate-600">
          <span class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono">이전 버전</span>
          <NuxtLink
            :to="`/announces/${versionChain.supersedes}`"
            class="text-primary-600 hover:underline"
          >#{{ versionChain.supersedes }} 보기</NuxtLink>
          <span class="text-slate-400">— 이 안내글이 해당 버전을 대체함</span>
        </div>
        <div v-if="versionChain.supersededBy" class="flex items-center gap-2 text-[12px] text-slate-600">
          <span class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-mono text-amber-700">신 버전</span>
          <NuxtLink
            :to="`/announces/${versionChain.supersededBy}`"
            class="text-primary-600 hover:underline"
          >#{{ versionChain.supersededBy }} 보기</NuxtLink>
          <span class="text-slate-400">— 이 안내글을 대체한 최신 버전</span>
        </div>
      </div>

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

        <!-- 3. PII 검수 게이트 -->
        <AdminPiiReviewPanel
          :id="current.id"
          table="announce"
          :body="current.answer"
          :image-pii-status="current.image_pii_status ?? null"
          :text-pii-status="current.pii_text_status ?? null"
          :private-source-flag="current.private_source_flag ?? null"
          :pii-checked-by="current.pii_checked_by ?? null"
          :pii-checked-at="current.pii_checked_at ?? null"
          :can-review="canWrite"
          :can-scan="canTransition"
          @reviewed="onPiiReviewed"
        />

        <!-- 4. CK 승인 체크리스트 (reviewing 상태 전용, QUALITY §3 준용) -->
        <div
          v-if="showCkPanel"
          class="rounded-xl border border-amber-200 bg-amber-50 p-6"
        >
          <div class="mb-5 border-b border-amber-200 pb-4">
            <h3 class="flex items-center gap-2 text-[15px] font-semibold text-amber-900">
              <CheckCircle2 class="size-5 text-amber-600" />승인 검토 체크리스트 (CK)
            </h3>
            <p class="mt-1 text-[12px] text-amber-700">
              QUALITY §3 준용(안내글) — 자동 항목(A) 2개 + 수동 항목(M) 8개 전부 통과 시 승인 버튼이 활성화됩니다.
            </p>
          </div>
          <div class="space-y-4">
            <!-- 자동 항목 -->
            <div>
              <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                자동 항목 (서버·클라이언트 계산)
              </p>
              <div class="space-y-2">
                <!-- CK-2: 분류 정합 -->
                <div
                  class="flex items-start gap-3 rounded-lg border px-3 py-2"
                  :class="[
                    (ck422Classify || ckAutoClassify === 'fail') ? 'border-rose-300 bg-rose-50' :
                    ckAutoClassify === 'skip' ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-white',
                  ]"
                >
                  <component
                    :is="ckAutoClassify === 'fail' || ck422Classify ? XCircle : ckAutoClassify === 'skip' ? MinusCircle : CheckCircle2"
                    class="mt-0.5 size-4 shrink-0"
                    :class="ckAutoClassify === 'fail' || ck422Classify ? 'text-rose-500' : ckAutoClassify === 'skip' ? 'text-slate-400' : 'text-emerald-500'"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-[12px] font-medium text-slate-800">
                      [자동] 분류 정합 (CK-2)
                      <span
                        v-if="ck422Classify"
                        class="ml-1.5 rounded bg-rose-100 px-1 py-0.5 text-[10px] font-semibold text-rose-700"
                      >서버 거부</span>
                    </p>
                    <p class="text-[11px] text-slate-500">
                      scope=service이면 service_id가 지정됐는지 확인
                      <span
                        v-if="ckAutoClassify === 'fail'"
                        class="font-medium text-rose-600"
                      > — scope=service인데 service_id 미지정</span>
                      <span
                        v-else-if="ckAutoClassify === 'skip'"
                        class="text-slate-400"
                      > — scope 미지정(skip)</span>
                    </p>
                  </div>
                  <span
                    class="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                    :class="ckAutoClassify === 'fail' || ck422Classify ? 'bg-rose-100 text-rose-700' : ckAutoClassify === 'skip' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'"
                  >{{ ckAutoClassify === 'fail' || ck422Classify ? '실패' : ckAutoClassify === 'skip' ? 'skip' : '통과' }}</span>
                </div>
                <!-- CK-4: PII 상태 -->
                <div
                  class="flex items-start gap-3 rounded-lg border px-3 py-2"
                  :class="[
                    (ck422Pii || ckAutoPii === 'fail') ? 'border-rose-300 bg-rose-50' :
                    ckAutoPii === 'skip' ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-white',
                  ]"
                >
                  <component
                    :is="ckAutoPii === 'fail' || ck422Pii ? XCircle : ckAutoPii === 'skip' ? MinusCircle : CheckCircle2"
                    class="mt-0.5 size-4 shrink-0"
                    :class="ckAutoPii === 'fail' || ck422Pii ? 'text-rose-500' : ckAutoPii === 'skip' ? 'text-slate-400' : 'text-emerald-500'"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-[12px] font-medium text-slate-800">
                      [자동] PII 패턴 검사 (CK-4)
                      <span
                        v-if="ck422Pii"
                        class="ml-1.5 rounded bg-rose-100 px-1 py-0.5 text-[10px] font-semibold text-rose-700"
                      >서버 거부</span>
                    </p>
                    <p class="text-[11px] text-slate-500">
                      텍스트 PII blocked 또는 이미지 PII suspect/pending/blocked 없어야 함
                      <template v-if="ckAutoPii === 'fail'">
                        <span class="font-medium text-rose-600">
                          —
                          <template v-if="current.pii_text_status === 'blocked'">텍스트 PII 차단됨</template>
                          <template v-else-if="current.image_pii_status === 'suspect'">이미지 PII 의심</template>
                          <template v-else-if="current.image_pii_status === 'pending'">이미지 PII 미검수</template>
                          <template v-else-if="current.image_pii_status === 'blocked'">이미지 PII 차단됨</template>
                        </span>
                      </template>
                      <span
                        v-else-if="ckAutoPii === 'skip'"
                        class="text-slate-400"
                      > — PII 검사 안 됨(컬럼 미배포, skip)</span>
                    </p>
                  </div>
                  <span
                    class="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                    :class="ckAutoPii === 'fail' || ck422Pii ? 'bg-rose-100 text-rose-700' : ckAutoPii === 'skip' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'"
                  >{{ ckAutoPii === 'fail' || ck422Pii ? '실패' : ckAutoPii === 'skip' ? 'skip' : '통과' }}</span>
                </div>
              </div>
            </div>

            <!-- 수동 항목 -->
            <div>
              <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                수동 항목 — 승인자 직접 체크 (8개 전부 필수)
              </p>
              <div class="space-y-1.5">
                <label
                  v-for="ck in MANUAL_CK_META"
                  :key="ck.key"
                  class="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 transition hover:border-primary-200 hover:bg-primary-50/30"
                  :class="{ 'border-emerald-300 bg-emerald-50/60': manualCks[ck.key] }"
                >
                  <input
                    v-model="manualCks[ck.key]"
                    type="checkbox"
                    class="mt-0.5 size-4 shrink-0 cursor-pointer accent-emerald-600"
                    :disabled="!canTransition"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="text-[12px] font-medium text-slate-800">{{ ck.label }}</p>
                    <p class="text-[11px] text-slate-500">{{ ck.hint }}</p>
                  </div>
                  <CheckCircle2
                    v-if="manualCks[ck.key]"
                    class="mt-0.5 size-4 shrink-0 text-emerald-500"
                  />
                </label>
              </div>
            </div>

            <!-- 게이트 요약 -->
            <div
              v-if="ckApproveBlocked"
              class="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5"
            >
              <XCircle class="mt-0.5 size-4 shrink-0 text-rose-500" />
              <div class="text-[12px] text-rose-700">
                <p class="font-semibold mb-1">승인 불가 — 아래 항목을 해결하세요</p>
                <ul class="list-disc pl-4 space-y-0.5">
                  <li v-for="r in ckBlockReasons" :key="r">{{ r }}</li>
                </ul>
              </div>
            </div>
            <div
              v-else
              class="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700"
            >
              <CheckCircle2 class="size-4 shrink-0 text-emerald-500" />
              <span class="font-semibold">체크리스트 통과 — 승인 버튼이 활성화되었습니다.</span>
            </div>
          </div>
        </div>

        <!-- 5. 승인 워크플로 -->
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
                  :disabled="!canTransition || transitioning || transitionBlocked(to)"
                  class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  :class="TRANSITION_META[to].cls"
                  :title="
                    !canTransition ? 'developer 이상 권한 필요' :
                    (to === 'approved' && ckApproveBlocked) ? '체크리스트 미통과 — CK 패널을 확인하세요' :
                    (transitionBlocked(to) ? (piiBlockReason ?? '') : '')
                  "
                  @click="doTransition(to)"
                >
                  <CheckCircle2 class="size-3.5" />{{ TRANSITION_META[to].label }}
                </button>
              </div>
              <p v-else class="text-[12px] text-slate-400">현재 상태에서 가능한 전이가 없습니다.</p>

              <!-- PII 승인 게이트 차단 사유 (§4-2) -->
              <div
                v-if="allowedTransitions.includes('approved') && piiBlockReason"
                class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700"
              >
                <span class="font-semibold">승인 불가:</span> {{ piiBlockReason }}
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

    <!-- 반려 사유 모달 (QUALITY §7 ERR_* 12코드) -->
    <AdminModal v-model="rejectModal" title="반려 사유 선택" size="lg">
      <div class="space-y-4">
        <p class="text-[12px] text-slate-600">
          ERR_* 코드 1개 이상 선택 필수. 자유 메모는 코드 선택 후 추가 설명으로만 사용합니다.
        </p>
        <div class="grid grid-cols-2 gap-2">
          <label
            v-for="rc in REJECT_CODES"
            :key="rc.code"
            class="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-rose-200 hover:bg-rose-50/30"
            :class="{ 'border-rose-300 bg-rose-50': rejectCodeMap[rc.code] }"
          >
            <input
              v-model="rejectCodeMap[rc.code]"
              type="checkbox"
              class="mt-0.5 size-4 shrink-0 cursor-pointer accent-rose-600"
            />
            <div class="min-w-0">
              <p class="text-[12px] font-semibold text-slate-800">
                <span class="font-mono text-rose-600">{{ rc.code }}</span>
                <span class="ml-1 font-normal text-slate-600">{{ rc.label }}</span>
              </p>
              <p class="text-[11px] text-slate-500">{{ rc.hint }}</p>
            </div>
          </label>
        </div>
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">
            자유 메모 <span class="text-slate-400">(선택 · 코드 선택 후 추가 설명)</span>
          </label>
          <textarea
            v-model="rejectMemo"
            rows="3"
            placeholder="상세 반려 사유를 입력하세요 (선택)"
            class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div v-if="!rejectReasonValid" class="text-[11px] text-rose-600">
          ERR_* 코드를 1개 이상 선택해야 반려할 수 있습니다.
        </div>
      </div>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="rejectModal = false"
          >
            취소
          </button>
          <button
            type="button"
            :disabled="!rejectReasonValid || transitioning"
            class="rounded-md bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            @click="confirmReject"
          >
            {{ transitioning ? '처리 중…' : '반려 확정' }}
          </button>
        </div>
      </template>
    </AdminModal>

    <!-- 보관 사유 모달 -->
    <AdminModal v-model="archiveReasonModal" title="보관 사유 선택" size="sm">
      <div class="space-y-4">
        <p class="text-[12px] text-slate-600">
          보관 처리 전 사유를 선택하세요. 보관 후 챗봇 노출에서 즉시 제외됩니다.
        </p>
        <select
          v-model="selectedArchiveReason"
          class="h-9 w-full rounded-md bg-slate-50 px-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">사유 선택</option>
          <option v-for="opt in ARCHIVE_REASON_OPTS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="archiveReasonModal = false; selectedArchiveReason = ''"
          >
            취소
          </button>
          <button
            type="button"
            :disabled="!selectedArchiveReason || transitioning"
            class="rounded-md bg-slate-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            @click="confirmArchive"
          >
            {{ transitioning ? '처리 중…' : '보관 확정' }}
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
