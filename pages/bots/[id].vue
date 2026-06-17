<!--
  pages/bots/[id].vue — 봇 설정(생성/편집 겸용). 서비스별 "구분 설정"이 핵심.
  /bots/new = 새 봇(POST), /bots/:id = 기존 봇(GET 로드 → PATCH 저장). 삭제는 DELETE.
  섹션: 구분·기본정보 · 캐릭터(페르소나) · 답변범위 · 자료 연결(준비중) · 모델 파라미터.
  쓰기는 서버가 admin(level≥9) 강제 → 권한 없으면 403 처리.
-->
<script setup lang="ts">
import { ArrowLeft, Trash2, Save } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const { getOne, save, remove, blankBot } = useBots();
const { services: serviceOpts, load: loadServices } = useServiceOptions();

const me = useAuthUser();
const isAdmin = computed(() => (me.value?.level ?? 0) >= 9);

const routeId = route.params.id as string;
const isNew = computed(() => routeId === "new");

const ready = ref(false);
const notFound = ref(false);
const loadErr = ref<string | null>(null);
const form = reactive<Bot>(blankBot());

// 서비스 드롭다운 바인딩: "" = 공통(serviceId null), 그 외 = String(serviceId)
const serviceSel = computed<string>({
  get: () => (form.serviceId === null ? "" : String(form.serviceId)),
  set: (v: string) => {
    form.serviceId = v === "" ? null : Number(v);
  },
});

onMounted(async () => {
  await loadServices();
  if (isNew.value) {
    Object.assign(form, blankBot());
    ready.value = true;
    return;
  }
  try {
    const existing = await getOne(routeId);
    Object.assign(form, existing);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("찾을 수 없")) notFound.value = true;
    else loadErr.value = msg;
  } finally {
    ready.value = true;
  }
});

useHead(() => ({
  title: `${isNew.value ? "새 봇" : form.name || "봇 편집"} · 맑은도우미 Admin`,
}));

// ── 멀티선택 토글 ──
function toggle(arr: string[], val: string) {
  const i = arr.indexOf(val);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(val);
}

// ── 콤마 구분 태그 프록시 ──
const topicsText = computed({
  get: () => form.topics.join(", "),
  set: (v: string) => {
    form.topics = v.split(",").map((s) => s.trim()).filter(Boolean);
  },
});
const refusalText = computed({
  get: () => form.refusalTopics.join(", "),
  set: (v: string) => {
    form.refusalTopics = v.split(",").map((s) => s.trim()).filter(Boolean);
  },
});

const STATUS_OPTS = [
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
  { value: "draft", label: "초안" },
];

const nameError = ref(false);
const saving = ref(false);
const saveErr = ref<string | null>(null);

