// Client-side todo storage using localStorage + Capacitor native notifications

import { Capacitor } from "@capacitor/core"
import { LocalNotifications } from "@capacitor/local-notifications"

export interface Todo {
  id: number
  title: string
  dueDate: string
  dueTime: string
  completed: boolean
  createdAt: string
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

const CHANNEL_ID = "remindme_high_priority"

function parseTriggerAt(dueDate: string, dueTime: string): Date {
  const [year, month, day] = dueDate.split("-").map(Number)
  const [hour, minute] = dueTime.split(":").map(Number)
  return new Date(year, month - 1, day, hour, minute, 0)
}

async function ensureChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "待办提醒",
      description: "RemindME 待办事项定时提醒",
      importance: 5,
      visibility: 1,
      sound: "beep.wav",
      vibration: true,
      lights: true,
    })
  } catch (e) {
    console.error("Failed to create notification channel:", e)
  }
}

async function scheduleNotification(todo: Todo): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.requestPermissions()
    await ensureChannel()
    await LocalNotifications.schedule({
      notifications: [
        {
          title: "RemindME",
          body: todo.title,
          id: todo.id,
          channelId: CHANNEL_ID,
          schedule: { at: parseTriggerAt(todo.dueDate, todo.dueTime) },
          sound: "beep.wav",
          smallIcon: "ic_stat_remindme",
        },
      ],
    })
  } catch (e) {
    console.error("Failed to schedule notification:", e)
  }
}

async function cancelNotification(id: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] })
  } catch (e) {
    console.error("Failed to cancel notification:", e)
  }
}

export async function addTodo(input: {
  title: string
  dueDate: string
  dueTime?: string
}): Promise<Todo> {
  const title = input.title.trim()
  if (!title) throw new Error("请输入待办名称")
  if (!input.dueDate) throw new Error("请选择日期")

  const todos = readTodos()
  const maxId = todos.reduce((max, t) => Math.max(max, t.id), 0)
  const todo: Todo = {
    id: maxId + 1,
    title,
    dueDate: input.dueDate,
    dueTime: input.dueTime ?? "",
    completed: false,
    createdAt: new Date().toISOString(),
  }
  todos.push(todo)
  writeTodos(todos)

  // 只有用户选了具体时间，才向安卓注册系统级定时提醒
  if (input.dueTime) {
    await scheduleNotification(todo)
  }

  return todo
}

export function toggleTodo(id: number, completed: boolean): void {
  const todos = readTodos()
  const index = todos.findIndex((t) => t.id === id)
  if (index !== -1) {
    todos[index].completed = completed
    writeTodos(todos)

    if (completed) {
      // 标记为已完成 → 取消系统提醒
      cancelNotification(id)
    }
  }
}

export function deleteTodo(id: number): void {
  const todos = readTodos()
  writeTodos(todos.filter((t) => t.id !== id))

  // 删除待办 → 取消系统提醒
  cancelNotification(id)
}
