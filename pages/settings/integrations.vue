<!--
  pages/settings/integrations.vue — 외부 연동.
  API: GET /settings/integrations · PUT /settings/integrations/:key
  ⚠ 시크릿(Webhook URL·API Key 등)은 DB 저장·반환 금지 — secret_set 플래그/연결상태/설명만 갱신.
     실제 시크릿은 `wrangler secret`로 설정.
-->
<script setup lang="ts">
import { Plug, CheckCircle, XCircle, AlertTriangle, ExternalLink, KeyRound } from 'lucide-vue-next'

useHead({ title: '외부 연동 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

const meSession = useAuthUser()
const isAdmin = computed(() => (meSession.value?.level ?? 0) >= 9)

type IntegrationStatus = 'connected' | 'disconnected' | 'error'
type Integration = {
  id: string
  name: string
  category: string
  description: string
  status: IntegrationStatus
  detail: string
  config: unknown
  secretSet: boolean
  docsUrl: string | null
  sortOrder: number
}

const items = ref<Integration[]>([])
const pending = ref(true)
const error = ref<string | null>(null)

const categories = computed(() => [...new Set(items.value.map(i => i.category))])

const STATUS_META: Record<IntegrationStatus, { label: string; cls: string; iconCls: string }> = {
  connected:    { label: '연결됨',    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', iconCls: 'text-emerald-500' },
  disconnected: { label: '연결 안 됨', cls: 'bg-slate-50 text-slate-500 ring-slate-200',       iconCls: 'text-slate-400' },
  error:        { label: '오류',      cls: 'bg-rose-50 text-rose-700 ring-rose-200',          iconCls: 'text-rose-500' },
}
const STATUS_OPTS: { value: IntegrationStatus; label: string }[] = [
  { value: 'connected', label: '연결됨' },
  { value: 'disconnected', label: '연결 안 됨' },
  { value: 'error', label: '오류' },
]

async function load() {
  pending.value = true
  error.value = null
  try {
    const res = await fetch(`${API_BASE}/settings/integrations`, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) throw new Error(res.status === 403 ? '연동 조회 권한이 없습니다.' : `API ${res.status}`)
    items.value = ((await res.json()) as { rows: Integration[] }).rows ?? []
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    pending.value = false
  }
}
onMounted(load)

/* ── 편집 슬라이드오버 ── */
const editing = ref<Integration | null>(null)
const slideOverOpen = computed({
  get: () => editing.value !== null,
  set: (v: boolean) => { if (!v) editing.value = null },
})
const editForm = reactive({
  connStatus: 'disconnected' as IntegrationStatus,
  detail: '',
  secretSet: false,
})
const saving = ref(false)
const saveErr = ref<string | null>(null)

function openConfig(item: Integration) {
  if (!isAdmin.value) return
  editing.value = item
  editForm.connStatus = item.status
  editForm.detail = item.detail
  editForm.secretSet = item.secretSet
  saveErr.value = null
}

async function save() {
  if (!editing.value || !isAdmin.value) return
  saving.value = true
  saveErr.value = null
  try {
    const res = await fetch(`${API_BASE}/settings/integrations/${editing.value.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connStatus: editForm.connStatus,
        detail: editForm.detail,
        secretSet: editForm.secretSet,
      }),
    })
    if (!res.ok) {
      if (res.status === 403) throw new Error('admin 권한이 필요합니다.')
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `API ${res.status}`)
    }
    const updated = (await res.json()) as Integration
    const idx = items.value.findIndex(i => i.id === updated.id)
    if (idx >= 0) items.value[idx] = updated
    editing.value = null
  } catch (e) {
    saveErr.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="설정"
      title="외부 연동"
      description="슬랙·이메일·티켓·SSO·스토리지·AI 인프라 연결 상태를 관리합니다."
    />

    <!-- 시크릿 정책 안내 -->
    <div class="mb-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] text-slate-600">
      <KeyRound class="mt-0.5 size-4 shrink-0 text-slate-400" />
      <span>Webhook URL·API Key 등 <span class="font-semibold">시크릿 값은 이 화면에 저장되지 않습니다.</span> 실제 시크릿은 <code class="font-mono">wrangler secret</code>로 설정하고, 여기서는 연결 상태·설명·시크릿 설정 여부(플래그)만 관리합니다.</span>
    </div>

    <div v-if="error" class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] text-rose-700">
      연동 목록을 불러오지 못했습니다 — {{ error }}
    </div>
    <p v-if="!isAdmin && !pending" class="mb-4 text-[11px] text-slate-400">연동 설정 변경은 admin 권한이 필요합니다. 현재 계정은 조회만 가능합니다.</p>

    <div v-if="pending" class="rounded-xl border border-slate-200 bg-white px-5 py-16 text-center text-[13px] text-slate-400">
      연동 목록을 불러오는 중…
    </div>

    <AdminEmptyState
      v-else-if="!error && !items.length"
      title="등록된 연동이 없습니다"
      description="외부 연동 카탈로그가 비어 있습니다."
    >
      <template #icon><Plug class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <!-- 카테고리별 카드 그리드 -->
    <template v-else>
      <div v-for="cat in categories" :key="cat" class="mb-6">
        <h2 class="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ cat }}</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="item in items.filter(i => i.category === cat)"
            :key="item.id"
            class="flex flex-col rounded-xl border bg-white px-5 py-4 transition hover:shadow-sm"
            :class="item.status === 'connected' ? 'border-emerald-200' : item.status === 'error' ? 'border-rose-200' : 'border-slate-200'"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-[14px] font-semibold text-slate-900">{{ item.name }}</p>
              <span
                class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
                :class="STATUS_META[item.status].cls"
              >
                <CheckCircle v-if="item.status === 'connected'" class="size-3" :class="STATUS_META[item.status].iconCls" />
                <AlertTriangle v-else-if="item.status === 'error'" class="size-3" :class="STATUS_META[item.status].iconCls" />
                <XCircle v-else class="size-3" :class="STATUS_META[item.status].iconCls" />
                {{ STATUS_META[item.status].label }}
              </span>
            </div>
            <p class="mt-1.5 flex-1 text-[12px] text-slate-500">{{ item.description }}</p>
            <p v-if="item.detail" class="mt-1 font-mono text-[11px]" :class="item.status === 'connected' ? 'text-emerald-600' : 'text-slate-400'">
              {{ item.detail }}
            </p>
            <p v-if="item.secretSet" class="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-slate-500">
              <KeyRound class="size-3" />시크릿 설정됨
            </p>

            <div class="mt-3 flex items-center gap-2">
              <button
                type="button"
                :disabled="!isAdmin"
                class="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition"
                :class="!isAdmin
                  ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                  : 'border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'"
                :title="isAdmin ? '연결 설정' : 'admin 권한 필요'"
                @click="openConfig(item)"
              >
                연결 설정
              </button>
              <a
                v-if="item.docsUrl"
                :href="item.docsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600"
              >
                문서 <ExternalLink class="size-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 연결 설정 슬라이드오버 -->
    <AdminSlideOver
      v-model="slideOverOpen"
      :title="editing?.name ?? '연결 설정'"
      size="md"
    >
      <div v-if="editing" class="space-y-4 px-6 py-4">
        <p class="text-[13px] text-slate-600">{{ editing.description }}</p>

        <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-600">
          <p class="inline-flex items-center gap-1 font-semibold text-slate-700"><KeyRound class="size-3.5" />시크릿 보관 정책</p>
          <p class="mt-0.5">Webhook URL·API Key 같은 시크릿 값은 저장하지 않습니다. <code class="font-mono">wrangler secret put</code>로 설정한 뒤, 아래 “시크릿 설정됨” 플래그를 켜 두면 운영 화면에 반영됩니다.</p>
        </div>

        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">연결 상태</label>
          <select
            v-model="editForm.connStatus"
            class="h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option v-for="o in STATUS_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>

        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">상태 설명</label>
          <input
            v-model="editForm.detail"
            type="text"
            placeholder="e.g. malgn-helper-assets"
            class="h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div class="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
          <div>
            <p class="text-[12px] font-medium text-slate-700">시크릿 설정됨</p>
            <p class="text-[11px] text-slate-400">wrangler secret로 시크릿을 등록했다면 켜세요.</p>
          </div>
          <label class="inline-flex cursor-pointer items-center gap-2">
            <div
              class="relative h-5 w-9 rounded-full transition"
              :class="editForm.secretSet ? 'bg-primary-500' : 'bg-slate-300'"
              @click="editForm.secretSet = !editForm.secretSet"
            >
              <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" :class="editForm.secretSet ? 'left-4' : 'left-0.5'" />
            </div>
          </label>
        </div>

        <div v-if="saveErr" class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ saveErr }}</div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="slideOverOpen = false"
          >닫기</button>
          <button
            type="button"
            :disabled="saving || !isAdmin"
            class="rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            @click="save"
          >{{ saving ? '저장 중…' : '저장' }}</button>
        </div>
      </template>
    </AdminSlideOver>
  </div>
</template>