async function doSave() {
  if (!isAdmin.value) {
    saveErr.value = "admin 권한이 필요합니다.";
    return;
  }
  if (!form.name.trim()) {
    nameError.value = true;
    return;
  }
  saving.value = true;
  saveErr.value = null;
  try {
    await save(toRaw(form));
    router.push("/bots");
  } catch (e) {
    saveErr.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

const confirmDelete = ref(false);
const deleting = ref(false);
async function doDelete() {
  deleting.value = true;
  saveErr.value = null;
  try {
    await remove(routeId);
    router.push("/bots");
  } catch (e) {
    saveErr.value = (e as Error).message;
    confirmDelete.value = false;
  } finally {
    deleting.value = false;
  }
}

const inputCls =
  "h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500";
const selectCls =
  "h-9 w-full rounded-md bg-slate-50 px-3 text-sm ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500";
const taCls =
  "w-full resize-y rounded-md bg-slate-50 px-3 py-2 text-[13px] leading-relaxed ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500";

function chipCls(on: boolean) {
  return on
    ? "rounded-md bg-primary-600 px-2.5 py-1 text-[12px] font-medium text-white"
    : "rounded-md bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-200";
}
</script>

<template>
  <div>
    <!-- 상단: 뒤로 + 액션 -->
    <div class="mb-5 flex items-center justify-between gap-3">
      <NuxtLink
        to="/bots"
        class="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft class="size-4" />봇 목록
      </NuxtLink>
      <div v-if="ready && !notFound" class="flex items-center gap-2">
        <button
          v-if="!isNew"
          type="button"
          :disabled="!isAdmin"
          :title="isAdmin ? '삭제' : 'admin 권한 필요'"
          class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          @click="confirmDelete = true"
        >
          <Trash2 class="size-4" />삭제
        </button>
        <button
          type="button"
          :disabled="saving || !isAdmin"
          :title="isAdmin ? '' : 'admin 권한 필요'"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
          @click="doSave"
        >
          <Save class="size-4" />{{ saving ? "저장 중…" : "저장" }}
        </button>
      </div>
    </div>

    <!-- 없음 -->
    <AdminEmptyState
      v-if="ready && notFound"
      title="봇을 찾을 수 없습니다"
      description="삭제되었거나 잘못된 주소입니다."
    >
      <template #actions>
        <NuxtLink
          to="/bots"
          class="rounded-md bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
          >목록으로</NuxtLink
        >
      </template>
    </AdminEmptyState>

    <!-- 로드 오류 -->
    <div
      v-else-if="ready && loadErr"
      class="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
    >
      봇을 불러오지 못했습니다 — {{ loadErr }}
    </div>

    <template v-else-if="ready">
      <!-- 헤더(아이덴티티) -->
      <header class="mb-6 flex items-center gap-4">
        <div
          class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-[30px] leading-none"
        >
          {{ form.avatar || "🤖" }}
        </div>
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            지식 자산 · 봇 관리
          </p>
          <h1 class="mt-0.5 text-[22px] font-bold tracking-tight text-slate-900">
            {{ isNew ? "새 봇 만들기" : form.name || "이름 없는 봇" }}
          </h1>
        </div>
      </header>

      <div v-if="!isAdmin" class="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
        조회 전용입니다. 봇 생성·편집·삭제는 admin 권한이 필요합니다.
      </div>

      <div class="space-y-6">
        <!-- 1. 구분 · 기본 정보 -->
        <AdminSettingsSection
          title="구분 · 기본 정보"
          description="이 봇이 어떤 서비스(솔루션)에 속하는지 지정합니다. 공통은 전 서비스 대상입니다."
        >
          <AdminFormRow label="서비스 구분" required hint="봇 1개 = 서비스 1개. 공통은 전 서비스">
            <select v-model="serviceSel" :class="selectCls">
              <option value="">공통(전 서비스)</option>
              <option v-for="s in serviceOpts" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
            </select>
          </AdminFormRow>
          <AdminFormRow label="봇 이름" required>
            <input
              v-model="form.name"
              :class="[inputCls, nameError && !form.name.trim() ? 'ring-rose-400' : '']"
              placeholder="예: LMS 일반 상담봇"
              @input="nameError = false"
            />
            <p v-if="nameError && !form.name.trim()" class="mt-1 text-[11px] text-rose-500">
              이름을 입력하세요.
            </p>
          </AdminFormRow>
          <AdminFormRow label="아바타" hint="이모지 1자">
            <input v-model="form.avatar" :class="inputCls" maxlength="4" placeholder="🤖" />
          </AdminFormRow>
          <AdminFormRow label="설명">
            <textarea v-model="form.description" rows="2" :class="taCls" placeholder="이 봇이 담당하는 역할을 한두 줄로" />
          </AdminFormRow>
          <AdminFormRow label="상태">
            <AdminSegment v-model="form.status" :options="STATUS_OPTS" />
          </AdminFormRow>
        </AdminSettingsSection>

        <!-- 2. 캐릭터 / 페르소나 -->
        <AdminSettingsSection
          title="캐릭터 · 페르소나"
          description="봇의 말투와 성격, 인삿말, 시스템 프롬프트를 정의합니다."
        >
          <AdminFormRow label="말투(톤)">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="o in TONE_OPTS"
                :key="o.value"
                type="button"
                :class="chipCls(form.tone === o.value)"
                :title="o.hint"
                @click="form.tone = o.value"
              >
                {{ o.label }}
              </button>
            </div>
          </AdminFormRow>
          <AdminFormRow label="성격 태그" hint="여러 개 선택 가능">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in TRAIT_OPTS"
                :key="t"
                type="button"
                :class="chipCls(form.traits.includes(t))"
                @click="toggle(form.traits, t)"
              >
                {{ t }}
              </button>
            </div>
          </AdminFormRow>
          <AdminFormRow label="인삿말">
            <input v-model="form.greeting" :class="inputCls" placeholder="안녕하세요! 무엇을 도와드릴까요?" />
          </AdminFormRow>
          <AdminFormRow label="시스템 프롬프트" hint="봇의 정체성·행동 규칙">
            <textarea v-model="form.systemPrompt" rows="5" :class="taCls + ' font-mono text-[12px]'" />
          </AdminFormRow>
        </AdminSettingsSection>

        <!-- 3. 답변 범위 -->
        <AdminSettingsSection
          title="답변 범위"
          description="이 봇이 어디까지 답하고, 모르면 어떻게 처리할지 정합니다."
        >
          <AdminFormRow label="토픽" hint="콤마(,)로 구분">
            <input v-model="topicsText" :class="inputCls" placeholder="로그인, 수강신청, 진도" />
          </AdminFormRow>
          <AdminFormRow label="자료 가시성">
            <div class="space-y-1.5">
              <AdminSegment v-model="form.visibility" :options="VISIBILITY_OPTS" />
              <p class="text-[11px] text-slate-400">
                {{ VISIBILITY_OPTS.find((o) => o.value === form.visibility)?.hint }}
              </p>
            </div>
          </AdminFormRow>
          <AdminFormRow label="“모르면 모른다” 강도">
            <div class="space-y-1.5">
              <AdminSegment v-model="form.unknownPolicy" :options="UNKNOWN_POLICY_OPTS" />
              <p class="text-[11px] text-slate-400">
                {{ UNKNOWN_POLICY_OPTS.find((o) => o.value === form.unknownPolicy)?.hint }}
              </p>
            </div>
          </AdminFormRow>
          <AdminFormRow label="에스컬레이션 임계값" hint="신뢰도가 이 값 미만이면 상담사 연결">
            <div class="flex items-center gap-3">
              <input
                v-model.number="form.escalationThreshold"
                type="range"
                min="0"
                max="1"
                step="0.05"
                class="h-2 flex-1 cursor-pointer accent-primary-600"
              />
              <span class="w-12 text-right font-mono text-[13px] font-semibold text-slate-700">
                {{ Math.round(form.escalationThreshold * 100) }}%
              </span>
            </div>
          </AdminFormRow>
          <AdminFormRow label="답변 금지 주제" hint="콤마(,)로 구분 — 이 주제는 봇이 단정하지 않음">
            <input v-model="refusalText" :class="inputCls" placeholder="환불 금액 확정, 계약 변경" />
          </AdminFormRow>
        </AdminSettingsSection>

        <!-- 4. 표준답변 / 자료 연결 -->
        <AdminSettingsSection
          title="답변 소스"
          description="봇이 근거로 삼을 표준답변·자료를 지정합니다."
        >
          <AdminFormRow label="표준답변 우선 사용">
            <div class="space-y-2">
              <label class="inline-flex cursor-pointer items-center gap-2">
                <input v-model="form.useStandardAnswers" type="checkbox" class="size-4 accent-primary-600" />
                <span class="text-[13px] text-slate-700">검증된 표준답변을 우선 적용</span>
              </label>
              <div v-if="form.useStandardAnswers" class="pt-1">
                <AdminSegment v-model="form.standardAnswerScope" :options="STD_SCOPE_OPTS" />
              </div>
            </div>
          </AdminFormRow>
          <AdminFormRow label="학습 자료 연결" hint="자료 라이브러리 API 도입 후 제공">
            <div class="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-[12px] text-slate-500">
              <span class="font-medium text-slate-600">준비중</span> — 봇별 학습 자료(소스) 연결은 자료 라이브러리 백엔드 도입 후 제공됩니다.
              현재는 표준답변 사용 설정만 반영됩니다.
            </div>
          </AdminFormRow>
        </AdminSettingsSection>

        <!-- 5. 모델 파라미터 -->
        <AdminSettingsSection title="모델 파라미터">
          <AdminFormRow label="모델">
            <select v-model="form.model" :class="selectCls">
              <option v-for="m in MODEL_OPTS" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </AdminFormRow>
          <AdminFormRow label="temperature" hint="0.0–1.0, 낮을수록 결정적">
            <input v-model.number="form.temperature" type="number" min="0" max="1" step="0.1" :class="inputCls" />
          </AdminFormRow>
          <AdminFormRow label="max_tokens" hint="응답 최대 토큰 수">
            <input v-model.number="form.maxTokens" type="number" :class="inputCls" />
          </AdminFormRow>
        </AdminSettingsSection>

        <!-- 저장 오류 -->
        <div v-if="saveErr" class="rounded-md bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{{ saveErr }}</div>

        <!-- 하단 저장 -->
        <div class="flex items-center justify-end gap-2 pb-2">
          <NuxtLink
            to="/bots"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            >취소</NuxtLink
          >
          <button
            type="button"
            :disabled="saving || !isAdmin"
            :title="isAdmin ? '' : 'admin 권한 필요'"
            class="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
            @click="doSave"
          >
            <Save class="size-4" />{{ saving ? "저장 중…" : isNew ? "봇 만들기" : "변경 저장" }}
          </button>
        </div>
      </div>
    </template>

    <!-- 로딩 -->
    <div v-else class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
      로딩 중…
    </div>

    <!-- 삭제 확인 -->
    <AdminModal v-model="confirmDelete" title="봇 삭제" size="sm">
      <p class="text-[13px] text-slate-600">
        <span class="font-semibold text-slate-900">{{ form.name }}</span> 봇을 삭제할까요? 되돌릴 수
        없습니다.
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="confirmDelete = false"
          >
            취소
          </button>
          <button
            type="button"
            :disabled="deleting"
            class="rounded-md bg-rose-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            @click="doDelete"
          >
            {{ deleting ? "삭제 중…" : "삭제" }}
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
