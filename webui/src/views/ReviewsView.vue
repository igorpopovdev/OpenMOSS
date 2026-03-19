<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import {
    adminReviewApi,
    type AdminReviewListItem,
    type AdminPageResponse,
} from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    FileText,
    Loader2,
    RefreshCw,
    Search,
    Star,
} from 'lucide-vue-next'

const PAGE_SIZE = 20

const loading = ref(false)
const error = ref('')

const keyword = ref('')
const resultFilter = ref('all')
const page = ref(1)
let requestId = 0

const pageData = ref<AdminPageResponse<AdminReviewListItem>>(createEmptyPage())
const selectedReview = ref<AdminReviewListItem | null>(null)
const detailSheetOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')

const resultOptions = [
    { value: 'all', label: 'Все' },
    { value: 'approved', label: 'Одобрено' },
    { value: 'rejected', label: 'Отклонено' },
    { value: 'pending', label: 'Ожидает' },
]

const roleBadgeClass: Record<string, string> = {
    planner: 'border-violet-200 bg-violet-50 text-violet-700',
    executor: 'border-sky-200 bg-sky-50 text-sky-700',
    reviewer: 'border-amber-200 bg-amber-50 text-amber-700',
    patrol: 'border-teal-200 bg-teal-50 text-teal-700',
}

function formatRole(role: string) {
    return ({ planner: 'Планировщик', executor: 'Исполнитель', reviewer: 'Рецензент', patrol: 'Патрульный' }[role] ?? role)
}

function formatDate(value: string | null) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat('ru-RU', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(date)
}

function formatResult(result: string) {
    return ({ approved: 'Одобрено', rejected: 'Отклонено', pending: 'Ожидает' }[result] ?? result)
}

function getResultBadgeClass(result: string) {
    return ({
        approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        rejected: 'border-rose-200 bg-rose-50 text-rose-700',
        pending: 'border-amber-200 bg-amber-50 text-amber-700',
    }[result] ?? 'border-border bg-muted text-muted-foreground')
}

const reloadDebounced = useDebounceFn(() => {
    page.value = 1
    void loadData()
}, 280)

watch([keyword, resultFilter], () => {
    loading.value = true
    reloadDebounced()
})

onMounted(() => {
    void loadData()
})

function createEmptyPage<T>(): AdminPageResponse<T> {
    return { items: [] as T[], total: 0, page: 1, page_size: PAGE_SIZE, total_pages: 1, has_more: false }
}

async function loadData() {
    const rid = ++requestId
    loading.value = true
    error.value = ''

    try {
        const response = await adminReviewApi.list({
            page: page.value,
            page_size: PAGE_SIZE,
            keyword: keyword.value.trim() || undefined,
            result: resultFilter.value === 'all' ? undefined : resultFilter.value,
            sort_order: 'desc',
        })
        if (rid !== requestId) return
        pageData.value = response.data
    } catch (e) {
        if (rid !== requestId) return
        console.error('Failed to load reviews', e)
        error.value = 'Ошибка загрузки данных. Попробуйте ещё раз.'
    } finally {
        if (rid === requestId) loading.value = false
    }
}

async function openReviewDetail(review: AdminReviewListItem) {
    selectedReview.value = review
    detailSheetOpen.value = true
    detailLoading.value = true
    detailError.value = ''
    try {
        const response = await adminReviewApi.get(review.id)
        selectedReview.value = response.data
    } catch (e) {
        console.error('Failed to load review detail', e)
        detailError.value = 'Не удалось загрузить детали рецензии.'
    } finally {
        detailLoading.value = false
    }
}

function goToPage(p: number) {
    if (p < 1 || p > pageData.value.total_pages || p === page.value) return
    page.value = p
    loadData()
}
</script>

