// RemindME — 平台分治提醒调度（Android AlarmManager / iOS LocalNotifications / Web noop）

import { Capacitor } from "@capacitor/core"
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

function getNativePlugin(): ReminderAlarmNative | null {
  try {
    return (Capacitor as any).getPlatform() !== "web"
      ? (window as any).Capacitor?.getPlatform() !== undefined
        ? {
            scheduleReminderAlarm: (o: any) =>
              (window as any).Capacitor.Plugins.ReminderAlarm.scheduleReminderAlarm(o),
            cancelReminderAlarm: (o: any) =>
              (window as any).Capacitor.Plugins.ReminderAlarm.cancelReminderAlarm(o),
            stopRinging: () =>
              (window as any).Capacitor.Plugins.ReminderAlarm.stopRinging(),
            canScheduleExactAlarms: () =>
              (window as any).Capacitor.Plugins.ReminderAlarm.canScheduleExactAlarms(),
            openExactAlarmSettings: () =>
              (window as any).Capacitor.Plugins.ReminderAlarm.openExactAlarmSettings(),
          }
        : null
      : null
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
  dueDate: string
  dueTime: string
  weekdays: number[] // Capacitor weekday: 1=Sun, 2=Mon, …, 7=Sat
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

  // Android: 使用原生 AlarmManager 插件
  if (platform === "android") {
    const plugin = getNativePlugin()
    if (plugin) {
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
  await LocalNotifications.requestPermissions()
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
  const { hour, minute } = parseTime(params.dueTime)
  const platform = Capacitor.getPlatform()
  const sound = getNotificationSound()
  const ids: number[] = []

  // Android: 分别注册多个 AlarmManager 闹钟
  if (platform === "android") {
    const plugin = getNativePlugin()
    if (plugin) {
      for (const wd of params.weekdays) {
        const nid = makeNotificationId()
        // 使用第一个发生日作为 fireAt（近似），后续由 AlarmManager 负责
        const firstFire = nextFireDate(wd, hour, minute)
        try {
          await plugin.scheduleReminderAlarm({
            id: nid,
            title: "RemindME",
            body: params.body,
            fireAt: firstFire,
            soundName: getRawSoundName(),
          })
          ids.push(nid)
        } catch {
          // 单个失败不阻断其他
        }
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

/** 计算下一个指定 weekday+time 的时间戳（Android AlarmManager 用） */
function nextFireDate(weekday: number, hour: number, minute: number): number {
  const now = new Date()
  const target = new Date(now)
  target.setHours(hour, minute, 0, 0)

  // Capacitor weekday: 1=Sun…7=Sat; JS getDay(): 0=Sun…6=Sat
  const jsDay = weekday === 1 ? 0 : weekday - 1
  const currentDay = target.getDay()
  let daysUntil = jsDay - currentDay
  if (daysUntil < 0) daysUntil += 7
  if (daysUntil === 0 && target.getTime() <= now.getTime()) daysUntil = 7
  target.setDate(target.getDate() + daysUntil)
  return target.getTime()
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
