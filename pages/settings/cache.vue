<!--
  pages/settings/cache.vue — 캐싱 설정.
  API: GET /settings/cache · PUT /settings/cache  (hp_setting group=cache)
  setting_key: enabled(bool) · ttl_sec(number) · max_entries(number) · strategy(string)
    · invalidate_on_standard_answer_update · invalidate_on_material_update · invalidate_on_prompt_update (bool)
-->
<script setup lang="ts">
import { CheckCircle } from 'lucide-vue-next'

useHead({ title: '캐싱 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

const meSession = useAuthUser()
const isAdmin = computed(() => (meSession.value?.level ?? 0) >= 9)

const form = reactive({
  enabled:    true,
  ttl_sec:    86400,
  max_entries: 5000,
  strategy:   'lru' as 'lru' | 'lfu',
  invalidate_on_standard_answer_update: true,
  invalidate_on_material_update:        true,
  invalidate_on_prompt_update:          false,
})

const pending = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)
const saveErr = ref<string | null>(null)
const saved = ref(false)

function applySettings(s: Record<string, unknown>) {
  if (typeof s.enabled === 'boolean') form.enabled = s.enabled
  if (typeof s.ttl_sec === 'number') form.ttl_sec = s.ttl_sec
  if (typeof s.max_entries === 'number') form.max_entries = s.max_entries
  if (s.strategy === 'lru' || s.strategy === 'lfu') form.strategy = s.strategy
  if (typeof s.invalidate_on_standard_answer_update === 'boolean') form.invalidate_on_standard_answer_update = s.invalidate_on_standard_answer_update
  if (typeof s.invalidate_on_material_update === 'boolean') form.invalidate_on_material_update = s.invalidate_on_material_update
  if (typeof s.invalidate_on_prompt_update === 'boolean') form.invalidate_on_prompt_update = s.invalidate_on_prompt_update
}

async function load() {
  pending.value = true
  error.value = null
  try {
    const res = await fetch(`${API_BASE}/settings/cache`, { credentials: 'include', cache: 'no-store' })
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
      enabled: form.enabled,
      ttl_sec: Number(form.ttl_sec),
      max_entries: Number(form.max_entries),
      strategy: form.strategy,
      invalidate_on_standard_answer_update: form.invalidate_on_standard_answer_update,
      invalidate_on_material_update: form.invalidate_on_material_update,
      invalidate_on_prompt_update: form.invalidate_on_prompt_update,
    }
    const res = await fetch(`${API_BASE}/settings/cache`, {
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

const STRATEGY_OPTS = [
  { value: 'lru', label: 'LRU (Least Recently Used)' },
  { value: 'lfu', label: 'LFU (Least Frequently Used)' },
]

const ttlDisplay = computed(() => {
  const s = form.ttl_sec
  if (s >= 86400) return `${(s / 86400).toFixed(s % 86400 === 0 ? 0 : 1)}일 (${s.toLocaleString()}초)`
  if (s >= 3600)  return `${(s / 3600).toFixed(s % 3600 === 0 ? 0 : 1)}시간 (${s.toLocaleString()}초)`
  return `${s.toLocaleString()}초`
})

const inputCls = 'h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500'
const selectCls = 'h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'

const toggles: { key: 'invalidate_on_standard_answer_update' | 'invalidate_on_material_update' | 'invalidate_on_prompt_update'; label: string }[] = [
  { key: 'invalidate_on_standard_answer_update', label: '표준답변 업데이트 시' },
  { key: 'invalidate_on_material_update',        label: '자료(RAG) 업데이트 시' },
  { key: 'invalidate_on_prompt_update',          label: '시스템 프롬프트 변경 시' },
]
</script>

<template>
  <div>
    <AdminPageHeader
      caption="설정"
      title="캐싱"
      description="llm_input_hash 기반 응답 캐시 TTL과 무효화 규칙을 설정합니다."
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
      <!-- 기본 설정 -->
      <AdminSettingsSection title="기본 설정">
        <AdminFormRow label="캐싱 활성화">
          <label class="inline-flex cursor-pointer items-center gap-2">
            <div
              class="relative h-5 w-9 rounded-full transition"
              :class="form.enabled ? 'bg-primary-500' : 'bg-slate-300'"
              @click="form.enabled = !form.enabled"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                :class="form.enabled ? 'left-4' : 'left-0.5'"
              />
            </div>
            <span class="text-[12px]" :class="form.enabled ? 'text-primary-700' : 'text-slate-500'">
              {{ form.enabled ? '활성화 됨' : '비활성화' }}
            </span>
          </label>
        </AdminFormRow>
        <AdminFormRow label="TTL (초)" :hint="ttlDisplay">
          <input v-model.number="form.ttl_sec" type="number" min="60" :class="inputCls" />
        </AdminFormRow>
        <AdminFormRow label="최대 엔트리 수" hint="초과 시 eviction 전략 적용">
          <input v-model.number="form.max_entries" type="number" :class="inputCls" />
        </AdminFormRow>
        <AdminFormRow label="Eviction 전략">
          <select v-model="form.strategy" :class="selectCls">
            <option v-for="s in STRATEGY_OPTS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </AdminFormRow>
      </AdminSettingsSection>

      <!-- 자동 무효화 -->
      <AdminSettingsSection
        title="자동 무효화 트리거"
        description="아래 이벤트 발생 시 관련 캐시 엔트리를 자동으로 삭제합니다."
      >
        <AdminFormRow v-for="t in toggles" :key="t.key" :label="t.label">
          <label class="inline-flex cursor-pointer items-center gap-2">
            <div
              class="relative h-5 w-9 rounded-full transition"
              :class="form[t.key] ? 'bg-primary-500' : 'bg-slate-300'"
              @click="form[t.key] = !form[t.key]"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                :class="form[t.key] ? 'left-4' : 'left-0.5'"
              />
            </div>
            <span class="text-[12px]" :class="form[t.key] ? 'text-primary-700' : 'text-slate-500'">
              {{ form[t.key] ? '활성' : '비활성' }}
            </span>
          </label>
        </AdminFormRow>
      </AdminSettingsSection>
    </div>
  </div>
</template>
