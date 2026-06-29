// RemindME — 平台分治提醒调度（Android AlarmManager / iOS LocalNotifications / Web noop）
// 注意：Capacitor 模块仅在运行时加载，防止 Vercel 构建阶段报错

import { getNotificationSound, getRingtone } from "@/lib/settings"

// Android 原生插件接口（由 ReminderAlarmPlugin.java 暴露）
interface ReminderAlarmNative {
  scheduleReminderAlarm(opts: {
    id: number
    title: string
    body: string
    fireAt: number
    soundName: string
    isRepeat?: boolean
    repeatWeekday?: number
    repeatTime?: string
  }): Promise<{ scheduled: boolean; id: number }>
  cancelReminderAlarm(opts: { id: number }): Promise<{ cancelled: boolean }>
  stopRinging(): Promise<void>
  canScheduleExactAlarms(): Promise<{ canSchedule: boolean }>
  openExactAlarmSettings(): Promise<void>
}

let _capCore: any = null
let _capLN: any = null
let _reminderAlarm: ReminderAlarmNative | null = null

async function ensureCapacitor() {
  if (_capCore) return
  try {
    const core = await import("@capacitor/core")
    _capCore = core.Capacitor
    const ln = await import("@capacitor/local-notifications")
    _capLN = ln.LocalNotifications
    _reminderAlarm = core.registerPlugin<ReminderAlarmNative>("ReminderAlarm")
  } catch {
    // Vercel 构建环境 / Web 无 Capacitor → 静默降级
  }
}

function getPlatform(): string {
  try { return _capCore?.getPlatform?.() ?? "web" } catch { return "web" }
}

function getNativePlugin(): ReminderAlarmNative | null {
  if (!_reminderAlarm) return null
  const p = getPlatform()
  if (p === "web") return null
  return _reminderAlarm
}

export interface ReminderParams {
  id: number
  title: string
  body: string
  dueDate: string
  dueTime: string
}

export interface RepeatReminderParams {
  baseId: number
  title: string
  body: string
  repeatTime: string
  weekdays: number[]
}

function parseFireAt(dueDate: string, dueTime: string): number {
  const [y, m, d] = dueDate.split("-").map(Number)
  const [hh, mm] = dueTime.split(":").map(Number)
  return new Date(y, m - 1, d, hh, mm, 0).getTime()
}

function parseTime(dueTime: string): { hour: number; minute: number } {
  const [h, m] = dueTime.split(":").map(Number)
  return { hour: h, minute: m }
}

function getRawSoundName(): string {
  const ringtone = getRingtone()
  return ringtone === "default" ? "alarm" : ringtone
}

/** 生成稳定的 repeat notificationId：baseId * 10 + weekday（同一 todo+weekday 永远同一 ID，支持自动续排） */
function makeRepeatId(baseId: number, weekday: number): number {
  return baseId * 10 + weekday
}

function makeNotificationId(): number {
  return Math.floor(Math.random() * 2000000000)
}

/** 计算下一个 weekday+time 的毫秒时间戳 */
function nextFireForWeekday(weekday: number, hour: number, minute: number): number {
  const now = new Date()
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)
  const jsDay = weekday === 1 ? 0 : weekday - 1
  const currentDay = target.getDay()
  let daysUntil = jsDay - currentDay
  if (daysUntil < 0) daysUntil += 7
  if (daysUntil === 0 && target.getTime() <= now.getTime()) daysUntil = 7
  target.setDate(target.getDate() + daysUntil)
  return target.getTime()
}

// ═══════════════════════════════ 调度 ─═════════════════════════════

/** 调度单次提醒 */
export async function scheduleReminder(params: ReminderParams): Promise<number | null> {
  await ensureCapacitor()
  const platform = getPlatform()
  const fireAt = parseFireAt(params.dueDate, params.dueTime)

  // Android: ReminderAlarm 原生插件
  if (platform === "android") {
    const p = getNativePlugin()
    if (p) {
      const ok = await checkExactAlarmPermission()
      if (!ok) throw new Error("需要「闹钟和提醒」权限才能设置定时提醒，请在系统设置中开启")
      await p.scheduleReminderAlarm({ id: params.id, title: "RemindME", body: params.body, fireAt, soundName: getRawSoundName() })
      return params.id
    }
  }

  // iOS / fallback
  if (_capLN) {
    const sound = getNotificationSound()
    await _capLN.requestPermissions().catch(() => {})
    await _capLN.schedule({
      notifications: [{ title: "RemindME", body: params.body, id: params.id, schedule: { at: new Date(fireAt) }, ...(sound ? { sound } : {}) }],
    })
    return params.id
  }

  return null // Web: no-op
}

