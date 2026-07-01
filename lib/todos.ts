// Client-side todo storage using localStorage + platform-native reminders

import {
  scheduleReminder,
  scheduleRepeatReminders,
} from "@/lib/reminderScheduler"

export type RepeatMode = "none" | "workdays" | "weekends" | "mwf" | "tts" | "custom"

export interface Todo {
  id: number
  title: string
  completed: boolean
  createdAt: string

  // 一次性提醒
  reminderEnabled?: boolean
  dueDate?: string
  dueTime?: string

  // 重复提醒（完全独立于一次性提醒）
  repeatEnabled?: boolean
  repeatWeekdays?: number[]  // Capacitor: 1=Sun, 2=Mon, …, 7=Sat
  repeatTime?: string        // "09:00:00"

  // 用户跳过/删除的重复 occurrence 日期
  repeatSkipDates?: string[] // ["2026-07-01", ...]

  notificationIds?: number[]
}

const STORAGE_KEY = "remindme-todos"

/** 兼容旧数据格式：强制所有字段类型正确，防御旧数据不规范导致渲染崩溃 */
function migrateTodo(raw: any): Todo {
  const t: Todo = {
    id: typeof raw.id === "number" ? raw.id : Number(raw.id) || 0,
    title: typeof raw.title === "string" ? raw.title : String(raw.title ?? ""),
    completed: Boolean(raw.completed),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    notificationIds: Array.isArray(raw.notificationIds) ? raw.notificationIds : [],
  }

  // 新字段直接读取
  if (typeof raw.reminderEnabled === "boolean") {
    t.reminderEnabled = raw.reminderEnabled
    t.dueDate = raw.dueDate || undefined
    t.dueTime = raw.dueTime || undefined
  } else if (raw.dueDate && raw.dueTime) {
    // 旧数据：有 dueDate + dueTime → 推断为一次性提醒
    t.reminderEnabled = true
    t.dueDate = raw.dueDate
    t.dueTime = raw.dueTime
  }

  // 重复提醒迁移
  if (typeof raw.repeatEnabled === "boolean") {
    t.repeatEnabled = raw.repeatEnabled
    t.repeatWeekdays = Array.isArray(raw.repeatWeekdays) ? raw.repeatWeekdays : []
    t.repeatTime = raw.repeatTime || undefined
    t.repeatSkipDates = Array.isArray(raw.repeatSkipDates) ? raw.repeatSkipDates : []
  } else if (raw.repeat && raw.repeat !== "none") {
    t.repeatEnabled = true
    t.repeatWeekdays = Array.isArray(raw.repeatDays) ? raw.repeatDays : Array.isArray(raw.repeatWeekdays) ? raw.repeatWeekdays : []
    t.repeatTime = raw.dueTime || raw.repeatTime || undefined
    t.repeatSkipDates = Array.isArray(raw.repeatSkipDates) ? raw.repeatSkipDates : []
  }

  return t
}

function readTodos(): Todo[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(migrateTodo)
  } catch {
    return []
  }
}

function writeTodos(todos: Todo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
}

export function getTodos(): Todo[] {
  return readTodos().sort((a, b) => {
    const da = a.dueDate ?? ""
    const db = b.dueDate ?? ""
    const dateCmp = da.localeCompare(db)
    if (dateCmp !== 0) return dateCmp
    const ta = a.dueTime ?? a.repeatTime ?? ""
    const tb = b.dueTime ?? b.repeatTime ?? ""
    return ta.localeCompare(tb)
  })
}

export async function addTodo(input: {
  title: string
  dueDate?: string
  dueTime?: string
  reminderEnabled?: boolean
  repeatEnabled?: boolean
  repeatWeekdays?: number[]
  repeatTime?: string
}): Promise<Todo> {
  const title = input.title.trim()
  if (!title) throw new Error("请输入待办名称")

  // 一次性提醒校验
  if (input.reminderEnabled) {
    if (!input.dueDate) throw new Error("请选择日期")
    if (!input.dueTime) throw new Error("请选择提醒时间")
  }

  // 重复提醒校验（独立）
  if (input.repeatEnabled) {
    if (!input.repeatTime) throw new Error("请选择重复提醒时间")
    if (!input.repeatWeekdays || input.repeatWeekdays.length === 0) {
      throw new Error("请选择重复提醒的星期")
    }
  }

  const todos = readTodos()
  const maxId = todos.reduce((max, t) => Math.max(max, t.id), 0)
  const newId = maxId + 1

  // 原子性：先调度，再写 localStorage
  // 一次性提醒和重复提醒分别独立调度
  const oneTimeIds: number[] = []
  const repeatIds: number[] = []

  if (input.reminderEnabled && input.dueDate && input.dueTime) {
    const nid = await scheduleReminder({
      id: newId,
      title,
      body: title,
      dueDate: input.dueDate,
      dueTime: input.dueTime,
    })
    if (nid != null) oneTimeIds.push(nid)
  }

  if (input.repeatEnabled && input.repeatTime && input.repeatWeekdays && input.repeatWeekdays.length > 0) {
    try {
      const rids = await scheduleRepeatReminders({
        baseId: newId,
        title,
        body: title,
        repeatTime: input.repeatTime,
        weekdays: input.repeatWeekdays,
      })
      repeatIds.push(...rids)
    } catch (e) {
      // 重复调度失败时，如果已有一次性提醒，仍然保存但记录错误
      if (oneTimeIds.length === 0) throw e
    }
  }

  const todo: Todo = {
    id: newId,
    title,
    completed: false,
    createdAt: new Date().toISOString(),
    reminderEnabled: input.reminderEnabled ?? false,
    dueDate: input.dueDate || undefined,
    dueTime: input.dueTime || undefined,
    repeatEnabled: input.repeatEnabled ?? false,
    repeatWeekdays: input.repeatWeekdays ?? [],
    repeatTime: input.repeatTime || undefined,
    notificationIds: [...oneTimeIds, ...repeatIds],
  }
  todos.push(todo)
  writeTodos(todos)

  return todo
}

export function toggleTodo(id: number, completed: boolean): void {
  const todos = readTodos()
  const index = todos.findIndex((t) => t.id === id)
  if (index === -1) return

  // P0 安全降级：只写 localStorage，不调任何通知/插件/原生代码
  todos[index].completed = completed
  writeTodos(todos)
}

export function deleteTodo(id: number): void {
  if (!Number.isFinite(id)) return
  const todos = readTodos()
  writeTodos(todos.filter((t) => t.id !== id))
}

/** 跳过某一天重复 occurrence（不删除原始 todo） */
export function skipRepeatOccurrence(todoId: number, dateKey: string): void {
  if (!Number.isFinite(todoId) || !dateKey) return
  const todos = readTodos()
  const index = todos.findIndex((t) => t.id === todoId)
  if (index === -1) return
  const todo = todos[index]
  if (!todo.repeatEnabled) return

  const skipSet = new Set(todo.repeatSkipDates ?? [])
  skipSet.add(dateKey)
  todo.repeatSkipDates = Array.from(skipSet).sort()
  writeTodos(todos)
}
