// RemindME — 时间线工具（一次性提醒 + 重复提醒投影）

import type { Todo } from "@/lib/todos"

export interface TimelineItem {
  dateKey: string       // "2026-07-01"
  time: string          // "09:00"
  todoId: number
  title: string
  completed: boolean
  todo: Todo
  isRepeatOccurrence: boolean
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function generateRepeatOccurrences(todo: Todo, fromDate: Date, daysAhead: number): TimelineItem[] {
  const items: TimelineItem[] = []
  if (!todo.repeatEnabled || !todo.repeatTime || !todo.repeatWeekdays || todo.repeatWeekdays.length === 0) {
    return items
  }

  const skipSet = new Set(todo.repeatSkipDates ?? [])
  const time = todo.repeatTime.slice(0, 5)
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(fromDate)
    d.setDate(d.getDate() + i)
    // Capacitor weekday: 1=Sun…7=Sat; JS getDay(): 0=Sun…6=Sat
    const jsDay = d.getDay()
    const capacitorDay = jsDay === 0 ? 1 : jsDay + 1
    if (todo.repeatWeekdays.includes(capacitorDay)) {
      const dk = dayKey(d)
      if (skipSet.has(dk)) continue
      items.push({
        dateKey: dk,
        time,
        todoId: todo.id,
        title: todo.title,
        completed: todo.completed,
        todo,
        isRepeatOccurrence: true,
      })
    }
  }
  return items
}

export function getTimelineItems(todos: Todo[], fromDate: Date, daysAhead = 30): TimelineItem[] {
  const items: TimelineItem[] = []

  for (const todo of todos) {
    // 一次性提醒
    if (todo.reminderEnabled && todo.dueDate) {
      items.push({
        dateKey: todo.dueDate,
        time: todo.dueTime ? todo.dueTime.slice(0, 5) : "",
        todoId: todo.id,
        title: todo.title,
        completed: todo.completed,
        todo,
        isRepeatOccurrence: false,
      })
    }

    // 重复提醒投影
    if (todo.repeatEnabled) {
      items.push(...generateRepeatOccurrences(todo, fromDate, daysAhead))
    }

    // 普通待办（有日期但无提醒）
    if (!todo.reminderEnabled && !todo.repeatEnabled && todo.dueDate) {
      items.push({
        dateKey: todo.dueDate,
        time: todo.dueTime ? todo.dueTime.slice(0, 5) : "",
        todoId: todo.id,
        title: todo.title,
        completed: todo.completed,
        todo,
        isRepeatOccurrence: false,
      })
    }
  }

  // 排序 + 去重
  const seen = new Set<string>()
  const deduped: TimelineItem[] = []
  for (const item of items.sort((a, b) => {
    const dc = a.dateKey.localeCompare(b.dateKey)
    if (dc !== 0) return dc
    return a.time.localeCompare(b.time)
  })) {
    const dedupKey = `${item.dateKey}|${item.todoId}|${item.time}|${item.isRepeatOccurrence}`
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey)
      deduped.push(item)
    }
  }
  return deduped
}
