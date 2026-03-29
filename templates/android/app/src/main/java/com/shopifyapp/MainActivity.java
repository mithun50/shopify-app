package {{PACKAGE_NAME}};

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.util.Collections;

public class MainActivity extends AppCompatActivity {

    private static final String STORE_URL = "{{STORE_URL}}";

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefresh;
    private View offlineView;
    private ValueCallback<Uri[]> fileUploadCallback;

    private final ActivityResultLauncher<String> notificationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                // Permission result received; notifications will work if granted
            });

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (fileUploadCallback == null) return;
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    Uri[] results = null;
                    String dataString = result.getData().getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                    fileUploadCallback.onReceiveValue(results);
                } else {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = null;
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        offlineView = findViewById(R.id.offlineView);

        setupWebView();
        setupSwipeRefresh();
        setupNotifications();

        if (isNetworkAvailable()) {
            webView.loadUrl(STORE_URL);
        } else {
            showOfflineView();
        }

        // Handle deep links or notification URLs
        handleIntent(getIntent());
    }

    private void setupNotifications() {
        NotificationHelper.createNotificationChannel(this);

        // Request POST_NOTIFICATIONS permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (!NotificationHelper.hasNotificationPermission(this)) {
                notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        // Schedule "Welcome back" local notification for 24 hours from now
        long triggerAt = System.currentTimeMillis() + (24 * 60 * 60 * 1000);
        NotificationHelper.scheduleLocalNotification(this,
                getString(R.string.app_name),
                "Welcome back! Check out new arrivals and deals.",
                triggerAt, 1001);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // Use a standard Chrome user agent to prevent sites from blocking WebView
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        );

        // Enable cookies
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
                offlineView.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showOfflineView();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String host = request.getUrl().getHost();
                if (host == null) return false;

                Uri storeUri = Uri.parse(STORE_URL);

                // Keep app domain and subdomains inside WebView
                if (host.equals(storeUri.getHost()) || host.endsWith("." + storeUri.getHost())) return false;

                // Shopify CDN / assets — stay in WebView
                if (host.endsWith(".shopify.com") || host.endsWith(".shopifycdn.com") || host.endsWith(".myshopify.com")) return false;

                // Auth providers — open in Chrome Custom Tabs so OAuth (Google, Apple, etc.) works
                // Google blocks sign-in inside WebView; Custom Tabs use the real Chrome engine
                if (host.equals("accounts.google.com") ||
                    host.endsWith(".accounts.google.com") ||
                    host.equals("google.com") ||
                    host.endsWith(".google.com") ||
                    host.endsWith(".firebaseapp.com") ||
                    host.endsWith(".firebaseio.com") ||
                    host.endsWith(".firebase.com") ||
                    host.endsWith(".googleapis.com") ||
                    host.equals("appleid.apple.com") ||
                    host.endsWith(".appleid.apple.com") ||
                    host.endsWith(".apple.com") ||
                    host.equals("login.microsoftonline.com") ||
                    host.endsWith(".microsoftonline.com") ||
                    host.endsWith(".live.com") ||
                    host.equals("github.com") ||
                    host.equals("api.github.com") ||
                    host.endsWith(".twitter.com") ||
                    host.endsWith(".x.com") ||
                    host.endsWith(".facebook.com") ||
                    host.endsWith(".auth0.com") ||
                    host.endsWith(".okta.com") ||
                    host.endsWith(".amazoncognito.com") ||
                    host.endsWith(".onelogin.com") ||
                    host.endsWith(".pingidentity.com")) {
                    openInCustomTab(request.getUrl());
                    return true;
                }

                // Payment gateways — open in Custom Tabs for full compatibility and security
                if (host.endsWith(".stripe.com") ||
                    host.endsWith(".paypal.com") ||
                    host.endsWith(".braintreegateway.com") ||
                    host.endsWith(".square.com") ||
                    host.endsWith(".razorpay.com") ||
                    host.endsWith(".payu.in") ||
                    host.endsWith(".ccavenue.com") ||
                    host.endsWith(".klarna.com") ||
                    host.endsWith(".afterpay.com") ||
                    host.endsWith(".affirm.com")) {
                    openInCustomTab(request.getUrl());
                    return true;
                }

                // Open all other external links in the default browser
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, request.getUrl());
                    startActivity(intent);
                } catch (Exception ignored) {}
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                             FileChooserParams fileChooserParams) {
                fileUploadCallback = callback;
                Intent intent = fileChooserParams.createIntent();
                fileChooserLauncher.launch(intent);
                return true;
            }
        });

        injectSessionStorageBridge();
    }

    // Inject sessionStorage persistence bridge BEFORE any page scripts run.
    // WebView isolates sessionStorage across redirect hops (unlike Chrome), which breaks
    // Firebase signInWithRedirect. This script backs sessionStorage with localStorage
    // so auth state survives the full redirect chain.
    private void injectSessionStorageBridge() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, getSessionStorageBridgeScript(),
                    Collections.singleton("*"));
        }
    }

    private String getSessionStorageBridgeScript() {
        return "(function() {" +
            "  try {" +
            "    var PREFIX = '__wv_ss__';" +
            "    var keys = [];" +
            "    for (var i = 0; i < localStorage.length; i++) {" +
            "      var k = localStorage.key(i);" +
            "      if (k && k.indexOf(PREFIX) === 0) keys.push(k);" +
            "    }" +
            "    keys.forEach(function(k) {" +
            "      var realKey = k.slice(PREFIX.length);" +
            "      var val = localStorage.getItem(k);" +
            "      if (val !== null) sessionStorage.setItem(realKey, val);" +
            "    });" +
            "    var _setItem = sessionStorage.setItem.bind(sessionStorage);" +
            "    sessionStorage.setItem = function(key, value) {" +
            "      try { localStorage.setItem(PREFIX + key, value); } catch(e) {}" +
            "      return _setItem(key, value);" +
            "    };" +
            "    var _getItem = sessionStorage.getItem.bind(sessionStorage);" +
            "    sessionStorage.getItem = function(key) {" +
            "      var v = _getItem(key);" +
            "      if (v === null) { try { v = localStorage.getItem(PREFIX + key); } catch(e) {} }" +
            "      return v;" +
            "    };" +
            "    var _removeItem = sessionStorage.removeItem.bind(sessionStorage);" +
            "    sessionStorage.removeItem = function(key) {" +
            "      try { localStorage.removeItem(PREFIX + key); } catch(e) {}" +
            "      return _removeItem(key);" +
            "    };" +
            "    var _clear = sessionStorage.clear.bind(sessionStorage);" +
            "    sessionStorage.clear = function() {" +
            "      try {" +
            "        var toRemove = [];" +
            "        for (var i = 0; i < localStorage.length; i++) {" +
            "          var k = localStorage.key(i);" +
            "          if (k && k.indexOf(PREFIX) === 0) toRemove.push(k);" +
            "        }" +
            "        toRemove.forEach(function(k) { localStorage.removeItem(k); });" +
            "      } catch(e) {}" +
            "      return _clear();" +
            "    };" +
            "  } catch(e) {}" +
            "})();";
    }

    private void openInCustomTab(Uri uri) {
        try {
            CustomTabsIntent customTab = new CustomTabsIntent.Builder()
                    .setShowTitle(true)
                    .build();
            customTab.launchUrl(this, uri);
        } catch (Exception e) {
            // Fallback to external browser if Custom Tabs not available
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {}
        }
    }

    private void setupSwipeRefresh() {
        swipeRefresh.setColorSchemeColors(
                android.graphics.Color.parseColor("{{THEME_COLOR}}")
        );
        swipeRefresh.setOnRefreshListener(() -> {
            if (isNetworkAvailable()) {
                webView.reload();
            } else {
                swipeRefresh.setRefreshing(false);
                showOfflineView();
            }
        });
    }

    private void showOfflineView() {
        offlineView.setVisibility(View.VISIBLE);
        webView.setVisibility(View.GONE);
        progressBar.setVisibility(View.GONE);
    }

    public void onRetryClick(View view) {
        if (isNetworkAvailable()) {
            offlineView.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            webView.loadUrl(STORE_URL);
        }
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnected();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        // Handle notification tap with URL
        String notificationUrl = intent.getStringExtra("notification_url");
        if (notificationUrl != null && !notificationUrl.isEmpty()) {
            webView.loadUrl(notificationUrl);
            return;
        }

        // Handle deep links
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri data = intent.getData();
            if (data != null) {
                webView.loadUrl(data.toString());
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
        CookieManager.getInstance().flush();
    }
}


