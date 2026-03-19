<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { feedApi } from '@/api/client'
import { translateLog } from '@/composables/useActivityFeed'
import type { FeedLog, TranslatedActivity, AgentSummary } from '@/composables/useActivityFeed'
import ActivityCard from '@/components/feed/ActivityCard.vue'
import FeedAgentList from '@/components/feed/FeedAgentList.vue'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { ChevronLeft, ChevronRight, Inbox, Loader2, Lock, Pause, Play, RefreshCw, Users, X } from 'lucide-vue-next'

const enabled = ref<boolean | null>(null)
const loading = ref(true)
const activities = ref<TranslatedActivity[]>([])
const agentSummaries = ref<AgentSummary[]>([])
const flashingAgentIds = ref<Set<string>>(new Set())
const selectedAgentId = ref<string | null>(null)
const paused = ref(false)
const newIds = ref<Set<string>>(new Set())
const mobileSheetOpen = ref(false)
const sidebarCollapsed = ref(false)
const timelineRef = ref<HTMLElement | null>(null)
const feedListKey = ref(0)

let pollTimer: ReturnType<typeof setInterval> | null = null

const filteredActivities = computed(() => {
    if (!selectedAgentId.value) return activities.value
    return activities.value.filter((a) => a.agentId === selectedAgentId.value)
})

const selectedAgentName = computed(() => {
    if (!selectedAgentId.value) return null
    return agentSummaries.value.find((a) => a.id === selectedAgentId.value)?.name ?? null
})

async function checkStatus() {
    try {
        const res = await feedApi.status()
        enabled.value = res.data.enabled
    } catch { enabled.value = false }
}

async function loadAgentSummaries() {
    try {
        const res = await feedApi.agentSummary()
        agentSummaries.value = res.data
    } catch { /* ignore */ }
}

async function loadLogs(incremental = false) {
    try {
        const params: { after?: string; limit?: number } = { limit: 100 }
        if (incremental && activities.value.length > 0) {
            const ts = activities.value[0]?.timestamp
            if (ts) params.after = ts
        }

        const res = await feedApi.logs(params)
        const newLogs: FeedLog[] = res.data
        const translated = newLogs.map(translateLog)

        if (incremental && translated.length > 0) {
            const ids = new Set(translated.map((t) => t.id))
            newIds.value = ids
            setTimeout(() => { newIds.value = new Set() }, 3000)

            activities.value = [...translated, ...activities.value].slice(0, 300)

            const agentIds = new Set(translated.map((t) => t.agentId).filter(Boolean))
            flashingAgentIds.value = agentIds
            setTimeout(() => { flashingAgentIds.value = new Set() }, 2000)

            await nextTick()
            timelineRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
        } else if (!incremental) {
            activities.value = translated
            feedListKey.value++
        }
    } catch { /* ignore */ }
}

async function init() {
    loading.value = true
    await checkStatus()
    if (enabled.value) {
        await Promise.all([loadAgentSummaries(), loadLogs(false)])
    }
    loading.value = false
}

function startPolling() {
    pollTimer = setInterval(() => {
        if (!paused.value && enabled.value) {
            loadLogs(true)
            loadAgentSummaries()
        }
    }, 5000)
}

const switchingAgent = ref(false)

function handleSelectAgent(agentId: string | null) {
    if (agentId === selectedAgentId.value) {
        selectedAgentId.value = null
        mobileSheetOpen.value = false
        return
    }
    switchingAgent.value = true
    selectedAgentId.value = agentId
    mobileSheetOpen.value = false
    feedListKey.value++
    setTimeout(() => { switchingAgent.value = false }, 300)
}

