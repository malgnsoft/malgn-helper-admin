<!--
  pages/settings/safety.vue — 안전가드 설정 (목업 폼).
  신뢰도 임계값·PII 마스킹·차단어. 저장 API 보강 예정.
-->
<script setup lang="ts">
import { ShieldAlert, X, Plus } from 'lucide-vue-next'

useHead({ title: '안전가드 · 맑은도우미 Admin' })

const form = reactive({
  confidenceThreshold: 0.6,
  escalateOnLow:       true,
  piiMasking:          true,
  piiPatterns: [
    '\\d{6}-[1-4]\\d{6}',
    '\\d{3}-\\d{3,4}-\\d{4}',
    '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
  ],
  blockedWords: ['비방', '욕설', '스팸', '광고'],
  newPiiPattern: '',
  newBlockedWord: '',
})

function removePii(i: number) { form.piiPatterns.splice(i, 1) }
function addPii() {
  const p = form.newPiiPattern.trim()
  if (p && !form.piiPatterns.includes(p)) form.piiPatterns.push(p)
  form.newPiiPattern = ''
}
function removeWord(i: number) { form.blockedWords.splice(i, 1) }
function addWord() {
  const w = form.newBlockedWord.trim()
  if (w && !form.blockedWords.includes(w)) form.blockedWords.push(w)
  form.newBlockedWord = ''
}

const thresholdPct = computed(() => Math.round(form.confidenceThreshold * 100))

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

    <div class="space-y-6">
      <!-- 신뢰도 임계값 -->
      <AdminSettingsSection
        title="응답 신뢰도 임계값"
        description="RAG 검색 결과의 cosine similarity 가 임계값 미만이면 에스컬레이션 처리합니다."
      >
        <AdminFormRow label="임계값" :hint="`현재: ${thresholdPct}%`">
          <div class="flex items-center gap-3">
            <input
              v-model.number="form.confidenceThreshold"
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
              :class="form.escalateOnLow ? 'bg-primary-500' : 'bg-slate-300'"
              @click="form.escalateOnLow = !form.escalateOnLow"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                :class="form.escalateOnLow ? 'left-4' : 'left-0.5'"
              />
            </div>
            <span class="text-[12px]" :class="form.escalateOnLow ? 'text-primary-700' : 'text-slate-500'">
              {{ form.escalateOnLow ? '활성화 됨' : '비활성화' }}
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
              :class="form.piiMasking ? 'bg-primary-500' : 'bg-slate-300'"
              @click="form.piiMasking = !form.piiMasking"
            >
              <span
                class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
                :class="form.piiMasking ? 'left-4' : 'left-0.5'"
              />
            </div>
            <span class="text-[12px]" :class="form.piiMasking ? 'text-primary-700' : 'text-slate-500'">
              {{ form.piiMasking ? '활성화 됨' : '비활성화' }}
            </span>
          </label>
        </AdminFormRow>

        <AdminFormRow label="정규식 패턴 목록">
          <div class="space-y-1.5">
            <div
              v-for="(pat, i) in form.piiPatterns"
              :key="i"
              class="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
            >
              <code class="flex-1 truncate font-mono text-[11px] text-slate-700">{{ pat }}</code>
              <button type="button" class="text-slate-400 hover:text-rose-500" @click="removePii(i)">
                <X class="size-3.5" />
              </button>
            </div>
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
                v-for="(w, i) in form.blockedWords"
                :key="i"
                class="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
              >
                {{ w }}
                <button type="button" class="text-rose-400 hover:text-rose-700" @click="removeWord(i)">
                  <X class="size-3" />
                </button>
              </span>
              <span v-if="!form.blockedWords.length" class="text-[12px] text-slate-400">차단어 없음</span>
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

      <!-- 안내 배너 -->
      <div class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
        <ShieldAlert class="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div>
          <p class="font-semibold">저장 비활성화 안내</p>
          <p class="mt-0.5 text-amber-700">hp_safety_config 테이블과 <code class="font-mono">/settings/safety</code> API 보강 후 실 저장이 가능합니다. 현재 변경사항은 새로고침 시 초기화됩니다.</p>
        </div>
      </div>
    </div>
  </div>
</template>
