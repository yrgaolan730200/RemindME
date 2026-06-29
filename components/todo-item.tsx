"use client"

import { useState } from "react"
import { Check, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toggleTodo, deleteTodo } from "@/lib/todos"
import type { Todo } from "@/lib/todos"

interface TodoItemProps {
  todo: Todo
  onUpdate: () => void
  showDelete?: boolean
  isRepeatOccurrence?: boolean
}

export function TodoItem({ todo, onUpdate, showDelete = false, isRepeatOccurrence = false }: TodoItemProps) {
  const [deleting, setDeleting] = useState(false)
  const time = todo.dueTime ? todo.dueTime.slice(0, 5) : todo.repeatTime ? todo.repeatTime.slice(0, 5) : ""

  async function handleToggle() {
    if (isRepeatOccurrence && !todo.completed) {
      if (!window.confirm("这是重复待办，完成后将停止整个重复提醒，是否继续？")) return
    }
    try {
      await toggleTodo(todo.id, !todo.completed)
      onUpdate()
    } catch (e) {
      console.error("toggle todo failed", { todoId: todo.id, error: e })
    }
  }

  function handleDelete() {
    if (!window.confirm("确定要删除这个待办吗？")) return
    setDeleting(true)
    deleteTodo(todo.id)
    onUpdate()
  }

  return (
    <li className="flex min-h-[52px] items-center gap-3 rounded-lg px-3 py-2.5">
      {/* 时间 */}
      <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground/60">
        {time || "—"}
      </span>

      {/* 完成圆圈 — 44px 触摸区域，24px 视觉圆 */}
      <button
        type="button"
        aria-label={todo.completed ? "标记为未完成" : "完成待办"}
        onClick={handleToggle}
        className="flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
            todo.completed
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/60 text-transparent active:bg-foreground/10",
          )}
        >
          {todo.completed && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
        </span>
      </button>

      {/* 标题 */}
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          todo.completed && "text-muted-foreground line-through",
        )}
      >
        {todo.title}
        {isRepeatOccurrence && (
          <span className="ml-1.5 text-[10px] text-muted-foreground/40">重复</span>
        )}
      </p>

      {/* 删除按钮 — 44px 触摸区域，始终可见 */}
      {showDelete && (
        <button
          type="button"
          aria-label="删除待办"
          onClick={handleDelete}
          disabled={deleting}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground/35 active:text-destructive disabled:opacity-30"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      )}
    </li>
  )
}
