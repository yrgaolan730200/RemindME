package com.yangrui.remindme.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class ReminderAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "ReminderAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        int reminderId = intent.getIntExtra("reminder_id", 0);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String soundName = intent.getStringExtra("sound_name");

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
            Log.e(TAG, "Cannot start foreground service (app in background?) — reminderId=" + reminderId
                + ", sdk=" + Build.VERSION.SDK_INT, e);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start ringing service — reminderId=" + reminderId
                + ", soundName=" + soundName + ", sdk=" + Build.VERSION.SDK_INT, e);
        }
    }
}
