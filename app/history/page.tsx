"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Trash2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTodos, deleteTodo, toggleTodo } from "@/lib/todos"
import { getTimelineItems, dayKey } from "@/lib/timeline"
import type { TimelineItem } from "@/lib/timeline"

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

export default function HistoryPage() {
  const [todos, setTodos] = useState(getTodos)

  const loadTodos = useCallback(() => {
    setTodos(getTodos())
  }, [])

  function handleDelete(todoId: number) {
    if (!window.confirm("确定要删除这个待办吗？")) return
    deleteTodo(todoId)
    loadTodos()
  }

  async function handleToggle(item: TimelineItem) {
    if (item.isRepeatOccurrence && !item.completed) {
      if (!window.confirm("这是重复待办，完成后将停止整个重复提醒，是否继续？")) return
    }
    try {
      await toggleTodo(item.todoId, !item.completed)
      loadTodos()
    } catch (e) {
      console.error("toggle todo failed in history", { todoId: item.todoId, error: e })
    }
  }

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  const now = new Date()
  const todayKey = dayKey(now)

  const timelineItems = useMemo(
    () => getTimelineItems(todos, now, 30),
    [todos, now],
  )

  // 按日期分组
  const groups = new Map<string, TimelineItem[]>()
  for (const item of timelineItems) {
    const list = groups.get(item.dateKey) ?? []
    list.push(item)
    groups.set(item.dateKey, list)
  }
  const days = Array.from(groups.keys()).sort()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-14 pb-8">
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

      {timelineItems.length === 0 ? (
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
                <span aria-hidden className="absolute bottom-0 left-[5px] top-7 w-px bg-border" />
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
                  <div className="flex items-baseline gap-2">
                    <span className={cn("text-sm font-medium tabular-nums", isPast && "text-muted-foreground")}>
                      {m}月{d}日
                    </span>
                    <span className="text-xs text-muted-foreground">{WEEKDAYS[date.getDay()]}</span>
                    {isToday && (
                      <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">今天</span>
                    )}
                  </div>

                  <ul className="mt-1 flex flex-col">
                    {items.map((item) => (
                      <li
                        key={`${item.dateKey}-${item.todoId}-${item.isRepeatOccurrence ? "r" : "o"}`}
                        className="flex min-h-[52px] items-center gap-3 rounded-lg px-3 py-2.5"
                      >
                        {/* 时间 */}
                        <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground/60">
                          {item.time || "—"}
                        </span>

                        {/* 完成圆圈 */}
                        <button
                          type="button"
                          aria-label={item.completed ? "标记为未完成" : "完成待办"}
                          onClick={() => handleToggle(item)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center"
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                              item.completed
                                ? "border-foreground bg-foreground text-background"
                                : "border-foreground/60 text-transparent active:bg-foreground/10",
                            )}
                          >
                            {item.completed && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                          </span>
                        </button>

                        {/* 标题 */}
                        <p className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          item.completed && "text-muted-foreground line-through",
                        )}>
                          {item.title}
                          {item.isRepeatOccurrence && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground/40">重复</span>
                          )}
                        </p>

                        {/* 删除按钮 — 始终可见，44px 触摸区域 */}
                        <button
                          type="button"
                          aria-label="删除待办"
                          onClick={() => handleDelete(item.todoId)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground/35 active:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </li>
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
