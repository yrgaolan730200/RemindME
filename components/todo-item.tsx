"use client"

import { useTransition } from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toggleTodo, deleteTodo } from "@/app/actions/todos"
import type { Todo } from "@/lib/db/schema"

function formatDate(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split("-")
  const hm = timeStr.slice(0, 5)
  return `${y}.${m}.${d} ${hm}`
}

export function TodoItem({ todo }: { todo: Todo }) {
  const [isPending, startTransition] = useTransition()

  return (
    <li className="flex items-center gap-3 py-3.5">
      <button
        type="button"
        aria-label={todo.completed ? "标记为未完成" : "标记为已完成"}
        onClick={() => startTransition(() => toggleTodo(todo.id, !todo.completed))}
        disabled={isPending}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          todo.completed
            ? "border-foreground bg-foreground text-background"
            : "border-muted-foreground/50 text-transparent",
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", todo.completed && "text-muted-foreground line-through")}>
          {todo.title}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {formatDate(todo.dueDate, todo.dueTime)}
        </p>
      </div>

      <button
        type="button"
        aria-label="删除"
        onClick={() => startTransition(() => deleteTodo(todo.id))}
        disabled={isPending}
        className="shrink-0 rounded-full p-1 text-muted-foreground/40 transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  )
}