/** 调度重复提醒 — 每个 weekday 只注册下一次触发（自动续排由原生端负责） */
export async function scheduleRepeatReminders(params: RepeatReminderParams): Promise<number[]> {
  await ensureCapacitor()
  const { hour, minute } = parseTime(params.repeatTime)
  const platform = getPlatform()
  const sound = getNotificationSound()
  const ids: number[] = []

  if (platform === "android") {
    const p = getNativePlugin()
    if (p) {
      const ok = await checkExactAlarmPermission()
      if (!ok) throw new Error("需要「闹钟和提醒」权限才能设置定时提醒，请在系统设置中开启")
      for (const wd of params.weekdays) {
        const nid = makeRepeatId(params.baseId, wd)
        const fireAt = nextFireForWeekday(wd, hour, minute)
        try {
          await p.scheduleReminderAlarm({
            id: nid, title: "RemindME", body: params.body, fireAt, soundName: getRawSoundName(),
            isRepeat: true, repeatWeekday: wd, repeatTime: params.repeatTime,
          })
          ids.push(nid)
        } catch { /* 单个失败不阻断其他 */ }
      }
      if (ids.length === 0) throw new Error("重复提醒注册失败，请检查闹钟权限")
      return ids
    }
  }

  // iOS / fallback: Capacitor 原生支持 weekly repeat
  if (_capLN) {
    const notifications = params.weekdays.map((wd) => {
      const nid = makeRepeatId(params.baseId, wd)
      ids.push(nid)
      return { title: "RemindME", body: params.body, id: nid, schedule: { on: { weekday: wd, hour, minute } }, ...(sound ? { sound } : {}) }
    })
    await _capLN.requestPermissions().catch(() => {})
    await _capLN.schedule({ notifications })
    return ids
  }

  return ids
}

// ═══════════════════════════════ 取消 ─═════════════════════════════

export async function cancelReminder(id: number): Promise<void> {
  try { await ensureCapacitor() } catch { return }
  const platform = getPlatform()
  if (platform === "android") {
    const p = getNativePlugin()
    if (p) { try { await p.cancelReminderAlarm({ id }) } catch (e) { console.error("cancelReminder android failed", { id, error: e }) } return }
  }
  if (_capLN) { await _capLN.cancel({ notifications: [{ id }] }).catch((e: any) => console.error("cancelReminder ios failed", { id, error: e })) }
}

export async function cancelReminders(ids: number[]): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return
  try { await ensureCapacitor() } catch { return }
  const platform = getPlatform()

  if (platform === "android") {
    const p = getNativePlugin()
    if (p) {
      for (const id of ids) {
        try { await p.cancelReminderAlarm({ id }) } catch (e) { console.error("cancelReminders android failed", { id, error: e }) }
      }
    }
    return
  }

  if (_capLN) {
    await _capLN.cancel({ notifications: ids.map((id) => ({ id })) }).catch((e: any) => console.error("cancelReminders ios failed", { ids, error: e }))
  }
}

// ═══════════════════════════════ 其他 ─═════════════════════════════

export async function stopCurrentRinging(): Promise<void> {
  const platform = getPlatform()
  if (platform === "android") { const p = getNativePlugin(); if (p) await p.stopRinging() }
}

export async function checkExactAlarmPermission(): Promise<boolean> {
  const platform = getPlatform()
  if (platform !== "android") return true
  const p = getNativePlugin(); if (!p) return true
  try { return (await p.canScheduleExactAlarms()).canSchedule } catch { return true }
}

export async function openExactAlarmSettings(): Promise<void> {
  const p = getNativePlugin(); if (p) await p.openExactAlarmSettings()
}
