"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTodos } from "@/lib/todos"
import { TodoItem } from "@/components/todo-item"
import type { Todo } from "@/lib/todos"

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function HistoryPage() {
  const [todos, setTodos] = useState<Todo[]>([])

  const loadTodos = useCallback(() => {
    setTodos(getTodos())
  }, [])

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  const now = new Date()
  const todayKey = dayKey(now)

  // 按日期分组
  const groups = new Map<string, Todo[]>()
  for (const t of todos) {
    const list = groups.get(t.dueDate) ?? []
    list.push(t)
    groups.set(t.dueDate, list)
  }

  // 日期升序排列；每组内按时间升序
  const days = Array.from(groups.keys()).sort()
  for (const k of days) {
    groups.get(k)!.sort((a, b) => a.dueTime.localeCompare(b.dueTime))
  }

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}
    >
      <header className="mb-10 flex items-center">
        <Link
          href="/"
          aria-label="返回"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="ml-2 text-base font-medium tracking-wide">历史待办</h1>
      </header>

      {todos.length === 0 ? (
        <p className="mt-20 text-center text-sm text-muted-foreground">还没有任何待办</p>
      ) : (
        <ol className="flex flex-col">
          {days.map((key) => {
            const items = groups.get(key)!
            const [y, m, d] = key.split("-").map(Number)
            const date = new Date(y, m - 1, d)
            const isPast = key < todayKey
            const isToday = key === todayKey

            return (
              <li key={key} className="relative flex gap-4 pb-8 last:pb-0">
                {/* 时间轴竖线 */}
                <span
                  aria-hidden
                  className="absolute bottom-0 left-[5px] top-7 w-px bg-border"
                />

                {/* 节点圆点 */}
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 mt-[7px] h-[11px] w-[11px] shrink-0 rounded-full border-2 border-background ring-1",
                    isToday
                      ? "bg-foreground ring-foreground"
                      : isPast
                        ? "bg-muted-foreground/40 ring-muted-foreground/40"
                        : "bg-background ring-muted-foreground/60",
                  )}
                />

                <div className="min-w-0 flex-1">
                  {/* 日期标题 */}
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        isPast && "text-muted-foreground",
                      )}
                    >
                      {m}月{d}日
                    </span>
                    <span className="text-xs text-muted-foreground">{WEEKDAYS[date.getDay()]}</span>
                    {isToday && (
                      <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
                        今天
                      </span>
                    )}
                  </div>

                  {/* 该日期下的待办 */}
                  <ul className="mt-1 flex flex-col">
                    {items.map((todo) => (
                      <TodoItem key={todo.id} todo={todo} onUpdate={loadTodos} />
                    ))}
                  </ul>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </main>
  )
}
