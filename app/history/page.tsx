"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, Trash2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTodos, deleteTodo, toggleTodo, skipRepeatOccurrence } from "@/lib/todos"
import { getTimelineItems, dayKey } from "@/lib/timeline"
import type { TimelineItem } from "@/lib/timeline"
import { DeleteActionSheet } from "@/components/delete-action-sheet"

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

export default function HistoryPage() {
  const [todos, setTodos] = useState(getTodos)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTodo, setSheetTodo] = useState<{ todoId: number; dateKey: string } | null>(null)

  const loadTodos = useCallback(() => {
    setTodos(getTodos())
  }, [])

  function handleDelete(e: React.MouseEvent, todoId: number, item?: TimelineItem) {
    e.preventDefault()
    e.stopPropagation()

    // 重复 occurrence → 弹出操作选择
    if (item?.isRepeatOccurrence) {
      setSheetTodo({ todoId, dateKey: item.dateKey })
      setSheetOpen(true)
      return
    }

    // 普通待办 → 直接确认
    if (!window.confirm("确定要删除这个待办吗？")) return
    try {
      deleteTodo(todoId)
    } catch (error) {
      console.error("delete todo failed in history", { todoId, error })
    }
    loadTodos()
  }

  function handleDeleteOnce() {
    if (!sheetTodo) return
    try {
      skipRepeatOccurrence(sheetTodo.todoId, sheetTodo.dateKey)
    } catch (error) {
      console.error("skip repeat occurrence failed", { todoId: sheetTodo.todoId, dateKey: sheetTodo.dateKey, error })
    }
    setSheetOpen(false)
    setSheetTodo(null)
    loadTodos()
  }

  function handleDeleteAll() {
    if (!sheetTodo) return
    try {
      deleteTodo(sheetTodo.todoId)
    } catch (error) {
      console.error("delete repeat todo failed", { todoId: sheetTodo.todoId, error })
    }
    setSheetOpen(false)
    setSheetTodo(null)
    loadTodos()
  }

  function handleToggle(item: TimelineItem, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      toggleTodo(item.todoId, !item.completed)
    } catch (error) {
      console.error("toggle todo failed in history", { todoId: item.todoId, error })
    }
    loadTodos()
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

                        {/* 完成圆圈：重复 occurrence 不显示 */}
                        {!item.isRepeatOccurrence && (
                          <button
                            type="button"
                            aria-label={item.completed ? "标记为未完成" : "完成待办"}
                            onClick={(e) => handleToggle(item, e)}
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
                        )}
                        {/* 重复 occurrence 占位，保持对齐 */}
                        {item.isRepeatOccurrence && <span className="h-11 w-11 shrink-0" />}

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
                          onClick={(e) => handleDelete(e, item.todoId, item)}
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

      {/* 重复待办删除操作选择 */}
      <DeleteActionSheet
        open={sheetOpen}
        onDeleteOnce={handleDeleteOnce}
        onDeleteAll={handleDeleteAll}
        onCancel={() => { setSheetOpen(false); setSheetTodo(null) }}
      />
    </main>
  )
}
