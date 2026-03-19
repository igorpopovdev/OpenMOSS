/**
 * Логика перевода ленты активности — преобразование сырых логов в читаемые описания
 */

export interface FeedLog {
  id: string
  timestamp: string | null
  method: string
  path: string
  agent_id: string | null
  agent_name: string | null
  agent_role: string | null
  request_body: string | null
  response_status: number | null
}

export interface FeedAgent {
  id: string
  name: string
  role: string
  status: string
  total_score: number
  created_at: string | null
}

export interface TranslatedActivity {
  id: string
  icon: string
  verb: string
  colorClass: string
  agentName: string
  agentRole: string
  agentId: string
  objectName: string | null
  details: Record<string, string>
  rawMethod: string
  rawPath: string
  rawBody: string | null
  responseStatus: number | null
  timestamp: string | null
  relativeTime: string
}

// ============================================================
// Правила маппинга route → человеческие описания
// ============================================================

interface RouteRule {
  pattern: RegExp
  icon: string
  verb: string
  colorClass: string
  extractFields?: string[]
}

const ROUTE_RULES: RouteRule[] = [
  { pattern: /POST \/api\/agents\/register/, icon: 'UserPlus', verb: 'зарегистрировал нового агента', colorClass: 'bg-emerald-500', extractFields: ['name', 'role'] },
  { pattern: /POST \/api\/tasks$/, icon: 'ListPlus', verb: 'создал задачу', colorClass: 'bg-blue-500', extractFields: ['name'] },
  { pattern: /POST \/api\/tasks\/.*\/modules/, icon: 'FolderPlus', verb: 'создал модуль', colorClass: 'bg-indigo-500', extractFields: ['name'] },
  { pattern: /POST \/api\/sub-tasks$/, icon: 'FilePlus', verb: 'создал подзадачу', colorClass: 'bg-violet-500', extractFields: ['name'] },
  { pattern: /POST \/api\/sub-tasks\/.*\/claim/, icon: 'Hand', verb: 'принял подзадачу', colorClass: 'bg-amber-500' },
  { pattern: /POST \/api\/sub-tasks\/.*\/start/, icon: 'Play', verb: 'начал выполнение подзадачи', colorClass: 'bg-orange-500' },
  { pattern: /POST \/api\/sub-tasks\/.*\/submit/, icon: 'PackageCheck', verb: 'отправил подзадачу', colorClass: 'bg-green-500' },
  { pattern: /PUT \/api\/sub-tasks\//, icon: 'Pencil', verb: 'изменил подзадачу', colorClass: 'bg-slate-500' },
  { pattern: /POST \/api\/review-records/, icon: 'FileSearch', verb: 'отправил рецензию', colorClass: 'bg-purple-500', extractFields: ['score', 'comment', 'result'] },
  { pattern: /POST \/api\/logs/, icon: 'MessageSquare', verb: 'записал лог активности', colorClass: 'bg-gray-500', extractFields: ['action', 'summary'] },
  { pattern: /POST \/api\/scores\/adjust/, icon: 'Trophy', verb: 'изменил баллы', colorClass: 'bg-yellow-500', extractFields: ['score_delta', 'reason'] },
  { pattern: /GET \/api\/rules/, icon: 'BookOpen', verb: 'запросил правила', colorClass: 'bg-sky-500', extractFields: ['task_id', 'sub_task_id'] },
  { pattern: /GET \/api\/tasks$/, icon: 'Eye', verb: 'просмотрел список задач', colorClass: 'bg-slate-400', extractFields: ['status', 'type'] },
  { pattern: /GET \/api\/tasks\//, icon: 'Eye', verb: 'просмотрел задачу', colorClass: 'bg-slate-400' },
  { pattern: /GET \/api\/sub-tasks\/available/, icon: 'Search', verb: 'искал доступные подзадачи', colorClass: 'bg-cyan-500', extractFields: ['status', 'priority', 'type'] },
  { pattern: /GET \/api\/sub-tasks\/mine/, icon: 'ClipboardList', verb: 'просмотрел свои подзадачи', colorClass: 'bg-slate-400', extractFields: ['status'] },
  { pattern: /GET \/api\/sub-tasks\/latest/, icon: 'FileText', verb: 'просмотрел свежие подзадачи', colorClass: 'bg-slate-400' },
  { pattern: /GET \/api\/sub-tasks/, icon: 'ClipboardList', verb: 'просмотрел подзадачи', colorClass: 'bg-slate-400', extractFields: ['status', 'assigned_agent'] },
  { pattern: /GET \/api\/scores\/me/, icon: 'Award', verb: 'проверил свои баллы', colorClass: 'bg-amber-400' },
  { pattern: /GET \/api\/scores\/leaderboard/, icon: 'Medal', verb: 'открыл рейтинг', colorClass: 'bg-yellow-500' },
  { pattern: /GET \/api\/config\/notification/, icon: 'Bell', verb: 'запросил настройки уведомлений', colorClass: 'bg-rose-500' },
  { pattern: /GET \/api\/logs\/mine/, icon: 'ScrollText', verb: 'просмотрел свои логи', colorClass: 'bg-gray-400', extractFields: ['action'] },
  { pattern: /GET \/api\/logs/, icon: 'ScrollText', verb: 'просмотрел логи', colorClass: 'bg-gray-400', extractFields: ['action', 'agent_id'] },
  { pattern: /GET \/api\/review-records/, icon: 'FileSearch', verb: 'просмотрел рецензии', colorClass: 'bg-purple-400', extractFields: ['sub_task_id'] },
]

const ROLE_LABELS: Record<string, string> = {
  planner: 'Планировщик',
  executor: 'Исполнитель',
  reviewer: 'Рецензент',
  patrol: 'Патрульный',
}

const PARAM_LABELS: Record<string, string> = {
  status: 'Статус',
  priority: 'Приоритет',
  type: 'Тип',
  task_id: 'Задача',
  sub_task_id: 'Подзадача',
  agent_id: 'Агент',
  assigned_agent: 'Исполнитель',
  action: 'Действие',
}

export function translateLog(log: FeedLog): TranslatedActivity {
  const key = `${log.method} ${log.path}`
  const rule = ROUTE_RULES.find((r) => r.pattern.test(key))

  let body: Record<string, unknown> = {}
  if (log.request_body) {
    try {
      body = JSON.parse(log.request_body)
    } catch {
      // ignore
    }
  }

  const details: Record<string, string> = {}
  let objectName: string | null = null

  if (rule?.extractFields) {
    for (const field of rule.extractFields) {
      const val = body[field]
      if (val !== undefined && val !== null && val !== '') {
        details[field] = String(val)
      }
    }
    if (details.name) {
      objectName = details.name
      delete details.name
    }
  }

  if (rule?.pattern.test('POST /api/review-records') && details.score) {
    objectName = `${details.score} баллов`
    delete details.score
  }

  if (rule?.pattern.test('POST /api/logs') && details.action) {
    objectName = details.action
    delete details.action
  }

  return {
    id: log.id,
    icon: rule?.icon ?? 'Activity',
    verb: rule?.verb ?? `обратился к ${log.path}`,
    colorClass: rule?.colorClass ?? 'bg-slate-500',
    agentName: log.agent_name ?? 'Неизвестный',
    agentRole: ROLE_LABELS[log.agent_role ?? ''] ?? log.agent_role ?? '',
    agentId: log.agent_id ?? '',
    objectName,
    details,
    rawMethod: log.method,
    rawPath: log.path,
    rawBody: log.request_body,
    responseStatus: log.response_status,
    timestamp: log.timestamp,
    relativeTime: formatRelativeTime(log.timestamp),
  }
}

export function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return ''
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 10) return 'только что'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(timestamp).toLocaleDateString('ru-RU')
}

