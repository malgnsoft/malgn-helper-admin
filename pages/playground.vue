<!--
  pages/playground.vue — AI 시연 (챗봇 답변 테스트).
  운영자가 고객 챗봇 답변 파이프라인(POST /chat/answer)을 즉시 시연·검증.
  질문 입력 → 답변 + 판정 모드(표준답변/RAG/상담사연결) + 근거 출처를 확인.
  대화 누적은 프런트 상태만(서버 저장 없음). apiFetch 경유. SSR 안전.
  권한: developer↑ (메뉴 노출 기준과 동일). /chat/answer 자체는 public.
-->
<script setup lang="ts">
import { Sparkles, Send, Loader2, FileText, Bookmark, AlertTriangle, MessageSquareText, Headphones } from 'lucide-vue-next'

useHead({ title: 'AI 시연 · 맑은도우미 Admin' })

const API_BASE = 'https://malgn-helper-api.malgnsoft.workers.dev'

// ── 권한 (developer↑) — 서버가 아닌 UI 보조 게이트. 메뉴 노출과 동일 기준. ──
const meSession = useAuthUser()
const myLevel = computed(() => meSession.value?.level ?? 0)
const canUse = computed(() => myLevel.value >= 5)

// ── API 계약 ──
type ChatMode = 'standard' | 'rag' | 'escalate'

interface ChatSource {
  kind: 'standard_answer' | 'material'
  id: number
  title: string
  snippet?: string
  score?: number
}
interface ChatAnswerRequest {
  question: string
  serviceId?: number
  botId?: number
}
interface ChatAnswerResponse {
  answer: string
  mode: ChatMode
  confidence: number
  sources: ChatSource[]
  usedChunks?: number
}

// ── 프런트 대화 모델 ──
interface UserTurn {
  id: number
  role: 'user'
  text: string
}
interface BotTurn {
  id: number
  role: 'bot'
  loading: boolean
  error: string | null
  answer: string
  mode: ChatMode | null
  confidence: number | null
  sources: ChatSource[]
  usedChunks: number | null
}
type Turn = UserTurn | BotTurn

