<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { marked } from 'marked'
import { promptsApi, adminRuleApi } from '@/api/client'
import type { AgentPromptMeta, PromptTemplate } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Plus, Copy, Pencil, Trash2, FileText, Check, Loader2,
  ChevronLeft, Code, Eye, ChevronRight, Download,
  Compass, Zap, SearchCheck, ShieldCheck, Bot,
  Users, ScrollText, LayoutTemplate,
} from 'lucide-vue-next'

// ── Статус ────────────────────────────────────────────────
const loading = ref(true)
const agents = ref<AgentPromptMeta[]>([])
const templates = ref<PromptTemplate[]>([])

// 
const mode = ref<'list' | 'create' | 'edit' | 'preview' | 'template' | 'agent-view'>('list')
const editSlug = ref('')
const form = ref({
  slug: '',
  name: '',
  role: '',
  description: '',
})

// Создать/Редактировать
const promptContent = ref('')
const onboardingContent = ref('')
const isRoleLoading = ref(false)

// РольПодтвердить
const showRoleConfirm = ref(false)
const roleConfirmTarget = ref('')
const roleConfirmPrevious = ref('')

// УдалитьПодтвердить
const showDeleteConfirm = ref(false)
const deleteTarget = ref('')

// ШаблонПросмотр/Редактировать
const templateForm = ref({ role: '', content: '', filename: '' })
const templateEditing = ref(false)

// Предпросмотр
const composedPrompt = ref('')
const copied = ref(false)
const previewMode = ref<'rendered' | 'source'>('rendered')

// const saving = ref(false)
const deleting = ref('')

// 
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

function showMessage(text: string, type: 'success' | 'error' = 'success') {
  message.value = text
  messageType.value = type
  setTimeout(() => { message.value = '' }, 3000)
}


// ── Правила ──────────────────────────────────────────
interface RuleItem {
  id: string
  scope: string
  content: string
  created_at?: string
  updated_at?: string
}

const rules = ref<RuleItem[]>([])
const rulesLoading = ref(false)
const ruleSaving = ref(false)
const ruleDeleting = ref('')

// ПравилаРедактировать（СоздатьРедактировать）
const showRuleEditor = ref(false)
const ruleEditorId = ref<string | null>(null)  // null = Создать
const ruleEditorContent = ref('')
const ruleEditorPreviewMode = ref<'split' | 'edit' | 'preview'>('split')

// ПравилаРедактироватьПредпросмотр
const renderedRulePreview = computed(() => {
  if (!ruleEditorContent.value) return ''
  return marked(ruleEditorContent.value) as string
})

// УдалитьПравилаПодтвердить
const showRuleDeleteConfirm = ref(false)
const ruleDeleteTarget = ref('')

async function loadRules() {
  rulesLoading.value = true
  try {
    const { data } = await adminRuleApi.list('global')
    rules.value = data
  } catch (e) {
    console.error('Правила', e)
  } finally {
    rulesLoading.value = false
  }
}

function openRuleEditor(rule?: RuleItem) {
  ruleEditorId.value = rule?.id ?? null
  ruleEditorContent.value = rule?.content ?? ''
  ruleEditorPreviewMode.value = 'split'
  showRuleEditor.value = true
}

function closeRuleEditor() {
  showRuleEditor.value = false
  ruleEditorId.value = null
  ruleEditorContent.value = ''
}

async function saveRuleEditor() {
  if (!ruleEditorContent.value.trim()) return
  ruleSaving.value = true
  try {
    if (ruleEditorId.value) {
      // Редактировать
      await adminRuleApi.update(ruleEditorId.value, ruleEditorContent.value)
      showMessage('ПравилаОбновить')
    } else {
      // Создать
      await adminRuleApi.create({ scope: 'global', content: ruleEditorContent.value })
      showMessage('ПравилаСоздать')
    }
    closeRuleEditor()
    await loadRules()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    showMessage(err.response?.data?.detail || 'Сохранить', 'error')
  } finally {
    ruleSaving.value = false
  }
}

function confirmRuleDelete(id: string) {
  ruleDeleteTarget.value = id
  showRuleDeleteConfirm.value = true
}

async function doRuleDelete() {
  showRuleDeleteConfirm.value = false
  const id = ruleDeleteTarget.value
  ruleDeleting.value = id
  try {
    await adminRuleApi.delete(id)
    showMessage('ПравилаУдалить')
    await loadRules()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    showMessage(err.response?.data?.detail || 'Удалить', 'error')
  } finally {
    ruleDeleting.value = ''
  }
}

// ── Роль ────────────────────────────────────────────
const roleOptions = [
  { value: 'planner', label: 'Планировщик Planner' },
  { value: 'executor', label: 'Исполнитель Executor' },
  { value: 'reviewer', label: 'Рецензент Reviewer' },
  { value: 'patrol', label: 'Патрульный Patrol' },
]

const roleLabel = (role: string) =>
  roleOptions.find(r => r.value === role)?.label || role

const templateDescriptions: Record<string, string> = {
  'planner': '，',
  'executor': '，Содержимое、',
  'reviewer': '，',
  'patrol': '，',
}

// РольНастроить
const requiredRoles = [
  { role: 'planner', label: 'Планировщик Planner', desc: '、、', single: true },
  { role: 'reviewer', label: 'Рецензент Reviewer', desc: 'Исполнитель，', single: true },
  { role: 'patrol', label: 'Патрульный Patrol', desc: '、、', single: true },
  { role: 'executor', label: 'Исполнитель Executor', desc: '，СоздатьИсполнитель', single: false },
]

// РольСтатус
const roleStatus = computed(() => {
  return requiredRoles.map(r => ({
    ...r,
    count: agents.value.filter(a => a.role === r.role).length,
    done: agents.value.some(a => a.role === r.role),
  }))
})

const hasMissingRoles = computed(() => roleStatus.value.some(r => !r.done))

// Роль，Создано
const groupedAgents = computed(() => {
  const groups: Record<string, AgentPromptMeta[]> = {}
  for (const a of agents.value) {
    const key = a.role || ''
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
  }
  //  created_at 
  for (const key of Object.keys(groups)) {
    groups[key]?.sort((a, b) => {
      const ta = a.created_at || ''
      const tb = b.created_at || ''
      return tb.localeCompare(ta)
    })
  }
  return groups
})

// ── Markdown  ────────────────────────────────────────
const renderedMarkdown = computed(() => {
  if (!composedPrompt.value) return ''
  return marked(composedPrompt.value) as string
})

const renderedTemplateContent = computed(() => {
  if (!templateForm.value.content) return ''
  return marked(templateForm.value.content) as string
})

