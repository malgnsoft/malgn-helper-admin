<!--
  pages/escalations.vue — 에스컬레이션 처리 큐 (Phase 2 목업).
  실 테이블 hp_escalation + API /escalations 는 Phase 2 챗봇 도입 후.
-->
<script setup lang="ts">
import { BellRing } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '에스컬레이션 · 맑은도우미 Admin' })

type EscItem = {
  id: number
  question: string
  confidence: number
  priority: 'high' | 'medium' | 'low'
  assignee: string
  createdAt: string
  resolvedAt?: string
  status: 'pending' | 'in_progress' | 'resolved'
}

const STATUS_META = {
  pending:     { label: '대기',    cls: 'bg-amber-100 text-amber-800' },
  in_progress: { label: '처리 중', cls: 'bg-blue-100 text-blue-800' },
  resolved:    { label: '완료',    cls: 'bg-emerald-100 text-emerald-800' },
}
const PRIORITY_META = {
  high:   { label: '높음', cls: 'bg-rose-100 text-rose-700' },
  medium: { label: '중간', cls: 'bg-amber-100 text-amber-700' },
  low:    { label: '낮음', cls: 'bg-slate-100 text-slate-600' },
}

const MOCK_ALL: EscItem[] = [
  { id: 1, question: '장애인 국가유공자 할인 적용이 시스템에서 안 돼요.',    confidence: 0.28, priority: 'high',   assignee: '이수연', createdAt: '2026-06-11T08:40:00', status: 'pending' },
  { id: 2, question: '이수 완료 표시가 되는데 수료증이 안 나와요.',           confidence: 0.38, priority: 'high',   assignee: '정민석', createdAt: '2026-06-10T17:15:00', status: 'in_progress' },
  { id: 3, question: '결제 오류 후 환불이 3주째 처리 안 됐습니다.',           confidence: 0.19, priority: 'high',   assignee: '이수연', createdAt: '2026-06-10T10:05:00', status: 'in_progress' },
  { id: 4, question: '모바일 앱에서 강의 동영상이 검은 화면만 나와요.',       confidence: 0.44, priority: 'medium', assignee: '박지훈', createdAt: '2026-06-09T14:22:00', status: 'pending' },
  { id: 5, question: '공공기관 교육 신청 마감일이 지났는데 예외 처리 가능한지요.', confidence: 0.41, priority: 'medium', assignee: '이수연', createdAt: '2026-06-08T09:30:00', status: 'resolved', resolvedAt: '2026-06-09T11:00:00' },
  { id: 6, question: '기업 단체 할인율 협의 문의입니다.',                    confidence: 0.35, priority: 'low',    assignee: '정민석', createdAt: '2026-06-07T16:10:00', status: 'resolved', resolvedAt: '2026-06-08T10:00:00' },
]

const TABS = [
  { value: 'pending',     label: '대기' },
  { value: 'in_progress', label: '진행' },
  { value: 'resolved',    label: '완료' },
]

const COLUMNS: TableColumn[] = [
  { key: 'question',   label: '질문' },
  { key: 'confidence', label: '신뢰도',   align: 'right' },
  { key: 'priority',   label: '우선순위', align: 'center' },
  { key: 'assignee',   label: '담당' },
  { key: 'createdAt',  label: '생성',     align: 'right' },
]

const tab      = ref<'pending' | 'in_progress' | 'resolved'>('pending')
const selected = ref<EscItem | null>(null)
const detailOpen = computed({
  get: () => !!selected.value,
  set: (v) => { if (!v) selected.value = null },
})

const tabRows = computed(() => MOCK_ALL.filter(r => r.status === tab.value))

function fmtTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function confClass(c: number) {
  if (c < 0.3) return 'text-rose-600'
  if (c < 0.45) return 'text-amber-600'
  return 'text-slate-700'
}
</script>

