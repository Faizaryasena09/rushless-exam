package com.example.myapplication

import android.content.Context
import android.os.Bundle
import android.view.KeyEvent
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.OnBackPressedCallback
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.myapplication.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

    private var volumeUpCount = 0
    private var volumeDownCount = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Disable back button
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Do nothing to block back button
                Toast.makeText(this@MainActivity, "Action not allowed during exam", Toast.LENGTH_SHORT).show()
            }
        })

        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ExamScreen()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Determine if we should pin. In a real kiosk app, we might check if we are already pinned.
        startLockTask()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> {
                volumeUpCount++
                // Reset down count if up is pressed
                if (volumeDownCount > 0) volumeDownCount = 0 
                
                checkExitSequence()
                return true // Consume event
            }
            KeyEvent.KEYCODE_VOLUME_DOWN -> {
                if (volumeUpCount >= 3) {
                    volumeDownCount++
                    checkExitSequence()
                } else {
                    // Reset if sequence is broken (down pressed before 3 ups)
                    volumeUpCount = 0
                    volumeDownCount = 0
                }
                return true // Consume event
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun checkExitSequence() {
        if (volumeUpCount >= 3 && volumeDownCount >= 3) {
            // Emergency Exit
            try {
                stopLockTask()
                finishAndRemoveTask()
                android.os.Process.killProcess(android.os.Process.myPid()) // Force kill
            } catch (e: Exception) {
                e.printStackTrace()
                finish()
            }
        }
    }
}

@Composable
fun ExamScreen() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Logo
             // Note: R.drawable.logo needs to be added. 
             // Using a placeholder icon content if logo isn't found or just text heavily implies it. 
             // Since I can't verify R.drawable.logo exists yet, I'll comment it out or use a standard icon 
             // but user request implies logo exists or will be added. 
             // I'll assume R.drawable.logo will be created by user or I should stick to text if file missing.
             // Actually, I can use a standard painter and assume user adds it. 
             // I'll use a placeholder text "LOGO" or similar if logic requires valid resource ID.
             // But valid kotlin code requires the ID to exist. 
             // I will assume the user will provide `R.drawable.logo` or rename their file. 
             // For now, I'll use a placeholder from android defaults or valid generated resource if possible.
             // Wait, `R.mipmap.ic_launcher` is usually available. I will use that as placeholder.
             
            Image(
                painter = painterResource(id = R.mipmap.ic_launcher), // Replace with R.drawable.logo when available
                contentDescription = "Rushless Logo",
                modifier = Modifier.size(100.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Rushless",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Buka website ujian anda untuk memulai ujian",
                fontSize = 18.sp,
                textAlign = TextAlign.Center
            )
        }

        Text(
            text = "Copyright Rushless",
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp),
            fontSize = 14.sp,
            color = Color.Gray
        )
    }
}

@Preview(showBackground = true)
@Composable
fun ExamScreenPreview() {
    MyApplicationTheme {
        ExamScreen()
    }
}