const MODE_META: Record<ChatMode, { label: string; cls: string; dot: string }> = {
  standard: { label: '표준답변', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  rag: { label: '자료 근거(RAG)', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' },
  escalate: { label: '상담사 연결', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
}

// ── 서비스 · 봇 선택(선택 사항) ──
const { services: serviceOpts, load: loadServices } = useServiceOptions()
const { list: listBots } = useBots()

const serviceId = ref<number | ''>('')
const botId = ref<number | ''>('')

interface BotOption { id: number; name: string; serviceId: number | null }
const botOpts = ref<BotOption[]>([])
const botsError = ref<string | null>(null)

async function loadBots() {
  botsError.value = null
  try {
    const { rows } = await listBots({ limit: 200 })
    botOpts.value = rows.map((b) => ({ id: Number(b.id), name: b.name, serviceId: b.serviceId }))
  } catch (e) {
    botsError.value = (e as Error).message
    botOpts.value = []
  }
}

// 선택한 서비스에 맞는 봇만(공통 봇 serviceId=null은 항상 노출). 서비스 미선택 시 전체.
const visibleBots = computed(() =>
  serviceId.value === ''
    ? botOpts.value
    : botOpts.value.filter((b) => b.serviceId === null || b.serviceId === serviceId.value),
)

// 서비스 변경 시 현재 봇이 범위를 벗어나면 초기화
watch(serviceId, () => {
  if (botId.value !== '' && !visibleBots.value.some((b) => b.id === botId.value)) botId.value = ''
})

onMounted(() => {
  if (!canUse.value) return
  loadServices()
  loadBots()
})

// ── 대화 상태 ──
const turns = ref<Turn[]>([])
const input = ref('')
const sending = ref(false)
let seq = 0
const nextId = () => ++seq

const scrollHost = ref<HTMLElement | null>(null)
async function scrollToBottom() {
  await nextTick()
  const el = scrollHost.value
  if (el) el.scrollTop = el.scrollHeight
}

const SUGGESTIONS = [
  '수강 신청은 어떻게 하나요?',
  '결제 후 영수증은 어디서 받나요?',
  '수료증 발급 기준이 궁금합니다.',
]

/** answer가 HTML 마크업을 포함하는지 간단 판별(태그 존재 여부). */
function looksLikeHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s)
}

function useSuggestion(q: string) {
  if (sending.value) return
  input.value = q
  send()
}

async function send() {
  const q = input.value.trim()
  if (!q || sending.value) return

  turns.value.push({ id: nextId(), role: 'user', text: q })
  input.value = ''

  const bot: BotTurn = {
    id: nextId(),
    role: 'bot',
    loading: true,
    error: null,
    answer: '',
    mode: null,
    confidence: null,
    sources: [],
    usedChunks: null,
  }
  turns.value.push(bot)
  sending.value = true
  await scrollToBottom()

  try {
    const body: ChatAnswerRequest = { question: q }
    if (serviceId.value !== '') body.serviceId = Number(serviceId.value)
    if (botId.value !== '') body.botId = Number(botId.value)

    const res = await apiFetch(`${API_BASE}/chat/answer`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error || `요청 실패 (${res.status})`)
    }
    const data = (await res.json()) as ChatAnswerResponse

    bot.loading = false
    bot.answer = typeof data.answer === 'string' ? data.answer : ''
    bot.mode = data.mode ?? null
    bot.confidence = typeof data.confidence === 'number' ? data.confidence : null
    bot.sources = Array.isArray(data.sources) ? data.sources : []
    bot.usedChunks = typeof data.usedChunks === 'number' ? data.usedChunks : null
    if (!bot.answer && bot.sources.length === 0) bot.error = '빈 응답을 받았습니다.'
  } catch (e) {
    bot.loading = false
    bot.error = (e as Error).message
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  // Enter 전송, Shift+Enter 줄바꿈, IME 조합 중 무시
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}

function resetConversation() {
  turns.value = []
}

const selectCls =
  'h-9 w-full rounded-md bg-white px-3 text-[13px] text-slate-700 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500'

function confClass(c: number | null): string {
  if (c === null) return 'text-slate-400'
  if (c < 0.5) return 'text-rose-600'
  if (c < 0.75) return 'text-amber-600'
  return 'text-emerald-600'
}
</script>

<template>
  <div>
    <AdminPageHeader
      caption="운영 보드"
      title="AI 시연"
      description="고객 챗봇 답변 파이프라인을 즉시 시연합니다. 질문을 보내면 답변·판정 모드·근거 출처를 확인할 수 있습니다. (대화는 저장되지 않습니다)"
    >
      <template #actions>
        <UButton
          v-if="turns.length"
          size="sm"
          color="neutral"
          variant="soft"
          @click="resetConversation"
        >
          대화 비우기
        </UButton>
      </template>
    </AdminPageHeader>

    <!-- 권한 안내 (developer 미만) -->
    <AdminEmptyState
      v-if="!canUse"
      title="AI 시연은 developer 이상 권한에서 사용할 수 있습니다"
      description="현재 계정은 챗봇 답변 시연을 실행할 수 없습니다. 권한이 필요하면 관리자에게 문의하세요."
      class="mt-2"
    >
      <template #icon><Sparkles class="size-5 text-slate-400" /></template>
    </AdminEmptyState>

    <template v-else>
      <!-- 서비스 · 봇 선택 (선택 즉시 다음 질문에 적용 — 별도 조회 없음) -->
      <section class="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
        <div class="flex flex-wrap items-end gap-x-3 gap-y-3">
          <AdminFilterField label="서비스(선택)">
            <select v-model="serviceId" :class="selectCls">
              <option :value="''">전체</option>
              <option v-for="s in serviceOpts" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </AdminFilterField>
          <AdminFilterField label="봇(선택)">
            <select v-model="botId" :class="selectCls">
              <option :value="''">전체(기본 봇)</option>
              <option v-for="b in visibleBots" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </AdminFilterField>
          <p v-if="botsError" class="flex items-center pb-2 text-[11px] text-slate-400">
            봇 목록을 불러오지 못했습니다 — 전체(기본 봇)로 시연합니다.
          </p>
        </div>
      </section>

      <!-- 대화 영역 -->
      <div class="flex h-[calc(100vh-320px)] min-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
        <!-- 메시지 스크롤 -->
        <div ref="scrollHost" class="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          <!-- 빈 상태(대화 시작 전) -->
          <div
            v-if="!turns.length"
            class="flex h-full flex-col items-center justify-center gap-4 text-center"
          >
            <div class="flex size-12 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-100">
              <Sparkles class="size-6 text-primary-500" />
            </div>
            <div>
              <p class="text-[14px] font-semibold text-slate-700">질문을 입력해 챗봇 답변을 시연하세요</p>
              <p class="mt-1 text-[12px] text-slate-400">아래 예시를 눌러 바로 시작할 수 있습니다.</p>
            </div>
            <div class="flex flex-wrap justify-center gap-2">
              <button
                v-for="s in SUGGESTIONS"
                :key="s"
                type="button"
                class="rounded-full bg-white px-3 py-1.5 text-[12px] text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:ring-primary-300 hover:text-primary-600"
                @click="useSuggestion(s)"
              >
                {{ s }}
              </button>
            </div>
          </div>

          <!-- 대화 말풍선 -->
          <template v-for="turn in turns" :key="turn.id">
            <!-- 사용자(우) -->
            <div v-if="turn.role === 'user'" class="flex justify-end">
              <div class="max-w-[80%] rounded-2xl rounded-br-sm bg-primary-600 px-4 py-2.5 text-[13px] leading-relaxed text-white">
                <p class="whitespace-pre-wrap break-words">{{ turn.text }}</p>
              </div>
            </div>

            <!-- 봇(좌) -->
            <div v-else class="flex justify-start">
              <div class="flex max-w-[85%] gap-2.5">
                <div class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                  <MessageSquareText class="size-3.5 text-slate-500" />
                </div>
                <div class="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[13px] leading-relaxed text-slate-800 ring-1 ring-slate-200">
                  <!-- 로딩 -->
                  <div v-if="turn.loading" class="flex items-center gap-2 text-slate-400">
                    <Loader2 class="size-4 animate-spin" />
                    <span class="text-[12px]">답변 생성 중…</span>
                  </div>

                  <!-- 에러 -->
                  <div v-else-if="turn.error" class="flex items-start gap-2 text-rose-600">
                    <AlertTriangle class="mt-0.5 size-4 shrink-0" />
                    <span class="text-[12.5px]">{{ turn.error }}</span>
                  </div>

                  <!-- 정상 답변 -->
                  <template v-else>
                    <!-- escalate 안내 강조 -->
                    <div
                      v-if="turn.mode === 'escalate'"
                      class="mb-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800"
                    >
                      <Headphones class="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <span><b>상담사 연결 필요</b> — 근거가 충분하지 않아 자동 답변 대신 상담사 연결을 안내합니다.</span>
                    </div>

                    <!-- 본문: HTML이면 rich-content, 평문이면 그대로 -->
                    <div v-if="looksLikeHtml(turn.answer)" class="rich-content" v-html="turn.answer" />
                    <p v-else class="whitespace-pre-wrap break-words">{{ turn.answer }}</p>

                    <!-- 모드 배지 + confidence -->
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <span
                        v-if="turn.mode"
                        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
                        :class="MODE_META[turn.mode].cls"
                      >
                        <span class="size-1.5 rounded-full" :class="MODE_META[turn.mode].dot" />
                        {{ MODE_META[turn.mode].label }}
                      </span>
                      <span
                        v-if="turn.confidence !== null"
                        class="font-mono text-[11px] tabular-nums"
                        :class="confClass(turn.confidence)"
                      >
                        신뢰도 {{ (turn.confidence * 100).toFixed(0) }}%
                      </span>
                      <span
                        v-if="turn.usedChunks !== null"
                        class="text-[10.5px] text-slate-400"
                      >
                        · 참조 청크 {{ turn.usedChunks }}
                      </span>
                    </div>

                    <!-- 출처 목록 -->
                    <div v-if="turn.sources.length" class="mt-3 space-y-1.5 border-t border-slate-100 pt-2.5">
                      <p class="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">근거 출처</p>
                      <div class="space-y-1.5">
                        <template v-for="(src, i) in turn.sources" :key="i">
                          <!-- 표준답변: 상세로 링크 -->
                          <NuxtLink
                            v-if="src.kind === 'standard_answer'"
                            :to="`/standard-answers/${src.id}`"
                            class="block rounded-lg bg-emerald-50/70 px-2.5 py-1.5 text-[12px] ring-1 ring-inset ring-emerald-100 transition hover:ring-emerald-300"
                          >
                            <span class="inline-flex items-center gap-1.5">
                              <Bookmark class="size-3 text-emerald-600" />
                              <span class="font-medium text-emerald-800">표준답변 #{{ src.id }}</span>
                              <span class="text-emerald-700/80">{{ src.title }}</span>
                              <span v-if="typeof src.score === 'number'" class="ml-1 font-mono text-[10px] text-emerald-600/70">
                                {{ src.score.toFixed(2) }}
                              </span>
                            </span>
                            <p v-if="src.snippet" class="mt-0.5 line-clamp-2 pl-4 text-[11.5px] text-emerald-700/70">
                              {{ src.snippet }}
                            </p>
                          </NuxtLink>

                          <!-- 자료(material) -->
                          <div
                            v-else
                            class="rounded-lg bg-indigo-50/60 px-2.5 py-1.5 text-[12px] ring-1 ring-inset ring-indigo-100"
                          >
                            <span class="inline-flex items-center gap-1.5">
                              <FileText class="size-3 text-indigo-600" />
                              <span class="font-medium text-indigo-800">자료</span>
                              <span class="text-indigo-700/80">{{ src.title }}</span>
                              <span v-if="typeof src.score === 'number'" class="ml-1 font-mono text-[10px] text-indigo-600/70">
                                {{ src.score.toFixed(2) }}
                              </span>
                            </span>
                            <blockquote v-if="src.snippet" class="mt-1 border-l-2 border-indigo-200 pl-2 text-[11.5px] italic text-indigo-700/70">
                              {{ src.snippet }}
                            </blockquote>
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 입력창 -->
        <div class="border-t border-slate-200 bg-white px-3 py-3">
          <div class="flex items-end gap-2">
            <textarea
              v-model="input"
              rows="1"
              placeholder="질문을 입력하세요. (Enter 전송 · Shift+Enter 줄바꿈)"
              class="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-800 ring-1 ring-inset ring-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              @keydown="onKeydown"
            />
            <button
              type="button"
              class="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-4 text-[13px] font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="sending || !input.trim()"
              @click="send"
            >
              <Loader2 v-if="sending" class="size-4 animate-spin" />
              <Send v-else class="size-4" />
              전송
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
