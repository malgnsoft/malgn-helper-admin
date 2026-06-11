<!--
  pages/settings/integrations.vue — 외부 연동 (목업).
  Slack·이메일·티켓·SSO 연결 상태 표시 UI. 실 연동 API 보강 예정.
-->
<script setup lang="ts">
import { Plug, CheckCircle, XCircle, ArrowRight, ExternalLink } from 'lucide-vue-next'

useHead({ title: '외부 연동 · 맑은도우미 Admin' })

type IntegrationStatus = 'connected' | 'disconnected' | 'error'

interface Integration {
  id: string
  name: string
  description: string
  status: IntegrationStatus
  detail: string
  category: string
  docsUrl?: string
}

const INTEGRATIONS: Integration[] = [
  // 알림
  {
    id: 'slack',
    name: 'Slack',
    description: '에스컬레이션·알림을 Slack 채널로 전송합니다.',
    status: 'disconnected',
    detail: '연결 안 됨',
    category: '알림',
    docsUrl: 'https://api.slack.com/incoming-webhooks',
  },
  {
    id: 'email',
    name: '이메일 (SMTP)',
    description: '시스템 알림과 리포트를 이메일로 발송합니다.',
    status: 'disconnected',
    detail: '연결 안 됨',
    category: '알림',
  },
  // 티켓
  {
    id: 'freshdesk',
    name: 'Freshdesk',
    description: '에스컬레이션 발생 시 Freshdesk 티켓을 자동 생성합니다.',
    status: 'disconnected',
    detail: '연결 안 됨',
    category: '티켓',
    docsUrl: 'https://developers.freshdesk.com/',
  },
  {
    id: 'jira',
    name: 'Jira Service Management',
    description: '이슈 트래킹 및 서비스 데스크 티켓 연동.',
    status: 'disconnected',
    detail: '연결 안 됨',
    category: '티켓',
  },
  // 인증
  {
    id: 'saml',
    name: 'SAML 2.0 SSO',
    description: '기업 IdP(Azure AD · Okta 등)와 SSO 연동.',
    status: 'disconnected',
    detail: '연결 안 됨',
    category: '인증',
  },
  // 스토리지
  {
    id: 'r2',
    name: 'Cloudflare R2',
    description: '업로드 파일·이미지를 R2 버킷에 저장합니다.',
    status: 'connected',
    detail: 'malgn-helper-assets',
    category: '스토리지',
  },
  // AI Gateway
  {
    id: 'ai-gateway',
    name: 'Cloudflare AI Gateway',
    description: 'LLM 호출 라우팅·캐싱·모니터링 게이트웨이.',
    status: 'connected',
    detail: 'malgn-helper2',
    category: 'AI',
    docsUrl: 'https://developers.cloudflare.com/ai-gateway/',
  },
  // OpenSearch
  {
    id: 'opensearch',
    name: 'Amazon OpenSearch',
    description: 'RAG 벡터 검색 인덱스 클러스터.',
    status: 'disconnected',
    detail: '연결 안 됨 — Phase 1 후반 연동 예정',
    category: 'AI',
  },
]

const CATEGORIES = [...new Set(INTEGRATIONS.map(i => i.category))]

