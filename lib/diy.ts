// DIY 实验室模式 — localStorage 配置管理

export type BlockKey = "title" | "todolist" | "buttons"

export const BLOCK_LABELS: Record<BlockKey, string> = {
  title: "文案区",
  todolist: "待办列表区",
  buttons: "按钮区",
}

export const DEFAULT_ORDER: BlockKey[] = ["title", "todolist", "buttons"]

const DEFAULT_TITLE = "到时候记得提醒我！"

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── DIY 模式开关 ──

export function isDiyMode(): boolean {
  return read("diy_mode", false)
}

export function enterDiyMode(): void {
  write("diy_mode", true)
}

export function exitDiyMode(): void {
  write("diy_mode", false)
}

// ── 自定义标题 ──

export function getDiyTitle(): string {
  return read("diy_title", DEFAULT_TITLE)
}

export function setDiyTitle(title: string): void {
  const trimmed = title.trim()
  write("diy_title", trimmed || DEFAULT_TITLE)
}

// ── 积木排序 ──

export function getDiyBlocks(): BlockKey[] {
  const order = read<BlockKey[]>("diy_blocks", DEFAULT_ORDER)
  const valid =
    DEFAULT_ORDER.every((k) => order.includes(k)) &&
    order.length === DEFAULT_ORDER.length
  return valid ? order : DEFAULT_ORDER
}

export function setDiyBlocks(order: BlockKey[]): void {
  write("diy_blocks", order)
}

export function moveBlock(blocks: BlockKey[], index: number, dir: "up" | "down"): BlockKey[] {
  const target = dir === "up" ? index - 1 : index + 1
  if (target < 0 || target >= blocks.length) return blocks
  const next = [...blocks]
  ;[next[index], next[target]] = [next[target], next[index]]
  setDiyBlocks(next)
  return next
}
