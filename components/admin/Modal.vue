<!--
  components/admin/Modal.vue
  화면 중앙 모달 — iframe 임베드 · 확인 다이얼로그에 사용.
  ESC 키, 배경 클릭으로 닫힘.  body 스크롤 잠금 자동 처리.

  Usage:
    // iframe 임베드 (noPad, height 지정)
    <AdminModal
      v-model="open"
      size="xl"
      height="h-[92vh]"
      no-pad
    >
      <iframe :src="`${PMS_BASE}/posts/${id}/eval`" class="size-full border-0" />
    </AdminModal>

    // 일반 컨텐츠 모달
    <AdminModal v-model="open" title="이미지 상세" size="lg">
      <img :src="url" class="w-full" />
      <template #footer>
        <UButton @click="open = false">닫기</UButton>
      </template>
    </AdminModal>
-->
<script setup lang="ts">
import { X } from 'lucide-vue-next'

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-[1000px]',
  '2xl': 'max-w-[1120px]',
  full: 'max-w-[95vw]',
} as const

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    size?: keyof typeof SIZE_CLASS
    /** 모달 높이 클래스 (기본: max-h-[90vh]) e.g. "h-[92vh]" */
    height?: string
    /** 본문 패딩 제거 — iframe 임베드에 사용 */
    noPad?: boolean
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

onUnmounted(() => {
  if (process.client) document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
        @click="close"
      >
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-150"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="modelValue"
            class="relative flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            :class="[SIZE_CLASS[size], height ?? 'max-h-[90vh]']"
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            @click.stop
          >
            <!-- 닫기 버튼 (항상 노출) -->
            <button
              type="button"
              class="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-md bg-white/90 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              @click="close"
            >
              <X class="size-4" />
              <span class="sr-only">닫기</span>
            </button>

            <!-- 헤더 (title 있을 때만) -->
            <div
              v-if="title"
              class="flex h-14 shrink-0 items-center border-b border-slate-100 px-5 pr-14"
            >
              <h2 class="text-[15px] font-semibold text-slate-900">
                {{ title }}
              </h2>
            </div>

            <!-- 본문 -->
            <div
              class="flex-1 overflow-auto"
              :class="noPad ? '' : 'p-5'"
            >
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
      </div>
    </Transition>
  </Teleport>
</template>
