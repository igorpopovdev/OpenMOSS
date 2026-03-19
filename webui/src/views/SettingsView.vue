<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminConfigApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Save, Eye, EyeOff, RefreshCw, Copy, Loader2, Plus, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const loading = ref(true)
const saving = ref<string | null>(null)

const projectName = ref('')
const registrationToken = ref('')
const allowRegistration = ref(true)
const notificationEnabled = ref(false)
const notificationChannels = ref<string[]>([])
const notificationEvents = ref<string[]>([])
const publicFeed = ref(false)
const feedRetentionDays = ref(7)
const workspaceRoot = ref('')
const externalUrl = ref('')

const showPasswordForm = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const allEvents = [
    { value: 'task_completed', label: 'Подзадача завершена' },
    { value: 'review_rejected', label: 'Рецензия отклонена' },
    { value: 'all_done', label: 'Все задачи выполнены' },
    { value: 'patrol_alert', label: 'Тревога патруля' },
]

onMounted(async () => {
    try {
        const res = await adminConfigApi.get()
        const cfg = res.data as Record<string, Record<string, unknown>>

        projectName.value = (cfg.project?.name as string) || ''
        registrationToken.value = (cfg.agent?.registration_token as string) || ''
        allowRegistration.value = (cfg.agent?.allow_registration as boolean) ?? true
        notificationEnabled.value = (cfg.notification?.enabled as boolean) ?? false
        notificationChannels.value = (cfg.notification?.channels as string[]) || []
        notificationEvents.value = (cfg.notification?.events as string[]) || []
        publicFeed.value = (cfg.webui?.public_feed as boolean) ?? false
        feedRetentionDays.value = (cfg.webui?.feed_retention_days as number) ?? 7
        workspaceRoot.value = (cfg.workspace?.root as string) || ''
        externalUrl.value = (cfg.server?.external_url as string) || ''
    } catch (e) {
        console.error('Ошибка загрузки конфигурации', e)
        showMessage('Ошибка загрузки конфигурации', 'error')
    } finally {
        loading.value = false
    }
})

function showMessage(msg: string, type: 'success' | 'error' = 'success') {
    if (type === 'success') {
        toast.success(msg)
    } else {
        toast.error(msg)
    }
}

async function saveSection(section: string) {
    saving.value = section
    try {
        let data: Record<string, unknown> = {}

        switch (section) {
            case 'project':
                data = {
                    project: { name: projectName.value },
                    workspace: { root: workspaceRoot.value },
                }
                break
            case 'agent':
                data = {
                    agent: {
                        registration_token: registrationToken.value,
                        allow_registration: allowRegistration.value,
                    }
                }
                break
            case 'notification':
                data = {
                    notification: {
                        enabled: notificationEnabled.value,
                        channels: notificationChannels.value.map(c => c.trim()).filter(c => c),
                        events: notificationEvents.value,
                    }
                }
                break
            case 'webui':
                data = {
                    webui: {
                        public_feed: publicFeed.value,
                        feed_retention_days: feedRetentionDays.value,
                    }
                }
                break
            case 'workspace':
                data = { workspace: { root: workspaceRoot.value } }
                break
            case 'server':
                data = { server: { external_url: externalUrl.value } }
                break
        }

        await adminConfigApi.update(data)
        showMessage('Сохранено', 'success')
    } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } } }
        showMessage(err.response?.data?.detail || 'Ошибка сохранения', 'error')
    } finally {
        saving.value = null
    }
}

async function handleChangePassword() {
    if (newPassword.value.length < 6) {
        showMessage('Новый пароль должен быть не менее 6 символов', 'error')
        return
    }
    if (newPassword.value !== confirmPassword.value) {
        showMessage('Пароли не совпадают', 'error')
        return
    }

    saving.value = 'password'
    try {
        await adminConfigApi.updatePassword(oldPassword.value, newPassword.value)
        showMessage('Пароль изменён')
        showPasswordForm.value = false
        oldPassword.value = ''
        newPassword.value = ''
        confirmPassword.value = ''
    } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } } }
        showMessage(err.response?.data?.detail || 'Ошибка смены пароля', 'error')
    } finally {
        saving.value = null
    }
}

function toggleEvent(event: string) {
    const idx = notificationEvents.value.indexOf(event)
    if (idx >= 0) {
        notificationEvents.value.splice(idx, 1)
    } else {
        notificationEvents.value.push(event)
    }
}

function regenerateToken() {
    const chars = 'abcdef0123456789'
    let result = ''
    for (let i = 0; i < 32; i++) {
        result += chars[Math.floor(Math.random() * chars.length)]
    }
    registrationToken.value = result
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text)
        showMessage('Скопировано')
    } catch { /* silent */ }
}
</script>

