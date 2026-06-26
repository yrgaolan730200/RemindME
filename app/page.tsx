"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Plus, Clock, Settings, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { getTodos } from "@/lib/todos"
import type { Todo } from "@/lib/todos"
import {
  type BlockKey,
  BLOCK_LABELS,
  getDiyTitle,
  setDiyTitle,
  getDiyBlocks,
  setDiyBlocks,
  isDiyMode,
  exitDiyMode,
} from "@/lib/diy"

// ═══════════════════════════════════════════════
// StrictMode 兼容 Droppable
// ═══════════════════════════════════════════════

function StrictModeDroppable({
  children,
  droppableId,
}: {
  children: (provided: any) => React.ReactNode
  droppableId: string
}) {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnabled(true))
    return () => cancelAnimationFrame(id)
  }, [])
  if (!enabled) return null
  return <Droppable droppableId={droppableId}>{children}</Droppable>
}

// ═══════════════════════════════════════════════
// 区块渲染函数（严格独立，互不包含）
// ═══════════════════════════════════════════════

function TitleBlock({
  editing,
  title,
  onChange,
}: {
  editing: boolean
  title: string
  onChange: (v: string) => void
}) {
  if (editing) {
    return (
      <input
        value={title}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入自定义标题…"
        autoComplete="off"
        className="text-pretty text-center text-2xl font-medium leading-relaxed tracking-wide sm:text-3xl bg-transparent border-b border-dashed border-muted-foreground/30 outline-none w-full pb-1 placeholder:text-muted-foreground/20"
      />
    )
  }
  return (
    <h1 className="text-pretty text-center text-2xl font-medium leading-relaxed tracking-wide sm:text-3xl">
      {title}
    </h1>
  )
}

function TodoListBlock() {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    setTodos(getTodos().filter((t) => !t.completed))
  }, [])

  if (todos.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground/40">暂无待办</p>
    )
  }

  return (
    <ul className="flex flex-col gap-2 w-full max-w-xs mx-auto">
      {todos.slice(0, 5).map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-3 text-sm text-muted-foreground"
        >
          <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground/50">
            {t.dueTime ? t.dueTime.slice(0, 5) : "—"}
          </span>
          <span className="truncate">{t.title}</span>
        </li>
      ))}
      {todos.length > 5 && (
        <p className="text-xs text-muted-foreground/30 mt-1 text-center">
          还有 {todos.length - 5} 条待办…
        </p>
      )}
    </ul>
  )
}

function ButtonsBlock() {
  return (
    <div className="flex w-full items-center justify-center gap-10 sm:gap-14">
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

      <Link
        href="/settings"
        aria-label="设置"
        className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-foreground hover:text-background"
      >
        <Settings className="h-6 w-6" strokeWidth={1.5} />
      </Link>
    </div>
  )
}

// ═══════════════════════════════════════════════
// 主页面
// ═══════════════════════════════════════════════

export default function HomePage() {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("到时候记得提醒我！")
  const [blocks, setBlocks] = useState<BlockKey[]>([
    "title",
    "todolist",
    "buttons",
  ])

  useEffect(() => {
    setBlocks(getDiyBlocks())
    setTitle(getDiyTitle())
    setEditing(isDiyMode())
  }, [])

  const handleTitleChange = useCallback((v: string) => setTitle(v), [])

  function handleSave() {
    setDiyTitle(title)
    exitDiyMode()
    setEditing(false)
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const sourceIndex = result.source.index
    const destIndex = result.destination.index
    if (sourceIndex === destIndex) return

    const reordered = Array.from(blocks)
    const [removed] = reordered.splice(sourceIndex, 1)
    reordered.splice(destIndex, 0, removed)
    setBlocks(reordered)
    setDiyBlocks(reordered)
  }

  const blockRenderers: Record<BlockKey, () => React.ReactNode> = {
    title: () => (
      <TitleBlock editing={editing} title={title} onChange={handleTitleChange} />
    ),
    todolist: () => <TodoListBlock />,
    buttons: () => <ButtonsBlock />,
  }

  return (
    <main
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center px-6 pb-8",
        editing && "justify-start",
      )}
      style={{
        paddingTop: editing
          ? "calc(max(env(safe-area-inset-top), 24px) + 5rem)"
          : "max(env(safe-area-inset-top), 24px)",
      }}
    >
      {/* DIY 模式顶栏 */}
      {editing && (
        <div
          className="fixed inset-x-0 z-50 mx-auto flex max-w-md items-center justify-between px-6 py-4"
          style={{ top: "max(env(safe-area-inset-top), 24px)" }}
        >
          <span className="text-xs uppercase tracking-widest text-muted-foreground/50">
            DIY 实验室
          </span>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            退出并保存
          </button>
        </div>
      )}

      {/* ── 编辑模式：拖拽排序 ── */}
      {editing ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <StrictModeDroppable droppableId="diy-blocks">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex w-full flex-col gap-6"
              >
                {blocks.map((key, i) => (
                  <Draggable key={key} draggableId={key} index={i}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "relative flex flex-col items-center w-full rounded-2xl border border-dashed border-muted-foreground/15 py-6 px-4 transition-shadow select-none",
                          snapshot.isDragging &&
                            "shadow-2xl bg-background scale-[1.03] z-50 border-muted-foreground/30",
                        )}
                      >
                        {/* 拖拽手柄 */}
                        <div
                          {...provided.dragHandleProps}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/20 hover:text-muted-foreground/50 active:text-foreground transition-colors cursor-grab active:cursor-grabbing"
                          aria-label={`拖拽排序 ${BLOCK_LABELS[key]}`}
                        >
                          <GripVertical className="h-5 w-5" strokeWidth={1.5} />
                        </div>

                        {/* 区块标签 */}
                        <span className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground/30">
                          {BLOCK_LABELS[key]}
                        </span>

                        {blockRenderers[key]()}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </StrictModeDroppable>
        </DragDropContext>
      ) : (
        /* ── 普通模式：静态渲染（区块间 gap-10 确保隔离）── */
        <div className="flex w-full flex-col gap-10">
          {blocks.map((key) => (
            <div key={key} className="flex flex-col items-center w-full">
              {blockRenderers[key]()}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