<template>
  <div>
    <AdminPageHeader mock
      caption="운영 보드"
      title="에스컬레이션"
      description="챗봇 저신뢰·모름 분기 질문을 상담사가 처리하는 큐입니다."
    />

    <!-- Phase 2 배지 -->
    <div class="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
      <span class="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">Phase 2</span>
      <span>챗봇(Phase 2) 가동 후 에스컬레이션이 자동 생성됩니다. 현재는 목업 데이터입니다.</span>
    </div>

    <!-- 탭 -->
    <div class="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
      <button
        v-for="t in TABS"
        :key="t.value"
        type="button"
        class="flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[13px] font-medium transition"
        :class="tab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
        @click="tab = t.value as any"
      >
        {{ t.label }}
        <span
          class="rounded-full px-1.5 text-[10px] font-bold"
          :class="tab === t.value ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/60 text-slate-500'"
        >
          {{ MOCK_ALL.filter(r => r.status === t.value).length }}
        </span>
      </button>
    </div>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="tabRows"
      :pending="false"
      :error="null"
      :empty-text="`${TABS.find(t => t.value === tab)?.label} 항목이 없습니다.`"
    >
      <template #default="{ row }: { row: EscItem }">
        <tr class="cursor-pointer hover:bg-slate-50" @click="selected = row">
          <td class="max-w-xs px-5 py-3">
            <p class="truncate text-[13px] text-slate-800">{{ row.question }}</p>
          </td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums" :class="confClass(row.confidence)">
            {{ (row.confidence * 100).toFixed(0) }}%
          </td>
          <td class="px-3 py-3 text-center">
            <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="PRIORITY_META[row.priority].cls">
              {{ PRIORITY_META[row.priority].label }}
            </span>
          </td>
          <td class="px-3 py-3 text-[12px] text-slate-700">{{ row.assignee }}</td>
          <td class="px-5 py-3 text-right font-mono text-[11px] text-slate-500">{{ fmtTime(row.createdAt) }}</td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="!tabRows.length"
      :title="`${TABS.find(t => t.value === tab)?.label} 에스컬레이션이 없습니다`"
      description="Phase 2 챗봇 가동 후 활성화됩니다."
      class="mt-4"
    >
      <template #icon><BellRing class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <!-- 처리 슬라이드오버 -->
    <AdminSlideOver v-model="detailOpen" title="에스컬레이션 처리" size="lg">
      <template v-if="selected">
        <div class="space-y-4 text-[13px]">
          <div class="rounded-lg bg-slate-50 p-4">
            <p class="font-semibold text-slate-800">{{ selected.question }}</p>
            <div class="mt-2 flex gap-2">
              <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="PRIORITY_META[selected.priority].cls">
                {{ PRIORITY_META[selected.priority].label }}
              </span>
              <span class="font-mono text-[11px]" :class="confClass(selected.confidence)">
                신뢰도 {{ (selected.confidence * 100).toFixed(0) }}%
              </span>
            </div>
          </div>
          <dl class="space-y-3">
            <div class="grid grid-cols-[120px_1fr] gap-2">
              <dt class="text-slate-400">담당</dt>
              <dd class="text-slate-700">{{ selected.assignee }}</dd>
            </div>
            <div class="grid grid-cols-[120px_1fr] gap-2">
              <dt class="text-slate-400">생성</dt>
              <dd class="font-mono text-slate-700">{{ fmtTime(selected.createdAt) }}</dd>
            </div>
            <div v-if="selected.resolvedAt" class="grid grid-cols-[120px_1fr] gap-2">
              <dt class="text-slate-400">처리 완료</dt>
              <dd class="font-mono text-slate-700">{{ fmtTime(selected.resolvedAt) }}</dd>
            </div>
          </dl>
          <!-- 답변 작성 (목업) -->
          <div>
            <label class="mb-1.5 block text-[12px] font-medium text-slate-700">상담사 답변</label>
            <textarea
              disabled
              rows="4"
              placeholder="Phase 2 챗봇 가동 후 활성화됩니다."
              class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-400 ring-1 ring-inset ring-slate-200 cursor-not-allowed"
            />
          </div>
          <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center text-[12px] text-slate-400">
            표준답변으로 등록 — Phase 2 활성화 예정
          </div>
        </div>
      </template>
    </AdminSlideOver>
  </div>
</template>
