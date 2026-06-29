package com.yangrui.remindme.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class ReminderStopReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // Stop the ringing service
        Intent stopIntent = new Intent(context, ReminderRingingService.class);
        stopIntent.setAction(ReminderRingingService.ACTION_STOP_RINGING);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(stopIntent);
            } else {
                context.startService(stopIntent);
            }
        } catch (Exception e) {
            // Ignore — service may already be stopped
        }

        // If triggered from notification tap, also open the app
        boolean launchApp = intent.getBooleanExtra("launch_app", false);
        if (launchApp) {
            Intent appIntent = new Intent(context, com.yangrui.remindme.MainActivity.class);
            appIntent.setAction(Intent.ACTION_MAIN);
            appIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            appIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(appIntent);
        }
    }
}
