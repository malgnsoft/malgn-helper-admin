<!--
  pages/announces.vue — 표준 안내답변(안내글) 큐레이션 [준비 중 · 백엔드 미연동].

  배경:
    안내글은 직원(staff) 첫 작성 글(공지·정책 안내)로, 고객 문의(Q&A) 표준답변과 트랙이 다르다.
    수집·분기 정책 정본: malgn-helper-mng/docs/PMS-INQUIRY-HARVEST.md §5-3
      - staff 첫 글 → 안내글 트랙(answer_type='announce'), 그 외 → Q&A.
    저장처는 별도 테이블(hp_announce, dba 설계 중)로 분리 예정.

  연동 상태 [TODO — 백엔드 GET /announces 등 미구현]:
    이 페이지는 메뉴·레이아웃 구조 + '준비 중' 빈 상태까지만 제공한다.
    실데이터 호출은 넣지 않는다(404 유발 방지). 아래 load()는 immediate:false로 비활성 — 엔드포인트가 생기면 본문 주석대로 활성화.

  향후 GET /announces 연동 지점 (developer↑):
    GET    /announces?serviceId=&topicId=&approvalStatus=&search=&limit=&offset=
             → { rows: AnnounceRow[]; total } (JOIN: topic_label·service_name·tags[]·approval_status)
    GET    /announces/:id                                   (developer↑)
    POST   /announces        body {title, body, scope?, topicId?, serviceId?, tags?, sourcePostId?}
    PATCH  /announces/:id                                   본문 수정 (admin)
    PATCH  /announces/:id/transition  body {to, reason?}    승인 전이 (developer↑)
    DELETE /announces/:id                                   soft delete (admin)
    (분류 카탈로그는 standard-answers.vue 와 동일하게 GET /topics · /services 재사용)

  ※ standard-answers.vue 의 레이아웃·필터·승인 워크플로 패턴을 그대로 따른다.
    엔드포인트 확정 시 그 파일을 참고해 목록/슬라이드오버/전이를 이식한다.
-->
<script setup lang="ts">
import { Megaphone } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '안내글 · 맑은도우미 Admin' })

// 엔드포인트가 생기면 standard-answers.vue 와 동일하게 사용한다.
// const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

/* 응답 행(예정) — hp_announce. 백엔드 확정 전 구조 메모. */
type ApprovalStatus = 'draft' | 'reviewing' | 'approved' | 'rejected' | 'archived'
type Scope = 'common' | 'service'

type AnnounceRow = {
  id: number
  title: string                 // 안내 주제/제목 (안내글은 명시적 질문이 없음 — HARVEST H3)
  body: string                  // 안내 본문(= 답변 콘텐츠)
  scope: Scope | null
  topic_id: number | null
  service_id: number | null
  topic_label: string | null
  service_name: string | null
  tags: string[]
  source_post_id: number | null // 출처 PMS 게시글
  approval_status: ApprovalStatus
  updated_at: string
}

/* ── 권한 (standard-answers.vue 와 동일 기준) ── */
const meSession = useAuthUser()
const myLevel = computed(() => meSession.value?.level ?? 0)
const canRead = computed(() => myLevel.value >= 5)   // developer↑ 가시
const canWrite = computed(() => myLevel.value >= 9)  // 쓰기 = admin

/* 향후 목록 컬럼 — 분류·승인·출처 자리를 미리 확보(연동 시 그대로 사용). */
const COLUMNS: TableColumn[] = [
  { key: 'id',        label: '#',      class: 'px-5 pr-3 w-14' },
  { key: 'title',     label: '제목' },
  { key: 'scope',     label: '분류',   align: 'center', class: 'px-3 w-16' },
  { key: 'topic',     label: '토픽',   class: 'px-3 w-32' },
  { key: 'service',   label: '서비스', class: 'px-3 w-32' },
  { key: 'status',    label: '상태',   align: 'center', class: 'px-3 w-20' },
  { key: 'source',    label: '출처',   align: 'right',  class: 'px-3 w-20' },
  { key: 'updatedAt', label: '수정일', align: 'right' },
]

const selectCls =
  'h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'

/* ── 필터(draft → 조회). 연동 전엔 표시만 하고 동작은 비활성. ── */
const draft = reactive({ scope: '', approvalStatus: '', q: '' })

/* ── 목록 상태 (연동 전: 항상 빈 목록) ── */
const rows = ref<AnnounceRow[]>([])
const total = ref(0)
const pending = ref(false)
const error = ref<string | null>(null)

