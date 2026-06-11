<!--
  components/admin/SettingsSection.vue
  설정 페이지 공통 — 섹션 카드(제목+설명) + 내부 폼 슬롯.

  Usage:
    <AdminSettingsSection title="기본 모델" description="LLM 호출에 사용할 기본 모델을 지정합니다.">
      <AdminFormRow label="Chat 모델">
        <input ... />
      </AdminFormRow>
    </AdminSettingsSection>
-->
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-6">
    <div class="mb-5 border-b border-slate-100 pb-4">
      <h3 class="text-[15px] font-semibold text-slate-900">{{ title }}</h3>
      <p v-if="description" class="mt-1 text-[12px] text-slate-500">{{ description }}</p>
    </div>
    <div class="space-y-5">
      <slot />
    </div>
  </div>
</template>
