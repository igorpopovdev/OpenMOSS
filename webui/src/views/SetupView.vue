<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { setupApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ChevronRight, ChevronLeft, Check, Copy, RefreshCw } from 'lucide-vue-next'

// Шаги мастера
const currentStep = ref(0)
const totalSteps = 5
const loading = ref(false)
const error = ref('')
const showRegistrationToken = ref(false)
const resultToken = ref('')
const alreadyInitialized = ref(false)
const pageLoading = ref(true)

onMounted(async () => {
    try {
        const { data } = await setupApi.status()
        if (data.initialized) {
            alreadyInitialized.value = true
        }
    } catch {
        // Исключение при ошибке — продолжаем
    } finally {
        pageLoading.value = false
    }
})

// Данные формы
const form = ref({
    adminPassword: '',
    confirmPassword: '',
    projectName: 'OpenMOSS',
    workspaceRoot: '',
    registrationToken: generateToken(),
    externalUrl: '',
    notificationChannels: '',
})

const allowRegistration = ref(true)
const notificationEnabled = ref(false)

function generateToken() {
    const chars = 'abcdef0123456789'
    let result = ''
    for (let i = 0; i < 32; i++) {
        result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
}

function regenerateToken() {
    form.value.registrationToken = generateToken()
}

async function copyToken(text: string) {
    try {
        await navigator.clipboard.writeText(text)
    } catch {
        // Тихая ошибка
    }
}

// Валидация шагов
const stepErrors = computed(() => {
    const errors: Record<number, string> = {}

    if (currentStep.value >= 0 && form.value.adminPassword.length > 0 && form.value.adminPassword.length < 6) {
        errors[0] = 'Пароль должен быть не менее 6 символов'
    }
    if (currentStep.value >= 0 && form.value.confirmPassword && form.value.adminPassword !== form.value.confirmPassword) {
        errors[0] = 'Пароли не совпадают'
    }

    if (currentStep.value >= 1 && form.value.projectName.length === 0) {
        errors[1] = 'Введите название проекта'
    }

    return errors
})

const canProceed = computed(() => {
    switch (currentStep.value) {
        case 0:
            return form.value.adminPassword.length >= 6 && form.value.adminPassword === form.value.confirmPassword
        case 1:
            return form.value.projectName.length > 0 && form.value.workspaceRoot.length > 0
        case 2:
            return form.value.registrationToken.length > 0
        case 3:
            return true
        case 4:
            return true
        default:
            return false
    }
})

function nextStep() {
    if (currentStep.value < totalSteps - 1 && canProceed.value) {
        currentStep.value++
        error.value = ''
    }
}

function prevStep() {
    if (currentStep.value > 0) {
        currentStep.value--
        error.value = ''
    }
}

async function handleSubmit() {
    if (!canProceed.value) return

    loading.value = true
    error.value = ''

    try {
        const channels = form.value.notificationChannels
            .split('\n')
            .map(c => c.trim())
            .filter(c => c.length > 0)

        const res = await setupApi.initialize({
            admin_password: form.value.adminPassword,
            project_name: form.value.projectName,
            workspace_root: form.value.workspaceRoot,
            registration_token: form.value.registrationToken,
            allow_registration: allowRegistration.value,
            external_url: form.value.externalUrl || undefined,
            notification: notificationEnabled.value ? {
                enabled: true,
                channels,
                events: ['task_completed', 'review_rejected', 'all_done', 'patrol_alert'],
            } : undefined,
        })

        resultToken.value = res.data.registration_token
        showRegistrationToken.value = true
    } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } } }
        error.value = err.response?.data?.detail || 'Ошибка инициализации. Попробуйте ещё раз.'
    } finally {
        loading.value = false
    }
}

function goToLogin() {
    window.location.href = '/login?from=setup'
}

const steps = [
    { title: 'Пароль администратора', desc: 'Установите пароль для входа' },
    { title: 'Информация о проекте', desc: 'Название проекта и рабочая директория' },
    { title: 'Регистрация агентов', desc: 'Токен для подключения агентов' },
    { title: 'Адрес сервера', desc: 'URL для подключения агентов' },
    { title: 'Каналы уведомлений', desc: 'Настройка оповещений (можно пропустить)' },
]
</script>

