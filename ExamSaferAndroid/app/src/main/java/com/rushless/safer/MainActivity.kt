package com.rushless.safer

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
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.OnBackPressedCallback
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
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
import com.example.myapplication.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

    private var volumeUpCount = 0
    private var volumeDownCount = 0
    
    // State to track if we are in exam mode
    private var examMode = mutableStateOf(false)
    private var targetUrl = mutableStateOf("")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

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
                    MainContent(examMode.value, targetUrl.value, ::onExamFinished)
                }
            }
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
                if (!url.isNullOrEmpty()) {
                    targetUrl.value = url
                    examMode.value = true
                    startLockTask() // Trigger pinning
                    Toast.makeText(this, "Lockdown Active", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun onExamFinished() {
        runOnUiThread {
            if (examMode.value) {
                examMode.value = false
                targetUrl.value = ""
                try {
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

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (examMode.value) {
            when (keyCode) {
                KeyEvent.KEYCODE_VOLUME_UP -> {
                    volumeUpCount++
                    if (volumeDownCount > 0) volumeDownCount = 0 
                    checkExitSequence()
                    return true
                }
                KeyEvent.KEYCODE_VOLUME_DOWN -> {
                    if (volumeUpCount >= 3) {
                        volumeDownCount++
                        checkExitSequence()
                    } else {
                        volumeUpCount = 0
                        volumeDownCount = 0
                    }
                    return true
                }
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun checkExitSequence() {
        if (volumeUpCount >= 3 && volumeDownCount >= 3) {
            // Emergency Exit - force release
            onExamFinished()
            volumeUpCount = 0
            volumeDownCount = 0
        }
    }
}

@Composable
fun MainContent(isExamMode: Boolean, url: String, onFinished: () -> Unit) {
    if (isExamMode) {
        ExamWebView(url, onFinished)
    } else {
        WelcomeScreen()
    }
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
            settings.javaScriptEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.allowFileAccess = true
            
            // Allow media playback without user gesture
            settings.mediaPlaybackRequiresUserGesture = false

            // Add Javascript Interface
            addJavascriptInterface(object {
                @JavascriptInterface
                fun finishExam() {
                    onFinished()
                }
            }, "RushlessSafer")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    // Prevent navigating outside exam host if possible, or just allow all
                    return false 
                }

                override fun onFormResubmission(view: WebView?, dontResend: android.os.Message?, resend: android.os.Message?) {
                    resend?.sendToTarget()
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
                modifier = Modifier.size(160.dp)
            )

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "Selamat Datang di\nRushless Safer",
                fontSize = 30.sp,
                lineHeight = 38.sp,
                fontWeight = FontWeight.Black,
                textAlign = TextAlign.Center,
                color = Color(0xFF1E293B)
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Buka website ujian Anda di browser biasa, lalu klik tombol 'Buka di Rushless Safer' untuk memulai ujian dengan aman.",
                fontSize = 16.sp,
                textAlign = TextAlign.Center,
                color = Color(0xFF64748B)
            )
        }

        Text(
            text = "Powered by Rushless Engine",
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = Color.LightGray
        )
    }
}