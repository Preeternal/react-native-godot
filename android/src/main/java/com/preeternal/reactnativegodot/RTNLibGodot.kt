package com.preeternal.reactnativegodot

import android.app.Activity
import android.content.res.AssetManager
import android.graphics.PixelFormat
import android.util.DisplayMetrics
import android.util.Log
import android.view.Surface
import android.view.SurfaceControl
import android.view.SurfaceHolder
import org.godotengine.godot.io.directory.DirectoryAccessHandler
import org.godotengine.godot.io.file.FileAccessHandler
import org.godotengine.godot.plugin.GodotPlugin
import org.godotengine.godot.utils.GodotNetUtils

class RTNLibGodot private constructor() {
  private class WindowSurfaceData(
    val control: SurfaceControl,
    width: Int,
    height: Int,
    val persistent: Boolean,
  ) {
    var attachedControl: SurfaceControl? = null
    var attachedSurface: Surface? = null
    val surface: Surface = Surface(control)
    var width: Int = width
    var height: Int = height
  }

  fun updateWindow(
    name: String,
    control: SurfaceControl,
    holder: SurfaceHolder,
    format: Int,
    width: Int,
    height: Int,
  ) {
    if (name.isNotEmpty()) {
      updateWindowNative(name, holder.surface, width, height)
      return
    }

    val window = getOrCreateWindowSurface(name, width, height)
    val holderSurface = holder.surface
    val surfaceChanged = window.attachedControl != control || window.attachedSurface != holderSurface

    if (surfaceChanged) {
      window.attachedControl = null
      window.attachedSurface = null
      Log.i(TAG, "Attaching and resizing surface to: $width $height")
      SurfaceControl.Transaction().use { transaction ->
        transaction.reparent(window.control, control)
        transaction.setLayer(window.control, 1)
        transaction.setVisibility(window.control, true)
        if (window.width != width || window.height != height) {
          transaction.setBufferSize(window.control, width, height)
          window.width = width
          window.height = height
        }
        transaction.apply()
      }
      window.attachedControl = control
      window.attachedSurface = holderSurface
    } else if (window.width != width || window.height != height) {
      Log.i(TAG, "Resizing surface to: $width $height")
      SurfaceControl.Transaction().use { transaction ->
        transaction.setBufferSize(window.control, width, height)
        window.width = width
        window.height = height
        transaction.apply()
      }
    }

    updateWindowNative(name, window.surface, width, height)
  }

  fun removeWindow(name: String) {
    val window = windowData[name]
    if (window == null) {
      removeWindowNative(name)
      return
    }

    SurfaceControl.Transaction().use { transaction ->
      transaction.reparent(window.control, null)
      transaction.setVisibility(window.control, false)
      transaction.apply()
    }
    window.attachedControl = null
    window.attachedSurface = null
    removeWindowNative(name)
    if (!window.persistent) windowData.remove(name)
  }

  @Synchronized
  fun init(newActivity: Activity?) {
    hostActivity = newActivity ?: hostActivity
    if (inited) return
    val currentActivity = hostActivity
    if (currentActivity == null) {
      Log.e(TAG, "Activity not set, abort init")
      return
    }

    val metrics = DisplayMetrics()
    @Suppress("DEPRECATION")
    currentActivity.windowManager.defaultDisplay.getMetrics(metrics)
    getOrCreateWindowSurface("", metrics.widthPixels, metrics.heightPixels)

    // Embedded creation owns the engine. Do not call Godot.initEngine(), which
    // initializes a second engine through the standalone Android JNI API.
    val context = currentActivity.applicationContext
    initialize(
      context.assets,
      GodotNetUtils(context),
      DirectoryAccessHandler(context),
      FileAccessHandler(context),
      RTNGodotIO(context) { hostActivity },
      checkNotNull(windowData[""]).surface,
      metrics.widthPixels,
      metrics.heightPixels,
    )
    inited = true
  }

  fun shutdown() {
    if (inited) {
      cleanup()
      inited = false
    }
  }

  @Deprecated("Standalone Godot Android plugins are not supported by the embedded engine")
  fun addHostPlugin(plugin: GodotPlugin) {
    throw UnsupportedOperationException("Cannot register standalone Android plugin: ${plugin.javaClass.name}")
  }

  private external fun updateWindowNative(name: String, surface: Surface, width: Int, height: Int)
  private external fun removeWindowNative(name: String)

  private external fun cleanup()

  external fun dispatchTouchEvent(
    windowName: String,
    event: Int,
    pointer: Int,
    pointerCount: Int,
    positions: FloatArray,
    doubleTap: Boolean,
  )

  external fun dispatchMouseEvent(
    windowName: String,
    event: Int,
    buttonMask: Int,
    x: Float,
    y: Float,
    deltaX: Float,
    deltaY: Float,
    doubleClick: Boolean,
    sourceMouseRelative: Boolean,
    pressure: Float,
    tiltX: Float,
    tiltY: Float,
  )

  companion object {
    private const val TAG = "LibGodot"
    private var inited = false
    @Volatile private var hostActivity: Activity? = null

    private val INSTANCE = RTNLibGodot()
    private val windowData = HashMap<String, WindowSurfaceData>()

    @JvmStatic
    fun getInstance(): RTNLibGodot = INSTANCE

    private fun createWindowSurface(name: String, width: Int, height: Int) {
      val control = SurfaceControl.Builder()
        .setBufferSize(width, height)
        .setFormat(PixelFormat.RGBA_8888)
        .setName(name)
        .build()
      windowData[name] = WindowSurfaceData(control, width, height, name.isEmpty())
    }

    private fun getOrCreateWindowSurface(name: String, width: Int, height: Int): WindowSurfaceData =
      windowData[name] ?: run {
        createWindowSurface(name, width, height)
        checkNotNull(windowData[name])
      }

    @JvmStatic
    private external fun initialize(
      assetManager: AssetManager,
      netUtils: GodotNetUtils,
      directoryAccessHandler: DirectoryAccessHandler,
      fileAccessHandler: FileAccessHandler,
      io: RTNGodotIO,
      mainSurface: Surface,
      width: Int,
      height: Int,
    )

    @JvmStatic
    private external fun registerWindowUpdateCallbackNative(
      name: String,
      handle: Any,
      runnable: Runnable,
    )

    @JvmStatic
    private external fun unregisterWindowUpdateCallbackNative(handle: Any)
  }
}