<template>
    <div class="flex min-h-screen items-center justify-center bg-background p-4">
        <!-- Загрузка -->
        <div v-if="pageLoading" class="flex justify-center py-12">
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>

        <!-- Уже инициализировано -->
        <Card v-else-if="alreadyInitialized" class="w-full max-w-md">
            <CardHeader class="text-center">
                <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400">
                    <Check class="h-6 w-6" />
                </div>
                <CardTitle class="text-xl">Система уже инициализирована</CardTitle>
                <CardDescription>Мастер настройки доступен только при первом развёртывании.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
                <p class="text-sm text-muted-foreground text-center">
                    Для изменения настроек войдите в систему и перейдите в «Настройки».
                </p>
                <Button class="w-full" @click="$router.push('/login')">
                    Перейти к входу
                    <ChevronRight class="ml-1 h-4 w-4" />
                </Button>
            </CardContent>
        </Card>

        <!-- Инициализация завершена -->
        <Card v-else-if="showRegistrationToken" class="w-full max-w-md">
            <CardHeader class="text-center">
                <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400">
                    <Check class="h-6 w-6" />
                </div>
                <CardTitle class="text-xl">Инициализация завершена!</CardTitle>
                <CardDescription>Сохраните токен регистрации агентов</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
                <div class="rounded-lg border bg-muted/50 p-4">
                    <Label class="text-xs text-muted-foreground">Токен регистрации агентов</Label>
                    <div class="mt-1 flex items-center gap-2">
                        <code class="flex-1 text-sm font-mono break-all">{{ resultToken }}</code>
                        <Button variant="ghost" size="icon" @click="copyToken(resultToken)" title="Копировать">
                            <Copy class="h-4 w-4" />
                        </Button>
                    </div>
                    <p class="mt-2 text-xs text-muted-foreground">
                        Агенты используют этот токен при регистрации. Его можно изменить в «Настройках».
                    </p>
                </div>
                <p class="mt-3 text-xs text-muted-foreground text-center">
                    После входа можно создавать промпты агентов и управлять ими.
                </p>
                <Button class="w-full" @click="goToLogin">
                    Перейти к входу
                    <ChevronRight class="ml-1 h-4 w-4" />
                </Button>
            </CardContent>
        </Card>

        <!-- Мастер настройки -->
        <Card v-else class="w-full max-w-lg">
            <CardHeader class="text-center">
                <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
                    M
                </div>
                <CardTitle class="text-2xl">Добро пожаловать в OpenMOSS</CardTitle>
                <CardDescription>Платформа мультиагентной — Настройка</CardDescription>
            </CardHeader>

            <CardContent>
                <!-- Индикатор шагов -->
                <div class="mb-6 flex items-center justify-center gap-2">
                    <template v-for="(step, i) in steps" :key="i">
                        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors"
                            :class="i < currentStep
                                ? 'bg-primary text-primary-foreground'
                                : i === currentStep
                                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                                    : 'bg-muted text-muted-foreground'">
                            <Check v-if="i < currentStep" class="h-3.5 w-3.5" />
                            <span v-else>{{ i + 1 }}</span>
                        </div>
                        <div v-if="i < steps.length - 1" class="h-px w-8 bg-border" />
                    </template>
                </div>

                <p class="mb-4 text-center text-sm text-muted-foreground">
                    {{ steps[currentStep]?.desc }}
                </p>

                <!-- Шаг 0: Пароль -->
                <div v-if="currentStep === 0" class="space-y-4">
                    <div class="space-y-2">
                        <Label for="admin-password">Пароль администратора</Label>
                        <Input id="admin-password" v-model="form.adminPassword" type="password" placeholder="Минимум 6 символов" />
                    </div>
                    <div class="space-y-2">
                        <Label for="confirm-password">Подтверждение пароля</Label>
                        <Input id="confirm-password" v-model="form.confirmPassword" type="password" placeholder="Введите пароль ещё раз"
                            @keyup.enter="nextStep" />
                    </div>
                    <p v-if="stepErrors[0]" class="text-sm text-destructive">{{ stepErrors[0] }}</p>
                </div>

                <!-- Шаг 1: Проект -->
                <div v-if="currentStep === 1" class="space-y-4">
                    <div class="space-y-2">
                        <Label for="project-name">Название проекта</Label>
                        <Input id="project-name" v-model="form.projectName" placeholder="OpenMOSS" />
                    </div>
                    <div class="space-y-2">
                        <Label for="workspace-root">Рабочая директория</Label>
                        <Input id="workspace-root" v-model="form.workspaceRoot" placeholder="Например: /home/openclaw/workspace" />
                        <p class="text-xs text-muted-foreground">
                            Общая директория на сервере, где агенты создают и хранят результаты. Убедитесь, что путь существует и агенты имеют права на запись.
                        </p>
                    </div>
                </div>

                <!-- Шаг 2: Регистрация -->
                <div v-if="currentStep === 2" class="space-y-4">
                    <div class="space-y-2">
                        <Label for="reg-token">Токен регистрации</Label>
                        <div class="flex gap-2">
                            <Input id="reg-token" v-model="form.registrationToken" class="flex-1 font-mono text-sm" />
                            <Button variant="outline" size="icon" @click="regenerateToken" title="Пересоздать">
                                <RefreshCw class="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" @click="copyToken(form.registrationToken)" title="Копировать">
                                <Copy class="h-4 w-4" />
                            </Button>
                        </div>
                        <p class="text-xs text-muted-foreground">Агенты используют этот токен для идентификации</p>
                    </div>
                    <div class="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <Label>Разрешить саморегистрацию агентов</Label>
                            <p class="text-xs text-muted-foreground">При выключении агенты создаются только вручную</p>
                        </div>
                        <Switch v-model="allowRegistration" />
                    </div>
                </div>

                <!-- Шаг 3: Адрес -->
                <div v-if="currentStep === 3" class="space-y-4">
                    <div class="space-y-2">
                        <Label for="external-url">🌐 Адрес сервера</Label>
                        <Input id="external-url" v-model="form.externalUrl" placeholder="https://moss.example.com" />
                    </div>

                    <div class="rounded-lg border bg-muted/30 p-4 space-y-3">
                        <div>
                            <p class="text-sm font-medium">💡 Что это?</p>
                            <p class="text-xs text-muted-foreground mt-1">
                                AI-агенты используют этот адрес для:
                            </p>
                            <ul class="text-xs text-muted-foreground mt-1 ml-4 list-disc space-y-0.5">
                                <li>Загрузки инструментов (task-cli.py)</li>
                                <li>Получения конфигурации навыков (SKILL.md)</li>
                                <li>Связи с системой задач</li>
                            </ul>
                        </div>
                        <div>
                            <p class="text-sm font-medium">📝 Инструкция</p>
                            <p class="text-xs text-muted-foreground mt-1">
                                Укажите полный внешний адрес сервера. Порт по умолчанию: <code class="bg-muted px-1 py-0.5 rounded">6565</code>.
                            </p>
                            <div class="flex flex-col gap-1 mt-2">
                                <div class="flex items-center gap-2">
                                    <code class="text-xs bg-muted px-2 py-1 rounded">https://moss.example.com</code>
                                    <span class="text-xs text-muted-foreground">← Обратный прокси (Nginx/Caddy)</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <code class="text-xs bg-muted px-2 py-1 rounded">http://123.45.67.89:6565</code>
                                    <span class="text-xs text-muted-foreground">← IP + порт</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <code class="text-xs bg-muted px-2 py-1 rounded">http://127.0.0.1:6565</code>
                                    <span class="text-xs text-muted-foreground">← Локальная отладка</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p class="text-xs text-muted-foreground">
                        ⏩ Пропустить? Можно настроить позже в «Настройках»
                    </p>
                </div>

                <!-- Шаг 4: Уведомления -->
                <div v-if="currentStep === 4" class="space-y-4">
                    <div class="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <Label>Включить уведомления</Label>
                            <p class="text-xs text-muted-foreground">Агент отправляет уведомления о завершении, отклонении и т.д.</p>
                        </div>
                        <Switch v-model="notificationEnabled" />
                    </div>

                    <div v-if="notificationEnabled" class="space-y-2">
                        <Label for="channels">Каналы уведомлений</Label>
                        <textarea id="channels" v-model="form.notificationChannels"
                            class="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            placeholder="По одному на строке, формат: тип:ID&#10;Пример: chat:oc_xxx" />
                        <p class="text-xs text-muted-foreground">
                            Можно настроить позже в «Настройках»
                        </p>
                    </div>
                </div>

                <!-- Ошибка -->
                <p v-if="error" class="mt-4 text-sm text-destructive">{{ error }}</p>

                <!-- Навигация -->
                <div class="mt-6 flex justify-between">
                    <Button v-if="currentStep > 0" variant="outline" @click="prevStep">
                        <ChevronLeft class="mr-1 h-4 w-4" />
                        Назад
                    </Button>
                    <div v-else />

                    <Button v-if="currentStep < totalSteps - 1" @click="nextStep" :disabled="!canProceed">
                        Далее
                        <ChevronRight class="ml-1 h-4 w-4" />
                    </Button>
                    <Button v-else @click="handleSubmit" :disabled="loading || !canProceed">
                        {{ loading ? 'Инициализация…' : 'Завершить настройку' }}
                        <Check v-if="!loading" class="ml-1 h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>
</template>
