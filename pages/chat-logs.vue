<!--
  pages/chat-logs.vue — 챗봇 대화 로그 (Phase 2 목업).
  실 테이블 hp_chat_session / hp_chat_message / hp_chat_feedback 는 Phase 2 이후.
-->
<script setup lang="ts">
import { MessageSquareText, ThumbsUp, ThumbsDown } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '챗봇 로그 · 맑은도우미 Admin' })

type Session = {
  id: string
  user: string
  startAt: string
  msgCount: number
  avgConfidence: number
  satisfaction: 'positive' | 'negative' | 'none'
}

type Message = {
  role: 'user' | 'assistant'
  content: string
  at: string
  confidence?: number
  citations?: string[]
}

const MOCK_SESSIONS: Session[] = [
  { id: 'sess_001', user: '익명_4821', startAt: '2026-06-11T11:30:00', msgCount: 7,  avgConfidence: 0.87, satisfaction: 'positive' },
  { id: 'sess_002', user: '익명_2093', startAt: '2026-06-11T10:15:00', msgCount: 3,  avgConfidence: 0.62, satisfaction: 'negative' },
  { id: 'sess_003', user: '익명_7742', startAt: '2026-06-11T09:05:00', msgCount: 12, avgConfidence: 0.91, satisfaction: 'positive' },
  { id: 'sess_004', user: '익명_3318', startAt: '2026-06-10T18:40:00', msgCount: 5,  avgConfidence: 0.75, satisfaction: 'none' },
  { id: 'sess_005', user: '익명_9901', startAt: '2026-06-10T16:55:00', msgCount: 2,  avgConfidence: 0.44, satisfaction: 'negative' },
  { id: 'sess_006', user: '익명_5566', startAt: '2026-06-10T14:20:00', msgCount: 9,  avgConfidence: 0.88, satisfaction: 'positive' },
]

const MOCK_MESSAGES: Record<string, Message[]> = {
  sess_001: [
    { role: 'user',      content: '수강 신청 방법을 알고 싶어요.', at: '2026-06-11T11:30:05' },
    { role: 'assistant', content: '강좌 신청은 학습관 상단 메뉴 > 수강신청 > 희망 과정 선택 후 [신청하기]를 클릭합니다. 결제 방식은 카드·무통장 입금 중 선택 가능합니다.', at: '2026-06-11T11:30:07', confidence: 0.93, citations: ['STEP 사용자 매뉴얼 §3.2'] },
    { role: 'user',      content: '결제 후 영수증은 어디서 받나요?', at: '2026-06-11T11:31:20' },
    { role: 'assistant', content: '마이페이지 > 결제내역 > 해당 주문의 [영수증 출력] 버튼을 누르시면 됩니다.', at: '2026-06-11T11:31:22', confidence: 0.89, citations: ['결제 안내 FAQ'] },
  ],
}

const COLUMNS: TableColumn[] = [
  { key: 'user',       label: '사용자' },
  { key: 'start',      label: '시작 시각',    align: 'right' },
  { key: 'msgs',       label: '메시지',       align: 'right' },
  { key: 'confidence', label: '평균 신뢰도',  align: 'right' },
  { key: 'feedback',   label: '피드백',       align: 'center' },
]

const selected   = ref<Session | null>(null)
const detailOpen = computed({
  get: () => !!selected.value,
  set: (v) => { if (!v) selected.value = null },
})
const messages   = computed(() => selected.value ? (MOCK_MESSAGES[selected.value.id] ?? []) : [])

function fmtTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function confClass(c: number) {
  if (c < 0.5) return 'text-rose-600'
  if (c < 0.75) return 'text-amber-600'
  return 'text-emerald-600'
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="운영 보드"
      title="챗봇 로그"
      description="사용자 챗 세션의 메시지 흐름·인용 출처·신뢰도·피드백을 열람합니다."
    />

    <!-- Phase 2 배지 -->
    <div class="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
      <span class="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">Phase 2</span>
      <span>사용자 챗봇(Phase 2) 출시 후 실 대화 로그가 기록됩니다. 현재는 목업 데이터입니다.</span>
    </div>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="MOCK_SESSIONS"
      :pending="false"
      :error="null"
      empty-text="챗봇 대화 로그가 없습니다."
    >
      <template #default="{ row }: { row: Session }">
        <tr class="cursor-pointer hover:bg-slate-50" @click="selected = row">
          <td class="px-5 py-3 text-[13px] font-medium text-slate-800">{{ row.user }}</td>
          <td class="px-3 py-3 text-right font-mono text-[11px] text-slate-500">{{ fmtTime(row.startAt) }}</td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-700">{{ row.msgCount }}</td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums" :class="confClass(row.avgConfidence)">
            {{ (row.avgConfidence * 100).toFixed(0) }}%
          </td>
          <td class="px-5 py-3 text-center">
            <ThumbsUp v-if="row.satisfaction === 'positive'" class="mx-auto size-4 text-emerald-500" />
            <ThumbsDown v-else-if="row.satisfaction === 'negative'" class="mx-auto size-4 text-rose-500" />
            <span v-else class="text-[11px] text-slate-300">—</span>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="!MOCK_SESSIONS.length"
      title="챗봇 대화 로그가 없습니다"
      description="사용자 챗봇(Phase 2) 출시 후 기록됩니다."
      class="mt-4"
    >
      <template #icon><MessageSquareText class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <!-- 세션 상세 슬라이드오버 -->
    <AdminSlideOver v-model="detailOpen" title="세션 상세" size="lg">
      <template v-if="selected">
        <div class="space-y-4">
          <!-- 메타 -->
          <div class="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-[12px]">
            <span class="font-semibold text-slate-800">{{ selected.user }}</span>
            <span class="font-mono text-slate-500">{{ fmtTime(selected.startAt) }}</span>
          </div>

          <!-- 메시지 타임라인 -->
          <div v-if="messages.length > 0" class="space-y-3">
            <div
              v-for="(msg, i) in messages"
              :key="i"
              class="flex gap-2"
              :class="msg.role === 'user' ? 'justify-end' : ''"
            >
              <div
                class="max-w-[85%] rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed"
                :class="
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white ring-1 ring-slate-200 text-slate-800'
                "
              >
                <p>{{ msg.content }}</p>
                <div v-if="msg.citations?.length" class="mt-1.5 flex flex-wrap gap-1">
                  <span
                    v-for="c in msg.citations"
                    :key="c"
                    class="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium"
                  >{{ c }}</span>
                </div>
                <p v-if="msg.confidence" class="mt-1 text-right text-[10px] opacity-60">
                  신뢰도 {{ (msg.confidence * 100).toFixed(0) }}%
                </p>
              </div>
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-[12px] text-slate-400">
            상세 메시지 데이터는 Phase 2 이후 표시됩니다.
          </div>

          <!-- 피드백 -->
          <div class="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-[12px]">
            <span class="text-slate-500">피드백</span>
            <ThumbsUp v-if="selected.satisfaction === 'positive'" class="size-4 text-emerald-500" />
            <ThumbsDown v-else-if="selected.satisfaction === 'negative'" class="size-4 text-rose-500" />
            <span v-else class="text-slate-400">없음</span>
          </div>
        </div>
      </template>
    </AdminSlideOver>
  </div>
</template>
