<!--
  components/admin/PiiReviewPanel.vue — 표준답변/안내글 PII 검수 패널 (P2-EXPOSURE-GUARD §4-A·§4-2).
  표준답변(standard-answers)·안내글(announces) 상세 페이지가 공유한다. table prop 으로 대상 분기.

  구성:
    1) private_source_flag=1 경고 박스 (§2-2)
    2) 인용 이미지 미리보기 그리드 (본문 <img src> 파싱)
    3) Vision 1차 스캔 버튼 (POST .../pii-image-scan) — suspect 강조, 자동 통과 아님 명시 (§4-A I1)
    4) §4-A-2 검수 체크리스트 + 건별 판정 버튼 (PATCH .../pii-image-review) — clear/removed/masked/blocked (§4-A I3)
    5) 검수자/시각 표시 (pii_checked_by·pii_checked_at)

  ⚠ §4-2·§4-A 준수: 검수 화면에 PII '값' 을 새로 노출/전사/저장하지 않는다.
     이미지(기존 본문 인용)와 유형 라벨(signals)만 표시한다.

  판정(pii-image-review) = admin(level≥9). Vision 스캔 = developer↑(level≥5).
  상태 변경 시 'reviewed' 이벤트로 부모가 current 행을 재조회하도록 한다.
-->
<script setup lang="ts">
import { ShieldAlert, ScanSearch, ImageOff, AlertTriangle, Check, Eye } from 'lucide-vue-next'

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

/* 게이트 컬럼 — api 상세 응답(sa.* / an.*)에 포함됨 (P2-EXPOSURE-GUARD §4-B) */
export type ImagePiiStatus =
  | 'none' | 'pending' | 'suspect' | 'clear' | 'removed' | 'masked' | 'blocked'
export type TextPiiStatus = 'pending' | 'clear' | 'masked' | 'blocked'

const props = defineProps<{
  /** 대상 자산 id */
  id: number
  /** 대상 테이블 — 안내글이면 announce (스캔/검수 ?table=announce) */
  table: 'standard-answer' | 'announce'
  /** 본문 HTML (인용 이미지 추출용) — 표준답변=answer, 안내글=answer(=body) */
  body: string
  /** 현재 이미지 PII 롤업 상태 */
  imagePiiStatus: ImagePiiStatus | null
  /** 현재 텍스트 PII 상태 */
  textPiiStatus: TextPiiStatus | null
  /** 비공개 출처 파생 플래그 */
  privateSourceFlag: 0 | 1 | boolean | null
  /** 검수자/시각 */
  piiCheckedBy: string | null
  piiCheckedAt: string | null
  /** 판정 권한(admin) */
  canReview: boolean
  /** 스캔 권한(developer↑) */
  canScan: boolean
}>()

const emit = defineEmits<{
  /** 스캔/판정 후 부모가 current 재조회 */
  (e: 'reviewed'): void
}>()

const tableQuery = computed(() => (props.table === 'announce' ? '?table=announce' : ''))

/* ── 본문 <img src> 추출 (api extractImgSrcs 와 동일 규칙) ── */
const imageSrcs = computed<string[]>(() => {
  const out: string[] = []
  const re = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi
  let m: RegExpExecArray | null
  const html = props.body ?? ''
  while ((m = re.exec(html)) !== null) {
    if (m[2]) out.push(m[2])
  }
  return Array.from(new Set(out))
})
const hasImages = computed(() => imageSrcs.value.length > 0)

/* ── 상태 메타 ── */
const IMG_META: Record<ImagePiiStatus, { label: string; cls: string; ok: boolean }> = {
  none:    { label: '이미지 없음', cls: 'bg-slate-100 text-slate-500', ok: true },
  pending: { label: '미검수',     cls: 'bg-amber-100 text-amber-700',  ok: false },
  suspect: { label: '의심',       cls: 'bg-rose-100 text-rose-700',    ok: false },
  clear:   { label: '검수 완료(통과)', cls: 'bg-emerald-100 text-emerald-700', ok: true },
  removed: { label: '인용 제거',  cls: 'bg-sky-100 text-sky-700',      ok: true },
  masked:  { label: '가림 처리',  cls: 'bg-sky-100 text-sky-700',      ok: true },
  blocked: { label: '차단',       cls: 'bg-rose-200 text-rose-800',    ok: false },
}
const imgMeta = computed(() => IMG_META[(props.imagePiiStatus ?? 'pending')])

