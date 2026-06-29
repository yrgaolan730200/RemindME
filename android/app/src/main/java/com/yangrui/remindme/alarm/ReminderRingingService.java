package com.yangrui.remindme.alarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;

public class ReminderRingingService extends Service {

    public static final String CHANNEL_ID = "reminder_ringing_v1";
    public static final String ACTION_START_RINGING = "com.yangrui.remindme.START_RINGING";
    public static final String ACTION_STOP_RINGING = "com.yangrui.remindme.STOP_RINGING";

    private static final int NOTIFICATION_ID = 9801;
    private static final long AUTO_STOP_MS = 30_000;

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private Handler handler;
    private int reminderId;

    private final Runnable autoStopRunnable = new Runnable() {
        @Override
        public void run() {
            stopRingingAndSelf();
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_STOP_RINGING.equals(intent.getAction())) {
            stopRingingAndSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_START_RINGING.equals(intent.getAction())) {
            reminderId = intent.getIntExtra("reminder_id", 0);
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            String soundName = intent.getStringExtra("sound_name");
            startRinging(reminderId, title, body, soundName);
        }

        return START_NOT_STICKY;
    }

    private void startRinging(int id, String title, String body, String soundName) {
        // Start foreground
        Notification notification = buildNotification(id, title, body);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        // Start media player
        startMediaPlayer(soundName);

        // Start vibration
        startVibration();

        // Auto-stop after 30 seconds
        handler.postDelayed(autoStopRunnable, AUTO_STOP_MS);
    }

    private void startMediaPlayer(String soundName) {
        try {
            int resId = getResources().getIdentifier(soundName, "raw", getPackageName());
            if (resId == 0) {
                resId = getResources().getIdentifier("alarm", "raw", getPackageName());
            }
            if (resId == 0) return;

            mediaPlayer = MediaPlayer.create(this, resId);
            if (mediaPlayer == null) return;

            mediaPlayer.setLooping(true);

            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
            mediaPlayer.setAudioAttributes(attrs);

            mediaPlayer.start();
        } catch (Exception e) {
            // MediaPlayer failed — log and continue without sound
            e.printStackTrace();
        }
    }

    private void startVibration() {
        if (vibrator == null || !vibrator.hasVibrator()) return;
        try {
            long[] pattern = new long[]{0, 700, 400, 700, 400};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                VibrationEffect effect = VibrationEffect.createWaveform(pattern, 0);
                vibrator.vibrate(effect);
            } else {
                vibrator.vibrate(pattern, 0);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private Notification buildNotification(int id, String title, String body) {
        // Stop action
        Intent stopIntent = new Intent(this, ReminderStopReceiver.class);
        stopIntent.setAction(ACTION_STOP_RINGING);
        stopIntent.putExtra("reminder_id", id);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent stopPendingIntent = PendingIntent.getBroadcast(
            this, id + 10000, stopIntent, flags
        );

        // Delete intent (swipe to dismiss)
        Intent deleteIntent = new Intent(this, ReminderStopReceiver.class);
        deleteIntent.setAction(ACTION_STOP_RINGING);
        deleteIntent.putExtra("reminder_id", id);
        PendingIntent deletePendingIntent = PendingIntent.getBroadcast(
            this, id + 20000, deleteIntent, flags
        );

        // Content intent (tap notification → stop ringing + open app)
        Intent contentIntent = new Intent(this, ReminderStopReceiver.class);
        contentIntent.setAction(ACTION_STOP_RINGING);
        contentIntent.putExtra("reminder_id", id);
        contentIntent.putExtra("launch_app", true);
        PendingIntent contentPendingIntent = PendingIntent.getBroadcast(
            this, id + 30000, contentIntent, flags
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getResources().getIdentifier("ic_launcher", "mipmap", getPackageName()))
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(false)
            .setAutoCancel(true)
            .setDeleteIntent(deletePendingIntent)
            .setContentIntent(contentPendingIntent)
            .addAction(android.R.drawable.ic_media_pause, "停止", stopPendingIntent);

        return builder.build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "RemindME 提醒响铃",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("待办提醒正在响铃 — 长响铃直到用户处理或 30 秒超时");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 700, 400, 700, 400});
            channel.setSound(null, null); // Sound controlled by MediaPlayer
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void stopRingingAndSelf() {
        // Remove the auto-stop callback
        if (handler != null) {
            handler.removeCallbacks(autoStopRunnable);
        }

        // Stop and release MediaPlayer
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception e) {
                e.printStackTrace();
            }
            mediaPlayer = null;
        }

        // Cancel vibration
        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        // Remove foreground notification
        stopForeground(true);

        // Also cancel the notification
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(NOTIFICATION_ID);
        }

        stopSelf();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopRingingAndSelf();
        super.onDestroy();
    }
}
