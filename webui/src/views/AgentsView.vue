<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { adminAgentApi, type AdminAgentItem } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {
    AlertCircle,
    Bot,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    Edit2,
    Key,
    Loader2,
    MoreHorizontal,
    RefreshCw,
    Search,
    ShieldCheck,
    Trash2,
    TrendingDown,
    TrendingUp,
    Users,
    X,
} from 'lucide-vue-next'

const PAGE_SIZE = 24

const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
const detailError = ref('')

const keyword = ref('')
const roleFilter = ref('all')
const statusFilter = ref('all')
const page = ref(1)
let requestId = 0

const pageData = ref({ items: [] as AdminAgentItem[], total: 0, page: 1, page_size: PAGE_SIZE, total_pages: 1, has_more: false })
const selectedAgent = ref<AdminAgentItem | null>(null)
const detailSheetOpen = ref(false)

const roleOptions = [
    { value: 'all', label: 'Все роли' },
    { value: 'planner', label: 'Планировщик' },
    { value: 'executor', label: 'Исполнитель' },
    { value: 'reviewer', label: 'Рецензент' },
    { value: 'patrol', label: 'Патрульный' },
]

const statusOptions = [
    { value: 'all', label: 'Все статусы' },
    { value: 'active', label: 'Работает' },
    { value: 'disabled', label: 'Отключён' },
]

const roleBadgeClass: Record<string, string> = {
    planner: 'border-violet-200 bg-violet-50 text-violet-700',
    executor: 'border-sky-200 bg-sky-50 text-sky-700',
    reviewer: 'border-amber-200 bg-amber-50 text-amber-700',
    patrol: 'border-teal-200 bg-teal-50 text-teal-700',
}

const roleColorClass: Record<string, string> = {
    planner: 'bg-violet-500',
    executor: 'bg-sky-500',
    reviewer: 'bg-amber-500',
    patrol: 'bg-teal-500',
}

function formatRole(role: string) {
    return ({ planner: 'Планировщик', executor: 'Исполнитель', reviewer: 'Рецензент', patrol: 'Патрульный' }[role] ?? role)
}

function formatStatus(status: string) {
    return ({ active: 'Работает', disabled: 'Отключён' }[status] ?? status)
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat('ru-RU', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date)
}

function formatRelativeTime(dateStr: string | null): string {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return '—'
    const diff = Date.now() - date.getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'менее часа'
    if (hours < 24) return `${hours} ч. назад`
    const days = Math.floor(hours / 24)
    return `${days} дн. назад`
}

async function loadData() {
    const rid = ++requestId
    loading.value = true
    error.value = ''
    try {
        const response = await adminAgentApi.list({
            page: page.value,
            page_size: PAGE_SIZE,
            keyword: keyword.value.trim() || undefined,
            role: roleFilter.value === 'all' ? undefined : roleFilter.value,
            status: statusFilter.value === 'all' ? undefined : statusFilter.value,
            sort_by: 'last_request_at',
            sort_order: 'desc',
        })
        if (rid !== requestId) return
        pageData.value = response.data
    } catch (e) {
        if (rid !== requestId) return
        console.error('Failed to load agents', e)
        error.value = 'Ошибка загрузки списка агентов'
    } finally {
        if (rid === requestId) loading.value = false
    }
}

async function selectAgent(agent: AdminAgentItem) {
    selectedAgent.value = agent
    detailSheetOpen.value = true
    detailLoading.value = true
    detailError.value = ''
    try {
        const response = await adminAgentApi.get(agent.id)
        selectedAgent.value = response.data
    } catch (e) {
        console.error('Failed to load agent detail', e)
        detailError.value = 'Не удалось загрузить данные агента'
    } finally {
        detailLoading.value = false
    }
}

function goToPage(p: number) {
    if (p < 1 || p > pageData.value.total_pages || p === page.value) return
    page.value = p
    loadData()
}

onMounted(() => {
    loadData()
})
</script>

