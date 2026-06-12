<!--
  pages/catalog.vue — 토픽·서비스 카탈로그 CRUD.
  API: GET/POST/PUT/DELETE /topics(/:id) · /services(/:id).
  active 토글·soft-delete(status=-1) 반영. 쓰기는 admin 권한 필요(서버 강제).
-->
<script setup lang="ts">
import { Tag, Plus, Pencil, Trash2 } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '토픽·서비스 카탈로그 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

type Topic = { id: number; slug: string; scope: 'common' | 'service'; label: string; description: string; sortOrder: number; active: boolean }
type Service = { id: number; slug: string; name: string; note: string; sortOrder: number; active: boolean }

const SCOPE_CLS: Record<Topic['scope'], string> = {
  common: 'bg-violet-50 text-violet-700',
  service: 'bg-sky-50 text-sky-700',
}

const meSession = useAuthUser()
const isAdmin = computed(() => (meSession.value?.level ?? 0) >= 9)

const TOPIC_COLS: TableColumn[] = [
  { key: 'slug',    label: 'slug' },
  { key: 'scope',   label: 'scope',   align: 'center' },
  { key: 'label',   label: '라벨' },
  { key: 'desc',    label: '설명' },
  { key: 'order',   label: '정렬',    align: 'right' },
  { key: 'active',  label: '상태',    align: 'center' },
  { key: 'actions', label: '',        align: 'right', class: 'px-5 pl-3 w-20' },
]

const SERVICE_COLS: TableColumn[] = [
  { key: 'slug',    label: 'slug' },
  { key: 'name',    label: '이름' },
  { key: 'note',    label: '비고' },
  { key: 'order',   label: '정렬',  align: 'right' },
  { key: 'active',  label: '상태',  align: 'center' },
  { key: 'actions', label: '',      align: 'right', class: 'px-5 pl-3 w-20' },
]

const tab = ref<'topics' | 'services'>('topics')

/* ── 목록 로드 ── */
const topics = ref<Topic[]>([])
const services = ref<Service[]>([])
const pending = ref(true)
const error = ref<string | null>(null)

async function load() {
  pending.value = true
  error.value = null
  try {
    const [tRes, sRes] = await Promise.all([
      fetch(`${API_BASE}/topics`, { credentials: 'include', cache: 'no-store' }),
      fetch(`${API_BASE}/services`, { credentials: 'include', cache: 'no-store' }),
    ])
    if (!tRes.ok) throw new Error(`토픽 ${tRes.status}`)
    if (!sRes.ok) throw new Error(`서비스 ${sRes.status}`)
    topics.value = ((await tRes.json()) as { rows: Topic[] }).rows ?? []
    services.value = ((await sRes.json()) as { rows: Service[] }).rows ?? []
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    pending.value = false
  }
}
onMounted(load)

/* ── 생성·편집 모달 ── */
const modalOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const saveErr = ref<string | null>(null)
const form = reactive({
  slug: '',
  scope: 'common' as Topic['scope'],
  label: '',          // 토픽: label / 서비스: name
  description: '',     // 토픽: description / 서비스: note
  sortOrder: 0,
  active: true,
})

function openCreate() {
  if (!isAdmin.value) return
  editingId.value = null
  form.slug = ''
  form.scope = tab.value === 'topics' ? 'common' : 'service'
  form.label = ''
  form.description = ''
  form.sortOrder = 0
  form.active = true
  saveErr.value = null
  modalOpen.value = true
}

function openEditTopic(row: Topic) {
  if (!isAdmin.value) return
  editingId.value = row.id
  form.slug = row.slug
  form.scope = row.scope
  form.label = row.label
  form.description = row.description
  form.sortOrder = row.sortOrder
  form.active = row.active
  saveErr.value = null
  modalOpen.value = true
}

function openEditService(row: Service) {
  if (!isAdmin.value) return
  editingId.value = row.id
  form.slug = row.slug
  form.label = row.name
  form.description = row.note
  form.sortOrder = row.sortOrder
  form.active = row.active
  saveErr.value = null
  modalOpen.value = true
}

