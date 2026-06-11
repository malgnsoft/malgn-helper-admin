<!--
  pages/materials.vue — 자료 관리 (목업).
  실 API /materials/* 는 OpenSearch 인덱싱 파이프라인 셋업 후 신설 예정.
-->
<script setup lang="ts">
import { FileText, Upload, RefreshCw } from 'lucide-vue-next'
import type { TableColumn } from '~/components/admin/DataTable.vue'

useHead({ title: '자료 · 맑은도우미 Admin' })

type Material = {
  id: number
  title: string
  kind: 'file' | 'url' | 'video_url'
  format: string
  status: 'pending' | 'processing' | 'indexed' | 'failed'
  chunks: number
  uploader: string
  createdAt: string
}

const KIND_LABEL: Record<Material['kind'], string> = { file: '파일', url: 'URL', video_url: '동영상' }
const KIND_CLS:   Record<Material['kind'], string> = { file: 'bg-violet-50 text-violet-700', url: 'bg-sky-50 text-sky-700', video_url: 'bg-pink-50 text-pink-700' }
const STATUS_META: Record<Material['status'], { label: string; cls: string }> = {
  pending:    { label: '대기 중',     cls: 'bg-slate-100 text-slate-600' },
  processing: { label: '처리 중',     cls: 'bg-blue-100 text-blue-700' },
  indexed:    { label: '인덱싱 완료', cls: 'bg-emerald-100 text-emerald-700' },
  failed:     { label: '실패',        cls: 'bg-rose-100 text-rose-700' },
}

const MOCK_ROWS: Material[] = [
  { id: 1, title: 'STEP 온라인 교육시스템 사용자 매뉴얼 v3.2',   kind: 'file',      format: 'PDF',  status: 'indexed',    chunks: 84,  uploader: '김도형', createdAt: '2026-05-10T10:00:00' },
  { id: 2, title: '민간자격 취득 안내서 (2026년판)',              kind: 'file',      format: 'PDF',  status: 'indexed',    chunks: 47,  uploader: '김도형', createdAt: '2026-05-12T14:00:00' },
  { id: 3, title: '공공기관 교육 신청 가이드',                   kind: 'url',       format: 'HTML', status: 'indexed',    chunks: 22,  uploader: '박지훈', createdAt: '2026-05-15T09:30:00' },
  { id: 4, title: 'STEP 결제·환불 프로세스 설명 영상',           kind: 'video_url', format: 'MP4',  status: 'processing', chunks: 0,   uploader: '박지훈', createdAt: '2026-06-01T11:20:00' },
  { id: 5, title: '보안교육 이수 안내 공문 2026-Q2',             kind: 'file',      format: 'DOCX', status: 'failed',     chunks: 0,   uploader: '김도형', createdAt: '2026-06-05T16:45:00' },
  { id: 6, title: '글로벌 직무 교육 FAQ (영문)',                 kind: 'url',       format: 'HTML', status: 'pending',    chunks: 0,   uploader: '이수연', createdAt: '2026-06-10T08:00:00' },
]

const KIND_OPTS = [
  { value: '', label: '전체 종류' },
  { value: 'file',      label: '파일' },
  { value: 'url',       label: 'URL' },
  { value: 'video_url', label: '동영상' },
]

const COLUMNS: TableColumn[] = [
  { key: 'title',    label: '제목' },
  { key: 'kind',     label: '종류',         align: 'center' },
  { key: 'status',   label: '인덱싱 상태',   align: 'center' },
  { key: 'chunks',   label: '청크 수',      align: 'right' },
  { key: 'uploader', label: '업로더' },
  { key: 'date',     label: '등록일',       align: 'right' },
]

const search     = ref('')
const kindFilter = ref('')
const uploadOpen = ref(false)

const filtered = computed(() => {
  let list = MOCK_ROWS
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(r => r.title.toLowerCase().includes(q))
  }
  if (kindFilter.value) list = list.filter(r => r.kind === kindFilter.value)
  return list
})

function fmtDate(iso: string) { return iso ? iso.slice(0, 10) : '—' }
</script>

<template>
  <div>
    <AdminPageHeader
      caption="지식 자산"
      title="자료"
      description="매뉴얼·PDF·URL·동영상을 업로드해 RAG 검색 소스로 인덱싱합니다."
    >
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
          @click="uploadOpen = true"
        >
          <Upload class="size-4" />자료 업로드
        </button>
      </template>
    </AdminPageHeader>

    <!-- OpenSearch 안내 -->
    <div class="mb-4 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-[12px] text-sky-800">
      <span class="font-semibold">안내</span>
      <span>OpenSearch 인덱싱 파이프라인 연동 후 실 업로드·검색이 활성화됩니다. 현재는 목업 데이터입니다.</span>
    </div>

    <!-- 필터 -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <AdminSearchInput v-model="search" placeholder="제목 검색" class="max-w-sm flex-1" />
      <select
        v-model="kindFilter"
        class="h-9 rounded-md bg-white px-2 text-[12px] ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option v-for="opt in KIND_OPTS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <span class="ml-auto text-[12px] text-slate-500">
        <span class="font-mono font-semibold text-slate-800">{{ filtered.length }}</span>건
      </span>
    </div>

    <AdminDataTable
      :columns="COLUMNS"
      :rows="filtered"
      :pending="false"
      :error="null"
      empty-text="등록된 자료가 없습니다."
    >
      <template #default="{ row }: { row: Material }">
        <tr class="hover:bg-slate-50">
          <td class="px-5 py-3">
            <p class="text-[13px] font-medium text-slate-800">{{ row.title }}</p>
            <p class="text-[10px] text-slate-400">{{ row.format }}</p>
          </td>
          <td class="px-3 py-3 text-center">
            <span class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" :class="KIND_CLS[row.kind]">
              {{ KIND_LABEL[row.kind] }}
            </span>
          </td>
          <td class="px-3 py-3 text-center">
            <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="STATUS_META[row.status].cls">
              <RefreshCw v-if="row.status === 'processing'" class="size-2.5 animate-spin" />
              {{ STATUS_META[row.status].label }}
            </span>
          </td>
          <td class="px-3 py-3 text-right font-mono text-[12px] tabular-nums text-slate-600">
            {{ row.chunks > 0 ? row.chunks : '—' }}
          </td>
          <td class="px-3 py-3 text-[12px] text-slate-700">{{ row.uploader }}</td>
          <td class="px-5 py-3 text-right font-mono text-[11px] text-slate-400">{{ fmtDate(row.createdAt) }}</td>
        </tr>
      </template>
    </AdminDataTable>

    <!-- 빈 상태 -->
    <AdminEmptyState
      v-if="!filtered.length"
      title="업로드된 자료가 없습니다"
      description="OpenSearch 인덱싱 파이프라인 연동 후 자료를 추가할 수 있습니다. (Phase 1 후반)"
      class="mt-4"
    >
      <template #icon><FileText class="size-5 text-slate-400" /></template>
      <template #actions>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
          @click="uploadOpen = true"
        >
          <Upload class="size-4" />자료 업로드
        </button>
      </template>
    </AdminEmptyState>

    <!-- 업로드 모달 (목업) -->
    <AdminModal v-model="uploadOpen" title="자료 업로드" size="md">
      <div class="space-y-4">
        <!-- 드롭존 -->
        <div class="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <Upload class="size-6 text-slate-400" />
          <p class="text-[13px] font-medium text-slate-700">파일을 드래그하거나 클릭해 선택</p>
          <p class="text-[11px] text-slate-400">PDF · DOCX · TXT · PPTX 지원</p>
        </div>
        <!-- URL 입력 -->
        <div>
          <label class="mb-1.5 block text-[12px] font-medium text-slate-700">또는 URL 입력</label>
          <input
            type="url"
            placeholder="https://..."
            disabled
            class="h-9 w-full cursor-not-allowed rounded-md bg-slate-100 px-3 text-sm text-slate-400 ring-1 ring-inset ring-slate-200"
          />
        </div>
        <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center text-[12px] text-slate-400">
          실제 업로드는 OpenSearch 파이프라인 연동 후 활성화됩니다.
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="uploadOpen = false"
          >닫기</button>
          <button
            type="button"
            disabled
            class="cursor-not-allowed rounded-md bg-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-400"
          >업로드 (API 보강 예정)</button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