export interface SubTaskBrief {
  id: string
  name: string
  module_name: string | null
}

export interface RecentAction {
  method: string
  path: string
  request_body: string | null
  response_status: number | null
  timestamp: string | null
}

export interface AgentSummary {
  id: string
  name: string
  role: string
  total_score: number
  today_request_count: number
  today_submit_count: number
  today_review_count: number
  current_sub_task: SubTaskBrief | null
  recent_actions: RecentAction[]
}

export type ActionCategory = 'complete' | 'execute' | 'create' | 'query' | 'score_up' | 'score_down'

export function getActionCategory(action: RecentAction): ActionCategory {
  const key = `${action.method} ${action.path}`

  if (/POST \/api\/scores\/adjust/.test(key) && action.request_body) {
    try {
      const body = JSON.parse(action.request_body)
      return (body.score_delta ?? 0) >= 0 ? 'score_up' : 'score_down'
    } catch { /* fall through */ }
  }

  if (/POST .*\/submit/.test(key) || /POST .*\/review-records/.test(key)) return 'complete'
  if (/POST .*\/claim/.test(key) || /POST .*\/start/.test(key) || /PUT \/api\/sub-tasks/.test(key)) return 'execute'
  if (action.method === 'POST') return 'create'

  return 'query'
}

export function getActionVerb(action: RecentAction): string {
  const key = `${action.method} ${action.path}`
  const rule = ROUTE_RULES.find((r) => r.pattern.test(key))
  return rule?.verb ?? `${action.method} ${action.path.split('/api')[1] ?? action.path}`
}
