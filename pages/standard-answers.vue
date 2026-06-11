<!--
  pages/standard-answers.vue — 표준답변 CRUD.
  API: GET/POST /standard-answers · PATCH/DELETE /standard-answers/:id
-->
<script setup lang="ts">
import { Plus, Pencil, Trash2, Bookmark } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '표준답변 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

type SA = {
  id: number
  label: string
  question: string
  answer: string
  projectId: number | null
  usageCount: number
  updatedAt: string
  createdAt?: string
  scope?: string | null
  topicId?: number | null
  serviceTag?: string | null
}

const COLUMNS: TableColumn[] = [
  { key: 'id',        label: '#',      class: 'px-5 pr-3 w-14' },
  { key: 'label',     label: '라벨' },
  { key: 'question',  label: '질문' },
  { key: 'usage',     label: '사용',    align: 'right' },
  { key: 'updatedAt', label: '수정일',  align: 'right' },
  { key: 'actions',   label: '',        align: 'right', class: 'px-5 pl-3 w-20' },
]

/* ── 목록 ── */
const search = ref('')
const rows = ref<SA[]>([])
const total = ref(0)
const pending = ref(true)
const error = ref<string | null>(null)

async function load() {
  pending.value = true
  error.value = null
  try {
    const url = new URL(`${API_BASE}/standard-answers`)
    url.searchParams.set('limit', '60')
    if (search.value.trim()) url.searchParams.set('search', search.value.trim())
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = await res.json() as { rows?: SA[]; total?: number } | SA[]
    if (Array.isArray(data)) {
      rows.value = data
      total.value = data.length
    } else {
      rows.value = (data as any).rows ?? (data as any).data ?? []
      total.value = (data as any).total ?? rows.value.length
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    pending.value = false
  }
}
onMounted(load)
let debounce: ReturnType<typeof setTimeout>
watch(search, () => { clearTimeout(debounce); debounce = setTimeout(load, 400) })

/* ── 생성·편집 모달 ── */
const modalOpen = ref(false)
const editing  = ref<SA | null>(null)
const saving   = ref(false)
const saveErr  = ref<string | null>(null)
const form = reactive({ label: '', question: '', answer: '' })

function openCreate() {
  editing.value = null
  form.label = form.question = form.answer = ''
  saveErr.value = null
  modalOpen.value = true
}

function openEdit(row: SA) {
  editing.value = row
  form.label    = row.label
  form.question = row.question
  form.answer   = row.answer
  saveErr.value = null
  modalOpen.value = true
}

async function save() {
  if (!form.label.trim() || !form.question.trim() || !form.answer.trim()) {
    saveErr.value = '라벨 · 질문 · 답변은 필수입니다.'
    return
  }
  saving.value = true
  saveErr.value = null
  try {
    const body = { label: form.label.trim(), question: form.question.trim(), answer: form.answer.trim() }
    const url = editing.value
      ? `${API_BASE}/standard-answers/${editing.value.id}`
      : `${API_BASE}/standard-answers`
    const res = await fetch(url, {
      method: editing.value ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as any
      throw new Error(j.error || `API ${res.status}`)
    }
    modalOpen.value = false
    await load()
  } catch (e) {
    saveErr.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

/* ── 삭제 모달 ── */
const delTarget = ref<SA | null>(null)
const delOpen   = ref(false)
const deleting  = ref(false)

function openDelete(row: SA) { delTarget.value = row; delOpen.value = true }

async function confirmDelete() {
  if (!delTarget.value) return
  deleting.value = true
  try {
    const res = await fetch(`${API_BASE}/standard-answers/${delTarget.value.id}`, {
      method: 'DELETE', credentials: 'include',
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    delOpen.value = false
    delTarget.value = null
    await load()
  } catch { /* silent */ } finally {
    deleting.value = false
  }
}

/* ── 포맷 ── */
function fmtDate(iso: string) { return iso ? iso.slice(0, 10) : '—' }
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="표준답변"
      description="챗봇 응답 1순위 소스. 질문·답변·라벨 단위로 관리합니다."
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
          @click="openCreate"
        >
          <Plus class="size-4" />새 표준답변
        </button>
      </template>
    </AdminPageHeader>

    <!-- 검색 -->
    <div class="mb-4 flex items-center gap-3">
      <AdminSearchInput v-model="search" placeholder="라벨·질문·답변 검색" class="max-w-sm flex-1" />
      <span class="ml-auto text-[12px] text-slate-500">
        총 <span class="font-mono font-semibold text-slate-800">{{ total.toLocaleString() }}</span>건
      </span>
    </div>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="rows"
      :pending="pending"
      :error="error"
      empty-text="등록된 표준답변이 없습니다."
    >
      <template #default="{ row }: { row: SA }">
        <tr class="cursor-pointer hover:bg-slate-50" @click="openEdit(row)">
          <td class="px-5 pr-3 py-3 font-mono text-[11px] text-slate-400">#{{ row.id }}</td>
          <td class="px-3 py-3">
            <p class="text-[13px] font-semibold text-slate-900">{{ row.label }}</p>
          </td>
          <td class="max-w-xs px-3 py-3">
            <p class="truncate text-[12px] text-slate-600">{{ row.question }}</p>
          </td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-500">
            {{ row.usageCount ?? 0 }}
          </td>
          <td class="px-3 py-3 text-right font-mono text-[11px] text-slate-400">
            {{ fmtDate(row.updatedAt) }}
          </td>
          <td class="px-5 pl-3 py-3 text-right" @click.stop>
            <div class="flex items-center justify-end gap-1">
              <button
                type="button"
                class="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="편집"
                @click="openEdit(row)"
              >
                <Pencil class="size-3.5" />
              </button>
              <button
                type="button"
                class="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                title="삭제"
                @click="openDelete(row)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="!pending && !error && !rows.length"
      title="등록된 표준답변이 없습니다"
      description="PMS Q&A 분석에서 '표준답변으로 저장'하거나 [+ 새 표준답변]으로 직접 추가하세요."
      class="mt-4"
    >
      <template #icon><Bookmark class="size-5 text-slate-400" /></template>
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
          @click="openCreate"
        >
          <Plus class="size-4" />새 표준답변 추가
        </button>
      </template>
    </AdminEmptyState>

    <!-- 생성 / 편집 모달 -->
    <AdminModal
      v-model="modalOpen"
      :title="editing ? '표준답변 편집' : '새 표준답변'"
      size="lg"
    >
      <div class="space-y-4">
        <!-- 라벨 -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">
            라벨 <span class="text-amber-600">*</span>
          </label>
          <input
            v-model="form.label"
            type="text"
            placeholder="e.g. STEP 로그인 방법"
            class="h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <!-- 질문 -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">
            질문 <span class="text-amber-600">*</span>
          </label>
          <textarea
            v-model="form.question"
            rows="2"
            placeholder="대표 질문 문장"
            class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <!-- 답변 -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">
            답변 <span class="text-amber-600">*</span>
          </label>
          <textarea
            v-model="form.answer"
            rows="5"
            placeholder="표준 답변 내용 (마크다운 사용 가능)"
            class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <!-- 향후 필드 (비활성) -->
        <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3">
          <p class="text-[11px] font-medium text-slate-400">
            scope · topic · service_tag · 승인 워크플로 — API 보강 후 활성화 예정
          </p>
        </div>

        <!-- 에러 -->
        <div
          v-if="saveErr"
          class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700"
        >
          {{ saveErr }}
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="modalOpen = false"
          >
            취소
          </button>
          <button
            type="button"
            :disabled="saving"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            @click="save"
          >
            {{ saving ? '저장 중…' : (editing ? '저장' : '추가') }}
          </button>
        </div>
      </template>
    </AdminModal>

    <!-- 삭제 확인 모달 -->
    <AdminModal v-model="delOpen" title="표준답변 삭제" size="sm">
      <p class="text-[13px] text-slate-700">
        <span class="font-semibold">{{ delTarget?.label }}</span> 을(를) 삭제하시겠습니까?<br />
        삭제 후 복구할 수 없습니다.
      </p>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="delOpen = false"
          >
            취소
          </button>
          <button
            type="button"
            :disabled="deleting"
            class="rounded-md bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            @click="confirmDelete"
          >
            {{ deleting ? '삭제 중…' : '삭제' }}
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
