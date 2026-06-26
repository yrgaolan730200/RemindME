"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { WheelPicker } from "@/components/wheel-picker"
import { addTodo } from "@/lib/todos"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export function AddTodoForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = new Date()
  const [title, setTitle] = useState("")
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [day, setDay] = useState(now.getDate())
  const [hour, setHour] = useState(now.getHours())
  const [minute, setMinute] = useState(now.getMinutes())
  const [isTimeReminderEnabled, setIsTimeReminderEnabled] = useState(false)

  const years = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const v = now.getFullYear() + i
        return { value: v, label: `${v}` }
      }),
    [now],
  )
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${pad(i + 1)}` })),
    [],
  )
  const days = useMemo(() => {
    const total = daysInMonth(year, month)
    return Array.from({ length: total }, (_, i) => ({ value: i + 1, label: `${pad(i + 1)}` }))
  }, [year, month])
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${pad(i)}` })),
    [],
  )
  const minutes = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ value: i, label: `${pad(i)}` })),
    [],
  )

  // 当月份/年份改变导致天数变少时，收敛 day
  const maxDay = daysInMonth(year, month)
  const safeDay = Math.min(day, maxDay)

  async function handleSubmit() {
    setError(null)
    const dueDate = `${year}-${pad(month)}-${pad(safeDay)}`
    const dueTime = isTimeReminderEnabled ? `${pad(hour)}:${pad(minute)}:00` : ""
    setSaving(true)
    try {
      await addTodo({ title, dueDate, dueTime })
      router.push("/")
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败")
      setSaving(false)
    }
  }

  return (
    <div
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
        <h1 className="ml-2 text-base font-medium tracking-wide">添加待办</h1>
      </header>

      <div className="flex flex-1 flex-col gap-8">
        {/* 第一行：名称 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="text-xs uppercase tracking-widest text-muted-foreground">
            名称
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="要做点什么？"
            autoComplete="off"
            className="w-full border-b border-border bg-transparent pb-2 text-lg outline-none placeholder:text-muted-foreground/40 focus:border-foreground"
          />
        </div>

        {/* 第二行：日期 */}
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">日期</span>
          <WheelPicker
            columns={[
              { items: years, value: year, onChange: setYear, ariaLabel: "年" },
              { items: months, value: month, onChange: setMonth, ariaLabel: "月" },
              { items: days, value: safeDay, onChange: setDay, ariaLabel: "日" },
            ]}
          />
        </div>

        {/* 第三行：时间（选填） */}
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">时间</span>

          {/* 开关行条 */}
          <label
            className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-colors cursor-pointer ${
              isTimeReminderEnabled
                ? "border-foreground bg-foreground text-background"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            <span className="text-base">开启时间提醒</span>
            <button
              type="button"
              role="switch"
              aria-checked={isTimeReminderEnabled}
              onClick={(e) => {
                e.preventDefault()
                setIsTimeReminderEnabled(!isTimeReminderEnabled)
              }}
              className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
                isTimeReminderEnabled ? "bg-background/20" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full shadow transition-transform ${
                  isTimeReminderEnabled
                    ? "translate-x-5 bg-background"
                    : "translate-x-1 bg-background"
                }`}
              />
            </button>
          </label>

          {/* 时间滚轮（开关打开时显示） */}
          {isTimeReminderEnabled && (
            <WheelPicker
              columns={[
                { items: hours, value: hour, onChange: setHour, ariaLabel: "时" },
                { items: minutes, value: minute, onChange: setMinute, ariaLabel: "分" },
              ]}
            />
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="mt-8 w-full rounded-full bg-primary py-3.5 text-sm font-medium tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "保存中…" : "保存待办"}
      </button>
    </div>
  )
}
