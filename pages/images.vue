<!--
  pages/images.vue — 이미지 카탈로그 (hp_image_asset).
  API: GET /image-assets · GET /image-assets/:id
-->
<script setup lang="ts">
import { ExternalLink, Image as ImageIcon } from 'lucide-vue-next'

useHead({ title: '이미지 카탈로그 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

type Img = {
  id: number
  srcPath: string
  absoluteUrl: string
  title: string
  description: string
  source: 'inquiry' | 'reply' | null
  firstSeenPostId: number | null
  firstSeenProjectId: number | null
  usageCount: number
  lastUsedAt: string | null
  analyzedAt: string
  llmModel: string | null
}

const SOURCE_OPTS = [
  { value: '', label: '전체' },
  { value: 'inquiry', label: '문의' },
  { value: 'reply', label: '응답' },
]

// 필터: draft 입력 → '조회'/Enter 시 applied(search/sourceFilter)로 반영 후 load()
const draftSearch = ref('')
const draftSource = ref<'' | 'inquiry' | 'reply'>('')
const search = ref('')
const sourceFilter = ref<'' | 'inquiry' | 'reply'>('')
const rows = ref<Img[]>([])
const total = ref(0)
const pending = ref(true)
const error = ref<string | null>(null)

/* 서버 페이지네이션 (limit/offset). page = floor(offset/limit)+1 */
const LIMIT = 60
const offset = ref(0)
const page = computed(() => Math.floor(offset.value / LIMIT) + 1)

const selected = ref<Img | null>(null)
const modalOpen = computed({
  get: () => selected.value !== null,
  set: (v) => { if (!v) selected.value = null },
})

async function load() {
  pending.value = true
  error.value = null
  try {
    const url = new URL(`${API_BASE}/image-assets`)
    url.searchParams.set('limit', String(LIMIT))
    url.searchParams.set('offset', String(offset.value))
    if (search.value.trim()) url.searchParams.set('search', search.value.trim())
    if (sourceFilter.value) url.searchParams.set('source', sourceFilter.value)
    const res = await apiFetch(url, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = (await res.json()) as { total: number; rows: Img[] }
    rows.value = data.rows
    total.value = data.total
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    pending.value = false
  }
}
onMounted(load)

function applyFilter() {
  search.value = draftSearch.value
  sourceFilter.value = draftSource.value
  offset.value = 0 // 필터/검색 변경 시 첫 페이지로
  load()
}
function resetFilter() {
  draftSearch.value = ''
  draftSource.value = ''
  search.value = ''
  sourceFilter.value = ''
  offset.value = 0
  load()
}
function goPage(p: number) {
  offset.value = (p - 1) * LIMIT
  load()
}

const selectCls =
  'h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="이미지 카탈로그"
      description="PMS 자산 이미지의 Vision 자동 캡션·설명 (`hp_image_asset`)"
    />

    <!-- 필터 바 -->
    <AdminFilterBar @search="applyFilter" @reset="resetFilter">
      <AdminFilterField label="출처">
        <select v-model="draftSource" :class="selectCls">
          <option v-for="o in SOURCE_OPTS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </AdminFilterField>
      <AdminFilterField label="검색어" grow>
        <AdminSearchInput
          v-model="draftSearch"
          placeholder="title · description 검색 후 Enter"
          @keyup.enter="applyFilter"
        />
      </AdminFilterField>
    </AdminFilterBar>

    <!-- 결과 수 -->
    <div class="mb-3 flex items-center justify-end text-[12px] text-slate-500">
      총
      <span class="mx-1 font-mono font-semibold tabular-nums text-slate-800">
        {{ total.toLocaleString() }}
      </span>건
    </div>

    <!-- 로딩 -->
    <div
      v-if="pending"
      class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500"
    >
      로딩 중…
    </div>

    <!-- 에러 -->
    <div
      v-else-if="error"
      class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
    >
      {{ error }}
    </div>

    <!-- 그리드 -->
    <section
      v-else-if="rows.length > 0"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <button
        v-for="r in rows"
        :key="r.id"
        type="button"
        class="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-primary-300 hover:shadow-md"
        @click="selected = r"
      >
        <div class="aspect-[4/3] overflow-hidden bg-slate-100">
          <img
            :src="r.absoluteUrl"
            :alt="r.title"
            class="size-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        </div>
        <div class="p-3">
          <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
            <span
              class="rounded-md px-1.5 py-0.5 font-semibold"
              :class="
                r.source === 'reply'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-violet-50 text-violet-700'
              "
              >{{ r.source === 'reply' ? '응답' : '문의' }}</span
            >
            <span class="text-slate-400">·</span>
            <span class="font-mono text-slate-500">사용 {{ r.usageCount }}회</span>
          </div>
          <p class="mt-1.5 line-clamp-1 text-[13px] font-semibold text-slate-900">
            {{ r.title }}
          </p>
          <p class="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">
            {{ r.description }}
          </p>
        </div>
      </button>
    </section>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-else
      title="조건에 맞는 이미지 없음"
      description="검색어나 필터를 변경해 보세요."
    >
      <template #icon>
        <ImageIcon class="size-5 text-slate-400" />
      </template>
    </AdminEmptyState>

    <!-- 페이저 (그리드 레이아웃이라 DataTable footer 미사용) -->
    <AdminPagination
      v-if="!pending && !error && rows.length > 0"
      :page="page"
      :page-size="LIMIT"
      :total="total"
      class="mt-4"
      @update:page="goPage"
    />

    <!-- 상세 모달 -->
    <AdminModal v-model="modalOpen" size="lg">
      <template v-if="selected">
        <div class="flex flex-col">
          <div class="overflow-auto bg-slate-50">
            <img
              :src="selected.absoluteUrl"
              :alt="selected.title"
              class="max-h-[55vh] w-full object-contain"
            />
          </div>
          <div class="border-t border-slate-100 p-5">
            <div class="flex items-center gap-2 text-[10px] uppercase tracking-wider">
              <span
                class="rounded-md px-1.5 py-0.5 font-semibold"
                :class="
                  selected.source === 'reply'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-violet-50 text-violet-700'
                "
                >{{ selected.source === 'reply' ? '응답' : '문의' }}</span
              >
              <span class="text-slate-400">·</span>
              <span class="font-mono text-slate-500">id #{{ selected.id }}</span>
              <span class="text-slate-400">·</span>
              <span class="font-mono text-slate-500">사용 {{ selected.usageCount }}회</span>
            </div>
            <h2 class="mt-2 text-[18px] font-bold text-slate-900">{{ selected.title }}</h2>
            <p class="mt-2 text-[13px] leading-relaxed text-slate-700">
              {{ selected.description }}
            </p>
            <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[11.5px]">
              <div>
                <dt class="text-slate-400">출처 게시물</dt>
                <dd class="font-mono text-slate-700">
                  post #{{ selected.firstSeenPostId ?? '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-slate-400">프로젝트</dt>
                <dd class="font-mono text-slate-700">
                  project #{{ selected.firstSeenProjectId ?? '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-slate-400">분석 시각</dt>
                <dd class="font-mono text-slate-700">{{ fmtTime(selected.analyzedAt) }}</dd>
              </div>
              <div>
                <dt class="text-slate-400">LLM</dt>
                <dd class="font-mono text-slate-700">{{ selected.llmModel ?? '—' }}</dd>
              </div>
              <div class="col-span-2">
                <dt class="text-slate-400">원본 경로</dt>
                <dd class="break-all font-mono text-slate-700">{{ selected.srcPath }}</dd>
              </div>
            </dl>
            <div class="mt-4 flex justify-end gap-2">
              <a
                :href="selected.absoluteUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink class="size-3.5" />원본 새 탭
              </a>
            </div>
          </div>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
