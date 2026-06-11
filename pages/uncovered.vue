<!--
  pages/uncovered.vue — 미커버 질문 (Phase 2 목업).
  실 테이블 hp_uncovered_question + API /uncovered 는 챗봇 Phase 2 이후 구현.
-->
<script setup lang="ts">
import { CircleHelp } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '미커버 질문 · 맑은도우미 Admin' })

type UncoveredItem = {
  id: number
  question: string
  frequency: number
  lastAt: string
  scope: string
  topic: string
  status: 'pending' | 'working' | 'resolved' | 'wont_fix'
}

const STATUS_META = {
  pending:   { label: '대기',    cls: 'bg-amber-100 text-amber-800' },
  working:   { label: '처리 중', cls: 'bg-blue-100 text-blue-800' },
  resolved:  { label: '해결',    cls: 'bg-emerald-100 text-emerald-800' },
  wont_fix:  { label: '보류',    cls: 'bg-slate-100 text-slate-600' },
}

const MOCK_ROWS: UncoveredItem[] = [
  { id: 1, question: '수강 취소 후 환불 기간이 어떻게 되나요?',             frequency: 23, lastAt: '2026-06-10T14:23:00', scope: 'common',  topic: '환불/취소',    status: 'pending' },
  { id: 2, question: '장애인·국가유공자 할인 적용 방법을 알고 싶어요.',       frequency: 18, lastAt: '2026-06-10T09:11:00', scope: 'common',  topic: '결제/비용',    status: 'working' },
  { id: 3, question: 'STEP 강의가 모바일에서 재생이 안 돼요.',               frequency: 15, lastAt: '2026-06-09T16:47:00', scope: 'step',    topic: '시스템 오류',  status: 'pending' },
  { id: 4, question: '이수 처리가 완료됐는데 수료증이 발급이 안 됩니다.',      frequency: 12, lastAt: '2026-06-09T11:30:00', scope: 'common',  topic: '수료증',      status: 'resolved' },
  { id: 5, question: '민간 자격증 취득 후 환급 신청은 어디서 하나요?',         frequency: 9,  lastAt: '2026-06-08T15:20:00', scope: 'private', topic: '환불/취소',    status: 'pending' },
  { id: 6, question: '영상 강의 배속 기능이 없나요?',                         frequency: 7,  lastAt: '2026-06-07T10:05:00', scope: 'common',  topic: '콘텐츠/학습',  status: 'wont_fix' },
  { id: 7, question: '수강 신청이 마감됐을 때 대기 신청이 가능한가요?',        frequency: 6,  lastAt: '2026-06-06T13:50:00', scope: 'common',  topic: '수강신청',     status: 'pending' },
]

const COLUMNS: TableColumn[] = [
  { key: 'question', label: '대표 질문' },
  { key: 'freq',     label: '빈도',         align: 'right' },
  { key: 'last',     label: '마지막 발생',   align: 'right' },
  { key: 'scope',    label: 'scope/topic' },
  { key: 'status',   label: '상태',          align: 'center' },
]

const STATUS_OPTS = [
  { value: '', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'working', label: '처리 중' },
  { value: 'resolved', label: '해결' },
  { value: 'wont_fix', label: '보류' },
]

const search        = ref('')
const statusFilter  = ref('')
const selected      = ref<UncoveredItem | null>(null)
const detailOpen    = computed({
  get: () => !!selected.value,
  set: (v) => { if (!v) selected.value = null },
})

const filtered = computed(() => {
  let list = MOCK_ROWS
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(r => r.question.toLowerCase().includes(q) || r.topic.includes(q))
  }
  if (statusFilter.value) list = list.filter(r => r.status === statusFilter.value)
  return list
})

function fmtTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="운영 보드"
      title="미커버 질문"
      description="챗봇이 답하지 못한 질문을 수집·분류해 지식 보강 큐로 운영합니다."
    />

    <!-- Phase 2 배지 -->
    <div class="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
      <span class="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">Phase 2</span>
      <span>챗봇 가동(Phase 2) 후 실 데이터가 자동 수집됩니다. 현재는 목업 데이터입니다.</span>
    </div>

    <!-- 필터 -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <AdminSearchInput v-model="search" placeholder="질문·토픽 검색" class="max-w-sm flex-1" />
      <AdminSegment v-model="statusFilter" :options="STATUS_OPTS" />
      <span class="ml-auto text-[12px] text-slate-500">
        <span class="font-mono font-semibold text-slate-800">{{ filtered.length }}</span>건
      </span>
    </div>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="filtered"
      :pending="false"
      :error="null"
      empty-text="조건에 맞는 미커버 질문이 없습니다."
    >
      <template #default="{ row }: { row: UncoveredItem }">
        <tr class="cursor-pointer hover:bg-slate-50" @click="selected = row">
          <td class="max-w-xs px-5 py-3">
            <p class="truncate text-[13px] text-slate-800">{{ row.question }}</p>
          </td>
          <td class="px-3 py-3 text-right font-mono text-[12px] font-semibold tabular-nums text-slate-700">
            {{ row.frequency }}
          </td>
          <td class="px-3 py-3 text-right font-mono text-[11px] text-slate-500">
            {{ fmtTime(row.lastAt) }}
          </td>
          <td class="px-3 py-3">
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">{{ row.scope }}</span>
            <span class="ml-1 text-[11px] text-slate-500">{{ row.topic }}</span>
          </td>
          <td class="px-5 py-3 text-center">
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="STATUS_META[row.status].cls"
            >{{ STATUS_META[row.status].label }}</span>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="!filtered.length"
      title="미커버 질문이 없습니다"
      description="챗봇(Phase 2) 가동 후 자동 수집됩니다. 아직 데이터가 없습니다."
      class="mt-4"
    >
      <template #icon><CircleHelp class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <!-- 상세 슬라이드오버 -->
    <AdminSlideOver v-model="detailOpen" title="미커버 질문 상세" size="md">
      <template v-if="selected">
        <div class="space-y-4 text-[13px]">
          <div class="rounded-lg bg-slate-50 p-4">
            <p class="font-semibold text-slate-800">{{ selected.question }}</p>
          </div>
          <dl class="space-y-3">
            <div class="grid grid-cols-[120px_1fr] gap-2">
              <dt class="text-slate-400">빈도</dt>
              <dd class="font-mono font-bold text-slate-800">{{ selected.frequency }}회</dd>
            </div>
            <div class="grid grid-cols-[120px_1fr] gap-2">
              <dt class="text-slate-400">마지막 발생</dt>
              <dd class="font-mono text-slate-700">{{ fmtTime(selected.lastAt) }}</dd>
            </div>
            <div class="grid grid-cols-[120px_1fr] gap-2">
              <dt class="text-slate-400">scope</dt>
              <dd><span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">{{ selected.scope }}</span></dd>
            </div>
            <div class="grid grid-cols-[120px_1fr] gap-2">
              <dt class="text-slate-400">topic</dt>
              <dd class="text-slate-700">{{ selected.topic }}</dd>
            </div>
            <div class="grid grid-cols-[120px_1fr] gap-2">
              <dt class="text-slate-400">상태</dt>
              <dd>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="STATUS_META[selected.status].cls">
                  {{ STATUS_META[selected.status].label }}
                </span>
              </dd>
            </div>
          </dl>
          <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center text-[12px] text-slate-400">
            AI 초안 생성 · 표준답변 등록 — Phase 2 활성화 예정
          </div>
        </div>
      </template>
    </AdminSlideOver>
  </div>
</template>