public class MainActivity extends AppCompatActivity {

    private static final String STORE_URL = "{{STORE_URL}}";

    private WebView webView;
    private ProgressBar progressBar;
    private SwipeRefreshLayout swipeRefresh;
    private View offlineView;
    private ValueCallback<Uri[]> fileUploadCallback;

    private final ActivityResultLauncher<String> notificationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                // Permission result received; notifications will work if granted
            });

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (fileUploadCallback == null) return;
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    Uri[] results = null;
                    String dataString = result.getData().getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                    fileUploadCallback.onReceiveValue(results);
                } else {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = null;
            });

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        offlineView = findViewById(R.id.offlineView);

        setupWebView();
        setupSwipeRefresh();
        setupNotifications();

        if (isNetworkAvailable()) {
            webView.loadUrl(STORE_URL);
        } else {
            showOfflineView();
        }

        // Handle deep links or notification URLs
        handleIntent(getIntent());
    }

    private void setupNotifications() {
        NotificationHelper.createNotificationChannel(this);

        // Request POST_NOTIFICATIONS permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (!NotificationHelper.hasNotificationPermission(this)) {
                notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS);
            }
        }

        // Schedule "Welcome back" local notification for 24 hours from now
        long triggerAt = System.currentTimeMillis() + (24 * 60 * 60 * 1000);
        NotificationHelper.scheduleLocalNotification(this,
                getString(R.string.app_name),
                "Welcome back! Check out new arrivals and deals.",
                triggerAt, 1001);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " ShopifyApp/1.0");

        // Enable cookies
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
                offlineView.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showOfflineView();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                // Keep Shopify URLs in WebView
                Uri storeUri = Uri.parse(STORE_URL);
                if (request.getUrl().getHost() != null &&
                    (request.getUrl().getHost().equals(storeUri.getHost()) ||
                     request.getUrl().getHost().endsWith(".shopify.com") ||
                     request.getUrl().getHost().endsWith(".shopifycdn.com"))) {
                    return false;
                }

                // Open external links in browser
                Intent intent = new Intent(Intent.ACTION_VIEW, request.getUrl());
                startActivity(intent);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                             FileChooserParams fileChooserParams) {
                fileUploadCallback = callback;
                Intent intent = fileChooserParams.createIntent();
                fileChooserLauncher.launch(intent);
                return true;
            }
        });
    }

    // Inject sessionStorage persistence bridge BEFORE any page scripts run.
    // WebView isolates sessionStorage across redirect hops (unlike Chrome), which breaks
    // Firebase signInWithRedirect. This script backs sessionStorage with localStorage
    // so auth state survives the full redirect chain.
    private void injectSessionStorageBridge() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, getSessionStorageBridgeScript(),
                    Collections.singleton("*"));
        }
    }

    private String getSessionStorageBridgeScript() {
        return "(function() {" +
            "  try {" +
            "    var PREFIX = '__wv_ss__';" +
            // Restore previously saved sessionStorage keys from localStorage on every page load
            "    var keys = [];" +
            "    for (var i = 0; i < localStorage.length; i++) {" +
            "      var k = localStorage.key(i);" +
            "      if (k && k.indexOf(PREFIX) === 0) keys.push(k);" +
            "    }" +
            "    keys.forEach(function(k) {" +
            "      var realKey = k.slice(PREFIX.length);" +
            "      var val = localStorage.getItem(k);" +
            "      if (val !== null) sessionStorage.setItem(realKey, val);" +
            "    });" +
            // Override setItem — persist to localStorage as well
            "    var _setItem = sessionStorage.setItem.bind(sessionStorage);" +
            "    sessionStorage.setItem = function(key, value) {" +
            "      try { localStorage.setItem(PREFIX + key, value); } catch(e) {}" +
            "      return _setItem(key, value);" +
            "    };" +
            // Override getItem — fall back to localStorage if sessionStorage is empty
            "    var _getItem = sessionStorage.getItem.bind(sessionStorage);" +
            "    sessionStorage.getItem = function(key) {" +
            "      var v = _getItem(key);" +
            "      if (v === null) { try { v = localStorage.getItem(PREFIX + key); } catch(e) {} }" +
            "      return v;" +
            "    };" +
            // Override removeItem
            "    var _removeItem = sessionStorage.removeItem.bind(sessionStorage);" +
            "    sessionStorage.removeItem = function(key) {" +
            "      try { localStorage.removeItem(PREFIX + key); } catch(e) {}" +
            "      return _removeItem(key);" +
            "    };" +
            // Override clear — only remove our prefixed keys from localStorage
            "    var _clear = sessionStorage.clear.bind(sessionStorage);" +
            "    sessionStorage.clear = function() {" +
            "      try {" +
            "        var toRemove = [];" +
            "        for (var i = 0; i < localStorage.length; i++) {" +
            "          var k = localStorage.key(i);" +
            "          if (k && k.indexOf(PREFIX) === 0) toRemove.push(k);" +
            "        }" +
            "        toRemove.forEach(function(k) { localStorage.removeItem(k); });" +
            "      } catch(e) {}" +
            "      return _clear();" +
            "    };" +
            "  } catch(e) {}" +
            "})();";
    }

    private void setupSwipeRefresh() {
        swipeRefresh.setColorSchemeColors(
                android.graphics.Color.parseColor("{{THEME_COLOR}}")
        );
        swipeRefresh.setOnRefreshListener(() -> {
            if (isNetworkAvailable()) {
                webView.reload();
            } else {
                swipeRefresh.setRefreshing(false);
                showOfflineView();
            }
        });
    }

    private void showOfflineView() {
        offlineView.setVisibility(View.VISIBLE);
        webView.setVisibility(View.GONE);
        progressBar.setVisibility(View.GONE);
    }

    public void onRetryClick(View view) {
        if (isNetworkAvailable()) {
            offlineView.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            webView.loadUrl(STORE_URL);
        }
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
        return activeNetwork != null && activeNetwork.isConnected();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        // Handle notification tap with URL
        String notificationUrl = intent.getStringExtra("notification_url");
        if (notificationUrl != null && !notificationUrl.isEmpty()) {
            webView.loadUrl(notificationUrl);
            return;
        }

        // Handle deep links
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri data = intent.getData();
            if (data != null) {
                webView.loadUrl(data.toString());
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
        CookieManager.getInstance().flush();
    }
}
