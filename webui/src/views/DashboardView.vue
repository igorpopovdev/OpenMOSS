<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminDashboardApi, type DashboardOverview, type DashboardHighlights } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    BarChart3,
    Bot,
    ChevronRight,
    Clock,
    Flag,
    Loader2,
    RefreshCw,
    Star,
    Target,
    TrendingUp,
    Zap,
} from 'lucide-vue-next'

const router = useRouter()
const overview = ref<DashboardOverview | null>(null)
const highlights = ref<DashboardHighlights | null>(null)
const loading = ref(true)
const error = ref('')
const refreshing = ref(false)

onMounted(() => {
    load()
})

async function load() {
    loading.value = true
    error.value = ''
    try {
        const [overviewRes, highlightsRes] = await Promise.all([
            adminDashboardApi.overview(),
            adminDashboardApi.highlights({ limit: 8, inactive_hours: 24 }),
        ])
        overview.value = overviewRes.data
        highlights.value = highlightsRes.data
    } catch (e) {
        console.error('Failed to load dashboard', e)
        error.value = 'Ошибка загрузки данных'
    } finally {
        loading.value = false
    }
}

async function refresh() {
    refreshing.value = true
    await load()
    refreshing.value = false
}

const taskStatusMap: Record<string, { label: string; color: string }> = {
    planning: { label: 'Планируется', color: 'text-violet-600' },
    active: { label: 'Активна', color: 'text-amber-600' },
    in_progress: { label: 'В работе', color: 'text-sky-600' },
    completed: { label: 'Завершена', color: 'text-emerald-600' },
    archived: { label: 'В архиве', color: 'text-stone-600' },
    cancelled: { label: 'Отменена', color: 'text-rose-600' },
}

const subTaskStatusMap: Record<string, { label: string; color: string }> = {
    pending: { label: 'Ожидает', color: 'text-slate-600' },
    assigned: { label: 'Назначена', color: 'text-indigo-600' },
    in_progress: { label: 'Выполняется', color: 'text-sky-600' },
    review: { label: 'На проверке', color: 'text-amber-600' },
    rework: { label: 'Доработка', color: 'text-orange-600' },
    blocked: { label: 'Заблокирована', color: 'text-rose-600' },
    done: { label: 'Готово', color: 'text-emerald-600' },
    cancelled: { label: 'Отменена', color: 'text-stone-600' },
}

const agentStatusMap: Record<string, { label: string; color: string }> = {
    active: { label: 'Работает', color: 'text-emerald-600' },
    disabled: { label: 'Отключен', color: 'text-gray-500' },
}

const agentRoleMap: Record<string, string> = {
    planner: 'Планировщик',
    executor: 'Исполнитель',
    reviewer: 'Рецензент',
    patrol: 'Патрульный',
}

