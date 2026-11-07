package com.preeternal.reactnativegodot

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Rect
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.DisplayMetrics
import android.util.Log
import android.view.Surface
import java.io.File
import java.util.Locale

// JNI contract: GodotIOJavaWrapper looks these methods up by name and descriptor.
// This adapter supplies Android services without starting Godot's standalone host.
internal class RTNGodotIO(
  private val context: Context,
  private val activity: () -> Activity?,
) {
  fun openURI(uri: String): Int = try {
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    0
  } catch (exception: Exception) {
    Log.e("RTNGodotIO", "Unable to open URI", exception)
    1
  }

  fun getCacheDir(): String = context.cacheDir.absolutePath
  fun getTempDir(): String = File(context.cacheDir, "tmp").also { it.mkdirs() }.absolutePath
  fun getDataDir(): String = context.filesDir.absolutePath
  fun getLocale(): String = Locale.getDefault().toString()
  fun getModel(): String = Build.MODEL
  fun getScreenDPI(): Int = context.resources.displayMetrics.densityDpi
  fun getScaledDensity(): Float = when {
    getScreenDPI() >= DisplayMetrics.DENSITY_XXXHIGH -> 4f
    getScreenDPI() >= DisplayMetrics.DENSITY_XXHIGH -> 3f
    getScreenDPI() >= DisplayMetrics.DENSITY_XHIGH -> 2f
    getScreenDPI() >= DisplayMetrics.DENSITY_HIGH -> 1.5f
    getScreenDPI() >= DisplayMetrics.DENSITY_MEDIUM -> 1f
    else -> 0.75f
  }

  @Suppress("DEPRECATION")
  fun getScreenRefreshRate(fallback: Double): Double =
    activity()?.windowManager?.defaultDisplay?.refreshRate?.toDouble() ?: fallback

  fun getDisplaySafeArea(): IntArray {
    val rect = Rect()
    activity()?.window?.decorView?.getWindowVisibleDisplayFrame(rect)
    return intArrayOf(rect.left, rect.top, rect.width(), rect.height())
  }

  fun getDisplayCutouts(): IntArray = activity()?.window?.decorView?.rootWindowInsets
    ?.displayCutout?.boundingRects?.flatMap { listOf(it.left, it.top, it.width(), it.height()) }
    ?.toIntArray() ?: intArrayOf()

  fun getUniqueID(): String = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: ""

  // Text entry is owned by React Native until an embedded IME bridge is available.
  @Suppress("UNUSED_PARAMETER")
  fun showKeyboard(text: String, type: Int, maxLength: Int, cursorStart: Int, cursorEnd: Int) {
    Log.w("RTNGodotIO", "Embedded Godot text input is unavailable; use React Native text input")
  }
  fun hideKeyboard() = Unit
  fun hasHardwareKeyboard(): Boolean = false

  fun setScreenOrientation(orientation: Int) {
    val requested = when (orientation) {
      0 -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
      1 -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
      2 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
      3 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
      4 -> ActivityInfo.SCREEN_ORIENTATION_USER_LANDSCAPE
      5 -> ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT
      6 -> ActivityInfo.SCREEN_ORIENTATION_FULL_USER
      else -> return
    }
    activity()?.let { host -> host.runOnUiThread { host.requestedOrientation = requested } }
  }

  fun getScreenOrientation(): Int = when (activity()?.requestedOrientation) {
    ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE -> 0
    ActivityInfo.SCREEN_ORIENTATION_PORTRAIT -> 1
    ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE -> 2
    ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT -> 3
    ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE, ActivityInfo.SCREEN_ORIENTATION_USER_LANDSCAPE -> 4
    ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT, ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT -> 5
    ActivityInfo.SCREEN_ORIENTATION_SENSOR, ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR,
    ActivityInfo.SCREEN_ORIENTATION_FULL_USER -> 6
    else -> -1
  }

  @Suppress("DEPRECATION")
  fun getDisplayRotation(): Int = when (activity()?.windowManager?.defaultDisplay?.rotation) {
    Surface.ROTATION_90 -> 90
    Surface.ROTATION_180 -> 180
    Surface.ROTATION_270 -> 270
    else -> 0
  }

  @Suppress("DEPRECATION")
  fun getSystemDir(index: Int, sharedStorage: Boolean): String {
    val directory = when (index) {
      1 -> Environment.DIRECTORY_DCIM
      2 -> Environment.DIRECTORY_DOCUMENTS
      3 -> Environment.DIRECTORY_DOWNLOADS
      4 -> Environment.DIRECTORY_MOVIES
      5 -> Environment.DIRECTORY_MUSIC
      6 -> Environment.DIRECTORY_PICTURES
      7 -> Environment.DIRECTORY_RINGTONES
      else -> null
    }
    val path = if (sharedStorage) {
      if (directory == null) Environment.getExternalStorageDirectory()
      else Environment.getExternalStoragePublicDirectory(directory)
    } else context.getExternalFilesDir(directory)
    return path?.absolutePath ?: context.filesDir.absolutePath
  }
}
