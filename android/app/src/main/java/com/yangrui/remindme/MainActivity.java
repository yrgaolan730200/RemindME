package com.yangrui.remindme;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.yangrui.remindme.alarm.ReminderAlarmPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReminderAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