<template>
    <div class="flex flex-col h-[calc(100vh-3.5rem)]">
        <!-- Заголовок -->
        <header class="shrink-0 border-b border-border/40 bg-background px-4 py-3 space-y-3">
            <div class="flex items-center gap-3">
                <div class="relative flex-1 max-w-sm">
                    <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input v-model="keyword" class="h-9 bg-muted/30 pl-10 text-sm" placeholder="Поиск по причине…" />
                </div>
                <Badge variant="secondary" class="h-7 px-2.5 text-xs tabular-nums shrink-0">
                    {{ pageData.total }} записей
                </Badge>
                <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0" :disabled="loading" @click="loadData">
                    <RefreshCw class="h-3.5 w-3.5" :class="loading ? 'animate-spin' : ''" />
                </Button>
            </div>

            <div class="flex items-center gap-1.5">
                <Button v-for="opt in resultOptions" :key="opt.value" size="sm"
                    :variant="resultFilter === opt.value ? 'default' : 'ghost'"
                    class="h-7 rounded-full px-3 text-xs" @click="resultFilter = opt.value">
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
                <Button class="mt-3" size="sm" @click="loadData">Перезагрузить</Button>
            </div>

            <!-- Загрузка -->
            <div v-else-if="loading" class="flex items-center justify-center py-16">
                <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
            </div>

            <!-- Список -->
            <template v-else-if="pageData.items.length">
                <div class="divide-y divide-border/30">
                    <button v-for="(review, idx) in pageData.items" :key="review.id" type="button"
                        class="w-full px-5 py-3.5 text-left transition-colors hover:bg-muted/30 animate-slide-up"
                        :style="{ animationDelay: `${idx * 25}ms` }"
                        @click="openReviewDetail(review)">
                        <div class="flex items-start gap-3">
                            <div class="shrink-0 mt-1">
                                <div class="h-8 w-8 rounded-full flex items-center justify-center"
                                    :class="review.result === 'approved' ? 'bg-emerald-100' : review.result === 'rejected' ? 'bg-rose-100' : 'bg-amber-100'">
                                    <Star v-if="review.result === 'approved'" class="h-4 w-4 text-emerald-600" />
                                    <AlertCircle v-else-if="review.result === 'rejected'" class="h-4 w-4 text-rose-600" />
                                    <Loader2 v-else class="h-4 w-4 text-amber-600" />
                                </div>
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-sm font-semibold">{{ review.sub_task_name }}</span>
                                    <Badge variant="outline" :class="getResultBadgeClass(review.result)" class="text-[10px] shrink-0">
                                        {{ formatResult(review.result) }}
                                    </Badge>
                                    <span class="text-[10px] text-muted-foreground">· {{ review.task_name }}</span>
                                </div>
                                <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    {{ review.issues || review.comment || 'Без комментария' }}
                                </p>
                                <div class="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground/50">
                                    <span>{{ review.reviewer_agent_name || review.reviewer_agent }}</span>
                                    <span v-if="review.rework_agent_name">→ {{ review.rework_agent_name }}</span>
                                    <span class="ml-auto tabular-nums">{{ formatDate(review.created_at) }}</span>
                                </div>
                            </div>
                        </div>
                    </button>
                </div>

                <!-- Пагинация -->
                <div v-if="pageData.total_pages > 1"
                    class="flex items-center justify-center gap-2 py-3 border-t border-border/30 text-xs text-muted-foreground">
                    <Button variant="ghost" size="icon" class="h-7 w-7" :disabled="page <= 1 || loading"
                        @click="goToPage(page - 1)">
                        <ArrowLeft class="h-3 w-3" />
                    </Button>
                    <span class="tabular-nums">{{ page }} / {{ pageData.total_pages }}</span>
                    <Button variant="ghost" size="icon" class="h-7 w-7"
                        :disabled="page >= pageData.total_pages || loading" @click="goToPage(page + 1)">
                        <ArrowRight class="h-3 w-3" />
                    </Button>
                </div>
            </template>

            <!-- Пусто -->
            <div v-else class="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
                <FileText class="h-6 w-6 mb-2" />
                <p class="text-sm">Рецензии не найдены</p>
            </div>
        </div>
    </div>

    <!-- Панель деталей -->
    <Sheet v-model:open="detailSheetOpen">
        <SheetContent side="right" class="w-full sm:max-w-xl p-0">
            <SheetHeader class="shrink-0 px-6 pt-6 pb-4 border-b border-border/30">
                <SheetTitle>Детали рецензии</SheetTitle>
                <SheetDescription>Просмотр результата, замечаний и контекста подзадачи</SheetDescription>
            </SheetHeader>

            <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div v-if="detailLoading" class="flex items-center justify-center py-12">
                    <Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
                </div>

                <div v-else-if="detailError" class="text-center text-sm text-muted-foreground">
                    {{ detailError }}
                </div>

                <template v-else-if="selectedReview">
                    <div class="flex items-center gap-2">
                        <Badge variant="outline" :class="getResultBadgeClass(selectedReview.result)">
                            {{ formatResult(selectedReview.result) }}
                        </Badge>
                        <Badge variant="secondary">Раунд {{ selectedReview.round }}</Badge>
                    </div>

                    <div class="space-y-3">
                        <div>
                            <p class="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Подзадача</p>
                            <p class="text-sm font-medium mt-1">{{ selectedReview.sub_task_name }}</p>
                            <p class="text-xs text-muted-foreground">{{ selectedReview.task_name }}</p>
                        </div>

                        <div v-if="selectedReview.issues">
                            <p class="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Замечания</p>
                            <p class="text-sm mt-1 whitespace-pre-wrap">{{ selectedReview.issues }}</p>
                        </div>

                        <div v-if="selectedReview.comment">
                            <p class="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Комментарий</p>
                            <p class="text-sm mt-1 whitespace-pre-wrap">{{ selectedReview.comment }}</p>
                        </div>

                        <Separator />

                        <div class="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p class="text-[11px] text-muted-foreground/60">Рецензент</p>
                                <p class="font-medium mt-0.5">{{ selectedReview.reviewer_agent_name || '—' }}</p>
                            </div>
                            <div v-if="selectedReview.rework_agent_name">
                                <p class="text-[11px] text-muted-foreground/60">Доработку ведёт</p>
                                <p class="font-medium mt-0.5">{{ selectedReview.rework_agent_name }}</p>
                            </div>
                            <div>
                                <p class="text-[11px] text-muted-foreground/60">Балл</p>
                                <p class="font-medium mt-0.5">{{ selectedReview.score || 0 }}</p>
                            </div>
                            <div>
                                <p class="text-[11px] text-muted-foreground/60">Дата</p>
                                <p class="font-medium mt-0.5">{{ formatDate(selectedReview.created_at) }}</p>
                            </div>
                        </div>

                        <div v-if="selectedReview.sub_task_description">
                            <p class="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Описание подзадачи</p>
                            <p class="text-sm mt-1 whitespace-pre-wrap">{{ selectedReview.sub_task_description }}</p>
                        </div>
                        <div v-if="selectedReview.sub_task_deliverable">
                            <p class="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Результат</p>
                            <p class="text-sm mt-1 whitespace-pre-wrap">{{ selectedReview.sub_task_deliverable }}</p>
                        </div>
                        <div v-if="selectedReview.sub_task_acceptance">
                            <p class="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Критерии приёмки</p>
                            <p class="text-sm mt-1 whitespace-pre-wrap">{{ selectedReview.sub_task_acceptance }}</p>
                        </div>
                    </div>
                </template>
            </div>
        </SheetContent>
    </Sheet>
</template>