const reviewResultMap: Record<string, string> = {
    approved: 'Одобрено',
    rejected: 'Отклонено',
}

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '—'
    const now = Date.now()
    const diff = now - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'только что'
    if (mins < 60) return `${mins} мин. назад`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} ч. назад`
    const days = Math.floor(hours / 24)
    return `${days} дн. назад`
}
</script>

<template>
    <div class="p-6 max-w-7xl mx-auto space-y-6">

        <!-- Заголовок -->
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold">Панель управления</h1>
                <p class="text-sm text-muted-foreground mt-1">
                    Обзор задач, агентов и ключевых событий
                </p>
            </div>
            <Button variant="outline" size="sm" :disabled="refreshing" @click="refresh">
                <RefreshCw class="h-3.5 w-3.5 mr-1.5" :class="refreshing ? 'animate-spin' : ''" />
                Обновить
            </Button>
        </div>

        <!-- Загрузка -->
        <div v-if="loading" class="flex justify-center py-20">
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>

        <!-- Ошибка -->
        <div v-else-if="error" class="flex flex-col items-center py-20 text-muted-foreground">
            <AlertCircle class="h-8 w-8 mb-3" />
            <p class="text-lg font-medium">{{ error }}</p>
            <Button class="mt-4" @click="load">Повторить</Button>
        </div>

        <template v-else-if="overview">

            <!-- Основные карточки -->
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Card
                    class="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                    @click="router.push('/tasks')">
                    <CardContent class="p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-[11px] text-muted-foreground uppercase tracking-wider">Открытые
                                    задачи</p>
                                <p class="text-3xl font-bold mt-1">{{ overview.core_cards.open_task_count }}</p>
                            </div>
                            <div class="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
                                <Target class="h-5 w-5 text-violet-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    class="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                    @click="router.push('/tasks')">
                    <CardContent class="p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-[11px] text-muted-foreground uppercase tracking-wider">Активные
                                    подзадачи</p>
                                <p class="text-3xl font-bold mt-1">
                                    {{ overview.core_cards.active_sub_task_count }}</p>
                            </div>
                            <div class="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                                <Zap class="h-5 w-5 text-sky-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    class="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                    @click="router.push('/reviews')">
                    <CardContent class="p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-[11px] text-muted-foreground uppercase tracking-wider">На проверке</p>
                                <p class="text-3xl font-bold mt-1">{{ overview.core_cards.review_queue_count }}</p>
                            </div>
                            <div class="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Star class="h-5 w-5 text-amber-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    class="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                    @click="router.push('/tasks')">
                    <CardContent class="p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-[11px] text-muted-foreground uppercase tracking-wider">Заблокированы
                                </p>
                                <p class="text-3xl font-bold mt-1"
                                    :class="overview.core_cards.blocked_sub_task_count > 0 ? 'text-rose-600' : ''">
                                    {{ overview.core_cards.blocked_sub_task_count }}
                                </p>
                            </div>
                            <div class="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                <AlertTriangle class="h-5 w-5 text-rose-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    class="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                    @click="router.push('/agents')">
                    <CardContent class="p-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-[11px] text-muted-foreground uppercase tracking-wider">Активные
                                    агенты</p>
                                <p class="text-3xl font-bold mt-1">
                                    {{ overview.core_cards.active_agent_count }}</p>
                            </div>
                            <div class="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <Bot class="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <!-- Вторичные карточки -->
            <div class="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
                <Card>
                    <CardContent class="p-4 space-y-1">
                        <p class="text-[11px] text-muted-foreground/60">Выполнено сегодня</p>
                        <p class="text-2xl font-bold text-emerald-600">
                            +{{ overview.core_cards.today_completed_sub_task_count }}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent class="p-4 space-y-1">
                        <p class="text-[11px] text-muted-foreground/60">Отключённые агенты</p>
                        <p class="text-2xl font-bold"
                            :class="overview.secondary_cards.disabled_agent_count > 0 ? 'text-stone-600' : 'text-muted-foreground'">
                            {{ overview.secondary_cards.disabled_agent_count }}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent class="p-4 space-y-1">
                        <p class="text-[11px] text-muted-foreground/60">Проверено сегодня</p>
                        <p class="text-2xl font-bold">{{ overview.secondary_cards.today_review_count }}</p>
                        <p class="text-[10px] text-muted-foreground">
                            <span class="text-rose-500">{{ overview.secondary_cards.today_rejected_review_count }}</span>
                            отклонено
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent class="p-4 space-y-1">
                        <p class="text-[11px] text-muted-foreground/60">Нетто-баллы за день</p>
                        <p class="text-2xl font-bold tabular-nums"
                            :class="overview.secondary_cards.today_net_score_delta >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                            {{ overview.secondary_cards.today_net_score_delta >= 0 ? '+' : '' }}{{ overview.secondary_cards.today_net_score_delta }}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent class="p-4 space-y-1">
                        <p class="text-[11px] text-muted-foreground/60">Статус рецензий</p>
                        <p class="text-2xl font-bold">{{ (overview.secondary_cards.today_reject_rate * 100).toFixed(0) }}%</p>
                        <p class="text-[10px] text-muted-foreground">доля отклонений</p>
                    </CardContent>
                </Card>
            </div>

            <!-- Распределения -->
            <div class="grid gap-4 xl:grid-cols-3">
                <!-- Статусы задач -->
                <Card>
                    <CardHeader class="pb-3">
                        <CardTitle class="text-sm">Статусы задач</CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-2.5">
                        <div v-for="(count, status) in overview.distributions.task_status_distribution" :key="status"
                            class="flex items-center gap-3">
                            <span class="text-xs text-muted-foreground w-20 shrink-0 truncate">
                                {{ taskStatusMap[status]?.label || status }}
                            </span>
                            <div class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div class="h-full rounded-full bg-violet-500 transition-all"
                                    :style="{ width: `${Math.max((count / (overview.core_cards.open_task_count || 1)) * 100, 2)}%` }" />
                            </div>
                            <span class="text-xs font-medium tabular-nums w-6 text-right">{{ count }}</span>
                        </div>
                    </CardContent>
                </Card>

                <!-- Статусы подзадач -->
                <Card>
                    <CardHeader class="pb-3">
                        <CardTitle class="text-sm">Статусы подзадач</CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-2.5">
                        <div v-for="(count, status) in overview.distributions.sub_task_status_distribution" :key="status"
                            class="flex items-center gap-3">
                            <span class="text-xs text-muted-foreground w-20 shrink-0 truncate">
                                {{ subTaskStatusMap[status]?.label || status }}
                            </span>
                            <div class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div class="h-full rounded-full bg-sky-500 transition-all"
                                    :style="{ width: `${Math.max((count / (overview.core_cards.active_sub_task_count || 1)) * 100, 2)}%` }" />
                            </div>
                            <span class="text-xs font-medium tabular-nums w-6 text-right">{{ count }}</span>
                        </div>
                    </CardContent>
                </Card>

                <!-- Роли агентов -->
                <Card>
                    <CardHeader class="pb-3">
                        <CardTitle class="text-sm">Агенты по ролям</CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-2.5">
                        <div v-for="(count, role) in overview.distributions.agent_role_distribution" :key="role"
                            class="flex items-center gap-3">
                            <span class="text-xs text-muted-foreground w-20 shrink-0 truncate">
                                {{ agentRoleMap[role] || role }}
                            </span>
                            <div class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div class="h-full rounded-full bg-emerald-500 transition-all"
                                    :style="{ width: `${Math.max((count / (overview.core_cards.active_agent_count || 1)) * 100, 2)}%` }" />
                            </div>
                            <span class="text-xs font-medium tabular-nums w-6 text-right">{{ count }}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <!-- Избранное -->
            <div class="grid gap-4 xl:grid-cols-2">

                <!-- Заблокированные подзадачи -->
                <Card>
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between">
                            <CardTitle class="text-sm">Заблокированные подзадачи</CardTitle>
                            <Button variant="ghost" size="sm" class="h-7 text-xs"
                                @click="router.push('/tasks?status=blocked')">
                                Подробнее
                                <ArrowRight class="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div v-if="highlights?.blocked_sub_tasks.length"
                            class="space-y-2.5">
                            <div v-for="item in highlights.blocked_sub_tasks" :key="item.id"
                                class="flex items-start gap-2.5 rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                                @click="router.push(`/tasks?t=${item.task_id}`)">
                                <div class="mt-0.5 w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium truncate">{{ item.name }}</p>
                                    <p class="text-xs text-muted-foreground mt-0.5">{{ item.task_name }}</p>
                                </div>
                                <Badge variant="outline" class="text-[10px] shrink-0">Заблокирована</Badge>
                            </div>
                        </div>
                        <div v-else class="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                            <Flag class="h-6 w-6 mb-2" />
                            <p class="text-sm">Нет заблокированных</p>
                        </div>
                    </CardContent>
                </Card>

                <!-- Ожидающие проверки -->
                <Card>
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between">
                            <CardTitle class="text-sm">Ожидающие проверки</CardTitle>
                            <Button variant="ghost" size="sm" class="h-7 text-xs"
                                @click="router.push('/reviews')">
                                Подробнее
                                <ArrowRight class="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div v-if="highlights?.pending_review_sub_tasks.length"
                            class="space-y-2.5">
                            <div v-for="item in highlights.pending_review_sub_tasks" :key="item.id"
                                class="flex items-start gap-2.5 rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                                @click="router.push(`/reviews?sub_task=${item.id}`)">
                                <div class="mt-0.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium truncate">{{ item.name }}</p>
                                    <p class="text-xs text-muted-foreground mt-0.5">{{ item.task_name }}</p>
                                </div>
                                <Badge variant="outline" class="text-[10px] shrink-0">На проверке</Badge>
                            </div>
                        </div>
                        <div v-else class="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                            <Clock class="h-6 w-6 mb-2" />
                            <p class="text-sm">Нет ожидающих</p>
                        </div>
                    </CardContent>
                </Card>

                <!-- Активные агенты -->
                <Card>
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between">
                            <CardTitle class="text-sm">Загруженные агенты</CardTitle>
                            <Button variant="ghost" size="sm" class="h-7 text-xs"
                                @click="router.push('/agents')">
                                Все агенты
                                <ArrowRight class="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div v-if="highlights?.busy_agents.length" class="space-y-2.5">
                            <div v-for="agent in highlights.busy_agents" :key="agent.id"
                                class="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                                @click="router.push(`/agents?agent=${agent.id}`)">
                                <div class="h-8 w-8 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                                    <Bot class="h-4 w-4 text-sky-600" />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium">{{ agent.name }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ agentRoleMap[agent.role] || agent.role }} ·
                                        {{ agent.open_sub_task_count }} подзадач
                                    </p>
                                </div>
                                <div class="text-right shrink-0">
                                    <p class="text-sm font-bold tabular-nums"
                                        :class="agent.total_score >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                                        {{ agent.total_score >= 0 ? '+' : '' }}{{ agent.total_score }}
                                    </p>
                                    <p class="text-[10px] text-muted-foreground">баллы</p>
                                </div>
                            </div>
                        </div>
                        <div v-else class="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                            <Bot class="h-6 w-6 mb-2" />
                            <p class="text-sm">Нет данных</p>
                        </div>
                    </CardContent>
                </Card>

                <!-- Неактивные агенты -->
                <Card>
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between">
                            <CardTitle class="text-sm">Неактивные агенты</CardTitle>
                            <Button variant="ghost" size="sm" class="h-7 text-xs"
                                @click="router.push('/agents')">
                                Все агенты
                                <ArrowRight class="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div v-if="highlights?.low_activity_agents.length" class="space-y-2.5">
                            <div v-for="agent in highlights.low_activity_agents" :key="agent.id"
                                class="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                                @click="router.push(`/agents?agent=${agent.id}`)">
                                <div class="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                                    <Clock class="h-4 w-4 text-stone-500" />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium">{{ agent.name }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ agentRoleMap[agent.role] || agent.role }} ·
                                        последний запрос {{ formatRelativeTime(agent.last_request_at) }}
                                    </p>
                                </div>
                                <Badge variant="outline" class="text-[10px] shrink-0">
                                    {{ agentStatusMap[agent.status]?.label || agent.status }}
                                </Badge>
                            </div>
                        </div>
                        <div v-else class="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                            <TrendingUp class="h-6 w-6 mb-2" />
                            <p class="text-sm">Все агенты активны</p>
                        </div>
                    </CardContent>
                </Card>

                <!-- Последние рецензии -->
                <Card class="xl:col-span-2">
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between">
                            <CardTitle class="text-sm">Последние рецензии</CardTitle>
                            <Button variant="ghost" size="sm" class="h-7 text-xs"
                                @click="router.push('/reviews')">
                                Все
                                <ArrowRight class="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div v-if="highlights?.recent_reviews.length" class="space-y-2">
                            <div v-for="review in highlights.recent_reviews" :key="review.id"
                                class="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                                @click="router.push(`/reviews?sub_task=${review.sub_task_id}`)">
                                <div class="shrink-0">
                                    <div class="h-8 w-8 rounded-full flex items-center justify-center"
                                        :class="review.result === 'approved' ? 'bg-emerald-100' : 'bg-rose-100'">
                                        <Star v-if="review.result === 'approved'" class="h-4 w-4 text-emerald-600" />
                                        <AlertCircle v-else class="h-4 w-4 text-rose-600" />
                                    </div>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium truncate">{{ review.sub_task_name }}</p>
                                    <p class="text-xs text-muted-foreground mt-0.5">{{ review.task_name }}</p>
                                </div>
                                <div class="text-right shrink-0">
                                    <Badge :variant="review.result === 'approved' ? 'default' : 'destructive'"
                                        class="text-[10px]">
                                        {{ reviewResultMap[review.result] || review.result }}
                                    </Badge>
                                    <p class="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                                        {{ formatRelativeTime(review.created_at) }}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div v-else class="flex flex-col items-center justify-center py-8 text-muted-foreground/40">
                            <BarChart3 class="h-6 w-6 mb-2" />
                            <p class="text-sm">Нет рецензий</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <p class="text-xs text-muted-foreground/40 text-center">
                Обновлено: {{ overview.generated_at ? new Date(overview.generated_at).toLocaleString('ru-RU') : '—' }}
            </p>
        </template>
    </div>
</template>