<template>
    <div class="flex flex-col h-[calc(100vh-3.5rem)]">
        <!-- Заголовок -->
        <header class="shrink-0 border-b border-border/40 bg-background px-4 py-3 space-y-3">
            <div class="flex items-center gap-3">
                <div class="relative flex-1 max-w-sm">
                    <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input v-model="keyword" class="h-9 bg-muted/30 pl-10 text-sm" placeholder="Поиск по имени…" />
                </div>
                <Badge variant="secondary" class="h-7 px-2.5 text-xs tabular-nums shrink-0">
                    {{ pageData.total }} агентов
                </Badge>
                <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0" :disabled="loading" @click="loadData">
                    <RefreshCw class="h-3.5 w-3.5" :class="loading ? 'animate-spin' : ''" />
                </Button>
            </div>
            <div class="flex items-center gap-1.5">
                <Button v-for="opt in roleOptions" :key="opt.value" size="sm"
                    :variant="roleFilter === opt.value ? 'default' : 'ghost'" class="h-7 rounded-full px-3 text-xs"
                    @click="roleFilter = opt.value">
                    {{ opt.label }}
                </Button>
            </div>
        </header>

        <!-- Контент -->
        <div class="flex-1 min-h-0 overflow-y-auto">
            <!-- Ошибка -->
            <div v-if="error" class="flex flex-col items-center justify-center py-16">
                <AlertCircle class="h-5 w-5 text-muted-foreground" />
                <p class="mt-2 text-sm">{{ error }}</p>
                <Button class="mt-3" size="sm" @click="loadData">Повторить</Button>
            </div>

            <!-- Загрузка -->
            <div v-else-if="loading" class="flex items-center justify-center py-16">
                <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
            </div>

            <!-- Сетка карточек -->
            <template v-else-if="pageData.items.length">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                    <Card v-for="(agent, idx) in pageData.items" :key="agent.id"
                        class="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 animate-slide-up"
                        :style="{ animationDelay: `${idx * 25}ms` }"
                        @click="selectAgent(agent)">
                        <CardContent class="p-4 space-y-3">
                            <!-- Аватар + имя -->
                            <div class="flex items-start gap-3">
                                <div class="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                                    :class="roleColorClass[agent.role] + '/10'">
                                    <Bot class="h-5 w-5" :class="roleColorClass[agent.role].replace('bg-', 'text-')" />
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-semibold truncate">{{ agent.name }}</p>
                                    <p class="text-xs text-muted-foreground mt-0.5">
                                        {{ formatRole(agent.role) }}
                                    </p>
                                </div>
                                <Badge variant="outline" :class="roleBadgeClass[agent.role]" class="text-[10px] shrink-0">
                                    {{ formatStatus(agent.status) }}
                                </Badge>
                            </div>

                            <!-- Статистика -->
                            <div class="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>
                                    <span class="font-semibold text-foreground">{{ agent.open_sub_task_count }}</span> подзадач
                                </span>
                                <span>
                                    <span class="font-semibold text-foreground">{{ agent.assigned_count }}</span> назначено
                                </span>
                                <span>
                                    <span class="font-semibold text-foreground">{{ agent.in_progress_count }}</span> в работе
                                </span>
                            </div>

                            <!-- Последняя активность -->
                            <p class="text-[11px] text-muted-foreground/50">
                                Последний запрос: {{ formatRelativeTime(agent.last_request_at) }}
                            </p>

                            <!-- Баллы -->
                            <div class="flex items-center justify-between">
                                <Badge variant="secondary" class="text-xs">
                                    {{ agent.total_score >= 0 ? '+' : '' }}{{ agent.total_score }} баллов
                                </Badge>
                                <span v-if="agent.rank" class="text-[10px] text-muted-foreground">#{{ agent.rank }}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <!-- Пагинация -->
                <div v-if="pageData.total_pages > 1"
                    class="flex items-center justify-center gap-2 py-3 border-t border-border/30 text-xs text-muted-foreground">
                    <Button variant="ghost" size="icon" class="h-7 w-7" :disabled="page <= 1 || loading"
                        @click="goToPage(page - 1)">
                        <ChevronLeft class="h-3 w-3" />
                    </Button>
                    <span class="tabular-nums">{{ page }} / {{ pageData.total_pages }}</span>
                    <Button variant="ghost" size="icon" class="h-7 w-7"
                        :disabled="page >= pageData.total_pages || loading" @click="goToPage(page + 1)">
                        <ChevronRight class="h-3 w-3" />
                    </Button>
                </div>
            </template>

            <!-- Пусто -->
            <div v-else class="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
                <Users class="h-8 w-8 mb-3" />
                <p class="text-sm">Агенты не найдены</p>
            </div>
        </div>
    </div>

    <!-- Панель деталей -->
    <Sheet v-model:open="detailSheetOpen">
        <SheetContent side="right" class="w-full sm:max-w-xl p-0">
            <SheetHeader class="shrink-0 px-6 pt-6 pb-4 border-b border-border/30">
                <SheetTitle>Информация об агенте</SheetTitle>
                <SheetDescription>Просмотр и управление агентом</SheetDescription>
            </SheetHeader>

            <!-- Загрузка -->
            <div v-if="detailLoading" class="flex items-center justify-center py-12">
                <Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
            </div>

            <!-- Ошибка -->
            <div v-else-if="detailError" class="p-6 text-center">
                <p class="text-sm text-muted-foreground">{{ detailError }}</p>
            </div>

            <!-- Детали -->
            <div v-else-if="selectedAgent" class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div class="flex items-center gap-3">
                    <div class="h-12 w-12 rounded-xl flex items-center justify-center"
                        :class="roleColorClass[selectedAgent.role] + '/10'">
                        <Bot class="h-6 w-6" :class="roleColorClass[selectedAgent.role].replace('bg-', 'text-')" />
                    </div>
                    <div>
                        <h2 class="text-lg font-bold">{{ selectedAgent.name }}</h2>
                        <p class="text-sm text-muted-foreground">{{ formatRole(selectedAgent.role) }}</p>
                    </div>
                    <Badge variant="outline" :class="roleBadgeClass[selectedAgent.role]" class="ml-auto">
                        {{ formatStatus(selectedAgent.status) }}
                    </Badge>
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div class="rounded-xl border border-border/50 bg-muted/20 p-3.5 text-center">
                        <div class="text-2xl font-bold"
                            :class="selectedAgent.total_score >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                            {{ selectedAgent.total_score >= 0 ? '+' : '' }}{{ selectedAgent.total_score }}
                        </div>
                        <div class="text-[11px] text-muted-foreground mt-0.5">Баллы</div>
                    </div>
                    <div class="rounded-xl border border-border/50 bg-muted/20 p-3.5 text-center">
                        <div class="text-2xl font-bold">{{ selectedAgent.done_count }}</div>
                        <div class="text-[11px] text-muted-foreground mt-0.5">Выполнено</div>
                    </div>
                    <div class="rounded-xl border border-border/50 bg-muted/20 p-3.5 text-center">
                        <div class="text-2xl font-bold">{{ selectedAgent.rework_count }}</div>
                        <div class="text-[11px] text-muted-foreground mt-0.5">Доработки</div>
                    </div>
                </div>

                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-muted-foreground">Последний запрос</span>
                        <span>{{ formatDate(selectedAgent.last_request_at) }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-muted-foreground">Последняя активность</span>
                        <span>{{ formatDate(selectedAgent.last_activity_at) }}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-muted-foreground">Создан</span>
                        <span>{{ formatDate(selectedAgent.created_at) }}</span>
                    </div>
                </div>

                <div class="rounded-xl border border-border/50 p-3.5 space-y-2">
                    <p class="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Подзадачи</p>
                    <div class="grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                            <div class="text-lg font-bold">{{ selectedAgent.open_sub_task_count }}</div>
                            <div class="text-[10px] text-muted-foreground">Открыто</div>
                        </div>
                        <div>
                            <div class="text-lg font-bold">{{ selectedAgent.in_progress_count }}</div>
                            <div class="text-[10px] text-muted-foreground">В работе</div>
                        </div>
                        <div>
                            <div class="text-lg font-bold">{{ selectedAgent.review_count }}</div>
                            <div class="text-[10px] text-muted-foreground">На проверке</div>
                        </div>
                        <div>
                            <div class="text-lg font-bold">{{ selectedAgent.blocked_count }}</div>
                            <div class="text-[10px] text-muted-foreground">Заблокировано</div>
                        </div>
                    </div>
                </div>
            </div>
        </SheetContent>
    </Sheet>
</template>
