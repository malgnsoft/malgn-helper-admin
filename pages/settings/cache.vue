<!--
  pages/settings/cache.vue — 캐싱 설정 (목업 폼).
  llm_input_hash 기반 응답 캐시 TTL·무효화 규칙·수동 캐시 클리어.
  저장 및 클리어 API 보강 예정.
-->
<script setup lang="ts">
import { Database, Trash2, RefreshCw, CheckCircle } from 'lucide-vue-next'

useHead({ title: '캐싱 · 맑은도우미 Admin' })

const form = reactive({
  enabled:     true,
  ttl:         86400,
  maxEntries:  5000,
  strategy:    'lru' as 'lru' | 'lfu',
  invalidateOnStandardAnswerUpdate: true,
  invalidateOnMaterialUpdate:       true,
  invalidateOnPromptUpdate:         false,
})

const clearing   = ref(false)
const clearDone  = ref(false)

async function simulateClear() {
  clearing.value  = true
  clearDone.value = false
  await new Promise(r => setTimeout(r, 1200))
  clearing.value  = false
  clearDone.value = true
  setTimeout(() => { clearDone.value = false }, 3000)
}

const STRATEGY_OPTS = [
  { value: 'lru', label: 'LRU (Least Recently Used)' },
  { value: 'lfu', label: 'LFU (Least Frequently Used)' },
]

const ttlDisplay = computed(() => {
  const s = form.ttl
  if (s >= 86400) return `${s / 86400}일 (${s.toLocaleString()}초)`
  if (s >= 3600)  return `${s / 3600}시간 (${s.toLocaleString()}초)`
  return `${s.toLocaleString()}초`
})

const inputCls = 'h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500'
const selectCls = 'h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'
</script>

<template>
  <div>
    <AdminPageHeader
      caption="설정"
      title="캐싱"
      description="llm_input_hash 기반 응답 캐시 TTL과 무효화 규칙을 설정합니다."
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-400">설정 저장 API 보강 예정</span>
          <button
            type="button"
            disabled
            class="cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-400"
          >저장 (준비 중)</button>
        </div>
      </template>
    </AdminPageHeader>

    <!-- 현재 캐시 통계 (목업) -->
    <div class="mb-6 grid grid-cols-3 gap-3">
      <div class="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">캐시 엔트리</p>
        <p class="mt-1 font-mono text-[22px] font-bold text-slate-900">2,847</p>
        <p class="mt-1 text-[11px] text-slate-400">/ {{ form.maxEntries.toLocaleString() }} 최대</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">히트율 (7일)</p>
        <p class="mt-1 font-mono text-[22px] font-bold text-emerald-600">68.4%</p>
        <p class="mt-1 text-[11px] text-slate-400">절감 비용 추정 ₩12,400</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">평균 TTL 잔여</p>
        <p class="mt-1 font-mono text-[22px] font-bold text-slate-900">14.3h</p>
        <p class="mt-1 text-[11px] text-slate-400">전체 엔트리 평균</p>
      </div>
    </div>

    <div class="space-y-6">
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
          <input v-model.number="form.ttl" type="number" min="60" :class="inputCls" />
        </AdminFormRow>
        <AdminFormRow label="최대 엔트리 수" hint="초과 시 eviction 전략 적용">
          <input v-model.number="form.maxEntries" type="number" :class="inputCls" />
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
        <AdminFormRow label="표준답변 업데이트 시">
          <label class="inline-flex cursor-pointer items-center gap-2">
            <div
              class="relative h-5 w-9 rounded-full transition"
              :class="form.invalidateOnStandardAnswerUpdate ? 'bg-primary-500' : 'bg-slate-300'"
              @click="form.invalidateOnStandardAnswerUpdate = !form.invalidateOnStandardAnswerUpdate"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                :class="form.invalidateOnStandardAnswerUpdate ? 'left-4' : 'left-0.5'"
              />
            </div>
            <span class="text-[12px]" :class="form.invalidateOnStandardAnswerUpdate ? 'text-primary-700' : 'text-slate-500'">
              {{ form.invalidateOnStandardAnswerUpdate ? '활성' : '비활성' }}
            </span>
          </label>
        </AdminFormRow>
        <AdminFormRow label="자료(RAG) 업데이트 시">
          <label class="inline-flex cursor-pointer items-center gap-2">
            <div
              class="relative h-5 w-9 rounded-full transition"
              :class="form.invalidateOnMaterialUpdate ? 'bg-primary-500' : 'bg-slate-300'"
              @click="form.invalidateOnMaterialUpdate = !form.invalidateOnMaterialUpdate"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                :class="form.invalidateOnMaterialUpdate ? 'left-4' : 'left-0.5'"
              />
            </div>
            <span class="text-[12px]" :class="form.invalidateOnMaterialUpdate ? 'text-primary-700' : 'text-slate-500'">
              {{ form.invalidateOnMaterialUpdate ? '활성' : '비활성' }}
            </span>
          </label>
        </AdminFormRow>
        <AdminFormRow label="시스템 프롬프트 변경 시">
          <label class="inline-flex cursor-pointer items-center gap-2">
            <div
              class="relative h-5 w-9 rounded-full transition"
              :class="form.invalidateOnPromptUpdate ? 'bg-primary-500' : 'bg-slate-300'"
              @click="form.invalidateOnPromptUpdate = !form.invalidateOnPromptUpdate"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                :class="form.invalidateOnPromptUpdate ? 'left-4' : 'left-0.5'"
              />
            </div>
            <span class="text-[12px]" :class="form.invalidateOnPromptUpdate ? 'text-primary-700' : 'text-slate-500'">
              {{ form.invalidateOnPromptUpdate ? '활성' : '비활성' }}
            </span>
          </label>
        </AdminFormRow>
      </AdminSettingsSection>

      <!-- 수동 캐시 클리어 -->
      <AdminSettingsSection
        title="수동 캐시 클리어"
        description="전체 캐시를 즉시 삭제합니다. 일시적으로 응답 속도가 느려질 수 있습니다."
      >
        <div class="flex items-center gap-3">
          <button
            type="button"
            :disabled="clearing"
            class="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            @click="simulateClear"
          >
            <RefreshCw class="size-3.5" :class="clearing ? 'animate-spin' : ''" />
            {{ clearing ? '클리어 중...' : '전체 캐시 클리어' }}
          </button>
          <Transition enter-from-class="opacity-0 scale-95" enter-active-class="transition duration-150" leave-active-class="transition duration-150" leave-to-class="opacity-0 scale-95">
            <span v-if="clearDone" class="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600">
              <CheckCircle class="size-3.5" />캐시가 클리어되었습니다.
            </span>
          </Transition>
        </div>
        <p class="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <Database class="size-3" />
          실제 클리어는 <code class="font-mono">DELETE /settings/cache</code> API 보강 후 활성화됩니다. 현재는 UI 시뮬레이션입니다.
        </p>
      </AdminSettingsSection>
    </div>
  </div>
</template>
