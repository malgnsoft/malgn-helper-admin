<!--
  pages/settings/ai.vue — AI 설정 (목업 폼).
  실 저장: hp_setting 테이블 + /settings/* API 미구현. 저장 버튼 비활성.
-->
<script setup lang="ts">
useHead({ title: 'AI 설정 · 맑은도우미 Admin' })

const TABS = [
  { value: 'chat',   label: '챗봇 시스템 프롬프트' },
  { value: 'eval',   label: '평가 프롬프트' },
  { value: 'suggest', label: '추천 프롬프트' },
]

const form = reactive({
  chatModel:    'openai/gpt-4.1-mini',
  visionModel:  'openai/gpt-4.1-mini',
  temperature:  '0.3',
  maxTokens:    '2048',
  timeout:      '30',
  cacheTtl:     '86400',
  promptTab: 'chat',
  chatPrompt:   '당신은 맑은소프트 솔루션 전문 고객상담 AI입니다. 제공된 문서와 표준답변만 근거로 답변하고, 확인되지 않은 정보는 "모름"으로 처리하세요. 항상 한국어로 응답합니다.',
  evalPrompt:   '주어진 상담 응답을 5개 축(정확성·완전성·가독성·공감·준수)으로 1-5점 채점하세요.',
  suggestPrompt: '상담사가 고객 문의에 답하기 위한 최적의 표준답변과 참고 자료를 추천하세요.',
})

const MODEL_OPTS = [
  { value: 'openai/gpt-4.1-mini',  label: 'GPT-4.1 mini (기본)' },
  { value: 'openai/gpt-4.1',       label: 'GPT-4.1' },
  { value: 'openai/gpt-4o',        label: 'GPT-4o' },
  { value: 'anthropic/claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
]

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
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-400">설정 저장 API 보강 예정</span>
          <button
            type="button"
            disabled
            title="hp_setting API 보강 후 활성화"
            class="cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-[13px] font-semibold text-slate-400"
          >
            저장 (준비 중)
          </button>
        </div>
      </template>
    </AdminPageHeader>

    <div class="space-y-6">
      <!-- 모델 설정 -->
      <AdminSettingsSection title="기본 모델" description="LLM 호출에 사용할 모델을 지정합니다. AI Gateway: malgn-helper2.">
        <AdminFormRow label="Chat 모델" hint="챗봇 응답 생성에 사용">
          <select v-model="form.chatModel" :class="selectCls">
            <option v-for="m in MODEL_OPTS" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </AdminFormRow>
        <AdminFormRow label="Vision 모델" hint="이미지 캡션 생성에 사용">
          <select v-model="form.visionModel" :class="selectCls">
            <option v-for="m in MODEL_OPTS" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </AdminFormRow>
      </AdminSettingsSection>

      <!-- 파라미터 -->
      <AdminSettingsSection title="호출 파라미터">
        <AdminFormRow label="temperature" hint="0.0 – 1.0, 낮을수록 결정적">
          <input v-model="form.temperature" type="number" min="0" max="1" step="0.1" :class="inputCls" />
        </AdminFormRow>
        <AdminFormRow label="max_tokens" hint="응답 최대 토큰 수">
          <input v-model="form.maxTokens" type="number" :class="inputCls" />
        </AdminFormRow>
        <AdminFormRow label="timeout (초)" hint="API 호출 제한 시간">
          <input v-model="form.timeout" type="number" :class="inputCls" />
        </AdminFormRow>
        <AdminFormRow label="캐시 TTL (초)" hint="동일 입력 캐시 유지 시간 (기본 86400 = 24h)">
          <input v-model="form.cacheTtl" type="number" :class="inputCls" />
        </AdminFormRow>
      </AdminSettingsSection>

      <!-- 시스템 프롬프트 -->
      <AdminSettingsSection title="시스템 프롬프트" description="용도별 프롬프트를 탭으로 관리합니다.">
        <!-- 탭 -->
        <div class="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <button
            v-for="t in TABS"
            :key="t.value"
            type="button"
            class="rounded-md px-3 py-1.5 text-[12px] font-medium transition"
            :class="form.promptTab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
            @click="form.promptTab = t.value"
          >{{ t.label }}</button>
        </div>

        <textarea
          v-if="form.promptTab === 'chat'"
          v-model="form.chatPrompt"
          rows="6"
          class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <textarea
          v-else-if="form.promptTab === 'eval'"
          v-model="form.evalPrompt"
          rows="4"
          class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <textarea
          v-else
          v-model="form.suggestPrompt"
          rows="4"
          class="w-full resize-y rounded-md bg-slate-50 px-3 py-2 font-mono text-[12px] leading-relaxed ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </AdminSettingsSection>
    </div>
  </div>
</template>