const agentViewData = ref({ slug: '', name: '', role: '', description: '', content: '' })
const renderedAgentContent = computed(() => {
  if (!agentViewData.value.content) return ''
  return marked(agentViewData.value.content) as string
})

// РедактироватьПредпросмотр：Подсказка + 
const fullEditorContent = computed(() => {
  const parts: string[] = []
  if (promptContent.value.trim()) parts.push(promptContent.value.trim())
  if (onboardingContent.value.trim()) parts.push(onboardingContent.value.trim())
  return parts.join('\n\n---\n\n')
})

const renderedEditorPreview = computed(() => {
  if (!fullEditorContent.value) return ''
  return marked(fullEditorContent.value) as string
})

const editorCopied = ref(false)

// ──  ─────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const [agentsRes, templatesRes] = await Promise.all([
      promptsApi.listAgents(),
      promptsApi.listTemplates(),
    ])
    agents.value = agentsRes.data
    templates.value = templatesRes.data
  } catch {
    showMessage('Ошибка загрузки', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
  loadRules()
})

// ── Роль → Шаблон ────────────────────
async function loadRoleContent(role: string) {
  isRoleLoading.value = true
  try {
    const templateRes = await promptsApi.getTemplate(role)
    promptContent.value = templateRes.data.content
  } catch {
    promptContent.value = ''
  }
  try {
    const onboardingRes = await promptsApi.getOnboarding(role)
    onboardingContent.value = onboardingRes.data.content
  } catch {
    onboardingContent.value = ''
  }
  isRoleLoading.value = false
}

function handleRoleChange(event: Event) {
  const newRole = (event.target as HTMLSelectElement).value
  if (!newRole) return

  // Содержимое，ПользовательскоеПодтвердить
  if (form.value.role && promptContent.value.trim()) {
    roleConfirmPrevious.value = form.value.role
    roleConfirmTarget.value = newRole
    //  select （ ）
    form.value.role = roleConfirmPrevious.value
    showRoleConfirm.value = true
    return
  }

  form.value.role = newRole
  loadRoleContent(newRole)
}

function confirmRoleSwitch() {
  showRoleConfirm.value = false
  form.value.role = roleConfirmTarget.value
  loadRoleContent(roleConfirmTarget.value)
}

function cancelRoleSwitch() {
  showRoleConfirm.value = false
}

// ── Создать ────────────────────────────────────────────
function startCreate(presetRole?: string) {
  form.value = { slug: '', name: '', role: presetRole || '', description: '' }
  promptContent.value = ''
  onboardingContent.value = ''
  mode.value = 'create'
  if (presetRole) {
    loadRoleContent(presetRole)
  }
}

async function handleCreate() {
  if (!form.value.slug || !form.value.name || !form.value.role || !promptContent.value) {
    showMessage('Обязательно', 'error')
    return
  }
  saving.value = true
  try {
    await promptsApi.createAgent({
      slug: form.value.slug,
      name: form.value.name,
      role: form.value.role,
      description: form.value.description,
      content: fullEditorContent.value,
    })
    showMessage('Создано')
    mode.value = 'list'
    await loadData()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    showMessage(err.response?.data?.detail || 'Ошибка создания', 'error')
  } finally {
    saving.value = false
  }
}

// ── Редактировать ────────────────────────────────────────────────
// ONBOARDING_MARKER Копировать

async function startEdit(slug: string) {
  try {
    const { data } = await promptsApi.getAgent(slug)
    editSlug.value = slug
    form.value = {
      slug: data.slug,
      name: data.name,
      role: data.role,
      description: data.description,
    }

    // Содержимое：，
    const content = data.content
    const markerIdx = content.indexOf(ONBOARDING_MARKER)
    if (markerIdx > 0) {
      //  ---
      let splitIdx = markerIdx
      const before = content.substring(0, markerIdx)
      const lastSep = before.lastIndexOf('---')
      if (lastSep > 0) splitIdx = lastSep

      promptContent.value = content.substring(0, splitIdx).trim()
      onboardingContent.value = content.substring(markerIdx).trim()
    } else {
      promptContent.value = content
      // 
      try {
        const { data: ob } = await promptsApi.getOnboarding(data.role)
        onboardingContent.value = ob.content
      } catch {
        onboardingContent.value = ''
      }
    }

    mode.value = 'edit'
  } catch {
    showMessage('Ошибка загрузки', 'error')
  }
}

async function handleUpdate() {
  saving.value = true
  try {
    await promptsApi.updateAgent(editSlug.value, {
      name: form.value.name,
      role: form.value.role,
      description: form.value.description,
      content: fullEditorContent.value,
    })
    showMessage('Сохранить')
    mode.value = 'list'
    await loadData()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    showMessage(err.response?.data?.detail || 'Сохранить', 'error')
  } finally {
    saving.value = false
  }
}

// ── Удалить ────────────────────────────────────────────────

async function handleDelete(slug: string, event: Event) {
  event.stopPropagation()
  deleteTarget.value = slug
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  showDeleteConfirm.value = false
  const slug = deleteTarget.value
  deleting.value = slug
  try {
    await promptsApi.deleteAgent(slug)
    showMessage('Удалить')
    await loadData()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    showMessage(err.response?.data?.detail || 'Удалить', 'error')
  } finally {
    deleting.value = ''
  }
}

// ── ШаблонПросмотр/Редактировать ────────────────────────────────────────
async function openTemplate(role: string) {
  try {
    const { data } = await promptsApi.getTemplate(role)
    templateForm.value = { role: data.role, content: data.content, filename: data.filename }
    templateEditing.value = false
    mode.value = 'template'
  } catch {
    showMessage('Шаблон', 'error')
  }
}

async function saveTemplate() {
  saving.value = true
  try {
    await promptsApi.updateTemplate(templateForm.value.role, templateForm.value.content)
    showMessage('ШаблонСохранить')
    templateEditing.value = false
    await loadData()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    showMessage(err.response?.data?.detail || 'Сохранить', 'error')
  } finally {
    saving.value = false
  }
}

// ── Agent Просмотр ───────────────────────────────────────────
async function openAgentView(slug: string) {
  try {
    const { data } = await promptsApi.getAgent(slug)
    agentViewData.value = {
      slug: data.slug,
      name: data.name,
      role: data.role,
      description: data.description,
      content: data.content,
    }
    mode.value = 'agent-view'
  } catch {
    showMessage('Ошибка загрузки', 'error')
  }
}

// ── Копировать ─────────────────────────────────────────────
const previewRole = ref('')

