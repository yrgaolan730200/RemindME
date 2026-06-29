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
  dueDate: string
  dueTime: string
  completed: boolean
  createdAt: string
  repeat?: RepeatMode
  repeatDays?: number[] // Capacitor weekday: 1=Sun, 2=Mon, …, 7=Sat
  notificationIds?: number[]
}

const STORAGE_KEY = "remindme-todos"

function readTodos(): Todo[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeTodos(todos: Todo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
}

export function getTodos(): Todo[] {
  return readTodos().sort((a, b) => {
    const dateCmp = a.dueDate.localeCompare(b.dueDate)
    if (dateCmp !== 0) return dateCmp
    return a.dueTime.localeCompare(b.dueTime)
  })
}

export async function addTodo(input: {
  title: string
  dueDate: string
  dueTime?: string
  repeat?: RepeatMode
  repeatDays?: number[]
}): Promise<Todo> {
  const title = input.title.trim()
  if (!title) throw new Error("请输入待办名称")
  if (!input.dueDate) throw new Error("请选择日期")

  const todos = readTodos()
  const maxId = todos.reduce((max, t) => Math.max(max, t.id), 0)
  const newId = maxId + 1

  // 必须先调度通知，成功后才写入本地存储（原子性保障）
  let notificationIds: number[] = []
  if (input.dueTime) {
    const hasRepeat =
      input.repeat && input.repeat !== "none" &&
      input.repeatDays && input.repeatDays.length > 0

    if (hasRepeat) {
      notificationIds = await scheduleRepeatReminders({
        baseId: newId,
        title,
        body: title,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
        weekdays: input.repeatDays!,
      })
    } else {
      const nid = await scheduleReminder({
        id: newId,
        title,
        body: title,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
      })
      if (nid != null) notificationIds = [nid]
    }
  }

  // 调度成功后才写 localStorage
  const todo: Todo = {
    id: newId,
    title,
    dueDate: input.dueDate,
    dueTime: input.dueTime ?? "",
    completed: false,
    createdAt: new Date().toISOString(),
    repeat: input.repeat ?? "none",
    repeatDays: input.repeatDays ?? [],
    notificationIds,
  }
  todos.push(todo)
  writeTodos(todos)

  return todo
}

export function toggleTodo(id: number, completed: boolean): void {
  const todos = readTodos()
  const index = todos.findIndex((t) => t.id === id)
  if (index !== -1) {
    todos[index].completed = completed
    writeTodos(todos)

    if (completed) {
      const ids = todos[index].notificationIds
      if (ids && ids.length > 0) {
        cancelReminders(ids)
      } else {
        cancelReminder(id)
      }
    }
  }
}

export function deleteTodo(id: number): void {
  const todos = readTodos()
  const todo = todos.find((t) => t.id === id)
  writeTodos(todos.filter((t) => t.id !== id))

  if (todo) {
    const ids = todo.notificationIds
    if (ids && ids.length > 0) {
      cancelReminders(ids)
    } else {
      cancelReminder(id)
    }
  }
}
