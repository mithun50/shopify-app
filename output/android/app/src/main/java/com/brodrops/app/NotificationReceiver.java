package com.brodrops.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class NotificationReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String title = intent.getStringExtra("title");
        String message = intent.getStringExtra("message");

        if (title == null) title = "BroDrops";
        if (message == null) message = "Check out what's new!";

        NotificationHelper.createNotificationChannel(context);
        NotificationHelper.showNotification(context, title, message, null);
    }
}