const STATUS_META: Record<IntegrationStatus, { label: string; cls: string; iconCls: string }> = {
  connected:    { label: '연결됨',   cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200',  iconCls: 'text-emerald-500' },
  disconnected: { label: '연결 안 됨', cls: 'bg-slate-50 text-slate-500 ring-slate-200',      iconCls: 'text-slate-400' },
  error:        { label: '오류',     cls: 'bg-rose-50 text-rose-700 ring-rose-200',           iconCls: 'text-rose-500' },
}

const configuringId = ref<string | null>(null)
function openConfig(id: string) { configuringId.value = id }
function closeConfig() { configuringId.value = null }

const configuring = computed(() => configuringId.value ? INTEGRATIONS.find(i => i.id === configuringId.value) : null)

// computed v-model — SlideOver 에서 false 가 emit 되면 configuringId 초기화
const slideOverOpen = computed({
  get: () => configuringId.value !== null,
  set: (v: boolean) => { if (!v) configuringId.value = null },
})
</script>

<template>
  <div>
    <AdminPageHeader
      caption="설정"
      title="외부 연동"
      description="슬랙·이메일·티켓·SSO·스토리지·AI 인프라 연결 상태를 관리합니다."
    />

    <!-- API 안내 -->
    <div class="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">
      <Plug class="size-4 shrink-0 text-amber-500" />
      <span><span class="font-semibold">연동 설정 API 보강 예정.</span> 현재는 연결 상태 표시 UI입니다. 실제 Webhook/API Key 저장은 <code class="font-mono">/settings/integrations/*</code> 엔드포인트 구현 후 활성화됩니다.</span>
    </div>

    <!-- 카테고리별 카드 그리드 -->
    <div v-for="cat in CATEGORIES" :key="cat" class="mb-6">
      <h2 class="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ cat }}</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="item in INTEGRATIONS.filter(i => i.category === cat)"
          :key="item.id"
          class="flex flex-col rounded-xl border bg-white px-5 py-4 transition hover:shadow-sm"
          :class="item.status === 'connected' ? 'border-emerald-200' : 'border-slate-200'"
        >
          <!-- 헤더 -->
          <div class="flex items-start justify-between gap-2">
            <p class="text-[14px] font-semibold text-slate-900">{{ item.name }}</p>
            <!-- 상태 뱃지 -->
            <span
              class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
              :class="STATUS_META[item.status].cls"
            >
              <CheckCircle v-if="item.status === 'connected'" class="size-3" :class="STATUS_META[item.status].iconCls" />
              <XCircle    v-else                               class="size-3" :class="STATUS_META[item.status].iconCls" />
              {{ STATUS_META[item.status].label }}
            </span>
          </div>
          <!-- 설명 -->
          <p class="mt-1.5 flex-1 text-[12px] text-slate-500">{{ item.description }}</p>
          <!-- 상세 -->
          <p v-if="item.detail" class="mt-1 font-mono text-[11px]" :class="item.status === 'connected' ? 'text-emerald-600' : 'text-slate-400'">
            {{ item.detail }}
          </p>
          <!-- 액션 -->
          <div class="mt-3 flex items-center gap-2">
            <button
              type="button"
              :disabled="item.status === 'connected'"
              class="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[12px] font-semibold transition"
              :class="item.status === 'connected'
                ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                : 'border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'"
              @click="openConfig(item.id)"
            >
              {{ item.status === 'connected' ? '연결됨' : '연결 설정' }}
              <ArrowRight v-if="item.status !== 'connected'" class="size-3" />
            </button>
            <a
              v-if="item.docsUrl"
              :href="item.docsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600"
            >
              문서 <ExternalLink class="size-3" />
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- 연결 설정 슬라이드오버 (목업) -->
    <AdminSlideOver
      v-model="slideOverOpen"
      :title="configuring?.name ?? '연결 설정'"
      size="md"
    >
      <div v-if="configuring" class="space-y-4 px-6 py-4">
        <p class="text-[13px] text-slate-600">{{ configuring.description }}</p>

        <div class="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
          <p class="font-semibold">API 보강 예정</p>
          <p class="mt-0.5">연결 정보(Webhook URL · API Key · Client ID 등)를 입력·저장하는 기능은 <code class="font-mono">/settings/integrations/{{ configuring.id }}</code> 엔드포인트 구현 후 활성화됩니다.</p>
        </div>

        <!-- 더미 필드들 -->
        <div class="space-y-3 opacity-50">
          <div v-if="configuring.id === 'slack'">
            <label class="mb-1 block text-[12px] font-medium text-slate-700">Incoming Webhook URL</label>
            <input type="url" placeholder="https://hooks.slack.com/services/..." disabled
              class="h-9 w-full cursor-not-allowed rounded-md bg-slate-100 px-3 text-sm text-slate-400 ring-1 ring-slate-200" />
          </div>
          <div v-else-if="configuring.id === 'email'">
            <label class="mb-1 block text-[12px] font-medium text-slate-700">SMTP 호스트</label>
            <input type="text" placeholder="smtp.example.com" disabled
              class="h-9 w-full cursor-not-allowed rounded-md bg-slate-100 px-3 text-sm text-slate-400 ring-1 ring-slate-200" />
          </div>
          <div v-else-if="configuring.id === 'saml'">
            <label class="mb-1 block text-[12px] font-medium text-slate-700">IdP Metadata URL</label>
            <input type="url" placeholder="https://login.microsoftonline.com/..." disabled
              class="h-9 w-full cursor-not-allowed rounded-md bg-slate-100 px-3 text-sm text-slate-400 ring-1 ring-slate-200" />
          </div>
          <div v-else>
            <label class="mb-1 block text-[12px] font-medium text-slate-700">API Key</label>
            <input type="password" placeholder="••••••••••••••••" disabled
              class="h-9 w-full cursor-not-allowed rounded-md bg-slate-100 px-3 text-sm text-slate-400 ring-1 ring-slate-200" />
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            class="rounded-md border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            @click="closeConfig"
          >닫기</button>
          <button
            type="button"
            disabled
            class="cursor-not-allowed rounded-md bg-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-400"
          >저장 (API 보강 예정)</button>
        </div>
      </template>
    </AdminSlideOver>
  </div>
</template>
