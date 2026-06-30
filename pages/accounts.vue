<!--
  pages/accounts.vue — 계정 관리.
  API: GET /accounts (검색 q · 페이징 page/pageSize, tb_user 직원 스코프 목록).
-->
<script setup lang="ts">
import { UserPlus, Users } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '계정 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

type User = {
  id: number
  loginId: string
  name: string
  email: string
  company: string
  level: number
  lastLogin: string | null
  isActive: boolean
}

type AccountsResponse = {
  page: number
  pageSize: number
  total: number
  rows: User[]
}

const COLUMNS: TableColumn[] = [
  { key: 'user',      label: '이름 / 이메일' },
  { key: 'company',   label: '회사' },
  { key: 'role',      label: '역할',        align: 'center' },
  { key: 'lastLogin', label: '마지막 로그인', align: 'right'  },
  { key: 'status',    label: '상태',         align: 'center' },
]

const ROLE_META: Record<string, { label: string; cls: string }> = {
  admin:     { label: 'admin',     cls: 'bg-primary-100 text-primary-800' },
  developer: { label: 'developer', cls: 'bg-violet-100 text-violet-800' },
  agent:     { label: 'agent',     cls: 'bg-slate-100 text-slate-700' },
}

const PAGE_SIZE = 20

const meSession = useAuthUser()
const search = ref('')
const page = ref(1)
const total = ref(0)
const rows = ref<User[]>([])
const pending = ref(true)
const error = ref<string | null>(null)

async function load() {
  pending.value = true
  error.value = null
  try {
    const url = new URL(`${API_BASE}/accounts`)
    url.searchParams.set('page', String(page.value))
    url.searchParams.set('pageSize', String(PAGE_SIZE))
    if (search.value.trim()) url.searchParams.set('q', search.value.trim())
    const res = await apiFetch(url, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) throw new Error(res.status === 403 ? '계정 목록 조회 권한이 없습니다.' : `API ${res.status}`)
    const data = (await res.json()) as AccountsResponse
    rows.value = data.rows ?? []
    total.value = data.total ?? rows.value.length
  } catch (e) {
    error.value = (e as Error).message
    rows.value = []
    total.value = 0
  } finally {
    pending.value = false
  }
}

onMounted(load)

let debounce: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => { page.value = 1; load() }, 400)
})
watch(page, load)

function isMe(row: User) {
  const s = meSession.value
  return !!s && (s.id === row.id || s.loginId === row.loginId || s.email === row.email)
}

function roleOf(level: number) {
  if (level >= 9) return 'admin'
  if (level >= 5) return 'developer'
  return 'agent'
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="시스템"
      title="계정"
      description="운영자·개발자·상담사 계정 및 역할을 관리합니다. (직원 스코프)"
    >
      <template #actions>
        <button
          type="button"
          disabled
          title="계정 초대 API 보강 후 활성화"
          class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-400"
        >
          <UserPlus class="size-4" />초대
        </button>
      </template>
    </AdminPageHeader>

    <!-- 검색 -->
    <div class="mb-4 flex items-center gap-3">
      <AdminSearchInput v-model="search" placeholder="이름·아이디·이메일 검색" class="max-w-sm flex-1" />
      <span class="ml-auto text-[12px] text-slate-500">
        총 <span class="font-mono font-semibold text-slate-800">{{ total.toLocaleString() }}</span>명
      </span>
    </div>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="rows"
      :pending="pending"
      :error="error"
      empty-text="표시할 계정이 없습니다."
    >
      <template #footer>
        <AdminPagination :page="page" :page-size="PAGE_SIZE" :total="total" @update:page="page = $event" />
      </template>
      <template #default="{ row }: { row: User }">
        <tr class="hover:bg-slate-50">
          <td class="px-5 py-3">
            <div class="flex items-center gap-2.5">
              <span
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[12px] font-semibold text-primary-700"
              >
                {{ (row.name || row.loginId).slice(0, 2) }}
              </span>
              <div>
                <p class="text-[13px] font-semibold text-slate-900">
                  {{ row.name || row.loginId }}
                  <span v-if="isMe(row)" class="ml-1 rounded bg-primary-50 px-1 text-[10px] font-medium text-primary-600">나</span>
                </p>
                <p class="text-[11px] text-slate-500">{{ row.email || '—' }}</p>
              </div>
            </div>
          </td>
          <td class="px-3 py-3 text-[12px] text-slate-700">{{ row.company || '—' }}</td>
          <td class="px-3 py-3 text-center">
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="ROLE_META[roleOf(row.level)].cls"
            >
              {{ ROLE_META[roleOf(row.level)].label }}
            </span>
          </td>
          <td class="px-3 py-3 text-right font-mono text-[11px] text-slate-500">
            {{ fmtTime(row.lastLogin) }}
          </td>
          <td class="px-5 py-3 text-center">
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              :class="row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
            >
              {{ row.isActive ? '활성' : '비활성' }}
            </span>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="!pending && !error && !rows.length"
      title="표시할 계정이 없습니다"
      :description="search ? '검색 조건에 맞는 계정이 없습니다.' : '직원 계정이 없습니다.'"
      class="mt-4"
    >
      <template #icon><Users class="size-5 text-slate-400" /></template>
    </AdminEmptyState>
  </div>
</template>
