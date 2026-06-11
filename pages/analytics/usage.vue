<!--
  pages/analytics/usage.vue — 사용량 분석 (목업).
  실 데이터: hp_llm_log 집계 + 세션 카운트. API 신설 후 연동.
-->
<script setup lang="ts">
import { Users, MessageSquare, Zap, BarChart2 } from 'lucide-vue-next'

useHead({ title: '사용량 · 맑은도우미 Admin' })

const MOCK_KPI = {
  activeSessions: 142,
  totalMessages: 1847,
  avgMessagesPerSession: 5.8,
  apiCalls: 2103,
}

const DAILY_DATA = [
  { day: '6/5',  sessions: 18, msgs: 104 },
  { day: '6/6',  sessions: 22, msgs: 131 },
  { day: '6/7',  sessions: 15, msgs: 87  },
  { day: '6/8',  sessions: 27, msgs: 162 },
  { day: '6/9',  sessions: 24, msgs: 143 },
  { day: '6/10', sessions: 31, msgs: 186 },
  { day: '6/11', sessions: 9,  msgs: 54  },
]

const TOP_PROJECTS = [
  { name: 'STEP 온라인', calls: 847,  pct: 40 },
  { name: '범용 LMS',    calls: 592,  pct: 28 },
  { name: '민간 인증',   calls: 380,  pct: 18 },
  { name: '공공 보안',   calls: 189,  pct: 9  },
  { name: '글로벌',      calls: 95,   pct: 5  },
]

const days = ref(7)
const maxSessions = computed(() => Math.max(...DAILY_DATA.map(d => d.sessions)))
const maxMsgs     = computed(() => Math.max(...DAILY_DATA.map(d => d.msgs)))
</script>

<template>
  <div>
    <AdminPageHeader
      caption="분석·비용"
      title="사용량"
      description="일별·프로젝트별 세션 수와 메시지 건수를 모니터링합니다."
    >
      <template #actions>
        <AdminSegment
          v-model="days"
          :options="[{ value: 7, label: '7일' }, { value: 30, label: '30일' }, { value: 90, label: '90일' }]"
        />
      </template>
    </AdminPageHeader>

    <!-- API 안내 -->
    <div class="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-[12px] text-sky-800">
      <span class="font-semibold">안내</span>
      <span>사용량 집계 API 연동 후 실 데이터가 표시됩니다. 현재는 목업 지표입니다.</span>
    </div>

    <!-- KPI 4 카드 -->
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <AdminKpiCard label="활성 세션 (누적)" :value="MOCK_KPI.activeSessions.toLocaleString()" unit="건">
        <template #icon><Users class="size-3.5" /></template>
      </AdminKpiCard>
      <AdminKpiCard label="총 메시지 수" :value="MOCK_KPI.totalMessages.toLocaleString()" unit="건" value-class="text-primary-600">
        <template #icon><MessageSquare class="size-3.5" /></template>
      </AdminKpiCard>
      <AdminKpiCard label="세션당 메시지" :value="MOCK_KPI.avgMessagesPerSession.toFixed(1)" unit="건">
        <template #icon><BarChart2 class="size-3.5" /></template>
      </AdminKpiCard>
      <AdminKpiCard label="API 호출 수" :value="MOCK_KPI.apiCalls.toLocaleString()" unit="건">
        <template #icon><Zap class="size-3.5" /></template>
      </AdminKpiCard>
    </section>

    <!-- 일별 추이 (세션 + 메시지) -->
    <section class="mt-6 grid gap-6 lg:grid-cols-2">
      <!-- 세션 수 -->
      <div class="rounded-xl border border-slate-200 bg-white">
        <header class="border-b border-slate-100 px-5 py-3.5">
          <h2 class="text-[13px] font-semibold text-slate-900">일별 세션 수</h2>
        </header>
        <div class="px-5 pb-4 pt-3">
          <div class="flex items-end gap-2 h-24">
            <div v-for="d in DAILY_DATA" :key="d.day" class="flex flex-1 flex-col items-center gap-1">
              <span class="text-[10px] font-mono text-slate-500">{{ d.sessions }}</span>
              <div
                class="w-full rounded-t-sm bg-primary-400"
                :style="{ height: `${(d.sessions / maxSessions) * 70}px` }"
              />
              <span class="text-[10px] text-slate-400">{{ d.day }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 메시지 수 -->
      <div class="rounded-xl border border-slate-200 bg-white">
        <header class="border-b border-slate-100 px-5 py-3.5">
          <h2 class="text-[13px] font-semibold text-slate-900">일별 메시지 수</h2>
        </header>
        <div class="px-5 pb-4 pt-3">
          <div class="flex items-end gap-2 h-24">
            <div v-for="d in DAILY_DATA" :key="d.day" class="flex flex-1 flex-col items-center gap-1">
              <span class="text-[10px] font-mono text-slate-500">{{ d.msgs }}</span>
              <div
                class="w-full rounded-t-sm bg-violet-400"
                :style="{ height: `${(d.msgs / maxMsgs) * 70}px` }"
              />
              <span class="text-[10px] text-slate-400">{{ d.day }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 프로젝트별 사용량 -->
    <section class="mt-6 rounded-xl border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-5 py-3.5">
        <h2 class="text-[13px] font-semibold text-slate-900">프로젝트별 API 호출 비율</h2>
      </header>
      <ol class="divide-y divide-slate-100">
        <li v-for="p in TOP_PROJECTS" :key="p.name" class="flex items-center gap-3 px-5 py-3">
          <span class="w-32 truncate text-[12px] font-medium text-slate-700">{{ p.name }}</span>
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-primary-500"
              :style="{ width: p.pct + '%' }"
            />
          </div>
          <span class="w-12 text-right font-mono text-[12px] tabular-nums text-slate-600">{{ p.pct }}%</span>
          <span class="w-16 text-right font-mono text-[11px] tabular-nums text-slate-400">{{ p.calls.toLocaleString() }}건</span>
        </li>
      </ol>
    </section>
  </div>
</template>
