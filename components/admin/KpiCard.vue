<!--
  components/admin/KpiCard.vue
  KPI 통계 카드 — 아이콘(슬롯) + label + value + unit + sub + 선택적 NuxtLink.
  pages/index.vue · pages/cost.vue 의 카드 패턴을 공통화.

  Usage:
    <AdminKpiCard label="표준답변" :value="42" unit="건" sub="활성 카탈로그" to="/standard-answers">
      <template #icon><Bookmark class="size-3.5" /></template>
    </AdminKpiCard>

    // 링크 없는 수치 카드
    <AdminKpiCard label="캐시 적중" :value="`${rate}%`" value-class="text-emerald-600">
      <template #icon><Database class="size-3.5" /></template>
    </AdminKpiCard>
-->
<script setup lang="ts">
defineProps<{
  /** 상단 라벨 텍스트 */
  label: string
  /** 대형 숫자 값 */
  value: string | number
  /** 값 뒤에 붙는 작은 단위 (e.g. "건", "ms") */
  unit?: string
  /** 값 아래 보조 텍스트 */
  sub?: string
  /** NuxtLink 경로 — 있으면 클릭 가능한 링크 카드로 렌더링 */
  to?: string
  /** 값 색상 클래스 (기본: text-slate-900) */
  valueClass?: string
}>()
</script>

<template>
  <component
    :is="to ? resolveComponent('NuxtLink') : 'div'"
    :to="to || undefined"
    class="rounded-xl border border-slate-200 bg-white p-4"
    :class="to ? 'transition hover:border-primary-300 hover:shadow-sm' : ''"
  >
    <!-- 아이콘 + 라벨 -->
    <div
      class="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-500"
    >
      <slot name="icon" />
      <span>{{ label }}</span>
    </div>

    <!-- 값 -->
    <p
      class="mt-2 text-[22px] font-bold tabular-nums"
      :class="valueClass || 'text-slate-900'"
    >
      {{ value
      }}<span
        v-if="unit"
        class="ml-0.5 text-[13px] font-medium text-slate-400"
        >{{ unit }}</span
      >
    </p>

    <!-- 보조 텍스트 -->
    <p v-if="sub" class="mt-0.5 text-[11px] text-slate-500">{{ sub }}</p>
  </component>
</template>
