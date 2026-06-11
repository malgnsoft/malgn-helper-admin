<!--
  components/admin/SlideOver.vue
  우측에서 슬라이드인하는 사이드 패널 — 행 상세 보기 · 편집 폼에 사용.
  ESC 키, 배경 클릭으로 닫힘.  body 스크롤 잠금 자동 처리.

  Usage:
    <AdminSlideOver v-model="open" title="미커버 질문 상세" size="lg">
      <dl>
        <dt>질문</dt>
        <dd>...</dd>
      </dl>
      <template #footer>
        <UButton @click="open = false">닫기</UButton>
      </template>
    </AdminSlideOver>
-->
<script setup lang="ts">
import { X } from 'lucide-vue-next'

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-3xl',
} as const

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    size?: keyof typeof SIZE_CLASS
  }>(),
  { size: 'md' },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function close() {
  emit('update:modelValue', false)
}

// ESC 키 닫기 (onMounted는 클라이언트에서만 실행)
onMounted(() => {
  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.modelValue) close()
  }
  window.addEventListener('keydown', onKeydown)
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
})

// body 스크롤 잠금
watch(
  () => props.modelValue,
  (v) => {
    if (process.client) {
      document.body.style.overflow = v ? 'hidden' : ''
    }
  },
)

// 언마운트 시 스크롤 복원
onUnmounted(() => {
  if (process.client) document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <!-- 배경 오버레이 -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]"
        aria-hidden="true"
        @click="close"
      />
    </Transition>

    <!-- 패널 -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="modelValue"
        class="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl"
        :class="SIZE_CLASS[size]"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <!-- 헤더 -->
        <div
          class="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-5"
        >
          <h2 class="text-[15px] font-semibold text-slate-900">
            {{ title }}
          </h2>
          <button
            type="button"
            class="inline-flex size-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            @click="close"
          >
            <X class="size-4" />
            <span class="sr-only">닫기</span>
          </button>
        </div>

        <!-- 본문 (스크롤 가능) -->
        <div class="flex-1 overflow-y-auto p-5">
          <slot />
        </div>

        <!-- 푸터 (선택) -->
        <div
          v-if="$slots.footer"
          class="shrink-0 border-t border-slate-100 px-5 py-4"
        >
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
