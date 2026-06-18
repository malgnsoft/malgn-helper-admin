<!--
  components/admin/RichEditor.vue
  TinyMCE 기반 위지위그 에디터 (v-model). 표준답변 답변 등 서식 있는 본문 입력에 사용.
  - TinyMCE는 jsdelivr 셀프호스트 빌드를 런타임 로드(API 키 불필요·워터마크 없음).
  - SSR 불가(window 의존) → <ClientOnly>로 감싸 클라이언트에서만 초기화.
  - 한국어 UI는 tinymce-i18n CDN best-effort(실패 시 영어로 폴백, 동작엔 지장 없음).
-->
<script setup lang="ts">
import Editor from "@tinymce/tinymce-vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    height?: number;
    placeholder?: string;
  }>(),
  { disabled: false, height: 380, placeholder: "" },
);
const emit = defineEmits<{ "update:modelValue": [string] }>();

const value = computed({
  get: () => props.modelValue,
  set: (v: string) => emit("update:modelValue", v),
});

const TINYMCE_SRC = "https://cdn.jsdelivr.net/npm/tinymce@7/tinymce.min.js";

const init = {
  height: props.height,
  menubar: false,
  branding: false,
  promotion: false,
  language: "ko_KR",
  language_url: "https://cdn.jsdelivr.net/npm/tinymce-i18n@25.7.7/langs7/ko_KR.js",
  placeholder: props.placeholder,
  plugins: "lists advlist autolink link image media table code wordcount",
  toolbar:
    "blocks fontfamily fontsize | bold italic underline strikethrough blockquote | forecolor backcolor | bullist numlist outdent indent | alignleft aligncenter alignright alignjustify | table link image media | removeformat code",
  toolbar_mode: "wrap" as const,
  content_style:
    "body{font-family:Pretendard,'Apple SD Gothic Neo',system-ui,sans-serif;font-size:14px;line-height:1.7;color:#1e293b} img{max-width:100%;height:auto}",
};
</script>

<template>
  <ClientOnly>
    <div class="rich-editor" :class="disabled ? 'pointer-events-none opacity-60' : ''">
      <Editor
        v-model="value"
        :init="init"
        :disabled="disabled"
        :tinymce-script-src="TINYMCE_SRC"
      />
    </div>
    <template #fallback>
      <div
        class="flex h-[200px] items-center justify-center rounded-md bg-slate-50 text-[13px] text-slate-400 ring-1 ring-inset ring-slate-200"
      >
        에디터 로딩 중…
      </div>
    </template>
  </ClientOnly>
</template>

<style scoped>
.rich-editor :deep(.tox-tinymce) {
  border-radius: 8px;
  border-color: rgb(226 232 240);
}
</style>