const roleLabels: Record<string, string> = {
  planner: 'Планировщик',
  executor: 'Исполнитель',
  reviewer: 'Рецензент',
  patrol: 'Патрульный',
}

const ONBOARDING_MARKER = '## 🔧 Платформа'

//  composedPrompt 
const onboardingSection = computed(() => {
  const idx = composedPrompt.value.indexOf(ONBOARDING_MARKER)
  if (idx < 0) return ''
  return composedPrompt.value.substring(idx).trim()
})

//  OpenClaw Копировать
function buildQuickCopyPrefix(role: string): string {
  const label = roleLabels[role] || role
  return (
    `🦞 **OpenClaw ** — Настроить：\n\n` +
    `1. 「РольПодсказка」**** **AGENTS.md**（Роль：${label}）\n` +
    `2.  AGENTS.md Содержимое，Обновить **SOUL.md**（）\n` +
    `3. 「Платформа」， API Key\n` +
    `4. Сохранить Skill \n` +
    `5. **Удалить**「Платформа」，РольПодсказка\n\n` +
    `---\n\n`
  )
}

async function showCompose(slug: string) {
  composedPrompt.value = ''
  copied.value = false
  previewMode.value = 'rendered'
  //  agent  role
  const agent = agents.value.find(a => a.slug === slug)
  previewRole.value = agent?.role || ''
  try {
    const { data } = await promptsApi.compose(slug)
    composedPrompt.value = data.prompt
    editSlug.value = slug
    mode.value = 'preview'
  } catch (e: unknown) {
    const err = e as { response?: { data?: { detail?: string } } }
    showMessage(err.response?.data?.detail || '', 'error')
  }
}

// 🦞 OpenClaw Копировать（）
const lobsterCopied = ref(false)
async function copyWithPrefix() {
  try {
    const text = buildQuickCopyPrefix(previewRole.value) + composedPrompt.value
    await navigator.clipboard.writeText(text)
    lobsterCopied.value = true
    showMessage('🦞 Копировать（）')
    setTimeout(() => { lobsterCopied.value = false }, 2000)
  } catch {
    showMessage('Копировать，Копировать', 'error')
  }
}

// Копировать（Подсказка）
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(composedPrompt.value)
    copied.value = true
    showMessage('Копировать')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    showMessage('Копировать，Копировать', 'error')
  }
}

// КопироватьПлатформа
const onboardingCopied = ref(false)
async function copyOnboarding() {
  if (!onboardingSection.value) {
    showMessage('Содержимое', 'error')
    return
  }
  try {
    await navigator.clipboard.writeText(onboardingSection.value)
    onboardingCopied.value = true
    showMessage('КопироватьПлатформа')
    setTimeout(() => { onboardingCopied.value = false }, 2000)
  } catch {
    showMessage('Копировать', 'error')
  }
}

async function copyEditorContent() {
  try {
    await navigator.clipboard.writeText(fullEditorContent.value)
    editorCopied.value = true
    showMessage('Копировать')
    setTimeout(() => { editorCopied.value = false }, 2000)
  } catch {
    showMessage('Копировать', 'error')
  }
}


