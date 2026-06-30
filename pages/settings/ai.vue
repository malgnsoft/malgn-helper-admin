<!--
  pages/settings/ai.vue — AI 설정.
  API: GET /settings/ai · PUT /settings/ai  (hp_setting group=ai)
  setting_key(snake_case): chat_model · vision_model · temperature · max_tokens
    · timeout_sec · cache_ttl_sec · chat_prompt · eval_prompt · suggest_prompt
-->
<script setup lang="ts">
import { CheckCircle } from 'lucide-vue-next'

useHead({ title: 'AI 설정 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

const meSession = useAuthUser()
const isAdmin = computed(() => (meSession.value?.level ?? 0) >= 9)

const TABS = [
  { value: 'chat',    label: '챗봇 시스템 프롬프트' },
  { value: 'eval',    label: '평가 프롬프트' },
  { value: 'suggest', label: '추천 프롬프트' },
] as const

const form = reactive({
  chat_model:     'openai/gpt-4.1-mini',
  vision_model:   'openai/gpt-4.1-mini',
  temperature:    0.3,
  max_tokens:     2048,
  timeout_sec:    30,
  cache_ttl_sec:  86400,
  chat_prompt:    '',
  eval_prompt:    '',
  suggest_prompt: '',
})
const promptTab = ref<typeof TABS[number]['value']>('chat')

const MODEL_OPTS = [
  { value: 'openai/gpt-4.1-mini',          label: 'GPT-4.1 mini (기본)' },
  { value: 'openai/gpt-4.1',               label: 'GPT-4.1' },
  { value: 'openai/gpt-4o',                label: 'GPT-4o' },
  { value: 'anthropic/claude-3-5-sonnet',  label: 'Claude 3.5 Sonnet' },
]

const pending = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const saveErr = ref<string | null>(null)
const saved = ref(false)

function applySettings(s: Record<string, unknown>) {
  if (typeof s.chat_model === 'string') form.chat_model = s.chat_model
  if (typeof s.vision_model === 'string') form.vision_model = s.vision_model
  if (typeof s.temperature === 'number') form.temperature = s.temperature
  if (typeof s.max_tokens === 'number') form.max_tokens = s.max_tokens
  if (typeof s.timeout_sec === 'number') form.timeout_sec = s.timeout_sec
  if (typeof s.cache_ttl_sec === 'number') form.cache_ttl_sec = s.cache_ttl_sec
  if (typeof s.chat_prompt === 'string') form.chat_prompt = s.chat_prompt
  if (typeof s.eval_prompt === 'string') form.eval_prompt = s.eval_prompt
  if (typeof s.suggest_prompt === 'string') form.suggest_prompt = s.suggest_prompt
}

async function load() {
  pending.value = true
  error.value = null
  try {
    const res = await apiFetch(`${API_BASE}/settings/ai`, { credentials: 'include', cache: 'no-store' })
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

async function save() {
  if (!isAdmin.value) return
  saving.value = true
  saveErr.value = null
  saved.value = false
  try {
    const settings = {
      chat_model: form.chat_model,
      vision_model: form.vision_model,
      temperature: Number(form.temperature),
      max_tokens: Number(form.max_tokens),
      timeout_sec: Number(form.timeout_sec),
      cache_ttl_sec: Number(form.cache_ttl_sec),
      chat_prompt: form.chat_prompt,
      eval_prompt: form.eval_prompt,
      suggest_prompt: form.suggest_prompt,
    }
    const res = await apiFetch(`${API_BASE}/settings/ai`, {
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
const selectCls = 'h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'
</script>

<template>
  <div>
    <AdminPageHeader
      caption="설정"
      title="AI 설정"
      description="LLM 모델·파라미터·시스템 프롬프트를 구성합니다."
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
      <!-- 모델 설정 -->
      <AdminSettingsSection title="기본 모델" description="LLM 호출에 사용할 모델을 지정합니다. AI Gateway: malgn-helper2.">
        <AdminFormRow label="Chat 모델" hint="챗봇 응답 생성에 사용">
          <select v-model="form.chat_model" :class="selectCls">
            <option v-for="m in MODEL_OPTS" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </AdminFormRow>
        <AdminFormRow label="Vision 모델" hint="이미지 캡션 생성에 사용">
          <select v-model="form.vision_model" :class="selectCls">
            <option v-for="m in MODEL_OPTS" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </AdminFormRow>
      </AdminSettingsSection>

      <!-- 파라미터 -->
      <AdminSettingsSection title="호출 파라미터">
        <AdminFormRow label="temperature" hint="0.0 – 1.0, 낮을수록 결정적">
          <input v-model.number="form.temperature" type="number" min="0" max="1" step="0.1" :class="inputCls" />
        </AdminFormRow>
        <AdminFormRow label="max_tokens" hint="응답 최대 토큰 수">
          <input v-model.number="form.max_tokens" type="number" :class="inputCls" />
        </AdminFormRow>
        <AdminFormRow label="timeout (초)" hint="API 호출 제한 시간">
          <input v-model.number="form.timeout_sec" type="number" :class="inputCls" />
        </AdminFormRow>
        <AdminFormRow label="캐시 TTL (초)" hint="동일 입력 캐시 유지 시간 (기본 86400 = 24h)">
          <input v-model.number="form.cache_ttl_sec" type="number" :class="inputCls" />
        </AdminFormRow>
      </AdminSettingsSection>

      <!-- 시스템 프롬프트 -->
      <AdminSettingsSection title="시스템 프롬프트" description="용도별 프롬프트를 탭으로 관리합니다.">
        <div class="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <button
            v-for="t in TABS"
            :key="t.value"
            type="button"
            class="rounded-md px-3 py-1.5 text-[12px] font-medium transition"
            :class="promptTab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
            @click="promptTab = t.value"
          >{{ t.label }}</button>
        </div>

        <textarea
          v-if="promptTab === 'chat'"
          v-model="form.chat_prompt"
          rows="6"
          class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <textarea
          v-else-if="promptTab === 'eval'"
          v-model="form.eval_prompt"
          rows="4"
          class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <textarea
          v-else
          v-model="form.suggest_prompt"
          rows="4"
          class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </AdminSettingsSection>
    </div>
  </div>
</template>