/*
  백엔드 GET /announces 연동 지점.
  엔드포인트가 생기면 immediate를 활성화하고 아래 본문을 standard-answers.vue 의 load() 패턴으로 채운다.
  현재는 호출하지 않는다(404 방지) — try/catch + 빈 목록 유지.
*/
async function load() {
  // TODO(announces): 엔드포인트 확정 시 구현.
  // try {
  //   pending.value = true
  //   const url = new URL(`${API_BASE}/announces`)
  //   url.searchParams.set('limit', '60')
  //   if (draft.scope) url.searchParams.set('scope', draft.scope)
  //   if (draft.approvalStatus) url.searchParams.set('approvalStatus', draft.approvalStatus)
  //   if (draft.q.trim()) url.searchParams.set('search', draft.q.trim())
  //   const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  //   if (res.status === 403) throw new Error('admin/developer 권한이 필요합니다.')
  //   if (!res.ok) throw new Error(`API ${res.status}`)
  //   const data = (await res.json()) as { rows: AnnounceRow[]; total: number }
  //   rows.value = data.rows ?? []
  //   total.value = data.total ?? rows.value.length
  // } catch (e) {
  //   error.value = (e as Error).message
  // } finally {
  //   pending.value = false
  // }
}

function applyFilter() {
  // 연동 전: 동작 없음. 엔드포인트 확정 시 load() 호출.
  load()
}
function resetFilter() {
  draft.scope = draft.approvalStatus = draft.q = ''
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="안내글 (표준 안내답변)"
      description="직원이 작성한 공지·정책 안내. 고객 문의(Q&A) 표준답변과 별도 트랙으로 검토·승인합니다."
      mock
    />

    <!-- 권한 안내 (developer 미만) -->
    <AdminEmptyState
      v-if="!canRead"
      title="안내글은 developer 이상 권한에서 조회할 수 있습니다"
      description="현재 계정은 안내글 목록을 볼 수 없습니다. 권한이 필요하면 관리자에게 문의하세요."
      class="mt-2"
    >
      <template #icon><Megaphone class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <template v-else>
      <!-- 필터 (구조만 — 연동 전엔 동작 비활성) -->
      <AdminFilterBar @search="applyFilter" @reset="resetFilter">
        <AdminFilterField label="분류">
          <select v-model="draft.scope" :class="selectCls" disabled>
            <option value="">전체</option>
            <option value="common">공통</option>
            <option value="service">서비스</option>
          </select>
        </AdminFilterField>
        <AdminFilterField label="승인상태">
          <select v-model="draft.approvalStatus" :class="selectCls" disabled>
            <option value="">전체</option>
            <option value="draft">초안</option>
            <option value="reviewing">검토중</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
            <option value="archived">보관</option>
          </select>
        </AdminFilterField>
        <AdminFilterField label="검색어" grow>
          <input
            v-model="draft.q"
            type="text"
            placeholder="백엔드 연동 후 사용 가능합니다"
            disabled
            class="h-9 w-full rounded-md bg-white px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </AdminFilterField>
      </AdminFilterBar>

      <!-- 목록 (구조 — 연동 전엔 항상 빈 행) -->
      <AdminDataTable
        :columns="COLUMNS"
        :rows="rows"
        :pending="pending"
        :error="error"
        title="전체 "
        :total="total"
        :shown="rows.length"
        empty-text="안내글 목록은 백엔드 연동 후 표시됩니다."
      >
        <template #default="{ row }: { row: AnnounceRow }">
          <!-- 연동 후 standard-answers.vue 의 행 마크업을 이식. (현재 rows 비어 호출되지 않음) -->
          <tr class="hover:bg-slate-50">
            <td class="px-5 pr-3 py-3 font-mono text-[11px] text-slate-400">#{{ row.id }}</td>
            <td class="px-3 py-3 text-[13px] font-semibold text-slate-900">{{ row.title }}</td>
            <td class="px-3 py-3 text-center text-[11px] text-slate-300">{{ row.scope ?? '—' }}</td>
            <td class="px-3 py-3 text-[12px] text-slate-700">{{ row.topic_label ?? '—' }}</td>
            <td class="px-3 py-3 text-[12px] text-slate-700">{{ row.service_name ?? '—' }}</td>
            <td class="px-3 py-3 text-center text-[11px] text-slate-500">{{ row.approval_status }}</td>
            <td class="px-3 py-3 text-right font-mono text-[11px] text-slate-400">
              {{ row.source_post_id ? `#${row.source_post_id}` : '—' }}
            </td>
            <td class="px-3 py-3 text-right font-mono text-[11px] text-slate-400">
              {{ row.updated_at ? row.updated_at.slice(0, 10) : '—' }}
            </td>
          </tr>
        </template>
      </AdminDataTable>

      <!-- 준비 중 안내 -->
      <AdminEmptyState
        v-if="!pending && !error && !rows.length"
        title="안내글 관리 — 곧 제공됩니다"
        description="직원 안내글(표준 안내답변) 수집·분류·승인 화면을 준비 중입니다. 백엔드(GET /announces, hp_announce 테이블)가 준비되면 목록·승인 워크플로가 활성화됩니다."
        class="mt-4"
      >
        <template #icon><Megaphone class="size-5 text-slate-400" /></template>
        <template #actions>
          <NuxtLink
            to="/standard-answers"
            class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Q&A 표준답변으로 이동
          </NuxtLink>
        </template>
      </AdminEmptyState>

      <p v-if="!canWrite" class="mt-3 text-[11px] text-slate-400">
        안내글 추가·수정·승인은 백엔드 연동 후 admin/developer 권한으로 제공됩니다.
      </p>
    </template>
  </div>
</template>
