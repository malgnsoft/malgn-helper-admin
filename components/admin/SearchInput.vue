<!--
  components/admin/SearchInput.vue
  돋보기 아이콘이 내장된 검색 인풋.
  v-model로 바인딩, class는 외부에서 직접 지정 가능(inheritAttrs 활용).

  Usage:
    <AdminSearchInput
      v-model="search"
      placeholder="title · description 검색"
      class="max-w-md flex-1"
    />
-->
<script setup lang="ts">
import { Search } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  { placeholder: '검색' },
)

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <!-- $attrs(class, style 등)를 outer div에 바인딩 -->
  <div v-bind="$attrs" class="relative">
    <Search
      class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
    />
    <input
      :value="modelValue"
      :placeholder="placeholder"
      type="text"
      autocomplete="off"
      class="h-9 w-full rounded-md bg-white pl-8 pr-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
