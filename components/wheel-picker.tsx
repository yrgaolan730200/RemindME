"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

const ITEM_HEIGHT = 40
const VISIBLE = 5 // 必须是奇数

type WheelColumnProps = {
  items: { value: number; label: string }[]
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}

function WheelColumn({ items, value, onChange, ariaLabel }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null)
  const frame = useRef<number | null>(null)
  const padding = ((VISIBLE - 1) / 2) * ITEM_HEIGHT

  // 当外部 value 改变时（且差距较大），同步滚动位置
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const index = items.findIndex((i) => i.value === value)
    if (index < 0) return
    const target = index * ITEM_HEIGHT
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTo({ top: target })
    }
  }, [value, items])

  function handleScroll() {
    const el = ref.current
    if (!el) return
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const index = Math.round(el.scrollTop / ITEM_HEIGHT)
      const clamped = Math.max(0, Math.min(items.length - 1, index))
      const next = items[clamped]
      if (next && next.value !== value) onChange(next.value)
    })
  }

  return (
    <div
      className="relative"
      style={{ height: VISIBLE * ITEM_HEIGHT }}
      role="listbox"
      aria-label={ariaLabel}
    >
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll no-scrollbar snap-y snap-mandatory"
        style={{ scrollPaddingTop: padding }}
      >
        <div style={{ height: padding }} aria-hidden />
        {items.map((item) => {
          const selected = item.value === value
          return (
            <div
              key={item.value}
              role="option"
              aria-selected={selected}
              onClick={() => onChange(item.value)}
              className={cn(
                "flex snap-center cursor-pointer items-center justify-center tabular-nums transition-colors",
                selected ? "text-foreground" : "text-muted-foreground/40",
              )}
              style={{ height: ITEM_HEIGHT }}
            >
              <span className={cn("text-lg", selected && "text-xl font-medium")}>{item.label}</span>
            </div>
          )
        })}
        <div style={{ height: padding }} aria-hidden />
      </div>
      {/* 中间选中行的横线指示 */}
      <div
        className="pointer-events-none absolute inset-x-0 border-y border-border"
        style={{ top: padding, height: ITEM_HEIGHT }}
        aria-hidden
      />
    </div>
  )
}

export function WheelPicker({
  columns,
}: {
  columns: WheelColumnProps[]
}) {
  return (
    <div className="relative flex items-stretch justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-2">
      {columns.map((col, i) => (
        <div key={i} className="min-w-0 flex-1">
          <WheelColumn {...col} />
        </div>
      ))}
    </div>
  )
}
