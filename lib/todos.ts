// Client-side todo storage using localStorage + platform-native reminders

import {
  scheduleReminder,
  scheduleRepeatReminders,
  cancelReminder,
  cancelReminders,
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

  notificationIds?: number[]
}

const STORAGE_KEY = "remindme-todos"

/** 兼容旧数据格式：将旧字段迁移到新字段 */
function migrateTodo(raw: any): Todo {
  const t: Todo = {
    id: raw.id ?? 0,
    title: raw.title ?? "",
    completed: raw.completed ?? false,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    notificationIds: raw.notificationIds ?? [],
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
    t.repeatWeekdays = raw.repeatWeekdays ?? []
    t.repeatTime = raw.repeatTime || undefined
  } else if (raw.repeat && raw.repeat !== "none") {
    // 旧 repeat + repeatDays → 新字段
    t.repeatEnabled = true
    t.repeatWeekdays = raw.repeatDays ?? raw.repeatWeekdays ?? []
    t.repeatTime = raw.dueTime || raw.repeatTime || undefined
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

export async function toggleTodo(id: number, completed: boolean): Promise<void> {
  const todos = readTodos()
  const index = todos.findIndex((t) => t.id === id)
  if (index === -1) return

  // 1. 先更新本地状态
  todos[index].completed = completed
  writeTodos(todos)

  // 2. 标记完成 → best-effort 取消通知（失败仅打日志，不回滚）
  if (completed) {
    const ids = Array.isArray(todos[index].notificationIds) ? todos[index].notificationIds : []
    try {
      if (ids.length > 0) {
        await cancelReminders(ids)
      } else {
        await cancelReminder(id)
      }
    } catch (e) {
      console.error("cancel reminders after completing todo failed", { todoId: id, notificationIds: ids, error: e })
    }
  }
}

export function deleteTodo(id: number): void {
  const todos = readTodos()
  const todo = todos.find((t) => t.id === id)
  writeTodos(todos.filter((t) => t.id !== id))

  // 删除时取消通知（fire-and-forget，best-effort）
  if (todo) {
    const ids = Array.isArray(todo.notificationIds) ? todo.notificationIds : []
    if (ids.length > 0) {
      cancelReminders(ids).catch((e) =>
        console.error("cancel reminders after delete failed", { todoId: id, notificationIds: ids, error: e }),
      )
    } else {
      cancelReminder(id).catch((e) =>
        console.error("cancel reminder after delete failed", { todoId: id, error: e }),
      )
    }
  }
}