onMounted(() => { init(); startPolling() })
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<template>
    <div class="h-screen flex flex-col bg-background text-foreground">
        <!-- Загрузка -->
        <div v-if="loading" class="flex-1 flex items-center justify-center">
            <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <!-- Отключено -->
        <div v-else-if="!enabled"
            class="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground/60 px-6">
            <Lock class="w-10 h-10 mb-1" />
            <p class="text-base font-semibold text-foreground/80">Лента активности отключена</p>
            <p class="text-sm text-muted-foreground/50 text-center max-w-sm leading-relaxed">
                После включения все API-запросы агентов будут отображаться на этой странице в реальном времени.
                Доступ возможен без авторизации.
            </p>
            <p class="text-xs text-muted-foreground/40 mt-1">Включите в настройках или измените <code class="bg-muted px-1.5 py-0.5 rounded text-[11px]">config.yaml → webui.public_feed: true</code></p>
        </div>

        <!-- Нормальный режим -->
        <template v-else>
            <!-- Верхняя панель -->
            <header class="shrink-0 flex items-center justify-between px-4 h-11 border-b border-border/40">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                        F
                    </div>
                    <span class="text-sm font-medium truncate">Лента</span>
                    <span class="text-[10px] text-muted-foreground/40 tabular-nums">{{ filteredActivities.length }}</span>

                    <template v-if="selectedAgentName">
                        <Separator orientation="vertical" class="h-3 mx-0.5 opacity-30" />
                        <span class="text-[11px] text-muted-foreground truncate max-w-[100px]">{{ selectedAgentName }}</span>
                        <button class="text-muted-foreground/40 hover:text-foreground" @click="selectedAgentId = null">
                            <X class="w-2.5 h-2.5" />
                        </button>
                    </template>
                </div>

                <div class="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" class="h-7 w-7" @click="paused = !paused">
                        <component :is="paused ? Play : Pause" class="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" class="h-7 w-7" @click="loadLogs(true)">
                        <RefreshCw class="w-3 h-3" />
                    </Button>

                    <!-- Агенты на мобильных -->
                    <Sheet v-model:open="mobileSheetOpen">
                        <SheetTrigger as-child>
                            <Button variant="ghost" size="icon" class="h-7 w-7 lg:hidden">
                                <Users class="w-3 h-3" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" class="max-h-[60vh] rounded-t-xl">
                            <SheetHeader>
                                <SheetTitle class="text-sm">Агенты</SheetTitle>
                            </SheetHeader>
                            <div class="overflow-y-auto">
                                <FeedAgentList :agents="agentSummaries" :flashing-agent-ids="flashingAgentIds"
                                    :selected-agent-id="selectedAgentId" @select="handleSelectAgent" />
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </header>

            <!-- Основной контент -->
            <div class="flex flex-1 min-h-0">
                <!-- Лента -->
                <div ref="timelineRef" class="flex-1 overflow-y-auto p-4">
                    <div class="max-w-3xl mx-auto rounded-xl border border-border/40 bg-card overflow-hidden">
                        <!-- Переключение -->
                        <div v-if="switchingAgent" class="flex items-center justify-center py-16">
                            <Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>

                        <template v-else>
                            <TransitionGroup name="feed-slide" tag="div" class="divide-y divide-border/30">
                                <ActivityCard v-for="(act, idx) in filteredActivities" :key="act.id" :activity="act"
                                    :is-new="newIds.has(act.id)" class="animate-slide-up"
                                    :style="{ animationDelay: `${Math.min(idx, 15) * 30}ms` }" />
                            </TransitionGroup>
                        </template>

                        <div v-if="!switchingAgent && filteredActivities.length === 0"
                            class="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
                            <Inbox class="w-6 h-6 mb-2" />
                            <p class="text-xs">Нет записей активности</p>
                            <p class="text-[10px] mt-1 text-muted-foreground/30">Записи появятся после запросов агентов</p>
                        </div>
                    </div>
                </div>

                <!-- Боковая панель агентов (ПК) -->
                <aside class="hidden lg:flex flex-col shrink-0 border-l border-border/40 overflow-hidden transition-all duration-300 ease-in-out"
                    :class="sidebarCollapsed ? 'w-10' : 'w-[400px]'">
                    <div class="flex items-center h-8 shrink-0"
                        :class="sidebarCollapsed ? 'justify-center' : 'px-3 justify-between'">
                        <span v-if="!sidebarCollapsed" class="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wider">
                            Агенты · {{ agentSummaries.length }}
                        </span>
                        <Button variant="ghost" size="icon" class="h-6 w-6" @click="sidebarCollapsed = !sidebarCollapsed">
                            <component :is="sidebarCollapsed ? ChevronLeft : ChevronRight" class="w-3 h-3" />
                        </Button>
                    </div>
                    <div v-if="!sidebarCollapsed" class="flex-1 overflow-y-auto">
                        <FeedAgentList :agents="agentSummaries" :flashing-agent-ids="flashingAgentIds"
                            :selected-agent-id="selectedAgentId" @select="handleSelectAgent" />
                    </div>
                </aside>
            </div>

            <!-- Нижняя панель -->
            <footer class="shrink-0 flex items-center justify-center gap-2 h-6 text-[10px] text-muted-foreground/30 border-t border-border/20">
                <span class="flex items-center gap-1">
                    <span class="inline-block w-1 h-1 rounded-full"
                        :class="paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'" />
                    {{ paused ? 'Приостановлено' : 'Обновляется' }}
                </span>
                <span>·</span>
                <span class="tabular-nums">{{ agentSummaries.length }} агентов</span>
            </footer>
        </template>
    </div>
</template>
