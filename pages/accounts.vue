<!--
  pages/accounts.vue — 계정 관리.
  실 데이터: GET /auth/me (현재 로그인 세션).
  목록: 목업 (GET /accounts 엔드포인트 미구현 → API 담당 협의 필요).
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
  lastLogin?: string
  isActive?: boolean
  isMock?: boolean
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

function roleOf(level: number) {
  if (level >= 9) return 'admin'
  if (level >= 5) return 'developer'
  return 'agent'
}

/* 목업 사용자 목록 (현재 사용자로 첫 번째 행 교체) */
const MOCK_USERS: User[] = [
  { id: 1, loginId: 'dotype', name: '김도형', email: 'dotype@malgnsoft.com', company: '맑은소프트', level: 9, lastLogin: '2026-06-11T09:00:00', isActive: true },
  { id: 2, loginId: 'dev01',  name: '박지훈', email: 'jihoon@malgnsoft.com', company: '맑은소프트', level: 7, lastLogin: '2026-06-10T18:32:00', isActive: true, isMock: true },
  { id: 3, loginId: 'cs01',   name: '이수연', email: 'suyeon@malgnsoft.com', company: '맑은소프트', level: 3, lastLogin: '2026-06-09T11:14:00', isActive: true, isMock: true },
  { id: 4, loginId: 'cs02',   name: '정민석', email: 'minsuk@malgnsoft.com', company: '맑은소프트', level: 3, lastLogin: '2026-05-28T15:05:00', isActive: false, isMock: true },
]

const meSession = useAuthUser()
const rows = ref<User[]>([])
const pending = ref(true)

onMounted(async () => {
  // 현재 세션으로 첫 번째 행 실값 반영
  const session = meSession.value
  const merged = MOCK_USERS.map(u => {
    if (session && (u.loginId === session.loginId || u.email === session.email)) {
      return { ...u, name: session.name, email: session.email, company: session.company, level: session.level, isMock: false }
    }
    return u
  })
  rows.value = merged
  pending.value = false
})

function fmtTime(iso?: string) {
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
      description="운영자·개발자·상담사 계정 및 역할을 관리합니다."
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-400">계정 목록 API 보강 예정</span>
          <button
            type="button"
            disabled
            title="계정 목록 API 보강 후 활성화"
            class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-[13px] font-semibold text-slate-400"
          >
            <UserPlus class="size-4" />초대
          </button>
        </div>
      </template>
    </AdminPageHeader>

    <!-- API 보강 안내 -->
    <div class="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
      <span class="font-semibold">안내</span>
      <span>현재 세션(자신) 정보는 실값이며, 나머지 행은 목업입니다.
        <code class="font-mono">GET /accounts</code> · <code class="font-mono">PATCH /accounts/:id/role</code> 신설 후 완전 연동됩니다.</span>
    </div>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="rows"
      :pending="pending"
      :error="null"
      empty-text="표시할 계정이 없습니다."
    >
      <template #default="{ row }: { row: User }">
        <tr class="hover:bg-slate-50" :class="row.isMock ? 'opacity-70' : ''">
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
                  <span v-if="row.isMock" class="ml-1 text-[10px] font-normal text-slate-400">(목업)</span>
                </p>
                <p class="text-[11px] text-slate-500">{{ row.email }}</p>
              </div>
            </div>
          </td>
          <td class="px-3 py-3 text-[12px] text-slate-700">{{ row.company }}</td>
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
      v-if="!pending && !rows.length"
      title="표시할 계정이 없습니다"
      description="계정 목록 API 연동 후 채워집니다."
      class="mt-4"
    >
      <template #icon><Users class="size-5 text-slate-400" /></template>
    </AdminEmptyState>
  </div>
</template>
