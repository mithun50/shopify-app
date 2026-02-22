package {{PACKAGE_NAME}};

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {

    private static final int SPLASH_DURATION = 1500;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Intent intent = new Intent(SplashActivity.this, MainActivity.class);
            // Forward any deep link intent
            if (getIntent().getData() != null) {
                intent.setData(getIntent().getData());
            }
            startActivity(intent);
            finish();
        }, SPLASH_DURATION);
    }
}
