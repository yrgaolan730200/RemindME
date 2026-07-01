package com.yangrui.remindme.alarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

import org.json.JSONArray;

public class ReminderAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "ReminderAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        int reminderId = intent.getIntExtra("reminder_id", 0);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String soundName = intent.getStringExtra("sound_name");
        boolean isRepeat = intent.getBooleanExtra("is_repeat", false);
        String skipDatesJson = intent.getStringExtra("skip_dates_json");

        // === 自动续排：重复提醒触发后，注册下一周同一天 ===
        if (isRepeat) {
            int repeatWeekday = intent.getIntExtra("repeat_weekday", 0);
            String repeatTime = intent.getStringExtra("repeat_time");
            rescheduleNextOccurrence(context, reminderId, title, body, soundName, repeatWeekday, repeatTime, skipDatesJson);
        }

        // === 启动响铃 Service ===
        Intent serviceIntent = new Intent(context, ReminderRingingService.class);
        serviceIntent.setAction(ReminderRingingService.ACTION_START_RINGING);
        serviceIntent.putExtra("reminder_id", reminderId);
        serviceIntent.putExtra("title", title);
        serviceIntent.putExtra("body", body);
        serviceIntent.putExtra("sound_name", soundName);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (SecurityException e) {
            Log.e(TAG, "Foreground service permission denied — reminderId=" + reminderId
                + ", soundName=" + soundName + ", sdk=" + Build.VERSION.SDK_INT, e);
        } catch (IllegalStateException e) {
            Log.e(TAG, "Cannot start foreground service — reminderId=" + reminderId
                + ", sdk=" + Build.VERSION.SDK_INT, e);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start ringing service — reminderId=" + reminderId
                + ", soundName=" + soundName + ", sdk=" + Build.VERSION.SDK_INT, e);
        }
    }

    /** 计算下一周同一天同一时间，跳过被用户删除的日期，并重新注册 AlarmManager */
    private void rescheduleNextOccurrence(Context context, int id, String title, String body,
                                          String soundName, int weekday, String repeatTime, String skipDatesJson) {
        if (weekday < 1 || weekday > 7) return;
        try {
            String[] parts = repeatTime.split(":");
            int hour = parts.length >= 1 ? Integer.parseInt(parts[0]) : 9;
            int minute = parts.length >= 2 ? Integer.parseInt(parts[1]) : 0;

            // 解析跳过的日期
            Set<String> skipSet = new HashSet<>();
            if (skipDatesJson != null && !skipDatesJson.isEmpty() && !"[]".equals(skipDatesJson)) {
                try {
                    JSONArray arr = new JSONArray(skipDatesJson);
                    for (int i = 0; i < arr.length(); i++) {
                        skipSet.add(arr.getString(i));
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed to parse skip_dates_json: " + skipDatesJson, e);
                }
            }

            Calendar next = Calendar.getInstance();
            next.set(Calendar.HOUR_OF_DAY, hour);
            next.set(Calendar.MINUTE, minute);
            next.set(Calendar.SECOND, 0);
            next.set(Calendar.MILLISECOND, 0);

            // Capacitor: 1=Sun…7=Sat; Java Calendar: 1=Sun…7=Sat — 一致
            int today = next.get(Calendar.DAY_OF_WEEK);
            int daysUntil = weekday - today;
            if (daysUntil < 0) daysUntil += 7;
            if (daysUntil == 0 && next.getTimeInMillis() <= System.currentTimeMillis()) daysUntil = 7;
            next.add(Calendar.DAY_OF_MONTH, daysUntil);

            // 如果被跳过，继续向后找下一周（最多 370 天避免死循环）
            int safety = 0;
            while (skipSet.contains(forDateKey(next)) && safety < 370) {
                next.add(Calendar.DAY_OF_MONTH, 7);
                safety++;
            }

            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent newIntent = new Intent(context, ReminderAlarmReceiver.class);
            newIntent.setAction("com.yangrui.remindme.ALARM_TRIGGER");
            newIntent.putExtra("reminder_id", id);
            newIntent.putExtra("title", title);
            newIntent.putExtra("body", body);
            newIntent.putExtra("sound_name", soundName);
            newIntent.putExtra("is_repeat", true);
            newIntent.putExtra("repeat_weekday", weekday);
            newIntent.putExtra("repeat_time", repeatTime);
            newIntent.putExtra("skip_dates_json", skipDatesJson);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getBroadcast(context, id, newIntent, flags);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
            }

            Log.d(TAG, "Repeat alarm rescheduled: reminderId=" + id
                + ", weekday=" + weekday + ", nextFireAt=" + next.getTime()
                + ", skipCount=" + safety);
        } catch (Exception e) {
            Log.e(TAG, "Failed to reschedule repeat alarm — reminderId=" + id, e);
        }
    }

    /** 生成 Calendar 对应的 YYYY-MM-DD 日期键 */
    private String forDateKey(Calendar c) {
        return String.format("%04d-%02d-%02d",
            c.get(Calendar.YEAR),
            c.get(Calendar.MONTH) + 1,
            c.get(Calendar.DAY_OF_MONTH));
    }
}
