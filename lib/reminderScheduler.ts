// RemindME — 平台分治提醒调度（Android AlarmManager / iOS LocalNotifications / Web noop）

import { Capacitor, registerPlugin } from "@capacitor/core"
import { LocalNotifications } from "@capacitor/local-notifications"
import { getNotificationSound, getRingtone } from "@/lib/settings"

// Android 原生插件接口（由 ReminderAlarmPlugin.java 暴露）
interface ReminderAlarmNative {
  scheduleReminderAlarm(opts: {
    id: number
    title: string
    body: string
    fireAt: number
    soundName: string
  }): Promise<{ scheduled: boolean; id: number }>
  cancelReminderAlarm(opts: { id: number }): Promise<{ cancelled: boolean }>
  stopRinging(): Promise<void>
  canScheduleExactAlarms(): Promise<{ canSchedule: boolean }>
  openExactAlarmSettings(): Promise<void>
}

const ReminderAlarm = registerPlugin<ReminderAlarmNative>("ReminderAlarm")

function getNativePlugin(): ReminderAlarmNative | null {
  try {
    const platform = Capacitor.getPlatform()
    if (platform === "web") return null
    // 测试是否已实现（调用轻量方法）
    return ReminderAlarm
  } catch {
    return null
  }
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
  repeatTime: string    // "09:00:00"
  weekdays: number[]    // Capacitor weekday: 1=Sun, 2=Mon, …, 7=Sat
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

/** 生成安全的 32 位正整数通知 ID（不依赖 baseId 乘法，避免溢出） */
function makeNotificationId(): number {
  return Math.floor(Math.random() * 2000000000)
}

/** 调度单次提醒 — 返回通知 ID */
export async function scheduleReminder(params: ReminderParams): Promise<number | null> {
  const platform = Capacitor.getPlatform()
  const fireAt = parseFireAt(params.dueDate, params.dueTime)

  // 通知权限（Android 13+ / iOS）
  await LocalNotifications.requestPermissions().catch(() => {})

  // Android: 使用原生 AlarmManager 插件
  if (platform === "android") {
    const plugin = getNativePlugin()
    if (plugin) {
      // 检查 exact alarm 权限
      const canSchedule = await checkExactAlarmPermission()
      if (!canSchedule) {
        throw new Error("需要「闹钟和提醒」权限才能设置定时提醒，请在系统设置中开启")
      }
      await plugin.scheduleReminderAlarm({
        id: params.id,
        title: "RemindME",
        body: params.body,
        fireAt,
        soundName: getRawSoundName(),
      })
      return params.id
    }
  }

  // iOS / fallback: LocalNotifications
  const sound = getNotificationSound()
  await LocalNotifications.schedule({
    notifications: [
      {
        title: "RemindME",
        body: params.body,
        id: params.id,
        schedule: { at: new Date(fireAt) },
        ...(sound ? { sound } : {}),
      },
    ],
  })
  return params.id
}

/** 调度重复提醒 — 为每个 weekday 生成独立通知，返回所有通知 ID 数组 */
export async function scheduleRepeatReminders(params: RepeatReminderParams): Promise<number[]> {
  const { hour, minute } = parseTime(params.repeatTime)
  const platform = Capacitor.getPlatform()
  const sound = getNotificationSound()
  const ids: number[] = []

  // 通知权限
  await LocalNotifications.requestPermissions().catch(() => {})

  // Android: 预排未来 30 天内所有匹配 weekday 的提醒
  if (platform === "android") {
    const plugin = getNativePlugin()
    if (plugin) {
      const canSchedule = await checkExactAlarmPermission()
      if (!canSchedule) {
        throw new Error("需要「闹钟和提醒」权限才能设置定时提醒，请在系统设置中开启")
      }
      // 从今天开始，预排未来 30 天
      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const d = new Date()
        d.setHours(hour, minute, 0, 0)
        d.setDate(d.getDate() + dayOffset)
        const jsDay = d.getDay()
        const capacitorDay = jsDay === 0 ? 1 : jsDay + 1
        if (!params.weekdays.includes(capacitorDay)) continue
        // 跳过已过去的时间
        if (dayOffset === 0 && d.getTime() <= Date.now()) continue

        const nid = makeNotificationId()
        try {
          await plugin.scheduleReminderAlarm({
            id: nid,
            title: "RemindME",
            body: params.body,
            fireAt: d.getTime(),
            soundName: getRawSoundName(),
          })
          ids.push(nid)
        } catch {
          // 单个失败不阻断其他
        }
      }
      if (ids.length === 0) {
        throw new Error("重复提醒注册失败，请检查闹钟权限")
      }
      return ids
    }
  }

  // iOS / fallback: 为每个 weekday 创建独立 LocalNotification
  const notifications = params.weekdays.map((wd) => {
    const nid = makeNotificationId()
    ids.push(nid)
    return {
      title: "RemindME",
      body: params.body,
      id: nid,
      schedule: { on: { weekday: wd, hour, minute } },
      ...(sound ? { sound } : {}),
    }
  })

  await LocalNotifications.requestPermissions()
  await LocalNotifications.schedule({ notifications })
  return ids
}

/** 取消单个提醒 */
export async function cancelReminder(id: number): Promise<void> {
  const platform = Capacitor.getPlatform()

  if (platform === "android") {
    const plugin = getNativePlugin()
    if (plugin) {
      await plugin.cancelReminderAlarm({ id })
      return
    }
  }

  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {})
}

/** 批量取消提醒 */
export async function cancelReminders(ids: number[]): Promise<void> {
  const platform = Capacitor.getPlatform()

  if (platform === "android") {
    const plugin = getNativePlugin()
    if (plugin) {
      for (const id of ids) {
        try { await plugin.cancelReminderAlarm({ id }) } catch {}
      }
      return
    }
  }

  await LocalNotifications.cancel({
    notifications: ids.map((id) => ({ id })),
  }).catch(() => {})
}

/** 停止当前响铃 */
export async function stopCurrentRinging(): Promise<void> {
  const platform = Capacitor.getPlatform()
  if (platform === "android") {
    const plugin = getNativePlugin()
    if (plugin) {
      await plugin.stopRinging()
    }
  }
}

/** 检查 exact alarm 权限 */
export async function checkExactAlarmPermission(): Promise<boolean> {
  const platform = Capacitor.getPlatform()
  if (platform !== "android") return true
  const plugin = getNativePlugin()
  if (!plugin) return true
  try {
    const result = await plugin.canScheduleExactAlarms()
    return result.canSchedule
  } catch {
    return true
  }
}

/** 跳转系统 exact alarm 设置 */
export async function openExactAlarmSettings(): Promise<void> {
  const plugin = getNativePlugin()
  if (plugin) {
    await plugin.openExactAlarmSettings()
  }
}
