import Link from "next/link"
import { Plus, Clock } from "lucide-react"

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex flex-col items-center">
        <h1 className="text-pretty text-center text-2xl font-medium leading-relaxed tracking-wide sm:text-3xl">
          到时候记得提醒我！
        </h1>

        {/* 文字下方一行：左下加号，右下历史 */}
        <div className="mt-10 flex w-full items-center justify-center gap-20">
          <Link
            href="/add"
            aria-label="添加待办"
            className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            <Plus className="h-6 w-6" strokeWidth={1.5} />
          </Link>

          <Link
            href="/history"
            aria-label="历史待办"
            className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            <Clock className="h-6 w-6" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </main>
  )
}