/* 승인 가능한 이미지 게이트 통과 여부 (§4-2 하드 게이트) */
const imageGateOk = computed(() => {
  const s = props.imagePiiStatus ?? (hasImages.value ? 'pending' : 'none')
  return s === 'none' || s === 'clear' || s === 'removed' || s === 'masked'
})

/* ── Vision 1차 스캔 ── */
const scanning = ref(false)
const scanErr = ref<string | null>(null)
const scanResult = ref<{ imagePiiStatus: ImagePiiStatus; images: number; scanned?: number; signals?: string[]; regions?: number; skipped?: boolean; reason?: string } | null>(null)

async function runScan() {
  if (!props.canScan) { scanErr.value = 'Vision 스캔은 developer 이상 권한이 필요합니다.'; return }
  scanning.value = true
  scanErr.value = null
  scanResult.value = null
  try {
    const res = await apiFetch(`${API_BASE}/standard-answers/${props.id}/pii-image-scan${tableQuery.value}`, {
      method: 'POST', credentials: 'include',
    })
    if (res.status === 403) throw new Error('Vision 스캔은 developer 이상 권한이 필요합니다.')
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `API ${res.status}`)
    }
    scanResult.value = (await res.json()) as typeof scanResult.value
    emit('reviewed')
  } catch (e) {
    scanErr.value = (e as Error).message
  } finally {
    scanning.value = false
  }
}

