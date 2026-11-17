package com.lite.yt480;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.util.TypedValue;
import android.view.InputDevice;
import android.view.KeyCharacterMap;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    // Đặt false nếu không muốn app tự dọn các tiến trình nền của ứng dụng khác khi mở
    private static final boolean CLEAN_BACKGROUND = true;

    private static final String HOME = "https://m.youtube.com/";
    private static final String[] ALLOWED = {
            "youtube.com", "youtu.be", "google.com", "gstatic.com",
            "googlevideo.com", "ytimg.com", "googleusercontent.com", "ggpht.com"
    };

    // Chất lượng: tên hiển thị và tên nội bộ của YouTube (mặc định 1080p)
    private static final String[] Q_NAMES = {"360p", "480p", "720p", "1080p"};
    private static final String[] Q_VALS = {"medium", "large", "hd720", "hd1080"};
    private static final int DEFAULT_Q = 3;
    // Cỡ chữ của trang (%)
    private static final int[] ZOOMS = {100, 125, 150, 175, 200};

    private static final int YELLOW = 0xFFFFD400;

    private SharedPreferences prefs;
    private FrameLayout root;
    private LinearLayout column;
    private LinearLayout bar;
    private EditText input;
    private WebView web;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private AlertDialog settings;
    private String injectJs = "";
    private long lastSearch = 0;
    // true khi người dùng đang gõ chữ trong một ô nhập của trang web (khi đó không chiếm phím mũi tên/OK)
    private volatile boolean webTyping = false;

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    /** Cầu nối để JavaScript trong trang gọi về app. Chỉ có 2 hàm, không làm gì nguy hiểm. */
    private class Bridge {
        @JavascriptInterface
        public void focusBar() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    input.requestFocus();
                }
            });
        }

        @JavascriptInterface
        public void typing(boolean t) {
            webTyping = t;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("yt480", MODE_PRIVATE);
        injectJs = readAsset("inject.js");

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);

        // ----- Thanh trên cùng: ô tìm kiếm + các nút (đều chọn được bằng remote) -----
        bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setBackgroundColor(0xFF181818);
        bar.setPadding(dp(24), dp(10), dp(24), dp(10));

        input = new EditText(this);
        input.setHint("Tìm video trên YouTube... (bấm OK để gõ)");
        input.setHintTextColor(0xFF9E9E9E);
        input.setTextColor(Color.WHITE);
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT);
        // Không dùng chế độ bàn phím toàn màn hình (extract UI) để bàn phím gọn, chỉ chiếm phần dưới
        input.setImeOptions(EditorInfo.IME_ACTION_SEARCH
                | EditorInfo.IME_FLAG_NO_EXTRACT_UI
                | EditorInfo.IME_FLAG_NO_FULLSCREEN);
        input.setPadding(dp(14), dp(6), dp(14), dp(6));
        input.setBackground(inputBg());
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(0, dp(52), 1f);
        bar.addView(input, ip);

        Button go = makeButton("Tìm");
        Button home = makeButton("Trang chủ");
        Button set = makeButton("Cài đặt");
        bar.addView(go, btnParams());
        bar.addView(home, btnParams());
        bar.addView(set, btnParams());

        column.addView(bar, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        column.addView(web, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        root.addView(column, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        setupWebView();

        go.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                doSearch();
            }
        });
        home.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                web.loadUrl(HOME);
                focusWeb();
            }
        });
        set.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSettings();
            }
        });
        input.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, KeyEvent e) {
                boolean enter = e != null && e.getKeyCode() == KeyEvent.KEYCODE_ENTER
                        && e.getAction() == KeyEvent.ACTION_DOWN;
                if (actionId == EditorInfo.IME_ACTION_SEARCH || enter) {
                    doSearch();
                    return true;
                }
                return false;
            }
        });
        input.setOnKeyListener(new View.OnKeyListener() {
            @Override
            public boolean onKey(View v, int code, KeyEvent ev) {
                boolean down = ev.getAction() == KeyEvent.ACTION_DOWN;
                if (code == KeyEvent.KEYCODE_DPAD_RIGHT) {
                    // bàn phím đang ẩn thì mũi tên phải chuyển sang nút kế bên
                    if (down) {
                        View n = v.focusSearch(View.FOCUS_RIGHT);
                        if (n != null) n.requestFocus();
                    }
                    return true;
                }
                if (code == KeyEvent.KEYCODE_DPAD_CENTER) {
                    if (down) showIme();
                    return true;
                }
                if (code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_NUMPAD_ENTER) {
                    if (down) {
                        if (input.getText().length() > 0 && isTypingKeyboard(ev)) doSearch();
                        else showIme();
                    }
                    return true;
                }
                return false;
            }
        });

        applyZoom();
        forceDarkCookie();
        if (CLEAN_BACKGROUND) cleanBackground();
        web.loadUrl(HOME);
        web.requestFocus();
    }

    // ---------- Giao diện thanh trên ----------

    private GradientDrawable box(int fill, int stroke, int strokePx) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(6));
        if (strokePx > 0) g.setStroke(strokePx, stroke);
        return g;
    }

    private StateListDrawable inputBg() {
        StateListDrawable sl = new StateListDrawable();
        sl.addState(new int[]{android.R.attr.state_focused}, box(0xFF303030, YELLOW, dp(3)));
        sl.addState(new int[]{}, box(0xFF282828, 0xFF555555, dp(1)));
        return sl;
    }

    private StateListDrawable buttonBg() {
        StateListDrawable sl = new StateListDrawable();
        sl.addState(new int[]{android.R.attr.state_focused}, box(YELLOW, YELLOW, 0));
        sl.addState(new int[]{android.R.attr.state_pressed}, box(YELLOW, YELLOW, 0));
        sl.addState(new int[]{}, box(0xFF3A3A3A, 0xFF555555, dp(1)));
        return sl;
    }

    private Button makeButton(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        b.setPadding(dp(18), dp(6), dp(18), dp(6));
        b.setBackground(buttonBg());
        b.setTextColor(new ColorStateList(
                new int[][]{{android.R.attr.state_focused}, {android.R.attr.state_pressed}, {}},
                new int[]{Color.BLACK, Color.BLACK, Color.WHITE}));
        b.setFocusable(true);
        return b;
    }

    private LinearLayout.LayoutParams btnParams() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, dp(52));
        p.leftMargin = dp(10);
        return p;
    }

    // ---------- Giao diện tối ----------

    /** Đặt cookie PREF của YouTube để luôn dùng giao diện tối (f6=400). */
    private void forceDarkCookie() {
        try {
            CookieManager cm = CookieManager.getInstance();
            cm.setAcceptCookie(true);
            String all = cm.getCookie("https://m.youtube.com");
            String pref = "";
            if (all != null) {
                for (String part : all.split(";")) {
                    part = part.trim();
                    if (part.startsWith("PREF=")) pref = part.substring(5);
                }
            }
            StringBuilder sb = new StringBuilder();
            boolean found = false;
            if (pref.length() > 0) {
                for (String kv : pref.split("&")) {
                    if (kv.length() == 0) continue;
                    if (sb.length() > 0) sb.append('&');
                    if (kv.startsWith("f6=")) {
                        sb.append("f6=400");
                        found = true;
                    } else {
                        sb.append(kv);
                    }
                }
            }
            if (!found) {
                if (sb.length() > 0) sb.append('&');
                sb.append("f6=400");
            }
            cm.setCookie("https://www.youtube.com",
                    "PREF=" + sb + "; Domain=.youtube.com; Path=/; Max-Age=31536000; Secure");
            cm.flush();
        } catch (Exception ignored) {
        }
    }

    // ---------- Cài đặt ----------

    private int qIdx() {
        int i = prefs.getInt("q", DEFAULT_Q);
        return (i < 0 || i >= Q_VALS.length) ? DEFAULT_Q : i;
    }

    private int zIdx() {
        int i = prefs.getInt("z", 0);
        return (i < 0 || i >= ZOOMS.length) ? 0 : i;
    }

    private String cfgJs() {
        return "window.__YT480_CFG={q:'" + Q_VALS[qIdx()] + "'"
                + ",shorts:" + prefs.getBoolean("shorts", true)
                + ",comments:" + prefs.getBoolean("comments", true)
                + ",home:" + prefs.getBoolean("home", false)
                + ",autoNext:" + prefs.getBoolean("autonext", false)
                + "};";
    }

    private void pushCfg() {
        web.evaluateJavascript(cfgJs()
                + "window.__yt480api&&window.__yt480api.setCfg(window.__YT480_CFG);", null);
    }

    private void applyZoom() {
        web.getSettings().setTextZoom(ZOOMS[zIdx()]);
    }

    private String onOff(String key, boolean def) {
        return prefs.getBoolean(key, def) ? "Bật" : "Tắt";
    }

    private ArrayList<String> labels() {
        ArrayList<String> l = new ArrayList<String>();
        l.add("Chất lượng video: " + Q_NAMES[qIdx()]);
        l.add("Cỡ chữ: " + ZOOMS[zIdx()] + "%");
        l.add("Ẩn Shorts: " + onOff("shorts", true));
        l.add("Ẩn bình luận: " + onOff("comments", true));
        l.add("Ẩn video đề xuất ở trang chủ: " + onOff("home", false));
        l.add("Tự phát video kế tiếp: " + onOff("autonext", false));
        l.add("Thoát ứng dụng");
        return l;
    }

    private void toggle(String key, boolean def) {
        prefs.edit().putBoolean(key, !prefs.getBoolean(key, def)).apply();
    }

    private void onSettingClick(int pos) {
        switch (pos) {
            case 0:
                prefs.edit().putInt("q", (qIdx() + 1) % Q_VALS.length).apply();
                break;
            case 1:
                prefs.edit().putInt("z", (zIdx() + 1) % ZOOMS.length).apply();
                applyZoom();
                break;
            case 2:
                toggle("shorts", true);
                break;
            case 3:
                toggle("comments", true);
                break;
            case 4:
                toggle("home", false);
                break;
            case 5:
                toggle("autonext", false);
                break;
            case 6:
                finish();
                return;
            default:
                return;
        }
        pushCfg();
    }

    private void showSettings() {
        if (settings != null && settings.isShowing()) return;
        final ListView lv = new ListView(this);
        final ArrayAdapter<String> ad = new ArrayAdapter<String>(
                this, android.R.layout.simple_list_item_1, labels());
        lv.setAdapter(ad);
        lv.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view, int pos, long id) {
                onSettingClick(pos);
                ad.clear();
                ad.addAll(labels());
                lv.setSelection(pos);
            }
        });
        AlertDialog.Builder b = new AlertDialog.Builder(this, AlertDialog.THEME_DEVICE_DEFAULT_DARK);
        b.setTitle("Cài đặt");
        b.setView(lv);
        b.setPositiveButton("Đóng", null);
        settings = b.create();
        settings.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override
            public void onDismiss(DialogInterface d) {
                web.requestFocus();
            }
        });
        settings.show();
        lv.requestFocus();
    }

    // ---------- Phím remote ----------

    private String dpadName(int k) {
        switch (k) {
            case KeyEvent.KEYCODE_DPAD_UP:
                return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN:
                return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT:
                return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                return "right";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A:
                return "ok";
            default:
                return null;
        }
    }

    private String mediaKeyName(int k) {
        switch (k) {
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                return "playpause";
            case KeyEvent.KEYCODE_MEDIA_PLAY:
                return "play";
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
                return "pause";
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
                return "ff";
            case KeyEvent.KEYCODE_MEDIA_REWIND:
                return "rw";
            default:
                return null;
        }
    }

    private void sendKey(String name, int repeat) {
        web.evaluateJavascript("window.__yt480api&&window.__yt480api.key('"
                + name + "'," + repeat + ")", null);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        boolean down = e.getAction() == KeyEvent.ACTION_DOWN;

        // Nút MENU trên remote: mở cài đặt
        if (k == KeyEvent.KEYCODE_MENU) {
            if (down && e.getRepeatCount() == 0) showSettings();
            return true;
        }
        if (customView != null) return super.dispatchKeyEvent(e);

        // Phím media của remote
        String m = mediaKeyName(k);
        if (m != null) {
            if (down) sendKey(m, e.getRepeatCount());
            return true;
        }

        // Đang ở thanh trên: dùng điều hướng mặc định của Android, riêng mũi tên xuống thì vào trang
        if (bar.findFocus() != null) {
            if (k == KeyEvent.KEYCODE_DPAD_DOWN) {
                if (down) focusWeb();
                return true;
            }
            return super.dispatchKeyEvent(e);
        }

        // Đang ở trang web: tự xử lý mũi tên/OK để chọn video bằng remote
        if (!webTyping) {
            String n = dpadName(k);
            if (n != null) {
                if (down) sendKey(n, e.getRepeatCount());
                return true;
            }
        }
        return super.dispatchKeyEvent(e);
    }

    private boolean isTypingKeyboard(KeyEvent ev) {
        if (ev.getDeviceId() == KeyCharacterMap.VIRTUAL_KEYBOARD) return true;
        InputDevice d = ev.getDevice();
        return d != null && d.getKeyboardType() == InputDevice.KEYBOARD_TYPE_ALPHABETIC;
    }

    private void showIme() {
        input.requestFocus();
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) imm.showSoftInput(input, 0);
    }

    private void hideIme() {
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) imm.hideSoftInputFromWindow(input.getWindowToken(), 0);
    }

    private void focusWeb() {
        hideIme();
        web.requestFocus();
        web.evaluateJavascript("window.__yt480api&&window.__yt480api.enter()", null);
    }

    // ---------- Dọn nền ----------

    /**
     * Giải phóng RAM: yêu cầu hệ thống tắt tiến trình nền của các ứng dụng cài thêm.
     * Bỏ qua: chính app này, ứng dụng hệ thống, bàn phím đang dùng và màn hình chính.
     * Android có thể tự khởi động lại một số app, nên hiệu quả mang tính tạm thời.
     */
    private void cleanBackground() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
                    PackageManager pm = getPackageManager();
                    String self = getPackageName();

                    String ime = "";
                    try {
                        String cur = Settings.Secure.getString(getContentResolver(),
                                Settings.Secure.DEFAULT_INPUT_METHOD);
                        if (cur != null) ime = cur.split("/")[0];
                    } catch (Exception ignored) {
                    }

                    String launcher = "";
                    try {
                        Intent h = new Intent(Intent.ACTION_MAIN);
                        h.addCategory(Intent.CATEGORY_HOME);
                        ResolveInfo ri = pm.resolveActivity(h, PackageManager.MATCH_DEFAULT_ONLY);
                        if (ri != null && ri.activityInfo != null) launcher = ri.activityInfo.packageName;
                    } catch (Exception ignored) {
                    }

                    List<ApplicationInfo> apps = pm.getInstalledApplications(0);
                    for (ApplicationInfo a : apps) {
                        if ((a.flags & ApplicationInfo.FLAG_SYSTEM) != 0) continue;
                        String p = a.packageName;
                        if (p.equals(self) || p.equals(ime) || p.equals(launcher)) continue;
                        am.killBackgroundProcesses(p);
                    }
                } catch (Exception ignored) {
                }
            }
        }).start();
    }

    // ---------- WebView ----------

    private void setupWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setSaveFormData(false);
        s.setGeolocationEnabled(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.addJavascriptInterface(new Bridge(), "YT480");

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !allowed(url); // chặn chuyển sang trang/ứng dụng ngoài
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                inject();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                inject();
                // Tải trang xong mà đang ở vùng web thì tự chọn sẵn video đầu tiên
                if (web.hasFocus()) {
                    web.evaluateJavascript(
                            "window.__yt480api&&window.__yt480api.autoFocus()", null);
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customCallback = callback;
                column.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                enterImmersive();
            }

            @Override
            public void onHideCustomView() {
                hideCustom();
            }

            @Override
            public Bitmap getDefaultVideoPoster() {
                return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
            }
        });
    }

    private boolean allowed(String url) {
        try {
            Uri u = Uri.parse(url);
            String scheme = u.getScheme();
            String host = u.getHost();
            if (scheme == null || host == null) return false;
            if (!scheme.equals("http") && !scheme.equals("https")) return false;
            host = host.toLowerCase();
            for (String a : ALLOWED) {
                if (host.equals(a) || host.endsWith("." + a)) return true;
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private void inject() {
        if (injectJs.length() > 0) web.evaluateJavascript(cfgJs() + injectJs, null);
    }

    private String readAsset(String name) {
        try {
            InputStream in = getAssets().open(name);
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            in.close();
            return bo.toString("UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

    private void doSearch() {
        String q = input.getText().toString().trim();
        if (q.length() == 0) return;
        long now = System.currentTimeMillis();
        if (now - lastSearch < 700) return; // tránh tìm hai lần do bàn phím gửi cả Enter lẫn Search
        lastSearch = now;
        hideIme();
        try {
            web.loadUrl(HOME + "results?search_query=" + URLEncoder.encode(q, "UTF-8"));
        } catch (Exception ignored) {
        }
        web.requestFocus();
    }

    private void enterImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    private void hideCustom() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        column.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        if (customCallback != null) {
            customCallback.onCustomViewHidden();
            customCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            hideCustom();
        } else if (webTyping) {
            // đang gõ trong ô nhập của trang: Back chỉ thoát khỏi ô nhập
            webTyping = false;
            web.evaluateJavascript(
                    "document.activeElement&&document.activeElement.blur&&document.activeElement.blur()", null);
        } else if (web.canGoBack()) {
            web.goBack();
        } else {
            finish();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
