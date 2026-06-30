<!--
  pages/settings/safety.vue — 안전가드 설정.
  API: GET /settings/safety · PUT /settings/safety  (hp_setting group=safety)
  setting_key: confidence_threshold(number) · escalate_on_low(bool) · pii_masking(bool)
    · pii_patterns(json[]) · blocked_words(json[])
-->
<script setup lang="ts">
import { ShieldAlert, X, Plus, CheckCircle } from 'lucide-vue-next'

useHead({ title: '안전가드 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

const meSession = useAuthUser()
const isAdmin = computed(() => (meSession.value?.level ?? 0) >= 9)

const form = reactive({
  confidence_threshold: 0.6,
  escalate_on_low:      true,
  pii_masking:          true,
  pii_patterns:         [] as string[],
  blocked_words:        [] as string[],
  newPiiPattern:        '',
  newBlockedWord:       '',
})

const pending = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const saveErr = ref<string | null>(null)
const saved = ref(false)

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function applySettings(s: Record<string, unknown>) {
  if (typeof s.confidence_threshold === 'number') form.confidence_threshold = s.confidence_threshold
  if (typeof s.escalate_on_low === 'boolean') form.escalate_on_low = s.escalate_on_low
  if (typeof s.pii_masking === 'boolean') form.pii_masking = s.pii_masking
  if (s.pii_patterns !== undefined) form.pii_patterns = toStringArray(s.pii_patterns)
  if (s.blocked_words !== undefined) form.blocked_words = toStringArray(s.blocked_words)
}

async function load() {
  pending.value = true
  error.value = null
  try {
    const res = await apiFetch(`${API_BASE}/settings/safety`, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) throw new Error(res.status === 403 ? '설정 조회 권한이 없습니다.' : `API ${res.status}`)
    const data = (await res.json()) as { settings: Record<string, unknown> }
    applySettings(data.settings ?? {})
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    pending.value = false
  }
}
onMounted(load)

function removePii(i: number) { form.pii_patterns.splice(i, 1) }
function addPii() {
  const p = form.newPiiPattern.trim()
  if (p && !form.pii_patterns.includes(p)) form.pii_patterns.push(p)
  form.newPiiPattern = ''
}
function removeWord(i: number) { form.blocked_words.splice(i, 1) }
function addWord() {
  const w = form.newBlockedWord.trim()
  if (w && !form.blocked_words.includes(w)) form.blocked_words.push(w)
  form.newBlockedWord = ''
}

const thresholdPct = computed(() => Math.round(form.confidence_threshold * 100))

async function save() {
  if (!isAdmin.value) return
  saving.value = true
  saveErr.value = null
  saved.value = false
  try {
    const settings = {
      confidence_threshold: Number(form.confidence_threshold),
      escalate_on_low: form.escalate_on_low,
      pii_masking: form.pii_masking,
      pii_patterns: [...form.pii_patterns],
      blocked_words: [...form.blocked_words],
    }
    const res = await apiFetch(`${API_BASE}/settings/safety`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    })
    if (!res.ok) {
      if (res.status === 403) throw new Error('admin 권한이 필요합니다.')
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `API ${res.status}`)
    }
    const data = (await res.json()) as { settings: Record<string, unknown> }
    applySettings(data.settings ?? {})
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e) {
    saveErr.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

const inputCls = 'h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500'
</script>

<template>
  <div>
    <AdminPageHeader
      caption="설정"
      title="안전가드"
      description="응답 신뢰도 임계값, PII 마스킹 규칙, 차단어 목록을 관리합니다."
    >
      <template #actions>
        <div class="flex items-center gap-2.5">
          <Transition enter-from-class="opacity-0" enter-active-class="transition" leave-active-class="transition" leave-to-class="opacity-0">
            <span v-if="saved" class="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600">
              <CheckCircle class="size-3.5" />저장되었습니다.
            </span>
          </Transition>
          <button
            type="button"
            :disabled="!isAdmin || pending || saving"
            :title="isAdmin ? '설정 저장' : 'admin 권한 필요'"
            class="rounded-md px-4 py-2 text-[13px] font-semibold transition"
            :class="isAdmin
              ? 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60'
              : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'"
            @click="save"
          >{{ saving ? '저장 중…' : '저장' }}</button>
        </div>
      </template>
    </AdminPageHeader>

    <div v-if="error" class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] text-rose-700">
      설정을 불러오지 못했습니다 — {{ error }}
    </div>
    <div v-if="saveErr" class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] text-rose-700">
      {{ saveErr }}
    </div>
    <p v-if="!isAdmin && !pending" class="mb-4 text-[11px] text-slate-400">설정 변경은 admin 권한이 필요합니다. 현재 계정은 조회만 가능합니다.</p>

    <div v-if="pending" class="rounded-xl border border-slate-200 bg-white px-5 py-16 text-center text-[13px] text-slate-400">
      설정을 불러오는 중…
    </div>

    <div v-else class="space-y-6" :class="isAdmin ? '' : 'pointer-events-none opacity-70'">
      <!-- 신뢰도 임계값 -->
      <AdminSettingsSection
        title="응답 신뢰도 임계값"
        description="RAG 검색 결과의 cosine similarity 가 임계값 미만이면 에스컬레이션 처리합니다."
      >
        <AdminFormRow label="임계값" :hint="`현재: ${thresholdPct}%`">
          <div class="flex items-center gap-3">
            <input
              v-model.number="form.confidence_threshold"
              type="range" min="0" max="1" step="0.05"
              class="flex-1 accent-primary-600"
            />
            <span class="w-11 rounded-md bg-primary-50 px-2 py-0.5 text-center font-mono text-[13px] font-semibold text-primary-700">
              {{ thresholdPct }}%
            </span>
          </div>
        </AdminFormRow>
        <AdminFormRow label="저신뢰 자동 에스컬레이션">
          <label class="inline-flex cursor-pointer items-center gap-2">
            <div
              class="relative h-5 w-9 rounded-full transition"
              :class="form.escalate_on_low ? 'bg-primary-500' : 'bg-slate-300'"
              @click="form.escalate_on_low = !form.escalate_on_low"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                :class="form.escalate_on_low ? 'left-4' : 'left-0.5'"
              />
            </div>
            <span class="text-[12px]" :class="form.escalate_on_low ? 'text-primary-700' : 'text-slate-500'">
              {{ form.escalate_on_low ? '활성화 됨' : '비활성화' }}
            </span>
          </label>
        </AdminFormRow>
      </AdminSettingsSection>

      <!-- PII 마스킹 -->
      <AdminSettingsSection
        title="PII 마스킹"
        description="응답에서 개인정보 패턴이 감지되면 자동으로 *** 처리합니다."
      >
        <AdminFormRow label="마스킹 활성화">
          <label class="inline-flex cursor-pointer items-center gap-2">
            <div
              class="relative h-5 w-9 rounded-full transition"
              :class="form.pii_masking ? 'bg-primary-500' : 'bg-slate-300'"
              @click="form.pii_masking = !form.pii_masking"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                :class="form.pii_masking ? 'left-4' : 'left-0.5'"
              />
            </div>
            <span class="text-[12px]" :class="form.pii_masking ? 'text-primary-700' : 'text-slate-500'">
              {{ form.pii_masking ? '활성화 됨' : '비활성화' }}
            </span>
          </label>
        </AdminFormRow>

        <AdminFormRow label="정규식 패턴 목록">
          <div class="space-y-1.5">
            <div
              v-for="(pat, i) in form.pii_patterns"
              :key="i"
              class="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
            >
              <code class="flex-1 truncate font-mono text-[11px] text-slate-700">{{ pat }}</code>
              <button type="button" class="text-slate-400 hover:text-rose-500" @click="removePii(i)">
                <X class="size-3.5" />
              </button>
            </div>
            <p v-if="!form.pii_patterns.length" class="text-[12px] text-slate-400">등록된 패턴 없음</p>
            <div class="flex items-center gap-2">
              <input
                v-model="form.newPiiPattern"
                type="text"
                placeholder="새 정규식 입력..."
                :class="inputCls"
                @keydown.enter.prevent="addPii"
              />
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-200"
                @click="addPii"
              ><Plus class="size-3.5" />추가</button>
            </div>
          </div>
        </AdminFormRow>
      </AdminSettingsSection>

      <!-- 차단어 -->
      <AdminSettingsSection
        title="차단어 목록"
        description="응답에 차단어가 포함되면 필터링하거나 에스컬레이션합니다."
      >
        <AdminFormRow label="차단어">
          <div class="space-y-2">
            <div class="flex flex-wrap gap-1.5 min-h-[28px]">
              <span
                v-for="(w, i) in form.blocked_words"
                :key="i"
                class="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
              >
                {{ w }}
                <button type="button" class="text-rose-400 hover:text-rose-700" @click="removeWord(i)">
                  <X class="size-3" />
                </button>
              </span>
              <span v-if="!form.blocked_words.length" class="text-[12px] text-slate-400">차단어 없음</span>
            </div>
            <div class="flex items-center gap-2">
              <input
                v-model="form.newBlockedWord"
                type="text"
                placeholder="차단어 추가..."
                :class="inputCls"
                @keydown.enter.prevent="addWord"
              />
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-200"
                @click="addWord"
              ><Plus class="size-3.5" />추가</button>
            </div>
          </div>
        </AdminFormRow>
      </AdminSettingsSection>

      <!-- 안내 -->
      <div class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-600">
        <ShieldAlert class="mt-0.5 size-4 shrink-0 text-slate-400" />
        <p>변경 후 <span class="font-semibold">저장</span> 버튼을 눌러야 적용됩니다. 저장하지 않은 변경사항은 새로고침 시 초기화됩니다.</p>
      </div>
    </div>
  </div>
</template>