function goBack() {
  mode.value = 'list'
}
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">

    <!-- Подсказка -->
    <Transition name="toast">
      <div v-if="message"
        class="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-medium shadow-xl ring-1 ring-black/5 backdrop-blur-md"
        :class="messageType === 'success'
          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200'
          : 'bg-red-50 text-red-800 dark:bg-red-950/90 dark:text-red-200'">
        <span class="text-base">{{ messageType === 'success' ? '✅' : '❌' }}</span>
        {{ message }}
      </div>
    </Transition>

    <!--  -->
    <Transition name="view" mode="out-in" appear>

      <div v-if="mode === 'list'" key="list" class="space-y-4 max-w-5xl mx-auto">

        <Tabs default-value="agents" class="w-full">
          <TabsList class="w-full justify-start bg-muted/50 p-1 h-auto gap-1">
            <TabsTrigger value="agents"
              class="text-xs px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1.5">
              <Users class="h-3.5 w-3.5" />
              Agent 
              <span class="text-muted-foreground">({{ agents.length }})</span>
            </TabsTrigger>
            <TabsTrigger value="rules"
              class="text-xs px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1.5">
              <ScrollText class="h-3.5 w-3.5" />
              Правила
              <span class="text-muted-foreground">({{ rules.length }})</span>
            </TabsTrigger>
            <TabsTrigger value="templates"
              class="text-xs px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1.5">
              <LayoutTemplate class="h-3.5 w-3.5" />
              РольШаблон
            </TabsTrigger>
          </TabsList>

          <!-- Tab: Agent  -->
          <TabsContent value="agents" class="mt-5 space-y-5">

            <!--  +  + Создать -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <h2 class="text-xl font-bold">Agent </h2>
                <div v-if="!loading && hasMissingRoles"
                  class="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1">
                  <div class="h-1.5 w-10 rounded-full bg-muted overflow-hidden">
                    <div class="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      :style="{ width: `${(roleStatus.filter(r => r.done).length / roleStatus.length) * 100}%` }" />
                  </div>
                  {{roleStatus.filter(r => r.done).length}}/{{ roleStatus.length }} Роль
                </div>
              </div>
              <Button @click="startCreate()">
                <Plus class="mr-1.5 h-4 w-4" />
                СоздатьПодсказка
              </Button>
            </div>

            <!-- Роль -->
            <div v-if="!loading && hasMissingRoles" class="flex items-center gap-2 flex-wrap text-sm">
              <span class="text-muted-foreground text-xs">Роль,Создать：</span>
              <template v-for="r in roleStatus.filter(r => !r.done)" :key="r.role">
                <button
                  class="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs font-medium transition-all duration-200 hover:shadow-sm"
                  :class="{
                    'border-violet-300 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950': r.role === 'planner',
                    'border-sky-300 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950': r.role === 'executor',
                    'border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950': r.role === 'reviewer',
                    'border-teal-300 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950': r.role === 'patrol',
                  }"
                  @click="startCreate(r.role)">
                  <Compass v-if="r.role === 'planner'" class="h-3 w-3" />
                  <Zap v-else-if="r.role === 'executor'" class="h-3 w-3" />
                  <SearchCheck v-else-if="r.role === 'reviewer'" class="h-3 w-3" />
                  <ShieldCheck v-else-if="r.role === 'patrol'" class="h-3 w-3" />
                  {{ r.label }}
                  <Plus class="h-3 w-3 opacity-50" />
                </button>
              </template>
              <span v-for="r in roleStatus.filter(r => r.done)" :key="'done-' + r.role"
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                :class="{
                  'bg-violet-500/10 text-violet-600 dark:text-violet-400': r.role === 'planner',
                  'bg-sky-500/10 text-sky-600 dark:text-sky-400': r.role === 'executor',
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400': r.role === 'reviewer',
                  'bg-teal-500/10 text-teal-600 dark:text-teal-400': r.role === 'patrol',
                }">
                <Check class="h-3 w-3" />
                {{ r.role === 'planner' ? 'Планировщик' : r.role === 'reviewer' ? 'Рецензент' : r.role === 'patrol' ? 'Патрульный' :
                  `Исполнитель×${r.count}` }}
              </span>
            </div>

            <!-- Инструкция -->
            <details class="group" :open="(agents.length === 0 || hasMissingRoles) || undefined">
              <summary
                class="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                <ChevronRight class="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                Инструкция
              </summary>
              <Card class="mt-2 bg-muted/30 border-dashed">
                <CardContent class="py-3 px-4 text-sm text-muted-foreground leading-relaxed space-y-2.5">
                  <p>Управление промптами агентов，hover Подробнее。</p>
                  <div class="rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5 space-y-1.5">
                    <p><strong class="text-foreground">OpenClaw </strong></p>
                    <p>1.  🦞 <strong class="text-foreground">Копировать</strong>，Содержимое</p>
                    <p>2.  Agent，： AGENTS.md → Обновить SOUL.md →  →  Skill</p>
                    <p>3. Подсказка Agent，「<strong class="text-foreground">Agent </strong>」 + Skill </p>
                  </div>
                  <p><strong class="text-foreground">Платформа</strong> — 「Копировать」，Настроить。</p>
                </CardContent>
              </Card>
            </details>

            <!-- Загрузка -->
            <div v-if="loading" class="flex justify-center py-16">
              <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
            </div>

            <!-- Статус -->
            <Card v-else-if="agents.length === 0" class="border-dashed">
              <CardContent class="flex flex-col items-center justify-center py-16 text-center">
                <FileText class="h-14 w-14 text-muted-foreground/40 mb-4" />
                <p class="text-lg font-semibold text-muted-foreground"> Agent Подсказка</p>
                <p class="text-sm text-muted-foreground mt-1.5 max-w-sm">
                  Создать промпт，Копировать Agent 
                </p>
                <Button class="mt-5" @click="startCreate()">
                  <Plus class="mr-1.5 h-4 w-4" />
                  Создать</Button>
              </CardContent>
            </Card>

            <!-- Agent （Роль） -->
            <div v-else class="space-y-8">
              <div v-for="(items, role) in groupedAgents" :key="role" class="space-y-4">
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <span class="inline-block w-2 h-2 rounded-full" :class="{
                    'bg-violet-500': role === 'planner',
                    'bg-sky-500': role === 'executor',
                    'bg-amber-500': role === 'reviewer',
                    'bg-teal-500': role === 'patrol',
                    'bg-muted-foreground': !['planner','executor','reviewer','patrol'].includes(String(role)),
                  }" />
                  {{ roleLabel(String(role)) }}
                  <span class="text-xs font-normal">({{ items.length }})</span>
                </h3>

                <!--  -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div v-for="item in items" :key="item.slug" class="flip-card" style="perspective: 1200px;">
                    <div class="flip-card-inner relative w-full" style="transform-style: preserve-3d;"
                      :style="{ minHeight: '200px' }">

                      <!--  -->
                      <div class="flip-card-front absolute inset-0 rounded-xl border bg-card overflow-hidden flex flex-col"
                        style="backface-visibility: hidden;">
                        <!-- шт. -->
                        <div class="h-1.5" :class="{
                          'bg-gradient-to-r from-violet-400 to-indigo-500': item.role === 'planner',
                          'bg-gradient-to-r from-sky-400 to-blue-500': item.role === 'executor',
                          'bg-gradient-to-r from-amber-400 to-orange-500': item.role === 'reviewer',
                          'bg-gradient-to-r from-teal-400 to-emerald-500': item.role === 'patrol',
                          'bg-gradient-to-r from-gray-400 to-gray-500': !['planner','executor','reviewer','patrol'].includes(item.role),
                        }" />
                        <div class="p-5 flex flex-col justify-between flex-1">
                          <div>
                            <div class="flex items-start justify-between">
                              <!--  -->
                              <div class="h-11 w-11 rounded-xl flex items-center justify-center shadow-sm" :class="{
                                'bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-violet-950 dark:to-indigo-900': item.role === 'planner',
                                'bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-950 dark:to-blue-900': item.role === 'executor',
                                'bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900': item.role === 'reviewer',
                                'bg-gradient-to-br from-teal-50 to-emerald-100 dark:from-teal-950 dark:to-emerald-900': item.role === 'patrol',
                                'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800': !['planner','executor','reviewer','patrol'].includes(item.role),
                              }">
                                <Compass v-if="item.role === 'planner'" class="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                <Zap v-else-if="item.role === 'executor'" class="h-5 w-5 text-sky-600 dark:text-sky-400" />
                                <SearchCheck v-else-if="item.role === 'reviewer'" class="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                <ShieldCheck v-else-if="item.role === 'patrol'" class="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                <Bot v-else class="h-5 w-5 text-gray-600 dark:text-gray-400" />
                              </div>
                              <!-- СтатусТег -->
                              <div class="flex gap-1">
                                <span v-if="item.example"
                                  class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-medium">
                                  Пример
                                </span>
                                <span v-if="item.status === 'unconfigured'"
                                  class="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 font-medium">
                                  Не настроено
                                </span>
                              </div>
                            </div>
                            <h4 class="text-lg font-bold mt-3 truncate">{{ item.name || item.slug }}</h4>
                            <p class="text-xs text-muted-foreground mt-1 truncate">{{ item.description || item.filename }}</p>
                          </div>
                          <div class="flex items-center justify-between mt-3">
                            <span class="text-xs px-2.5 py-1 rounded-full font-medium" :class="{
                              'bg-violet-500/10 text-violet-600 dark:text-violet-400': item.role === 'planner',
                              'bg-sky-500/10 text-sky-600 dark:text-sky-400': item.role === 'executor',
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400': item.role === 'reviewer',
                              'bg-teal-500/10 text-teal-600 dark:text-teal-400': item.role === 'patrol',
                            }">{{ roleLabel(item.role) }}</span>
                            <span class="text-[10px] text-muted-foreground/40 italic">hover →</span>
                          </div>
                        </div>
                      </div>

                      <!--  -->
                      <div class="flip-card-back absolute inset-0 rounded-xl border bg-card overflow-hidden flex flex-col"
                        style="backface-visibility: hidden; transform: rotateY(180deg);">
                        <!-- шт. -->
                        <div class="h-1.5" :class="{
                          'bg-gradient-to-r from-violet-400 to-indigo-500': item.role === 'planner',
                          'bg-gradient-to-r from-sky-400 to-blue-500': item.role === 'executor',
                          'bg-gradient-to-r from-amber-400 to-orange-500': item.role === 'reviewer',
                          'bg-gradient-to-r from-teal-400 to-emerald-500': item.role === 'patrol',
                          'bg-gradient-to-r from-gray-400 to-gray-500': !['planner','executor','reviewer','patrol'].includes(item.role),
                        }" />
                        <div class="p-5 flex flex-col justify-between flex-1">
                          <div class="space-y-2 flex-1 overflow-hidden">
                            <div class="flex items-center gap-2">
                              <h4 class="text-sm font-bold truncate">{{ item.name || item.slug }}</h4>
                              <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="{
                                'bg-violet-500/10 text-violet-600': item.role === 'planner',
                                'bg-sky-500/10 text-sky-600': item.role === 'executor',
                                'bg-amber-500/10 text-amber-600': item.role === 'reviewer',
                                'bg-teal-500/10 text-teal-600': item.role === 'patrol',
                              }">{{ roleLabel(item.role) }}</span>
                            </div>
                            <p class="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                              {{ item.description || 'НетОписание' }}
                            </p>
                            <p class="text-[10px] text-muted-foreground/50 font-mono truncate pt-1">{{ item.filename }}</p>
                          </div>
                          <div class="flex items-center gap-1.5 pt-3 border-t border-border/40 mt-2">
                            <Button size="sm" class="flex-1 h-7 text-xs bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-sm"
                              @click.stop="showCompose(item.slug)">
                              <span class="mr-1">🦞</span> Копировать
                            </Button>
                            <Button variant="outline" size="icon" class="h-7 w-7" title="Просмотр"
                              @click.stop="openAgentView(item.slug)">
                              <Eye class="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="icon" class="h-7 w-7" title="Редактировать"
                              @click.stop="startEdit(item.slug)">
                              <Pencil class="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" class="h-7 w-7" title="Удалить"
                              :disabled="deleting === item.slug"
                              @click.stop="handleDelete(item.slug, $event)">
                              <Loader2 v-if="deleting === item.slug" class="h-3 w-3 animate-spin" />
                              <Trash2 v-else class="h-3 w-3 text-destructive/70" />
                            </Button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>

          </TabsContent>

          <!-- Tab: Правила -->
          <TabsContent value="rules" class="mt-4 space-y-4">
            <!-- Загрузка -->
            <div v-if="rulesLoading" class="flex justify-center py-12">
              <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
            </div>

            <template v-else>
              <!-- Статус -->
              <Card v-if="rules.length === 0" class="border-dashed">
                <CardContent class="flex flex-col items-center justify-center py-12 text-center">
                  <FileText class="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p class="text-lg font-medium text-muted-foreground">НетПравила</p>
                  <p class="text-sm text-muted-foreground mt-1">
                    Agent  API Правила，
                  </p>
                  <Button class="mt-4" variant="outline" @click="openRuleEditor()">
                    <Plus class="mr-1.5 h-4 w-4" />
                    СоздатьПравила
                  </Button>
                </CardContent>
              </Card>

              <!-- Правила（шт.） -->
              <template v-if="rules.length > 0">
                <Card v-for="rule in rules" :key="rule.id"
                  class="transition-all duration-200 hover:shadow-sm">
                  <CardContent class="p-4">
                    <div class="flex items-start gap-3">
                      <!-- Содержимое -->
                      <div class="flex-1 min-w-0 prose prose-sm dark:prose-invert max-w-none"
                        v-html="marked(rule.content)" />
                      <!-- （） -->
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" class="h-7 w-7" title="Редактировать"
                          @click="openRuleEditor(rule)">
                          <Pencil class="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" class="h-7 w-7" title="Удалить"
                          :disabled="ruleDeleting === rule.id" @click="confirmRuleDelete(rule.id)">
                          <Loader2 v-if="ruleDeleting === rule.id" class="h-3.5 w-3.5 animate-spin" />
                          <Trash2 v-else class="h-3.5 w-3.5 text-destructive/70" />
                        </Button>
                      </div>
                    </div>
                    <p v-if="rule.updated_at" class="text-xs text-muted-foreground mt-2 opacity-50">
                      Обновитьобновлено: {{ rule.updated_at }}
                    </p>
                  </CardContent>
                </Card>
              </template>
            </template>
          </TabsContent>

          <!-- Tab: РольШаблон -->
          <TabsContent value="templates" class="mt-5 space-y-5">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold">РольШаблон</h2>
                <p class="text-sm text-muted-foreground mt-0.5">
                  Роль，СоздатьПодсказка
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div v-for="tmpl in templates" :key="tmpl.role"
                class="group cursor-pointer rounded-xl border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                @click="openTemplate(tmpl.role)">
                <!-- шт. -->
                <div class="h-1.5" :class="{
                  'bg-gradient-to-r from-violet-400 to-indigo-500': tmpl.role === 'planner',
                  'bg-gradient-to-r from-sky-400 to-blue-500': tmpl.role === 'executor',
                  'bg-gradient-to-r from-amber-400 to-orange-500': tmpl.role === 'reviewer',
                  'bg-gradient-to-r from-teal-400 to-emerald-500': tmpl.role === 'patrol',
                  'bg-gradient-to-r from-gray-400 to-gray-500': !['planner','executor','reviewer','patrol'].includes(tmpl.role),
                }" />
                <div class="p-5 flex items-start gap-4">
                  <!--  -->
                  <div class="h-12 w-12 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0" :class="{
                    'bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-violet-950 dark:to-indigo-900': tmpl.role === 'planner',
                    'bg-gradient-to-br from-sky-50 to-blue-100 dark:from-sky-950 dark:to-blue-900': tmpl.role === 'executor',
                    'bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950 dark:to-orange-900': tmpl.role === 'reviewer',
                    'bg-gradient-to-br from-teal-50 to-emerald-100 dark:from-teal-950 dark:to-emerald-900': tmpl.role === 'patrol',
                    'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800': !['planner','executor','reviewer','patrol'].includes(tmpl.role),
                  }">
                    <Compass v-if="tmpl.role === 'planner'" class="h-6 w-6 text-violet-600 dark:text-violet-400" />
                    <Zap v-else-if="tmpl.role === 'executor'" class="h-6 w-6 text-sky-600 dark:text-sky-400" />
                    <SearchCheck v-else-if="tmpl.role === 'reviewer'" class="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    <ShieldCheck v-else-if="tmpl.role === 'patrol'" class="h-6 w-6 text-teal-600 dark:text-teal-400" />
                    <Bot v-else class="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <!--  -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="text-base font-bold">{{ roleLabel(tmpl.role) || tmpl.role }}</p>
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="{
                        'bg-violet-500/10 text-violet-600': tmpl.role === 'planner',
                        'bg-sky-500/10 text-sky-600': tmpl.role === 'executor',
                        'bg-amber-500/10 text-amber-600': tmpl.role === 'reviewer',
                        'bg-teal-500/10 text-teal-600': tmpl.role === 'patrol',
                      }">{{ tmpl.filename }}</span>
                    </div>
                    <p class="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {{ templateDescriptions[tmpl.role] || 'РольШаблон' }}
                    </p>
                  </div>
                  <!--  -->
                  <ChevronRight class="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors flex-shrink-0 mt-1" />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

      </div>

      <!-- ============================================================ -->
      <!-- ШаблонПросмотр/Редактировать -->
      <!-- ============================================================ -->
      <div v-else-if="mode === 'template'" key="template" class="space-y-4 max-w-5xl mx-auto">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" @click="goBack">
            <ChevronLeft class="h-5 w-5" />
          </Button>
          <div class="flex-1">
            <h1 class="text-2xl font-bold">{{ roleLabel(templateForm.role) }}</h1>
            <p class="text-sm text-muted-foreground">
              {{ templateDescriptions[templateForm.role] || templateForm.filename }}
            </p>
          </div>
          <Button v-if="!templateEditing" variant="outline" @click="templateEditing = true">
            <Pencil class="mr-1.5 h-4 w-4" />
            Редактировать
          </Button>
          <div v-else class="flex gap-2">
            <Button variant="outline" @click="templateEditing = false">Отмена</Button>
            <Button @click="saveTemplate" :disabled="saving">
              <Loader2 v-if="saving" class="mr-1.5 h-4 w-4 animate-spin" />
              {{ saving ? 'Сохранить...' : 'Сохранить' }}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent class="p-0">
            <textarea v-if="templateEditing" v-model="templateForm.content"
              class="w-full min-h-[500px] p-6 text-sm font-mono bg-background border-0 rounded-lg resize-y focus:outline-none focus:ring-0" />
            <div v-else class="p-6 prose prose-sm dark:prose-invert max-w-none" v-html="renderedTemplateContent" />
          </CardContent>
        </Card>
      </div>

      <!-- ============================================================ -->
      <!-- Agent ПодсказкаПросмотр -->
      <!-- ============================================================ -->
      <div v-else-if="mode === 'agent-view'" key="agent-view" class="space-y-4 max-w-5xl mx-auto">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" @click="goBack">
            <ChevronLeft class="h-5 w-5" />
          </Button>
          <div class="flex-1">
            <h1 class="text-2xl font-bold">{{ agentViewData.name || agentViewData.slug }}</h1>
            <p class="text-sm text-muted-foreground">
              {{ roleLabel(agentViewData.role) }} · {{ agentViewData.description }}
            </p>
          </div>
          <Button variant="outline" @click="showCompose(agentViewData.slug)">
            <span class="mr-1.5">🦞</span>
            OpenClaw Копировать
          </Button>
          <Button variant="outline" @click="startEdit(agentViewData.slug)">
            <Pencil class="mr-1.5 h-4 w-4" />
            Редактировать
          </Button>
        </div>

        <Card>
          <CardContent class="p-0">
            <div class="p-6 prose prose-sm dark:prose-invert max-w-none max-h-[70vh] overflow-y-auto"
              v-html="renderedAgentContent" />
          </CardContent>
        </Card>
      </div>

      <!-- ============================================================ -->
      <!-- Создать / Редактировать  ——  -->
      <!-- ============================================================ -->
      <div v-else-if="mode === 'create' || mode === 'edit'" :key="mode">
        <!--  -->
        <div class="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" @click="goBack">
            <ChevronLeft class="h-5 w-5" />
          </Button>
          <h1 class="text-2xl font-bold flex-1">{{ mode === 'create' ? 'СоздатьПодсказка' : 'Редактировать промпт' }}</h1>
          <Button variant="outline" @click="goBack">Отмена</Button>
          <Button @click="mode === 'create' ? handleCreate() : handleUpdate()" :disabled="saving">
            <Loader2 v-if="saving" class="mr-1.5 h-4 w-4 animate-spin" />
            {{ saving ? 'Сохранить...' : 'Сохранить' }}
          </Button>
        </div>

        <!-- Роль -->
        <div class="space-y-2 mb-4">
          <Label class="text-xs">РольШаблон *</Label>
          <div class="grid grid-cols-4 gap-2">
            <button v-for="opt in roleOptions" :key="opt.value" type="button"
              class="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all duration-200"
              :class="form.role === opt.value ? {
                'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-600 shadow-sm': opt.value === 'planner',
                'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-600 shadow-sm': opt.value === 'executor',
                'border-purple-400 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-600 shadow-sm': opt.value === 'reviewer',
                'border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-600 shadow-sm': opt.value === 'patrol',
              } : 'border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground'"
              @click="handleRoleChange({ target: { value: opt.value } } as any)">
              <div class="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0" :class="form.role === opt.value ? {
                'bg-blue-100 dark:bg-blue-900': opt.value === 'planner',
                'bg-amber-100 dark:bg-amber-900': opt.value === 'executor',
                'bg-purple-100 dark:bg-purple-900': opt.value === 'reviewer',
                'bg-emerald-100 dark:bg-emerald-900': opt.value === 'patrol',
              } : 'bg-muted/50'">
                <Compass v-if="opt.value === 'planner'" class="h-3.5 w-3.5" />
                <Zap v-else-if="opt.value === 'executor'" class="h-3.5 w-3.5" />
                <SearchCheck v-else-if="opt.value === 'reviewer'" class="h-3.5 w-3.5" />
                <ShieldCheck v-else-if="opt.value === 'patrol'" class="h-3.5 w-3.5" />
                <Bot v-else class="h-3.5 w-3.5" />
              </div>
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!--  -->
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div class="space-y-1">
            <Label for="p-name" class="text-xs">ПоказатьНазвание *</Label>
            <Input id="p-name" v-model="form.name" placeholder="Пример：AI" class="h-9" />
          </div>
          <div class="space-y-1">
            <Label for="p-slug" class="text-xs">（） *</Label>
            <Input id="p-slug" v-model="form.slug" placeholder="Пример：jianggua" :disabled="mode === 'edit'" class="h-9" />
          </div>
          <div class="space-y-1">
            <Label for="p-desc" class="text-xs"></Label>
            <Input id="p-desc" v-model="form.description" placeholder="Пример：" class="h-9" />
          </div>
        </div>

        <!-- Загрузка -->
        <div v-if="isRoleLoading" class="flex justify-center py-12">
          <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <!--  -->
        <div v-else class="grid grid-cols-2 gap-4" style="height: calc(100vh - 220px);">
          <!-- ：Редактировать -->
          <div class="flex flex-col gap-3 min-h-0">
            <!-- ПодсказкаСодержимое -->
            <div class="flex flex-col space-y-1" style="flex: 2;">
              <Label class="text-xs text-muted-foreground flex-shrink-0">
                📝 ПодсказкаСодержимое
                <span v-if="form.role" class="text-primary ml-1">
                  (「{{ roleLabel(form.role) }}」Шаблон)
                </span>
              </Label>
              <textarea v-model="promptContent"
                class="flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none min-h-0"
                placeholder="РольШаблонСодержимое，Основное..." />
            </div>

            <!-- Платформа -->
            <div class="flex flex-col space-y-1" style="flex: 1;">
              <Label class="text-xs text-muted-foreground flex-shrink-0">🔧 Платформа（，）</Label>
              <textarea v-model="onboardingContent"
                class="flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none min-h-0"
                placeholder="Роль..." />
            </div>
          </div>

          <!-- ：Предпросмотр -->
          <div class="flex flex-col min-h-0">
            <div class="flex items-center justify-between mb-1 flex-shrink-0">
              <Label class="text-xs text-muted-foreground">👁 ПодсказкаПредпросмотр</Label>
              <Button size="sm" variant="ghost" class="h-7 text-xs" @click="copyEditorContent">
                <Check v-if="editorCopied" class="mr-1 h-3 w-3" />
                <Copy v-else class="mr-1 h-3 w-3" />
                {{ editorCopied ? 'Копировать' : 'Копировать' }}
              </Button>
            </div>
            <Card class="flex-1 overflow-hidden min-h-0">
              <CardContent class="p-0 h-full">
                <div v-if="fullEditorContent"
                  class="p-4 prose prose-sm dark:prose-invert max-w-none h-full overflow-y-auto"
                  v-html="renderedEditorPreview" />
                <div v-else class="flex items-center justify-center h-full text-sm text-muted-foreground">
                  РольПоказатьПредпросмотр
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <!-- РольПодтвердить -->
        <Transition name="view">
          <div v-if="showRoleConfirm"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card class="w-full max-w-sm shadow-xl">
              <CardContent class="p-6 space-y-4">
                <div>
                  <h3 class="text-lg font-semibold">РольШаблон</h3>
                  <p class="text-sm text-muted-foreground mt-2">
                    「{{ roleLabel(roleConfirmTarget) }}」ШаблонРедактироватьСодержимое，Нет。
                  </p>
                </div>
                <div class="flex justify-end gap-2">
                  <Button variant="outline" @click="cancelRoleSwitch">Отмена</Button>
                  <Button variant="destructive" @click="confirmRoleSwitch">ОК</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </Transition>
      </div>

      <!-- ============================================================ -->
      <!-- Предпросмотр / Копировать（ Markdown ） -->
      <!-- ============================================================ -->
      <div v-else-if="mode === 'preview'" key="preview" class="space-y-5 max-w-5xl mx-auto">

        <!--  -->
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" @click="goBack">
            <ChevronLeft class="h-5 w-5" />
          </Button>
          <div class="flex-1">
            <h1 class="text-2xl font-bold">ПодсказкаПредпросмотр</h1>
            <p class="text-sm text-muted-foreground mt-0.5">
              {{ editSlug }} · РольШаблон + Содержимое + Платформа
            </p>
          </div>
          <Button variant="outline" size="sm" @click="startEdit(editSlug)">
            <Pencil class="mr-1.5 h-3.5 w-3.5" />
            Редактировать
          </Button>
        </div>

        <!-- ：Копировать +  -->
        <div class="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
          <!-- ：Копировать -->
          <TooltipProvider :delay-duration="200">
            <div class="flex items-center gap-2">
              <!-- 🦞 OpenClaw Копировать —  -->
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button @click="copyWithPrefix"
                    :class="lobsterCopied
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500'
                      : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-md shadow-orange-500/20'"
                    class="transition-all duration-300">
                    <Check v-if="lobsterCopied" class="mr-1.5 h-4 w-4" />
                    <span v-else class="mr-1.5 text-base leading-none">🦞</span>
                    {{ lobsterCopied ? 'Копировать ✓' : 'OpenClaw Копировать' }}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>， Agent ：</p>
                  <p>ОбновитьПодсказка →  →  Skill</p>
                </TooltipContent>
              </Tooltip>

              <div class="w-px h-6 bg-border" />

              <!-- Копировать -->
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="outline" size="sm" @click="copyToClipboard"
                    :class="copied ? 'border-emerald-500 text-emerald-600' : ''">
                    <Check v-if="copied" class="mr-1 h-3.5 w-3.5" />
                    <Copy v-else class="mr-1 h-3.5 w-3.5" />
                    {{ copied ? 'Копировать' : 'Копировать' }}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  КопироватьПодсказкаСодержимое，
                </TooltipContent>
              </Tooltip>

              <!-- Agent  -->
              <Tooltip v-if="onboardingSection">
                <TooltipTrigger as-child>
                  <Button variant="outline" size="sm" @click="copyOnboarding"
                    :class="onboardingCopied ? 'border-emerald-500 text-emerald-600' : ''">
                    <Check v-if="onboardingCopied" class="mr-1 h-3.5 w-3.5" />
                    <Download v-else class="mr-1 h-3.5 w-3.5" />
                    {{ onboardingCopied ? 'Копировать' : 'Agent ' }}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Копировать + Skill ，Подсказка Agent 
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          <!-- ： -->
          <div class="flex items-center border rounded-lg overflow-hidden">
            <button class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
              :class="previewMode === 'rendered' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'"
              @click="previewMode = 'rendered'">
              <Eye class="h-3.5 w-3.5" />
              Предпросмотр
            </button>
            <button class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
              :class="previewMode === 'source' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'"
              @click="previewMode = 'source'">
              <Code class="h-3.5 w-3.5" />
              
            </button>
          </div>
        </div>

        <!-- Содержимое -->
        <Card>
          <CardContent class="p-0">
            <div v-if="previewMode === 'rendered'"
              class="p-6 prose prose-sm dark:prose-invert max-w-none max-h-[70vh] overflow-y-auto"
              v-html="renderedMarkdown" />
            <pre v-else
              class="p-6 text-sm whitespace-pre-wrap break-words font-mono max-h-[70vh] overflow-y-auto bg-muted/30 rounded-lg">{{ composedPrompt }}</pre>
          </CardContent>
        </Card>

        <!--  -->
        <div class="grid grid-cols-3 gap-3">
          <div class="flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2.5">
            <span class="text-base leading-none mt-0.5">🦞</span>
            <div>
              <p class="text-xs font-medium text-foreground">Копировать</p>
              <p class="text-xs text-muted-foreground mt-0.5">， Agent Настроить</p>
            </div>
          </div>
          <div class="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
            <Copy class="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p class="text-xs font-medium text-foreground">Копировать</p>
              <p class="text-xs text-muted-foreground mt-0.5">Подсказка，НастроитьПлатформа</p>
            </div>
          </div>
          <div class="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
            <Download class="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p class="text-xs font-medium text-foreground">Agent </p>
              <p class="text-xs text-muted-foreground mt-0.5"> Agent  +  Skill </p>
            </div>
          </div>
        </div>
      </div>

    </Transition>

    <!-- УдалитьПодтвердить -->
    <Transition name="view">
      <div v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <Card class="w-full max-w-sm shadow-xl">
          <CardContent class="p-6 space-y-4">
            <div>
              <h3 class="text-lg font-semibold">Подтвердить удаление</h3>
              <p class="text-sm text-muted-foreground mt-2">
                ОКУдалитьПодсказка「{{ deleteTarget }}」？。
              </p>
            </div>
            <div class="flex justify-end gap-2">
              <Button variant="outline" @click="showDeleteConfirm = false">Отмена</Button>
              <Button variant="destructive" @click="confirmDelete">ОКУдалить</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Transition>

    <!-- ПравилаРедактировать（Создать / РедактироватьВсего） -->
    <Teleport to="body">
      <Transition name="view">
        <div v-if="showRuleEditor"
          class="fixed inset-0 z-[100] flex items-center justify-center">
          <!--  -->
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeRuleEditor()" />
          <!--  -->
          <div class="relative z-10 w-full max-w-4xl mx-6 bg-background rounded-xl shadow-2xl border flex flex-col overflow-hidden"
            style="height: 75vh; max-height: 75vh;">
            <!--  -->
            <div class="flex items-center justify-between px-5 py-3 border-b flex-shrink-0">
              <div>
                <h3 class="text-base font-semibold">
                  {{ ruleEditorId ? 'РедактироватьПравила' : 'СоздатьПравила' }}
                </h3>
                <p class="text-xs text-muted-foreground mt-0.5">Поддерживается Markdown</p>
              </div>
              <!--  -->
              <div class="flex items-center border rounded-lg overflow-hidden">
                <button class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
                  :class="ruleEditorPreviewMode === 'edit' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'"
                  @click="ruleEditorPreviewMode = 'edit'">
                  <Code class="h-3.5 w-3.5" />
                  Редактировать
                </button>
                <button class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
                  :class="ruleEditorPreviewMode === 'split' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'"
                  @click="ruleEditorPreviewMode = 'split'">
                  
                </button>
                <button class="px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors"
                  :class="ruleEditorPreviewMode === 'preview' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'"
                  @click="ruleEditorPreviewMode = 'preview'">
                  <Eye class="h-3.5 w-3.5" />
                  Предпросмотр
                </button>
              </div>
            </div>

            <!-- Редактировать -->
            <div class="flex-1 flex min-h-0">
              <!-- Редактировать -->
              <div v-if="ruleEditorPreviewMode !== 'preview'"
                :class="ruleEditorPreviewMode === 'split' ? 'w-1/2 border-r' : 'w-full'"
                class="h-full">
                <textarea v-model="ruleEditorContent"
                  class="w-full h-full px-4 py-3 text-sm font-mono bg-background border-0 resize-none focus:outline-none focus:ring-0"
                  placeholder="ПравилаСодержимое，Поддерживается Markdown..." />
              </div>
              <!-- Предпросмотр -->
              <div v-if="ruleEditorPreviewMode !== 'edit'"
                :class="ruleEditorPreviewMode === 'split' ? 'w-1/2' : 'w-full'"
                class="h-full overflow-y-auto">
                <div v-if="renderedRulePreview"
                  class="p-4 prose prose-sm dark:prose-invert max-w-none"
                  v-html="renderedRulePreview" />
                <div v-else class="flex items-center justify-center h-full text-sm text-muted-foreground">
                  СодержимоеПоказатьПредпросмотр
                </div>
              </div>
            </div>

            <!--  -->
            <div class="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30 flex-shrink-0">
              <Button variant="outline" @click="closeRuleEditor()">Отмена</Button>
              <Button :disabled="ruleSaving || !ruleEditorContent.trim()" @click="saveRuleEditor">
                <Loader2 v-if="ruleSaving" class="mr-1.5 h-4 w-4 animate-spin" />
                {{ ruleSaving ? 'Сохранить...' : 'Сохранить' }}
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ПравилаУдалитьПодтвердить -->
    <Transition name="toast">
      <div v-if="showRuleDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showRuleDeleteConfirm = false" />
        <Card class="relative z-10 w-full max-w-sm shadow-2xl">
          <CardContent class="p-6 text-center space-y-4">
            <div
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400">
              <Trash2 class="h-5 w-5" />
            </div>
            <div>
              <p class="font-semibold text-foreground">ОКУдалитьПравила？</p>
              <p class="text-sm text-muted-foreground mt-1">Удалить</p>
            </div>
            <div class="flex gap-3 justify-center">
              <Button variant="outline" @click="showRuleDeleteConfirm = false">Отмена</Button>
              <Button variant="destructive" @click="doRuleDelete">Подтвердить удаление</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.view-enter-active {
  transition: all 0.25s ease-out;
}

.view-leave-active {
  transition: all 0.15s ease-in;
}

.view-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.view-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.2s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/*  */
.flip-card:hover .flip-card-inner {
  transform: rotateY(180deg);
}

.flip-card-inner {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.flip-card-front,
.flip-card-back {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.3s ease;
}

.flip-card:hover .flip-card-front,
.flip-card:hover .flip-card-back {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.04);
}

.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
