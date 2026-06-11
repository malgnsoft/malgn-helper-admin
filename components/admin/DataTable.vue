<!--
  components/admin/DataTable.vue
  데이터 테이블 쉘 — 카드 래퍼 + 컬럼 헤더 + 로딩 / 에러 / 빈 행 처리.
  기본 슬롯은 scoped으로 row/index를 받아 <tr>을 렌더링.

  Usage:
    <AdminDataTable
      :columns="COLS"
      :rows="rows"
      :pending="pending"
      :error="error"
      title="전체"
      :total="total"
      :shown="rows.length"
    >
      <template #default="{ row }">
        <tr class="cursor-pointer hover:bg-slate-50" @click="selected = row">
          <td class="px-5 py-3 font-mono text-[11px] text-slate-500">#{{ row.id }}</td>
          ...
        </tr>
      </template>

      // 우측 헤더 영역 (필터 버튼 등)
      <template #headerRight>
        <AdminSegment v-model="sort" :options="SORT_OPTS" />
      </template>
    </AdminDataTable>
-->
<script setup lang="ts">
export interface TableColumn {
  key: string
  label: string
  /** 기본값: 'left' */
  align?: 'left' | 'right' | 'center'
  /** 추가 th class (기본: px-3, first:pl-5, last:pr-5) */
  class?: string
}

defineProps<{
  columns: TableColumn[]
  rows: any[]
  pending?: boolean
  error?: string | null
  /** 섹션 헤더 타이틀 */
  title?: string
  /** 전체 건수 (타이틀 옆에 표시) */
  total?: number
  /** 현재 표시 건수 (우측에 표시) */
  shown?: number
  /** 빈 상태 안내 문구 */
  emptyText?: string
}>()
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white">
    <!-- ── 헤더 ── -->
    <header
      v-if="title || $slots.headerLeft || $slots.headerRight"
      class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5"
    >
      <slot name="headerLeft">
        <h2 v-if="title" class="text-[13px] font-semibold text-slate-900">
          {{ title }}
          <template v-if="total != null">
            <span class="font-mono text-slate-500">{{ total.toLocaleString() }}</span
            >건
          </template>
        </h2>
      </slot>
      <slot name="headerRight">
        <span v-if="shown != null" class="text-[11px] text-slate-400">
          표시 {{ shown }}건
        </span>
      </slot>
    </header>

    <!-- ── 로딩 ── -->
    <div v-if="pending" class="p-6 text-sm text-slate-500">로딩 중…</div>

    <!-- ── 에러 ── -->
    <div
      v-else-if="error"
      class="rounded-b-xl bg-rose-50 p-6 text-sm text-rose-700"
    >
      {{ error }}
    </div>

    <!-- ── 테이블 ── -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-[13px]">
        <thead class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="py-2.5 font-medium"
              :class="[
                col.align === 'right'
                  ? 'text-right'
                  : col.align === 'center'
                    ? 'text-center'
                    : 'text-left',
                col.class ?? 'px-3 first:pl-5 last:pr-5',
              ]"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <!-- scoped slot: 한 row 당 한 번씩 호출, <tr> 렌더링은 부모 담당 -->
          <slot
            v-for="(row, i) in rows"
            :key="i"
            :row="row"
            :index="i"
          />
          <!-- 빈 상태 -->
          <tr v-if="!rows.length">
            <td
              :colspan="columns.length"
              class="px-5 py-12 text-center text-[13px] text-slate-400"
            >
              {{ emptyText || '데이터 없음' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
