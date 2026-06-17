<!--
  components/admin/Pagination.vue (AdminPagination)
  공용 페이저 — accounts.vue 인라인 페이저 마크업을 추출·토큰화.
  page/pageSize/total 기반. limit/offset 페이지는 page = floor(offset/limit)+1 로 변환해 사용.

  Usage:
    <AdminPagination :page="page" :page-size="20" :total="total" @update:page="onPage" />

  - total === 0 이면 렌더하지 않음(빈 슬롯).
  - 1페이지뿐이면 범위 텍스트는 표시하되 이전/다음은 자동 disabled.
  - update:page 는 1-based 페이지 번호를 emit.
-->
<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  /** 1-based 현재 페이지 */
  page: number
  /** 페이지당 행 수 */
  pageSize: number
  /** 전체 건수 */
  total: number
}>()

const emit = defineEmits<{
  'update:page': [page: number]
}>()

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))),
)
const rangeStart = computed(() =>
  props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1,
)
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.total))

function goPrev() {
  if (props.page > 1) emit('update:page', props.page - 1)
}
function goNext() {
  if (props.page < totalPages.value) emit('update:page', props.page + 1)
}
</script>

<template>
  <div v-if="total > 0" class="flex items-center justify-between">
    <p class="text-[12px] text-slate-500">
      <span class="font-mono text-slate-700">{{ rangeStart }}–{{ rangeEnd }}</span>
      / {{ total.toLocaleString() }}
    </p>
    <div class="flex items-center gap-1">
      <button
        type="button"
        :disabled="page <= 1"
        aria-label="이전 페이지"
        class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
        @click="goPrev"
      >
        <ChevronLeft class="size-4" />
      </button>
      <span class="px-2 font-mono text-[12px] text-slate-600">{{ page }} / {{ totalPages }}</span>
      <button
        type="button"
        :disabled="page >= totalPages"
        aria-label="다음 페이지"
        class="inline-flex size-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
        @click="goNext"
      >
        <ChevronRight class="size-4" />
      </button>
    </div>
  </div>
</template>