async function save() {
  if (!form.slug.trim() || !form.label.trim()) {
    saveErr.value = tab.value === 'topics' ? 'slug · 라벨은 필수입니다.' : 'slug · 이름은 필수입니다.'
    return
  }
  saving.value = true
  saveErr.value = null
  try {
    const isTopic = tab.value === 'topics'
    const base = isTopic ? `${API_BASE}/topics` : `${API_BASE}/services`
    const url = editingId.value ? `${base}/${editingId.value}` : base
    const body = isTopic
      ? { slug: form.slug.trim(), scope: form.scope, label: form.label.trim(), description: form.description.trim(), sortOrder: Number(form.sortOrder), active: form.active }
      : { slug: form.slug.trim(), name: form.label.trim(), note: form.description.trim(), sortOrder: Number(form.sortOrder), active: form.active }
    const res = await fetch(url, {
      method: editingId.value ? 'PUT' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      if (res.status === 403) throw new Error('admin 권한이 필요합니다.')
      const j = (await res.json().catch(() => ({}))) as { error?: string }
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

/* ── active 토글 (PUT) ── */
const togglingId = ref<number | null>(null)
async function toggleActive(kind: 'topics' | 'services', id: number, next: boolean) {
  if (!isAdmin.value || togglingId.value) return
  togglingId.value = id
  try {
    const res = await fetch(`${API_BASE}/${kind}/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: next }),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    if (kind === 'topics') {
      const t = topics.value.find(x => x.id === id)
      if (t) t.active = next
    } else {
      const s = services.value.find(x => x.id === id)
      if (s) s.active = next
    }
  } catch {
    await load()
  } finally {
    togglingId.value = null
  }
}

/* ── 삭제(soft) ── */
const delTarget = ref<{ kind: 'topics' | 'services'; id: number; label: string } | null>(null)
const delOpen = ref(false)
const deleting = ref(false)

function openDelete(kind: 'topics' | 'services', id: number, label: string) {
  if (!isAdmin.value) return
  delTarget.value = { kind, id, label }
  delOpen.value = true
}

async function confirmDelete() {
  if (!delTarget.value) return
  deleting.value = true
  try {
    const res = await fetch(`${API_BASE}/${delTarget.value.kind}/${delTarget.value.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    delOpen.value = false
    delTarget.value = null
    await load()
  } catch { /* silent */ } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="토픽·서비스 카탈로그"
      description="표준답변 분류용 topic(scope=common/service)과 service_tag(LMS 패밀리) 카탈로그를 관리합니다."
    >
      <template #actions>
        <button
          type="button"
          :disabled="!isAdmin"
          :title="isAdmin ? '항목 추가' : 'admin 권한 필요'"
          class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-semibold transition"
          :class="isAdmin
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'"
          @click="openCreate"
        >
          <Plus class="size-4" />추가
        </button>
      </template>
    </AdminPageHeader>

    <!-- 탭 -->
    <div class="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
      <button
        v-for="t in [{ value: 'topics', label: '토픽' }, { value: 'services', label: '서비스' }]"
        :key="t.value"
        type="button"
        class="rounded-md px-4 py-1.5 text-[13px] font-medium transition"
        :class="tab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
        @click="tab = (t.value as 'topics' | 'services')"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 토픽 테이블 -->
    <AdminDataTable
      v-if="tab === 'topics'"
      :columns="TOPIC_COLS"
      :rows="topics"
      :pending="pending"
      :error="error"
      empty-text="등록된 토픽이 없습니다."
    >
      <template #default="{ row }: { row: Topic }">
        <tr class="hover:bg-slate-50" :class="row.active ? '' : 'opacity-60'">
          <td class="px-5 py-3 font-mono text-[12px] text-slate-700">{{ row.slug }}</td>
          <td class="px-3 py-3 text-center">
            <span class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" :class="SCOPE_CLS[row.scope]">
              {{ row.scope }}
            </span>
          </td>
          <td class="px-3 py-3 text-[13px] font-medium text-slate-800">{{ row.label }}</td>
          <td class="max-w-xs px-3 py-3 text-[12px] text-slate-500"><span class="line-clamp-1">{{ row.description || '—' }}</span></td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-500">{{ row.sortOrder }}</td>
          <td class="px-3 py-3 text-center">
            <button
              type="button"
              :disabled="!isAdmin || togglingId === row.id"
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-60"
              :class="row.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
              :title="isAdmin ? '클릭하여 토글' : 'admin 권한 필요'"
              @click="toggleActive('topics', row.id, !row.active)"
            >
              {{ row.active ? '활성' : '비활성' }}
            </button>
          </td>
          <td class="px-5 pl-3 py-3 text-right">
            <div class="flex items-center justify-end gap-1">
              <button
                type="button"
                :disabled="!isAdmin"
                class="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                title="편집"
                @click="openEditTopic(row)"
              >
                <Pencil class="size-3.5" />
              </button>
              <button
                type="button"
                :disabled="!isAdmin"
                class="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                title="삭제"
                @click="openDelete('topics', row.id, row.label)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 서비스 테이블 -->
    <AdminDataTable
      v-else
      :columns="SERVICE_COLS"
      :rows="services"
      :pending="pending"
      :error="error"
      empty-text="등록된 서비스가 없습니다."
    >
      <template #default="{ row }: { row: Service }">
        <tr class="hover:bg-slate-50" :class="row.active ? '' : 'opacity-60'">
          <td class="px-5 py-3 font-mono text-[12px] text-slate-700">{{ row.slug }}</td>
          <td class="px-3 py-3 text-[13px] font-medium text-slate-800">{{ row.name }}</td>
          <td class="max-w-xs px-3 py-3 text-[12px] text-slate-500"><span class="line-clamp-1">{{ row.note || '—' }}</span></td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-500">{{ row.sortOrder }}</td>
          <td class="px-3 py-3 text-center">
            <button
              type="button"
              :disabled="!isAdmin || togglingId === row.id"
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-60"
              :class="row.active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
              :title="isAdmin ? '클릭하여 토글' : 'admin 권한 필요'"
              @click="toggleActive('services', row.id, !row.active)"
            >
              {{ row.active ? '활성' : '비활성' }}
            </button>
          </td>
          <td class="px-5 pl-3 py-3 text-right">
            <div class="flex items-center justify-end gap-1">
              <button
                type="button"
                :disabled="!isAdmin"
                class="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                title="편집"
                @click="openEditService(row)"
              >
                <Pencil class="size-3.5" />
              </button>
              <button
                type="button"
                :disabled="!isAdmin"
                class="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                title="삭제"
                @click="openDelete('services', row.id, row.name)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </td>
        </tr>
      </template>
    </AdminDataTable>

    <p v-if="!isAdmin" class="mt-3 text-[11px] text-slate-400">
      편집·추가·삭제는 admin 권한이 필요합니다. 현재 계정은 조회만 가능합니다.
    </p>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="!pending && !error && (tab === 'topics' ? !topics.length : !services.length)"
      :title="tab === 'topics' ? '등록된 토픽이 없습니다' : '등록된 서비스가 없습니다'"
      description="운영자가 추가한 항목이 여기에 표시됩니다."
      class="mt-4"
    >
      <template #icon><Tag class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <!-- 생성 / 편집 모달 -->
    <AdminModal
      v-model="modalOpen"
      :title="editingId ? (tab === 'topics' ? '토픽 편집' : '서비스 편집') : (tab === 'topics' ? '새 토픽' : '새 서비스')"
      size="md"
    >
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">slug <span class="text-amber-600">*</span></label>
          <input
            v-model="form.slug"
            type="text"
            placeholder="e.g. login"
            class="h-9 w-full rounded-md bg-slate-50 px-3 font-mono text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div v-if="tab === 'topics'">
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">scope <span class="text-amber-600">*</span></label>
          <select
            v-model="form.scope"
            class="h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="common">common</option>
            <option value="service">service</option>
          </select>
        </div>

        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">
            {{ tab === 'topics' ? '라벨' : '이름' }} <span class="text-amber-600">*</span>
          </label>
          <input
            v-model="form.label"
            type="text"
            :placeholder="tab === 'topics' ? 'e.g. 로그인/계정' : 'e.g. STEP 온라인'"
            class="h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">{{ tab === 'topics' ? '설명' : '비고' }}</label>
          <textarea
            v-model="form.description"
            rows="2"
            class="w-full resize-none rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div class="flex items-center gap-4">
          <div class="flex-1">
            <label class="mb-1.5 block text-[12px] font-medium text-slate-700">정렬</label>
            <input
              v-model.number="form.sortOrder"
              type="number"
              class="h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div class="flex-1">
            <label class="mb-1.5 block text-[12px] font-medium text-slate-700">상태</label>
            <label class="inline-flex h-9 cursor-pointer items-center gap-2">
              <div
                class="relative h-5 w-9 rounded-full transition"
                :class="form.active ? 'bg-primary-500' : 'bg-slate-300'"
                @click="form.active = !form.active"
              >
                <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" :class="form.active ? 'left-4' : 'left-0.5'" />
              </div>
              <span class="text-[12px]" :class="form.active ? 'text-primary-700' : 'text-slate-500'">{{ form.active ? '활성' : '비활성' }}</span>
            </label>
          </div>
        </div>

        <div v-if="saveErr" class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ saveErr }}</div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="modalOpen = false"
          >취소</button>
          <button
            type="button"
            :disabled="saving"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            @click="save"
          >{{ saving ? '저장 중…' : (editingId ? '저장' : '추가') }}</button>
        </div>
      </template>
    </AdminModal>

    <!-- 삭제 확인 -->
    <AdminModal v-model="delOpen" title="삭제 확인" size="sm">
      <p class="text-[13px] text-slate-700">
        <span class="font-semibold">{{ delTarget?.label }}</span> 항목을 삭제하시겠습니까?<br />
        삭제 후에는 목록에서 제외됩니다.
      </p>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="delOpen = false"
          >취소</button>
          <button
            type="button"
            :disabled="deleting"
            class="rounded-md bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            @click="confirmDelete"
          >{{ deleting ? '삭제 중…' : '삭제' }}</button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
