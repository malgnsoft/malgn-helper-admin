<!--
  pages/analytics/quality.vue — 응답 품질 분석 (목업).
  실 데이터: hp_qa_eval 집계. 별도 엔드포인트 신설 후 연동.
-->
<script setup lang="ts">
import { TrendingUp, Star, ThumbsUp, AlertTriangle } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '응답 품질 · 맑은도우미 Admin' })

const MOCK_KPI = {
  avgScore: 4.1,
  satisfaction: 82,
  coverageRate: 74,
  escalationRate: 6.2,
}

type WeakItem = {
  id: number
  postSubject: string
  project: string
  score: number
  verdict: string
  generatedAt: string
}

const MOCK_WEAK: WeakItem[] = [
  { id: 45, postSubject: '환불 처리 지연 문의 (결제 취소 후 14일 초과)', project: 'STEP 온라인', score: 2.1, verdict: '관련 정책 미인용, 정확도 낮음', generatedAt: '2026-06-10T16:30:00' },
  { id: 52, postSubject: '모바일 학습 앱 재생 오류 해결 방법', project: '범용 LMS', score: 2.4, verdict: 'OS 버전별 해결책 누락', generatedAt: '2026-06-09T11:15:00' },
  { id: 38, postSubject: '장애인 할인 적용 절차 문의', project: 'STEP 온라인', score: 2.8, verdict: '할인 정책 문서 미확인', generatedAt: '2026-06-08T14:20:00' },
  { id: 61, postSubject: '단체 수강 계약 할인율 협의', project: '민간 인증', score: 2.9, verdict: '영업 문의로 연결 필요, 부적절 답변', generatedAt: '2026-06-07T09:45:00' },
]

const WEEK_TREND = [
  { day: '6/5',  avg: 3.8, evals: 12 },
  { day: '6/6',  avg: 4.0, evals: 15 },
  { day: '6/7',  avg: 3.9, evals: 9  },
  { day: '6/8',  avg: 4.2, evals: 18 },
  { day: '6/9',  avg: 4.1, evals: 14 },
  { day: '6/10', avg: 4.3, evals: 21 },
  { day: '6/11', avg: 4.1, evals: 7  },
]

const WEAK_COLS: TableColumn[] = [
  { key: 'subject', label: '게시글' },
  { key: 'project', label: '프로젝트' },
  { key: 'score',   label: '점수',    align: 'right' },
  { key: 'verdict', label: '한 줄 평' },
  { key: 'date',    label: '생성',    align: 'right' },
]

const days = ref(7)
const maxEvals = computed(() => Math.max(...WEEK_TREND.map(d => d.evals)))

function scoreClass(s: number) {
  if (s < 3) return 'text-rose-600'
  if (s < 4) return 'text-amber-600'
  return 'text-emerald-600'
}
function fmtDate(iso: string) { return iso ? iso.slice(5, 16).replace('T', ' ') : '—' }
</script>

<template>
  <div>
    <AdminPageHeader mock
      caption="분석·비용"
      title="응답 품질"
      description="챗봇 응답의 신뢰도·만족도·인용 정확도 통계입니다."
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
      <span>hp_qa_eval 집계 API 연동 후 실 데이터가 표시됩니다. 현재는 목업 지표입니다.</span>
    </div>

    <!-- KPI 4 카드 -->
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <AdminKpiCard label="평균 평가 점수" :value="MOCK_KPI.avgScore.toFixed(1)" unit=" / 5" value-class="text-primary-600">
        <template #icon><Star class="size-3.5" /></template>
      </AdminKpiCard>
      <AdminKpiCard label="사용자 만족도" :value="`${MOCK_KPI.satisfaction}%`" sub="👍 긍정 피드백 기준" value-class="text-emerald-600">
        <template #icon><ThumbsUp class="size-3.5" /></template>
      </AdminKpiCard>
      <AdminKpiCard label="질문 커버율" :value="`${MOCK_KPI.coverageRate}%`" sub="지식 베이스 히트율">
        <template #icon><TrendingUp class="size-3.5" /></template>
      </AdminKpiCard>
      <AdminKpiCard label="에스컬레이션율" :value="`${MOCK_KPI.escalationRate}%`" sub="저신뢰 이관 비율" value-class="text-amber-600">
        <template #icon><AlertTriangle class="size-3.5" /></template>
      </AdminKpiCard>
    </section>

    <!-- 일별 점수 추이 -->
    <section class="mt-6 rounded-xl border border-slate-200 bg-white">
      <header class="border-b border-slate-100 px-5 py-3.5">
        <h2 class="text-[13px] font-semibold text-slate-900">일별 평균 점수 추이</h2>
      </header>
      <div class="px-5 py-4">
        <div class="flex items-end gap-2 h-28">
          <div
            v-for="d in WEEK_TREND"
            :key="d.day"
            class="flex flex-1 flex-col items-center gap-1"
          >
            <span class="text-[10px] font-mono text-slate-500">{{ d.avg.toFixed(1) }}</span>
            <div class="w-full rounded-t-sm bg-primary-200 transition-all" :style="{ height: `${(d.avg / 5) * 80}px` }" />
            <div
              class="h-1 w-full rounded-full bg-violet-300"
              :style="{ opacity: d.evals / maxEvals }"
              :title="`평가 ${d.evals}건`"
            />
            <span class="text-[10px] text-slate-400">{{ d.day }}</span>
          </div>
        </div>
        <p class="mt-2 text-[11px] text-slate-400">보라 바 = 평가 건수 비율</p>
      </div>
    </section>

    <!-- 취약 응답 TOP 목록 -->
    <div class="mt-6">
      <AdminDataTable
        :columns="WEAK_COLS"
        :rows="MOCK_WEAK"
        :pending="false"
        :error="null"
        title="취약 응답 목록"
        empty-text="취약 응답이 없습니다."
      >
        <template #default="{ row }: { row: WeakItem }">
          <tr class="hover:bg-slate-50">
            <td class="px-5 py-3">
              <p class="line-clamp-1 max-w-xs text-[12.5px] font-medium text-slate-800">{{ row.postSubject }}</p>
              <p class="font-mono text-[10px] text-slate-400">post #{{ row.id }}</p>
            </td>
            <td class="px-3 py-3 text-[12px] text-slate-600">{{ row.project }}</td>
            <td class="px-3 py-3 text-right">
              <span class="inline-flex items-center gap-1 font-mono font-semibold tabular-nums text-[12px]" :class="scoreClass(row.score)">
                <Star class="size-3.5 fill-current" />{{ row.score.toFixed(1) }}
              </span>
            </td>
            <td class="px-3 py-3 max-w-xs">
              <p class="line-clamp-1 text-[12px] text-slate-500">{{ row.verdict }}</p>
            </td>
            <td class="px-5 py-3 text-right font-mono text-[11px] text-slate-400">{{ fmtDate(row.generatedAt) }}</td>
          </tr>
        </template>
      </AdminDataTable>
    </div>
  </div>
</template>
