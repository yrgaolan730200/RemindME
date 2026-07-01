package com.yangrui.remindme.alarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ReminderAlarm")
public class ReminderAlarmPlugin extends Plugin {

    @PluginMethod
    public void scheduleReminderAlarm(PluginCall call) {
        int id = call.getInt("id");
        String title = call.getString("title", "RemindME");
        String body = call.getString("body", "");
        long fireAt = call.getLong("fireAt");
        String soundName = call.getString("soundName", "alarm");
        boolean isRepeat = Boolean.TRUE.equals(call.getBoolean("isRepeat"));
        int repeatWeekday = call.getInt("repeatWeekday", 0);
        String repeatTime = call.getString("repeatTime", "");
        String skipDatesJson = call.getString("skipDatesJson", "[]");

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            call.reject("AlarmManager not available");
            return;
        }

        Intent intent = new Intent(context, ReminderAlarmReceiver.class);
        intent.setAction("com.yangrui.remindme.ALARM_TRIGGER");
        intent.putExtra("reminder_id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("sound_name", soundName);
        intent.putExtra("is_repeat", isRepeat);
        intent.putExtra("repeat_weekday", repeatWeekday);
        intent.putExtra("repeat_time", repeatTime);
        intent.putExtra("skip_dates_json", skipDatesJson);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, id, intent, flags
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, fireAt, pendingIntent);
            }
            JSObject result = new JSObject();
            result.put("scheduled", true);
            result.put("id", id);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to schedule alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelReminderAlarm(PluginCall call) {
        int id = call.getInt("id");

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            call.reject("AlarmManager not available");
            return;
        }

        Intent intent = new Intent(context, ReminderAlarmReceiver.class);
        intent.setAction("com.yangrui.remindme.ALARM_TRIGGER");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context, id, intent, flags
        );
        alarmManager.cancel(pendingIntent);
        pendingIntent.cancel();

        // Also stop ringing if currently active
        Intent stopIntent = new Intent(context, ReminderRingingService.class);
        stopIntent.setAction(ReminderRingingService.ACTION_STOP_RINGING);
        stopIntent.putExtra("reminder_id", id);
        context.startForegroundService(stopIntent);

        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, ReminderRingingService.class);
        intent.setAction(ReminderRingingService.ACTION_STOP_RINGING);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        boolean canSchedule = false;
        if (alarmManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                canSchedule = alarmManager.canScheduleExactAlarms();
            } else {
                canSchedule = true;
            }
        }
        JSObject result = new JSObject();
        result.put("canSchedule", canSchedule);
        call.resolve(result);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(android.net.Uri.parse("package:" + context.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        }
        call.resolve();
    }
}
