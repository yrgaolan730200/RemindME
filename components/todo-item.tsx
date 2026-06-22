"use client"

import { useTransition } from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toggleTodo, deleteTodo } from "@/app/actions/todos"
import type { Todo } from "@/lib/db/schema"

export function TodoItem({ todo }: { todo: Todo }) {
  const [isPending, startTransition] = useTransition()
  const time = todo.dueTime.slice(0, 5)

  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60",
        isPending && "opacity-50",
      )}
    >
      <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">{time}</span>

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

      <p className={cn("min-w-0 flex-1 truncate text-sm", todo.completed && "text-muted-foreground line-through")}>
        {todo.title}
      </p>

      <button
        type="button"
        aria-label="删除"
        onClick={() => startTransition(() => deleteTodo(todo.id))}
        disabled={isPending}
        className="shrink-0 rounded-full p-1 text-muted-foreground/40 opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  )
}
