import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getTodos } from "@/app/actions/todos"
import { TodoItem } from "@/components/todo-item"
import type { Todo } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

function Section({ title, items }: { title: string; items: Todo[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col">
      <h2 className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
      <ul className="divide-y divide-border">
        {items.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </ul>
    </section>
  )
}

export default async function HistoryPage() {
  const todos = await getTodos()
  const now = new Date()

  const upcoming: Todo[] = []
  const past: Todo[] = []
  for (const t of todos) {
    const dueAt = new Date(`${t.dueDate}T${t.dueTime}`)
    if (dueAt.getTime() >= now.getTime()) upcoming.push(t)
    else past.push(t)
  }
  // 过去的按时间倒序更符合直觉
  past.reverse()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-8">
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
        <div className="flex flex-col gap-10">
          <Section title="即将到来" items={upcoming} />
          <Section title="已过去" items={past} />
        </div>
      )}
    </main>
  )
}
