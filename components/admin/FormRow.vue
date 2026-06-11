<!--
  components/admin/FormRow.vue
  설정 폼의 라벨+입력 한 줄 레이아웃.

  Usage:
    <AdminFormRow label="Chat 모델" hint="API 호출에 사용할 모델 ID">
      <input v-model="model" class="..." />
    </AdminFormRow>
-->
<script setup lang="ts">
defineProps<{
  label: string
  hint?: string
  required?: boolean
}>()
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr] sm:items-start">
    <div class="sm:pt-2">
      <p class="text-[13px] font-medium text-slate-700">
        {{ label }}<span v-if="required" class="ml-0.5 text-rose-500">*</span>
      </p>
      <p v-if="hint" class="mt-0.5 text-[11px] text-slate-400">{{ hint }}</p>
    </div>
    <slot />
  </div>
</template>
