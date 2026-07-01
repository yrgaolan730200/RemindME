// RemindME — 删除确认 Action Sheet（仅删除一次 / 删除全部 / 取消）

"use client"

import { X } from "lucide-react"

interface Props {
  open: boolean
  onDeleteOnce: () => void
  onDeleteAll: () => void
  onCancel: () => void
}

export function DeleteActionSheet({ open, onDeleteOnce, onDeleteAll, onCancel }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-6 shadow-2xl">
        <h3 className="text-base font-medium tracking-wide text-foreground">删除重复提醒</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          你希望如何处理这条重复待办？
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onDeleteOnce}
            className="w-full rounded-2xl border border-border px-5 py-3.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            <span className="font-medium">仅删除这一次</span>
            <p className="mt-0.5 text-xs text-muted-foreground">只移除该日期的待办提醒，其他日期不受影响</p>
          </button>

          <button
            type="button"
            onClick={onDeleteAll}
            className="w-full rounded-2xl border border-border px-5 py-3.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <span className="font-medium">删除整个重复提醒</span>
            <p className="mt-0.5 text-xs text-muted-foreground">移除该待办及其所有日期的提醒</p>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="mt-2 w-full rounded-2xl px-5 py-3.5 text-center text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
