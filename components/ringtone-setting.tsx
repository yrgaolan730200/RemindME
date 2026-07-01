// RemindME v1.0.1 — 铃声选择器 + 震动开关

"use client"

import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import {
  type RingtoneId,
  RINGTONE_OPTIONS,
  getRingtone,
  setRingtone,
  getVibrationEnabled,
  setVibrationEnabled,
} from "@/lib/settings"
import { useSoundPreview } from "@/hooks/useSoundPreview"

export function RingtoneSetting() {
  const [ringtone, setRingtoneState] = useState<RingtoneId>(getRingtone)
  const [vibration, setVibrationState] = useState(getVibrationEnabled)
  const [open, setOpen] = useState(false)
  const { previewSound, stopPreview } = useSoundPreview()

  const current = RINGTONE_OPTIONS.find((r) => r.id === ringtone) ?? RINGTONE_OPTIONS[0]

  function selectRingtone(id: RingtoneId) {
    setRingtoneState(id)
    setRingtone(id)
    // 试听失败绝不抛异常（catch 已内置在 useSoundPreview 中）
    previewSound(id)
    // 不关闭列表，方便用户试听多个
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
    }
  }

  function closePicker() {
    stopPreview()
    setOpen(false)
  }

  function toggleVibration() {
    const next = !vibration
    setVibrationState(next)
    setVibrationEnabled(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 震动开关 */}
      <div className="flex items-center justify-between rounded-2xl border border-border px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-base text-foreground">通知震动</span>
          <span className="text-xs text-muted-foreground">
            {vibration ? "提醒时手机会震动" : "仅响铃，不震动"}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={vibration}
          onClick={toggleVibration}
          className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
            vibration ? "bg-foreground" : "bg-muted-foreground/30"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${
              vibration ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* 铃声选择下拉 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (open) stopPreview()
            setOpen(!open)
          }}
          className="flex w-full items-center justify-between rounded-2xl border border-border px-5 py-4 text-left transition-colors hover:bg-muted"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-base text-foreground">提醒铃声</span>
            <span className="text-xs text-muted-foreground">
              {current.id === "default" ? current.label : `${current.label} · ${current.desc}`}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={1.5}
          />
        </button>

        {open && (
          <div className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
            {RINGTONE_OPTIONS.map((opt) => {
              const selected = ringtone === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectRingtone(opt.id)}
                  className={`flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-muted ${
                    selected ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">{opt.label}</span>
                    <span className="text-xs text-muted-foreground/60">{opt.desc}</span>
                  </div>
                  {selected && <Check className="h-4 w-4" strokeWidth={1.5} />}
                </button>
              )
            })}
            {/* 底部确认按钮 */}
            <button
              type="button"
              onClick={closePicker}
              className="w-full border-t border-border px-5 py-3.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
