package com.forgestudios.app

import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
  private val pipChannelName = "forge/pip"
  private var pipChannel: MethodChannel? = null
  private var autoEnterOnLeave = false

  override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
    super.configureFlutterEngine(flutterEngine)
    pipChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, pipChannelName).also { channel ->
      channel.setMethodCallHandler { call, result ->
        when (call.method) {
          "isSupported" -> result.success(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
          "setAutoEnter" -> {
            autoEnterOnLeave = when (val args = call.arguments) {
              is Boolean -> args
              is Map<*, *> -> args["enabled"] as? Boolean == true
              else -> false
            }
            result.success(null)
          }
          "enter" -> result.success(enterPip())
          else -> result.notImplemented()
        }
      }
    }
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (autoEnterOnLeave) {
      enterPip()
    }
  }

  private fun enterPip(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    return try {
      val params = PictureInPictureParams.Builder()
        .setAspectRatio(Rational(16, 9))
        .build()
      enterPictureInPictureMode(params)
    } catch (_: Exception) {
      false
    }
  }
}
