"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, Check } from "lucide-react"
import Link from "next/link"
import { WheelPicker } from "@/components/wheel-picker"
import { addTodo, type RepeatMode } from "@/lib/todos"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

const WEEKDAY_KEYS = [1, 2, 3, 4, 5, 6, 7] as const // Capacitor: 1=Sun...7=Sat
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

const REPEAT_OPTIONS: { value: RepeatMode; label: string }[] = [
  { value: "none", label: "不重复" },
  { value: "workdays", label: "工作日 (周一至周五)" },
  { value: "weekends", label: "休息日 (周六、周日)" },
  { value: "mwf", label: "周一、周三、周五" },
  { value: "tts", label: "周二、周四、周六" },
  { value: "custom", label: "自定义…" },
]

const PRESET_DAYS: Record<Exclude<RepeatMode, "none" | "custom">, number[]> = {
  workdays: [2, 3, 4, 5, 6],
  weekends: [1, 7],
  mwf: [2, 4, 6],
  tts: [3, 5, 7],
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

  // ── 重复提醒状态 ──
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none")
  const [repeatOpen, setRepeatOpen] = useState(false)
  const [customDays, setCustomDays] = useState<number[]>([])

  const years = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => ({
        value: now.getFullYear() + i,
        label: `${now.getFullYear() + i}`,
      })),
    [now],
  )
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${pad(i + 1)}` })),
    [],
  )
  const daysMemo = useMemo(() => {
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

  const maxDay = daysInMonth(year, month)
  const safeDay = Math.min(day, maxDay)

  function getSelectedDays(): number[] {
    if (!repeatEnabled || repeatMode === "none") return []
    if (repeatMode === "custom") return customDays.sort((a, b) => a - b)
    return PRESET_DAYS[repeatMode] ?? []
  }

  function handleRepeatModeSelect(mode: RepeatMode) {
    setRepeatMode(mode)
    setRepeatOpen(false)
    if (mode === "workdays") setCustomDays(PRESET_DAYS.workdays)
    else if (mode === "weekends") setCustomDays(PRESET_DAYS.weekends)
    else if (mode === "mwf") setCustomDays(PRESET_DAYS.mwf)
    else if (mode === "tts") setCustomDays(PRESET_DAYS.tts)
    else setCustomDays([])
  }

  function toggleCustomDay(wd: number) {
    setCustomDays((prev) =>
      prev.includes(wd) ? prev.filter((d) => d !== wd) : [...prev, wd].sort((a, b) => a - b),
    )
  }

  function getRepeatLabel(): string {
    return REPEAT_OPTIONS.find((r) => r.value === repeatMode)?.label ?? "不重复"
  }

  async function handleSubmit() {
    setError(null)
    const dueDate = `${year}-${pad(month)}-${pad(safeDay)}`
    const dueTime = isTimeReminderEnabled ? `${pad(hour)}:${pad(minute)}:00` : ""
    setSaving(true)
    try {
      await addTodo({
        title,
        dueDate,
        dueTime,
        repeat: repeatEnabled ? repeatMode : "none",
        repeatDays: getSelectedDays(),
      })
      router.push("/")
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败")
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col px-6 pt-14">
      {/* Header */}
      <header className="flex shrink-0 items-center pb-6">
        <Link
          href="/"
          aria-label="返回"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="ml-2 text-base font-medium tracking-wide">添加待办</h1>
      </header>

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="flex flex-col gap-6">

          {/* 名称 */}
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

          {/* 日期 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">日期</span>
            <WheelPicker
              columns={[
                { items: years, value: year, onChange: setYear, ariaLabel: "年" },
                { items: months, value: month, onChange: setMonth, ariaLabel: "月" },
                { items: daysMemo, value: safeDay, onChange: setDay, ariaLabel: "日" },
              ]}
            />
          </div>

          {/* 时间（选填） */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">提醒时间</span>

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
                  const next = !isTimeReminderEnabled
                  setIsTimeReminderEnabled(next)
                  // 关闭时间时同步关闭重复
                  if (!next) {
                    setRepeatEnabled(false)
                    setRepeatMode("none")
                  }
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

            {isTimeReminderEnabled && (
              <WheelPicker
                columns={[
                  { items: hours, value: hour, onChange: setHour, ariaLabel: "时" },
                  { items: minutes, value: minute, onChange: setMinute, ariaLabel: "分" },
                ]}
              />
            )}
          </div>

          {/* 重复提醒 — 独立区块，始终可见 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">重复</span>

            <label
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 transition-colors cursor-pointer ${
                repeatEnabled
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              <span className="text-base">重复提醒</span>
              <button
                type="button"
                role="switch"
                aria-checked={repeatEnabled}
                onClick={(e) => {
                  e.preventDefault()
                  const next = !repeatEnabled
                  setRepeatEnabled(next)
                  if (next) {
                    // 开启重复必须同时开启时间
                    if (!isTimeReminderEnabled) setIsTimeReminderEnabled(true)
                    if (repeatMode === "none") setRepeatMode("workdays")
                  } else {
                    setRepeatMode("none")
                  }
                }}
                className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
                  repeatEnabled ? "bg-background/20" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full shadow transition-transform ${
                    repeatEnabled
                      ? "translate-x-5 bg-background"
                      : "translate-x-1 bg-background"
                  }`}
                />
              </button>
            </label>

            {repeatEnabled && (
              <>
                {/* 重复模式下拉 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRepeatOpen(!repeatOpen)}
                    className="flex w-full items-center justify-between rounded-2xl border border-border px-5 py-4 text-left text-foreground transition-colors hover:bg-muted"
                  >
                    <span className="text-base">{getRepeatLabel()}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        repeatOpen ? "rotate-180" : ""
                      }`}
                      strokeWidth={1.5}
                    />
                  </button>

                  {repeatOpen && (
                    <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
                      {REPEAT_OPTIONS.map((opt) => {
                        const selected = repeatMode === opt.value
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleRepeatModeSelect(opt.value)}
                            className={`flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-muted ${
                              selected ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            <span className="text-sm">{opt.label}</span>
                            {selected && <Check className="h-4 w-4" strokeWidth={1.5} />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 自定义星期选择 */}
                {repeatMode === "custom" && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    {WEEKDAY_KEYS.map((wd) => {
                      const active = customDays.includes(wd)
                      return (
                        <button
                          key={wd}
                          type="button"
                          onClick={() => toggleCustomDay(wd)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                            active
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {WEEKDAY_LABELS[wd - 1]}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Error */}
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
        </div>
      </div>

      {/* Sticky bottom save button with safe area */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="shrink-0 w-full rounded-full bg-primary py-3.5 text-sm font-medium tracking-wide text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ paddingBottom: "max(calc(env(safe-area-inset-bottom, 24px) + 0.875rem), 0.875rem)" }}
      >
        {saving ? "保存中…" : "保存待办"}
      </button>
    </div>
  )
}