/* ── 사람 검수 판정 (clear/removed/masked/blocked) ── */
type ReviewStatus = 'clear' | 'removed' | 'masked' | 'blocked'
const REVIEW_BTNS: { status: ReviewStatus; label: string; desc: string; cls: string }[] = [
  { status: 'clear',   label: '통과(clear)',  desc: 'PII 없음·일반 조작안내로 적합', cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  { status: 'masked',  label: '가림(masked)', desc: '일부 영역 가림 처리본으로 교체 시 노출 가능', cls: 'bg-sky-600 hover:bg-sky-700 text-white' },
  { status: 'removed', label: '제거(removed)', desc: '명단·내부화면 등 인용 이미지 자체 제거', cls: 'bg-slate-600 hover:bg-slate-700 text-white' },
  { status: 'blocked', label: '차단(blocked)', desc: '고유식별정보 등 노출 절대 불가 — 자산 차단', cls: 'bg-rose-600 hover:bg-rose-700 text-white' },
]
const reviewing = ref(false)
const reviewErr = ref<string | null>(null)

async function doReview(status: ReviewStatus) {
  if (!props.canReview) { reviewErr.value = '판정은 admin 권한이 필요합니다.'; return }
  reviewing.value = true
  reviewErr.value = null
  try {
    const res = await apiFetch(`${API_BASE}/standard-answers/${props.id}/pii-image-review${tableQuery.value}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.status === 403) throw new Error('판정은 admin 권한이 필요합니다.')
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `API ${res.status}`)
    }
    scanResult.value = null
    emit('reviewed')
  } catch (e) {
    reviewErr.value = (e as Error).message
  } finally {
    reviewing.value = false
  }
}

/* ── §4-A-2 검수 체크리스트 (값 전사 금지 — 유형·위치만) ──
   체크 = "각 항목을 눈으로 확인했다"는 검토 완료 표시(해당 여부 아님).
   7개를 모두 확인해야 판정 버튼이 활성화된다(allChecked).
   위험 신호(1~6)는 보이면 해당 판정으로, 통과 조건(7)은 맞으면 clear 로 안내한다.
   hint = 권장 판정(색에만 의존하지 않도록 텍스트 병행), strong = 강조 표시. */
type CheckItem = { text: string; hint: string; strong?: boolean }
const RISK_CHECKLIST: CheckItem[] = [
  { text: '인명·연락처·이메일·주소가 화면에 보인다', hint: '→ 가림/제거' },
  { text: '고객 명단·표(여러 고객 행이 한 번에 노출되는 관리화면 리스트)가 보인다', hint: '→ 차단/가림' },
  { text: '계좌·카드·사업자번호가 보인다', hint: '→ 가림/제거' },
  { text: '주민등록번호 등 고유식별정보가 보인다', hint: '→ 즉시 차단(blocked)', strong: true },
  { text: '내부 관리화면(고객 비노출 전용 화면)이 그대로 캡처돼 있다', hint: '→ 차단/가림' },
  { text: '제3자 정보가 교차 노출된다(원 문의자 외 고객, L6)', hint: '→ 차단/가림' },
]
const PASS_CHECKLIST: CheckItem[] = [
  { text: '일반 조작안내(메뉴·버튼 위치 등)로서 적합한가', hint: '→ 통과(clear)' },
]
/* 체크 상태 배열은 위험(0~5) + 통과(6) 순서로 단일 관리 — allChecked 로직 비파괴 유지(총 7항목) */
const RISK_COUNT = RISK_CHECKLIST.length
const TOTAL_COUNT = RISK_COUNT + PASS_CHECKLIST.length
const checked = ref<boolean[]>(Array.from({ length: TOTAL_COUNT }, () => false))
const allChecked = computed(() => checked.value.every(Boolean))

function fmtDateTime(iso?: string | null) {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 16)
}
const privateSource = computed(() => props.privateSourceFlag === 1 || props.privateSourceFlag === true)
</script>

<template>
  <AdminSettingsSection
    title="PII 검수 게이트 (이미지·노출 가드)"
    description="검증된 답변만 챗봇에 노출됩니다. 인용 이미지/스크린샷의 개인정보는 사람 검수가 기본입니다(Vision 1차는 보조 트리아지일 뿐 자동 통과 아님)."
  >
    <!-- 0) 비공개 출처 경고 (§2-2) -->
    <div
      v-if="privateSource"
      class="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-800"
    >
      <ShieldAlert class="mt-0.5 size-4 shrink-0 text-rose-600" />
      <div>
        <p class="font-semibold">비공개 출처 파생 경고 (private_source_flag)</p>
        <p class="mt-0.5 leading-relaxed">
          출처가 비공개 댓글(private)에서 파생된 자산입니다. 본문이 일반화(고객 식별정보 제거)됐는지
          승인 전 직접 확인하세요. 일반화되지 않았다면 P2 노출 부적합입니다.
        </p>
      </div>
    </div>

    <!-- 현재 상태 요약 -->
    <AdminFormRow label="이미지 PII 상태">
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold" :class="imgMeta.cls">
          {{ imgMeta.label }}
        </span>
        <span v-if="hasImages" class="text-[11px] text-slate-400">
          인용 이미지 {{ imageSrcs.length }}건
        </span>
        <span v-else class="text-[11px] text-slate-400">인용 이미지 없음</span>
        <span v-if="piiCheckedBy" class="text-[11px] text-slate-400">
          · 검수 {{ piiCheckedBy }}<template v-if="piiCheckedAt"> · {{ fmtDateTime(piiCheckedAt) }}</template>
        </span>
      </div>
    </AdminFormRow>

    <!-- 1) 인용 이미지 미리보기 그리드 -->
    <AdminFormRow v-if="hasImages" label="인용 이미지" hint="본문에 인용된 이미지/스크린샷. PII 값을 텍스트로 옮겨 적지 마세요(전사 금지).">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <a
          v-for="(src, i) in imageSrcs"
          :key="i"
          :href="src"
          target="_blank"
          rel="noopener noreferrer"
          class="group relative block overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
        >
          <img
            :src="src"
            :alt="`인용 이미지 ${i + 1}`"
            loading="lazy"
            class="h-32 w-full object-cover transition group-hover:opacity-90"
          />
          <span class="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white">
            #{{ i + 1 }}
          </span>
        </a>
      </div>
    </AdminFormRow>
    <AdminFormRow v-else label="인용 이미지">
      <div class="flex items-center gap-2 pt-1 text-[12px] text-slate-400">
        <ImageOff class="size-4" />본문에 인용된 이미지가 없습니다. (이미지 게이트 통과)
      </div>
    </AdminFormRow>

    <!-- 2) Vision 1차 스캔 -->
    <AdminFormRow v-if="hasImages" label="Vision 1차 스캔" hint="검수 우선순위용 보조 트리아지. PII 없음으로 자동 통과시키지 않습니다(사람 판정 필수).">
      <div class="space-y-2.5">
        <button
          type="button"
          :disabled="scanning || !canScan"
          :title="canScan ? '' : 'developer 이상 권한 필요'"
          class="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          @click="runScan"
        >
          <ScanSearch class="size-4" />{{ scanning ? '스캔 중…' : 'Vision 1차 스캔 실행' }}
        </button>

        <!-- 스캔 결과 -->
        <div
          v-if="scanResult"
          class="rounded-lg border px-3 py-2.5 text-[12px]"
          :class="scanResult.imagePiiStatus === 'suspect'
            ? 'border-rose-300 bg-rose-50 text-rose-800'
            : 'border-slate-200 bg-slate-50 text-slate-600'"
        >
          <template v-if="scanResult.skipped">
            이미 사람검수로 확정된 상태입니다 — {{ scanResult.reason }}
          </template>
          <template v-else-if="scanResult.imagePiiStatus === 'suspect'">
            <p class="flex items-center gap-1.5 font-semibold">
              <AlertTriangle class="size-4" />의심(suspect) — 사람 검수 필요. 자동 통과되지 않습니다.
            </p>
            <p v-if="scanResult.signals?.length" class="mt-1">
              의심 유형: <span class="font-medium">{{ scanResult.signals.join(', ') }}</span>
              <span v-if="scanResult.regions"> · 의심 영역 {{ scanResult.regions }}곳</span>
            </p>
            <p class="mt-0.5 text-[11px] text-rose-600">유형 라벨만 표시됩니다(PII 값 미노출).</p>
          </template>
          <template v-else>
            의심 신호 없음(pending 유지). 그래도 사람 검수로 최종 판정해야 합니다 — 자동 통과 아님.
            <span v-if="typeof scanResult.scanned === 'number'"> (스캔 {{ scanResult.scanned }}/{{ scanResult.images }}건)</span>
          </template>
        </div>
        <div v-if="scanErr" class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ scanErr }}</div>
      </div>
    </AdminFormRow>

    <!-- 3) §4-A-2 검수 체크리스트 + 판정 -->
    <AdminFormRow v-if="hasImages" label="검수 체크리스트" hint="값 전사 금지 — 유형·위치만 확인합니다.">
      <div class="space-y-3">
        <!-- 체크 의미 안내 -->
        <div class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
          <Eye class="mt-0.5 size-4 shrink-0 text-slate-400" />
          <p class="leading-relaxed">
            <span class="font-semibold text-slate-700">체크 = 각 항목을 눈으로 확인했다는 표시(검토 완료)</span>입니다.
            해당 여부를 표시하는 것이 아니라, 빠짐없이 살펴봤다는 의미입니다.
            <span class="font-semibold text-slate-700">7개를 모두 확인</span>해야 아래 판정 버튼이 활성화됩니다.
          </p>
        </div>

        <!-- 위험 신호 그룹 (1~6) -->
        <div class="overflow-hidden rounded-lg border border-amber-300 bg-amber-50/60">
          <div class="flex items-center gap-1.5 border-b border-amber-200 bg-amber-100/70 px-3 py-2 text-[12px] font-semibold text-amber-800">
            <AlertTriangle class="size-4 shrink-0" />
            <span>위험 신호 — 보이면 해당 판정 (확인 후 체크)</span>
          </div>
          <ul class="space-y-1.5 p-3">
            <li v-for="(item, i) in RISK_CHECKLIST" :key="`r-${i}`" class="flex items-start gap-2">
              <input
                :id="`pii-chk-${id}-${i}`"
                v-model="checked[i]"
                type="checkbox"
                :disabled="!canReview"
                class="mt-0.5 size-3.5 rounded border-amber-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              />
              <label :for="`pii-chk-${id}-${i}`" class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[12px] leading-relaxed text-slate-700">
                <span>{{ item.text }}</span>
                <span
                  class="inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold"
                  :class="item.strong ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500'"
                >{{ item.hint }}</span>
              </label>
            </li>
          </ul>
        </div>

        <!-- 통과 조건 그룹 (7) -->
        <div class="overflow-hidden rounded-lg border border-emerald-300 bg-emerald-50/60">
          <div class="flex items-center gap-1.5 border-b border-emerald-200 bg-emerald-100/70 px-3 py-2 text-[12px] font-semibold text-emerald-800">
            <Check class="size-4 shrink-0" />
            <span>통과 조건 — 맞으면 통과 (확인 후 체크)</span>
          </div>
          <ul class="space-y-1.5 p-3">
            <li v-for="(item, j) in PASS_CHECKLIST" :key="`p-${j}`" class="flex items-start gap-2">
              <input
                :id="`pii-chk-${id}-${RISK_COUNT + j}`"
                v-model="checked[RISK_COUNT + j]"
                type="checkbox"
                :disabled="!canReview"
                class="mt-0.5 size-3.5 rounded border-emerald-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              />
              <label :for="`pii-chk-${id}-${RISK_COUNT + j}`" class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[12px] leading-relaxed text-slate-700">
                <span>{{ item.text }}</span>
                <span class="inline-flex items-center rounded bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-700">{{ item.hint }}</span>
              </label>
            </li>
          </ul>
        </div>

        <p class="text-[11px] text-slate-400">
          7개 항목을 모두 확인한 뒤 판정을 누르세요. 판정 결과·검수자는 감사 로그에 기록됩니다.
        </p>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="b in REVIEW_BTNS"
            :key="b.status"
            type="button"
            :disabled="reviewing || !canReview || !allChecked"
            :title="!canReview ? 'admin 권한 필요' : (!allChecked ? '체크리스트 전 항목 확인 필요' : b.desc)"
            class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            :class="b.cls"
            @click="doReview(b.status)"
          >
            <Check class="size-3.5" />{{ b.label }}
          </button>
        </div>

        <!-- 판정 버튼 의미 설명 -->
        <ul class="space-y-0.5 text-[11px] leading-relaxed text-slate-500">
          <li><span class="font-semibold text-emerald-700">통과(clear)</span> — PII 없음, 그대로 노출 OK</li>
          <li><span class="font-semibold text-sky-700">가림(masked)</span> — 일부 PII를 가린 처리본으로 교체 후 노출 OK</li>
          <li><span class="font-semibold text-slate-700">제거(removed)</span> — 인용 이미지만 삭제(본문 답변은 유지)</li>
          <li><span class="font-semibold text-rose-700">차단(blocked)</span> — 노출 차단(고유식별정보 등 노출 절대 불가)</li>
        </ul>

        <p v-if="!canReview" class="text-[11px] text-amber-600">
          이미지 PII 판정은 admin 권한이 필요합니다. 현재 계정은 확인만 가능합니다.
        </p>
        <p v-else-if="!allChecked" class="text-[11px] text-amber-600">
          체크리스트 전 항목을 확인해야 판정 버튼이 활성화됩니다.
        </p>
        <div v-if="reviewErr" class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ reviewErr }}</div>
      </div>
    </AdminFormRow>

    <!-- 게이트 요약 (승인 가능 여부) -->
    <AdminFormRow label="승인 게이트">
      <div class="space-y-1.5 pt-1 text-[12px]">
        <p :class="imageGateOk ? 'text-emerald-700' : 'text-rose-700'">
          <span class="font-semibold">이미지:</span>
          {{ imageGateOk
            ? '통과 (clear/removed/masked/none)'
            : '미통과 — pending/suspect/blocked 상태에서는 승인할 수 없습니다.' }}
        </p>
        <p :class="textPiiStatus === 'blocked' ? 'text-rose-700' : 'text-slate-500'">
          <span class="font-semibold">텍스트:</span>
          {{ textPiiStatus === 'blocked'
            ? '차단(blocked) — 본문에서 고유식별정보가 발견되어 승인할 수 없습니다. 마스킹 후 재시도하세요.'
            : (textPiiStatus ? `상태 ${textPiiStatus}` : '미평가 — 승인 전이 시 api가 자동 스캔합니다.') }}
        </p>
      </div>
    </AdminFormRow>
  </AdminSettingsSection>
</template>
