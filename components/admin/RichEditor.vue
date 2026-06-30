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
  // 구조화 HTML(표·콜아웃·data-* 박스) 편집 보존
  extended_valid_elements: "div[data-caution|data-callout|class|style],code,h3,h4,hr",
  content_style:
    "body{font-family:Pretendard,'Apple SD Gothic Neo',system-ui,sans-serif;font-size:14px;line-height:1.7;color:#1e293b}" +
    "img{max-width:100%;height:auto}" +
    "h3{font-size:1.05em;font-weight:700;margin:1.1em 0 .5em;color:#0f172a}h4{font-size:.98em;font-weight:700;margin:1em 0 .4em;color:#334155}" +
    "table{border-collapse:collapse;width:100%;margin:.9em 0;font-size:.95em}th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left;vertical-align:top}th{background:#f8fafc;font-weight:700;color:#0f172a}tbody tr:nth-child(even) td{background:#fafcff}" +
    "code{background:#f1f5f9;color:#0f172a;padding:1px 5px;border-radius:4px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em}" +
    "ol,ul{padding-left:1.4em;margin:.6em 0}li{margin:.25em 0}hr{border:0;border-top:1px solid #e2e8f0;margin:1.1em 0}" +
    "[data-callout]{margin:1em 0;padding:.75em 1em;border-left:3px solid #6366f1;background:#eef2ff;border-radius:0 8px 8px 0;color:#312e81}[data-callout=summary]::before{content:'요지 ';font-size:.72em;font-weight:700;color:#4f46e5}" +
    "[data-caution]:not([style]){margin:1em 0;padding:.75em 1em;border-left:3px solid #f43f5e;background:#fff1f2;border-radius:0 8px 8px 0;color:#9f1239}",
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