<template>
    <div class="max-w-2xl">
        <!-- Загрузка -->
        <div v-if="loading" class="flex justify-center py-12">
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>

        <template v-else>
            <Tabs default-value="project" class="w-full">
                <TabsList class="grid w-full grid-cols-4">
                    <TabsTrigger value="project">Проект</TabsTrigger>
                    <TabsTrigger value="security">Безопасность</TabsTrigger>
                    <TabsTrigger value="notification">Уведомления</TabsTrigger>
                    <TabsTrigger value="display">Отображение</TabsTrigger>
                </TabsList>

                <!-- Tab 1: Настройки проекта -->
                <TabsContent value="project">
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Настройки проекта</CardTitle>
                            <CardDescription>Основная информация и рабочая директория</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div class="space-y-2">
                                <Label for="s-project-name">Название проекта</Label>
                                <Input id="s-project-name" v-model="projectName" />
                            </div>
                            <div class="space-y-2">
                                <Label for="s-workspace">Рабочая директория</Label>
                                <Input id="s-workspace" v-model="workspaceRoot" placeholder="/path/to/workspace" />
                                <p class="text-xs text-muted-foreground">Корневая директория для файлов агентов</p>
                            </div>

                            <Separator />

                            <div class="space-y-2">
                                <Label for="s-external-url">Адрес сервера</Label>
                                <Input id="s-external-url" v-model="externalUrl" placeholder="https://moss.example.com" />
                                <p class="text-xs text-muted-foreground">
                                    Агенты используют этот адрес для загрузки task-cli.py и SKILL.md, а также для связи с системой задач.
                                    Порт по умолчанию: <code class="bg-muted px-1 py-0.5 rounded">6565</code>.
                                </p>
                                <div class="flex flex-col gap-1 mt-1">
                                    <div class="flex items-center gap-2">
                                        <code class="text-xs bg-muted px-2 py-1 rounded">https://moss.example.com</code>
                                        <span class="text-xs text-muted-foreground">← Обратный прокси</span>
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

                            <div class="flex justify-end gap-2">
                                <Button size="sm" variant="outline" @click="saveSection('server')" :disabled="!!saving">
                                    <Loader2 v-if="saving === 'server'" class="mr-1 h-3.5 w-3.5 animate-spin" />
                                    <Save v-else class="mr-1 h-3.5 w-3.5" />
                                    {{ saving === 'server' ? 'Сохранение…' : 'Сохранить адрес' }}
                                </Button>
                                <Button size="sm" @click="saveSection('project')" :disabled="!!saving">
                                    <Loader2 v-if="saving === 'project'" class="mr-1 h-3.5 w-3.5 animate-spin" />
                                    <Save v-else class="mr-1 h-3.5 w-3.5" />
                                    {{ saving === 'project' ? 'Сохранение…' : 'Сохранить' }}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <!-- Tab 2: Безопасность -->
                <TabsContent value="security">
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Безопасность</CardTitle>
                            <CardDescription>Пароль администратора и управление регистрацией агентов</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <!-- Смена пароля -->
                            <div>
                                <Button variant="outline" size="sm" @click="showPasswordForm = !showPasswordForm">
                                    <component :is="showPasswordForm ? EyeOff : Eye" class="mr-1 h-3.5 w-3.5" />
                                    {{ showPasswordForm ? 'Отмена' : 'Изменить пароль' }}
                                </Button>
                            </div>
                            <div v-if="showPasswordForm" class="space-y-3 rounded-lg border p-4">
                                <div class="space-y-2">
                                    <Label for="s-old-pwd">Текущий пароль</Label>
                                    <Input id="s-old-pwd" v-model="oldPassword" type="password" />
                                </div>
                                <div class="space-y-2">
                                    <Label for="s-new-pwd">Новый пароль</Label>
                                    <Input id="s-new-pwd" v-model="newPassword" type="password" placeholder="Минимум 6 символов" />
                                </div>
                                <div class="space-y-2">
                                    <Label for="s-confirm-pwd">Подтверждение</Label>
                                    <Input id="s-confirm-pwd" v-model="confirmPassword" type="password" />
                                </div>
                                <Button size="sm" @click="handleChangePassword" :disabled="saving === 'password'">
                                    {{ saving === 'password' ? 'Изменение…' : 'Подтвердить' }}
                                </Button>
                            </div>

                            <Separator />

                            <!-- Токен регистрации -->
                            <div class="space-y-2">
                                <Label for="s-reg-token">Токен регистрации агентов</Label>
                                <div class="flex gap-2">
                                    <Input id="s-reg-token" v-model="registrationToken" class="flex-1 font-mono text-sm" />
                                    <Button variant="outline" size="icon" @click="regenerateToken" title="Пересоздать">
                                        <RefreshCw class="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" @click="copyText(registrationToken)" title="Копировать">
                                        <Copy class="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <!-- Переключатель саморегистрации -->
                            <div class="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                    <Label>Разрешить саморегистрацию агентов</Label>
                                    <p class="text-xs text-muted-foreground">При выключении агенты создаются только администратором</p>
                                </div>
                                <Switch v-model="allowRegistration" />
                            </div>

                            <div class="flex justify-end">
                                <Button size="sm" @click="saveSection('agent')" :disabled="!!saving">
                                    <Loader2 v-if="saving === 'agent'" class="mr-1 h-3.5 w-3.5 animate-spin" />
                                    <Save v-else class="mr-1 h-3.5 w-3.5" />
                                    {{ saving === 'agent' ? 'Сохранение…' : 'Сохранить' }}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <!-- Tab 3: Уведомления -->
                <TabsContent value="notification">
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Уведомления</CardTitle>
                            <CardDescription>Настройка каналов и событий для оповещений агентов</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div class="flex items-center justify-between rounded-lg border p-3">
                                <div class="space-y-1">
                                    <Label>Включить уведомления</Label>
                                    <p class="text-xs text-muted-foreground">Агенты будут отправлять уведомления в настроенные каналы</p>
                                </div>
                                <Switch v-model="notificationEnabled" />
                            </div>

                            <template v-if="notificationEnabled">
                                <div class="space-y-2">
                                    <Label>Каналы уведомлений</Label>
                                    <div class="space-y-2">
                                        <div v-for="(_, idx) in notificationChannels" :key="idx" class="flex items-center gap-2">
                                            <Input v-model="notificationChannels[idx]" class="flex-1 font-mono text-sm"
                                                placeholder="chat:oc_xxx или email:xxx@example.com" />
                                            <Button variant="ghost" size="icon"
                                                class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                @click="notificationChannels.splice(idx, 1)">
                                                <Trash2 class="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <Button variant="outline" size="sm" class="w-full"
                                            @click="notificationChannels.push('')">
                                            <Plus class="mr-1 h-3.5 w-3.5" />
                                            Добавить канал
                                        </Button>
                                    </div>
                                    <div class="space-y-1 text-xs text-muted-foreground">
                                        <p class="font-medium text-foreground/60">Поддерживаемые типы:</p>
                                        <p><code class="bg-muted px-1 py-0.5 rounded">chat:oc_xxx</code> — OpenClaw групповой чат</p>
                                        <p><code class="bg-muted px-1 py-0.5 rounded">user:ou_xxx</code> — OpenClaw личные сообщения</p>
                                        <p><code class="bg-muted px-1 py-0.5 rounded">email:xxx@example.com</code> — Email-уведомления</p>
                                    </div>
                                </div>

                                <div class="space-y-2">
                                    <Label>События</Label>
                                    <div class="grid grid-cols-2 gap-2">
                                        <div v-for="event in allEvents" :key="event.value"
                                            class="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                            @click="toggleEvent(event.value)">
                                            <div class="h-4 w-4 rounded border flex items-center justify-center"
                                                :class="notificationEvents.includes(event.value) ? 'bg-primary border-primary' : ''">
                                                <svg v-if="notificationEvents.includes(event.value)" class="h-3 w-3 text-primary-foreground"
                                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <span class="text-sm">{{ event.label }}</span>
                                        </div>
                                    </div>
                                </div>
                            </template>

                            <div class="flex justify-end">
                                <Button size="sm" @click="saveSection('notification')" :disabled="!!saving">
                                    <Loader2 v-if="saving === 'notification'" class="mr-1 h-3.5 w-3.5 animate-spin" />
                                    <Save v-else class="mr-1 h-3.5 w-3.5" />
                                    {{ saving === 'notification' ? 'Сохранение…' : 'Сохранить' }}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <!-- Tab 4: Отображение -->
                <TabsContent value="display">
                    <Card>
                        <CardHeader>
                            <CardTitle class="text-base">Настройки отображения</CardTitle>
                            <CardDescription>Лента активности и логи</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div class="flex items-center justify-between rounded-lg border p-3">
                                <div class="space-y-1">
                                    <Label>Публичный доступ к ленте</Label>
                                    <p class="text-xs text-muted-foreground">
                                        Включите для доступа к <code class="bg-muted px-1 py-0.5 rounded">/feed</code> без авторизации
                                    </p>
                                </div>
                                <Switch v-model="publicFeed" />
                            </div>
                            <div class="space-y-2">
                                <Label for="s-retention">Срок хранения логов (дни)</Label>
                                <Input id="s-retention" v-model.number="feedRetentionDays" type="number" min="1" max="365" class="w-32" />
                                <p class="text-xs text-muted-foreground">Логи старше этого срока удаляются при запуске</p>
                            </div>
                            <div class="flex justify-end">
                                <Button size="sm" @click="saveSection('webui')" :disabled="!!saving">
                                    <Loader2 v-if="saving === 'webui'" class="mr-1 h-3.5 w-3.5 animate-spin" />
                                    <Save v-else class="mr-1 h-3.5 w-3.5" />
                                    {{ saving === 'webui' ? 'Сохранение…' : 'Сохранить' }}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </template>
    </div>
</template>
