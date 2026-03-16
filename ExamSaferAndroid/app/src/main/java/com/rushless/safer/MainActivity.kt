package com.rushless.safer

import android.content.IntentFilter
import android.os.BatteryManager
import android.content.BroadcastReceiver
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.webkit.*
import android.widget.Toast
import android.app.ActivityManager
import android.view.WindowManager
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Button as AndroidButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.OnBackPressedCallback
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.rushless.safer.ui.theme.MyApplicationTheme
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextField
import androidx.compose.material3.Button
import androidx.compose.material3.TextButton
import androidx.compose.ui.text.input.PasswordVisualTransformation

class MainActivity : ComponentActivity() {

    private var volumeUpCount = 0
    private var volumeDownCount = 0
    private var lastKeyTime = 0L
    private val SEQUENCE_TIMEOUT = 2000L // 2 seconds between presses
    
    // State to track if we are in exam mode
    internal var examMode = mutableStateOf(false)
    private var targetUrl = mutableStateOf("")
    private var showExitDialog = mutableStateOf(false)
    private var emergencyPassword = mutableStateOf("")
    private var lastLockAttemptTime = 0L
    private var overlayView: View? = null
    private var bottomOverlayView: View? = null
    private var hasOverlayPermission = mutableStateOf(false)
    private var showSetupWizard = mutableStateOf(false)
    private var showViolationWarning = mutableStateOf(false) // New state
    private var violationDetected = false // Internal flag
    private var isWaitingForFirstPin = false // New flag to suppress initial warning
    private var batteryLevel = mutableStateOf(100)
    private var isCharging = mutableStateOf(false)

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.let {
                val level = it.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = it.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                batteryLevel.value = (level * 100 / scale.toFloat()).toInt()
                
                val status = it.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
                isCharging.value = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                                   status == BatteryManager.BATTERY_STATUS_FULL
            }
        }
    }

    private val lockdownHandler = Handler(Looper.getMainLooper())
    private val lockdownCheckRunnable = object : Runnable {
        override fun run() {
            if (examMode.value) {
                enforceLockdown()
            }
            // Panic Mode: 100ms if violating, 300ms if safe
            val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val delay = if (examMode.value && am.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE) 100 else 300
            lockdownHandler.postDelayed(this, delay.toLong())
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Safety: Prevent screenshots and screen recording
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        enableEdgeToEdge()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Handle initial intent
        handleIntent(intent)

        // Disable back button globally or handle normally if not in exam
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (examMode.value) {
                    Toast.makeText(this@MainActivity, "Kembali dilarang saat ujian", Toast.LENGTH_SHORT).show()
                } else {
                    // Temporarily disable this callback and call onBackPressed to exit
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    Box {
                        if (showSetupWizard.value && !examMode.value) {
                            SetupWizard(
                                onRefresh = { checkPermissions() },
                                hasOverlay = hasOverlayPermission.value
                            )
                        } else {
                            MainContent(
                                isExamMode = examMode.value,
                                url = targetUrl.value,
                                batteryLevel = batteryLevel.value,
                                isCharging = isCharging.value,
                                showWarning = showViolationWarning,
                                onFinished = { onExamFinished() }
                            )
                        }
                        
                        if (showExitDialog.value) {
                            EmergencyExitDialog(
                                onDismiss = { showExitDialog.value = false },
                                onConfirm = { password ->
                                    if (password == emergencyPassword.value && emergencyPassword.value.isNotEmpty()) {
                                        onEmergencyExit()
                                        showExitDialog.value = false
                                    } else {
                                        Toast.makeText(this@MainActivity, "Sandi salah!", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
        
        checkPermissions()
        
        // Load password early if possible, or we fetch it when triggered
        fetchEmergencyPassword()

        // Start periodic lockdown check
        lockdownHandler.post(lockdownCheckRunnable)

        // Register battery receiver
        registerReceiver(batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(batteryReceiver)
        } catch (e: Exception) {}
        lockdownHandler.removeCallbacks(lockdownCheckRunnable)
    }

    private fun checkPermissions() {
        hasOverlayPermission.value = Settings.canDrawOverlays(this)
        showSetupWizard.value = !hasOverlayPermission.value
    }


    private fun forcePullBack() {
        if (!examMode.value) return
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(intent)
    }

    private fun showLockdownOverlay(isViolation: Boolean) {
        if (!Settings.canDrawOverlays(this)) return

        val windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        
        // 1. TOP BLOCKER (Status Bar / Fullscreen Violation)
        val targetHeight = if (isViolation) WindowManager.LayoutParams.MATCH_PARENT else customStatusBarHeight()
        
        overlayView?.let {
            val params = it.layoutParams as WindowManager.LayoutParams
            if ((params.height == WindowManager.LayoutParams.MATCH_PARENT) != isViolation) {
                removeStatusBarBlocker()
            } else {
                if (!isViolation) it.setBackgroundColor(0x01000000.toInt())
                // Still need to handle bottom blocker if violation
            }
        } ?: run {
            val flags = if (isViolation) {
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_INSET_DECOR
            } else {
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_INSET_DECOR
            }

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                targetHeight,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                flags,
                PixelFormat.TRANSLUCENT
            )
            params.gravity = Gravity.TOP

            overlayView = FrameLayout(this).apply {
                if (isViolation) {
                    setBackgroundColor(0xF10F172A.toInt())
                    val container = LinearLayout(this.context).apply {
                        orientation = LinearLayout.VERTICAL
                        gravity = Gravity.CENTER
                        setPadding(60, 60, 60, 60)
                    }
                    container.addView(TextView(this.context).apply {
                        text = "SYSTEM ALERT: LOCKDOWN BREACH"
                        setTextColor(0xFFF43F5E.toInt())
                        textSize = 22f
                        setTypeface(null, android.graphics.Typeface.BOLD)
                        gravity = Gravity.CENTER
                    })
                    container.addView(TextView(this.context).apply {
                        text = "KONTROL NAVIGASI TERDETEKSI\nPERANGKAT TERKUNCI OTOMATIS"
                        setTextColor(android.graphics.Color.WHITE)
                        textSize = 14f
                        gravity = Gravity.CENTER
                        setPadding(0, 20, 0, 40)
                    })
                    container.addView(AndroidButton(this.context).apply {
                        text = "RE-LOCK SYSTEM"
                        setBackgroundColor(0xFF334155.toInt())
                        setTextColor(android.graphics.Color.WHITE)
                        setPadding(40, 20, 40, 20)
                        setOnClickListener {
                            removeStatusBarBlocker()
                            lastLockAttemptTime = 0
                            enforceLockdown()
                        }
                    })
                    addView(container, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
                } else {
                    setBackgroundColor(0x01000000.toInt())
                }
            }
            try { windowManager.addView(overlayView, params) } catch (e: Exception) { Log.e("RushlessSafer", "Top overlay fail", e) }
        }

        // 2. BOTTOM BLOCKER (The Iron Curtain - Prevents Unpinning Gesture)
        // We only show this when pinned to prevent the user from holding Back + Recents
        if (!isViolation && bottomOverlayView == null) {
            val bottomParams = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                customNavigationBarHeight() + 50, // Extra margin to ensure coverage
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or 
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            )
            bottomParams.gravity = Gravity.BOTTOM
            
            bottomOverlayView = View(this).apply {
                setBackgroundColor(0x01000000.toInt()) // Invisible but consumes touches
            }
            try { windowManager.addView(bottomOverlayView, bottomParams) } catch (e: Exception) { Log.e("RushlessSafer", "Bottom overlay fail", e) }
        } else if (isViolation) {
            removeBottomBlocker()
        }
    }

    private fun removeStatusBarBlocker() {
        overlayView?.let {
            try {
                (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(it)
            } catch (e: Exception) {}
            overlayView = null
        }
        removeBottomBlocker()
    }

    private fun removeBottomBlocker() {
        bottomOverlayView?.let {
            try {
                (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(it)
            } catch (e: Exception) {}
            bottomOverlayView = null
        }
    }

    private fun customStatusBarHeight(): Int {
        val resourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (resourceId > 0) resources.getDimensionPixelSize(resourceId) else 100
    }

    private fun customNavigationBarHeight(): Int {
        val resourceId = resources.getIdentifier("navigation_bar_height", "dimen", "android")
        return if (resourceId > 0) resources.getDimensionPixelSize(resourceId) else 150
    }

    private fun applyStickyImmersive() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN)
    }

    override fun onActivityReenter(resultCode: Int, data: Intent?) {
        super.onActivityReenter(resultCode, data)
        if (examMode.value) {
            val inCooldown = System.currentTimeMillis() - lastLockAttemptTime < 5000
            if (!inCooldown && !isWaitingForFirstPin) {
                violationDetected = true
            }
            enforceLockdown()
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (examMode.value) {
            val inCooldown = System.currentTimeMillis() - lastLockAttemptTime < 5000
            if (!inCooldown && !isWaitingForFirstPin) {
                violationDetected = true
                forcePullBack()
            }
        }
    }

    override fun onPause() {
        super.onPause()
        if (examMode.value) {
            val inCooldown = System.currentTimeMillis() - lastLockAttemptTime < 5000
            if (!inCooldown && !isWaitingForFirstPin) {
                violationDetected = true
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (examMode.value) {
            applyStickyImmersive()
            if (hasFocus) {
                if (violationDetected) {
                    showViolationWarning.value = true
                    violationDetected = false
                }
                enforceLockdown()
            }
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val keyCode = event.keyCode
            
            // 1. Emergency Sequence Detection
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastKeyTime > SEQUENCE_TIMEOUT) {
                volumeUpCount = 0
                volumeDownCount = 0
            }
            lastKeyTime = currentTime

            when (keyCode) {
                KeyEvent.KEYCODE_VOLUME_UP -> {
                    if (volumeDownCount == 0) volumeUpCount++
                    else {
                        volumeUpCount = 1
                        volumeDownCount = 0
                    }
                    checkSequence()
                    if (examMode.value) return true // Block during exam
                }
                KeyEvent.KEYCODE_VOLUME_DOWN -> {
                    if (volumeUpCount == 3) volumeDownCount++
                    else {
                        volumeUpCount = 0
                        volumeDownCount = 0
                    }
                    checkSequence()
                    if (examMode.value) return true // Block during exam
                }
                KeyEvent.KEYCODE_HOME -> {
                    if (examMode.value) return true // Block/Consume Home during exam
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }
    private fun enforceLockdown() {
        val am = this.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val lockTaskMode = am.lockTaskModeState
        val isPinned = lockTaskMode != ActivityManager.LOCK_TASK_MODE_NONE
        
        if (!isPinned) {
            val currentTime = System.currentTimeMillis()
            val inCooldown = currentTime - lastLockAttemptTime < 5000 // 5s for initial dialog
            
            if (inCooldown) {
                removeStatusBarBlocker()
                return
            }
            
            if (!isWaitingForFirstPin) {
                violationDetected = true // Mark violation ONLY if not in cooldown/initial
            } else {
                // If we are still waiting but cooldown passed, it's likely they ignored/canceled
                // We'll keep trying but maybe warn them now? 
                // For now, let's keep it quiet until they manage to pin.
            }
            // Not pinned and not in cooldown -> Try to lock aggressively
            forcePullBack() // Bring to front BEFORE locking
            if (currentTime - lastLockAttemptTime > 2000) { 
                try {
                    lastLockAttemptTime = currentTime
                    removeStatusBarBlocker()
                    startLockTask()
                } catch (e: Exception) {
                    Log.e("RushlessSafer", "Failed to re-enforce lockdown", e)
                }
            }
            // Show Violation Screen
            showLockdownOverlay(isViolation = true)
        } else {
            // Already Pinned -> Active the Iron Curtain (Safety Blocker)
            isWaitingForFirstPin = false // Confirmed pinned!
            showLockdownOverlay(isViolation = false)
        }
    }

    private fun fetchEmergencyPassword() {
        // We'll fetch this from the server. For now, we can use the targetUrl's origin
        // or a hardcoded fallback if needed.
        val origin = if (targetUrl.value.isNotEmpty()) {
            Uri.parse(targetUrl.value).let { "${it.scheme}://${it.host}${if (it.port != -1) ":${it.port}" else ""}" }
        } else {
            "https://exam.rushless.my.id" // Default or injected origin
        }

        Thread {
            try {
                val url = java.net.URL("$origin/api/web-settings?mode=app-config")
                val connection = url.openConnection() as java.net.HttpURLConnection
                // Note: This won't have session cookies unless we pass them.
                // However, the app-config mode requires authentication.
                // In a real app, we'd use CookieManager cookies.
                val cookies = CookieManager.getInstance().getCookie(origin)
                if (cookies != null) {
                    connection.setRequestProperty("Cookie", cookies)
                }
                
                connection.requestMethod = "GET"
                val responseCode = connection.responseCode
                if (responseCode == 200) {
                    val text = connection.inputStream.bufferedReader().readText()
                    // Simple JSON parse for "app_emergency_password"
                    val pass = text.split("\"app_emergency_password\":\"")[1].split("\"")[0]
                    emergencyPassword.value = pass
                }
            } catch (e: Exception) {
                Log.e("RushlessSafer", "Failed to fetch password: ${e.message}")
            }
        }.start()
    }

    private fun onEmergencyExit() {
        stopLockTask()
        examMode.value = false
        Toast.makeText(this, "Emergency Exit Aktif", Toast.LENGTH_LONG).show()
    }

    private fun checkSequence() {
        if (volumeUpCount == 3 && volumeDownCount == 2) {
            volumeUpCount = 0
            volumeDownCount = 0
            showExitDialog.value = true
            fetchEmergencyPassword() // Refresh just in case
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val action = intent?.action
        val data: Uri? = intent?.data

        if (Intent.ACTION_VIEW == action && data != null) {
            if (data.scheme == "rushless-safer" && data.host == "lock") {
                val url = data.getQueryParameter("url")
                val handoffToken = data.getQueryParameter("handoff_token")

                if (!url.isNullOrEmpty()) {
                    if (!handoffToken.isNullOrEmpty()) {
                        // Construct handoff URL to perform auto-login in WebView
                        val baseUri = Uri.parse(url)
                        val handoffUrl = Uri.Builder()
                            .scheme(baseUri.scheme)
                            .authority(baseUri.authority)
                            .path("/api/auth/handoff")
                            .appendQueryParameter("token", handoffToken)
                            .appendQueryParameter("redirect", url)
                            .build()
                            .toString()
                        targetUrl.value = handoffUrl
                    } else {
                        targetUrl.value = url
                    }
                    
                    examMode.value = true
                    violationDetected = false // Reset violation state
                    showViolationWarning.value = false // Reset warning state
                    isWaitingForFirstPin = true // Guard the initial pinning
                    enforceLockdown()
                    Toast.makeText(this, "Lockdown Active", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    internal fun onExamFinished() {
        runOnUiThread {
            if (examMode.value) {
                examMode.value = false
                targetUrl.value = ""
                try {
                    removeStatusBarBlocker()
                    stopLockTask()
                    Toast.makeText(this, "Ujian selesai, lockdown dilepas.", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    Log.e("RushlessSafer", "Failed to stop lock task", e)
                    // If pinning fail to stop, we might need to finish the activity
                    finish()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-lock if in exam mode and somehow resumed
        if (examMode.value) {
            try {
                startLockTask()
            } catch (e: Exception) {
                Log.e("RushlessSafer", "Failed to start lock task in onResume", e)
            }
        }
    }

    // dispatchKeyEvent already handles the sequence
}

@Composable
fun MainContent(
    isExamMode: Boolean, 
    url: String, 
    batteryLevel: Int,
    isCharging: Boolean,
    showWarning: MutableState<Boolean>, 
    onFinished: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        if (isExamMode) {
            // Minimalist Battery Header
            BatteryHeader(level = batteryLevel, isCharging = isCharging)
            
            Box(modifier = Modifier.weight(1f)) {
                ExamWebView(url, onFinished)
                
                if (showWarning.value) {
                    androidx.compose.material3.AlertDialog(
                        onDismissRequest = { showWarning.value = false },
                        title = { Text("PERINGATAN KEAMANAN", color = Color.Red, fontWeight = FontWeight.Bold) },
                        text = { Text("Anda terdeteksi keluar dari aplikasi ujian. Kejadian ini telah dicatat oleh sistem.") },
                        confirmButton = {
                            androidx.compose.material3.Button(onClick = { showWarning.value = false }) {
                                Text("SAYA MENGERTI")
                            }
                        }
                    )
                }
            }
        } else {
            WelcomeScreen()
        }
    }
}

@Composable
fun BatteryHeader(level: Int, isCharging: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0F172A))
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.CenterVertically
    ) {
        val batteryColor = when {
            level <= 15 -> Color(0xFFF43F5E) // Red
            level <= 30 -> Color(0xFFFACC15) // Yellow
            else -> Color(0xFF22C55E) // Green
        }
        
        if (isCharging) {
            androidx.compose.material3.Icon(
                imageVector = Icons.Default.Info, // Fallback
                contentDescription = null,
                tint = Color(0xFF38BDF8),
                modifier = Modifier.size(12.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
        }
        
        Text(
            text = "BATTERY: $level%",
            color = batteryColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp
        )
    }
}

@Composable
fun SetupWizard(
    onRefresh: () -> Unit,
    hasOverlay: Boolean
) {
    val context = LocalContext.current
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A)) // Dark hardcore theme
            .padding(24.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = Color(0xFFF43F5E) // Red warning
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = "SECURITY CHECK",
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                textAlign = TextAlign.Center
            )
            
            Text(
                text = "Izin 'Overlay' diperlukan untuk memblokir status bar & navigasi selama ujian.",
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                color = Color(0xFF94A3B8),
                modifier = Modifier.padding(top = 12.dp, bottom = 40.dp)
            )
            
            SetupItem(
                title = "AKTIFKAN OVERLAY",
                desc = "Ketuk untuk memberikan izin sistem",
                isDone = hasOverlay,
                icon = Icons.Default.Info,
                onClick = {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${context.packageName}")
                    )
                    context.startActivity(intent)
                }
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            
            Button(
                onClick = onRefresh,
                modifier = Modifier.fillMaxWidth().height(60.dp),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF334155)
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null, tint = Color.White)
                Spacer(modifier = Modifier.width(12.dp))
                Text("REFRESH STATUS", fontWeight = FontWeight.Black, color = Color.White)
            }
        }
    }
}

@Composable
fun SetupItem(
    title: String,
    desc: String,
    isDone: Boolean,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Surface(
        onClick = if (!isDone) onClick else ({}),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        shape = RoundedCornerShape(12.dp),
        color = if (isDone) Color(0xFFF1F5F9) else Color.White,
        border = BorderStroke(
            1.dp,
            if (isDone) Color.Transparent else Color(0xFFE2E8F0)
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(
                        if (isDone) Color(0xFF22C55E) else Color(0xFF6366F1),
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
            }
            
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 16.dp)
            ) {
                Text(
                    text = title,
                    fontWeight = FontWeight.Bold,
                    color = if (isDone) Color(0xFF64748B) else Color(0xFF1E293B)
                )
                Text(
                    text = desc,
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }
            
            if (isDone) {
                Text("AKTIF", fontWeight = FontWeight.Black, color = Color(0xFF22C55E), fontSize = 10.sp)
            } else {
                Text("SETTING", fontWeight = FontWeight.Black, color = Color(0xFF6366F1), fontSize = 10.sp)
            }
        }
    }
}

@Composable
fun EmergencyExitDialog(onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var password by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = "Sandi Keluar Darurat", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text(
                    text = "Aplikasi dalam mode lockdown. Masukkan sandi emergency exit untuk keluar.",
                    fontSize = 14.sp,
                    color = Color.Gray,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                TextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Sandi") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(password) }
            ) {
                Text("Buka Kunci")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss
            ) {
                Text("Batal")
            }
        },
        containerColor = Color.White,
        tonalElevation = 8.dp
    )
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun ExamWebView(url: String, onFinished: () -> Unit) {
    AndroidView(factory = { context ->
        WebView(context).apply {
            layoutParams = android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT
            )

            // Session persistence: Cookie management
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(this, true)

            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.allowFileAccess = true
            settings.setSupportMultipleWindows(true)
            settings.javaScriptCanOpenWindowsAutomatically = true
            
            // Identification: Append custom string to User-Agent
            val originalUserAgent = settings.userAgentString
            settings.userAgentString = "$originalUserAgent RushlessSaferAndroid"
            
            // Allow media playback without user gesture
            settings.mediaPlaybackRequiresUserGesture = false

            // Add Javascript Interface
            val activity = context as? MainActivity
            addJavascriptInterface(object {
                @JavascriptInterface
                fun finishExam() {
                    onFinished()
                }
                
                @JavascriptInterface
                fun remoteUnlock() {
                    activity?.runOnUiThread {
                        if (activity.examMode.value) {
                            activity.onExamFinished()
                            Toast.makeText(activity, "Admin telah melepas penguncian.", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }, "RushlessSafer")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    // Prevent navigating outside exam host if possible, or just allow all
                    return false 
                }

                override fun onFormResubmission(view: WebView?, dontResend: android.os.Message?, resend: android.os.Message?) {
                    // This is crucial to avoid ERR_CACHE_MISS on form resubmission (back/forward)
                    resend?.sendToTarget()
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    // Persist cookies to disk
                    cookieManager.flush()
                }
            }
            
            loadUrl(url)
        }
    })
}

@Composable
fun WelcomeScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A)) // Match the SetupWizard dark theme
            .padding(24.dp)
    ) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Image(
                painter = painterResource(id = R.drawable.logo),
                contentDescription = "Rushless Logo",
                modifier = Modifier.size(140.dp)
            )

            Spacer(modifier = Modifier.height(40.dp))

            Text(
                text = "RUSHELESS SAFER",
                fontSize = 32.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
                color = Color.White,
                letterSpacing = 2.sp
            )


            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "Silakan buka link ujian dari browser Anda.\nSesi akan otomatis ditarik ke aplikasi ini.",
                fontSize = 15.sp,
                lineHeight = 22.sp,
                textAlign = TextAlign.Center,
                color = Color(0xFF94A3B8)
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Copyright Rushless Exam",
                fontSize = 10.sp,
                color = Color(0xFF475569)
            )
        }
    }
}