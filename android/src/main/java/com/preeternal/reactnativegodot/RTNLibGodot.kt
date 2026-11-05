package com.preeternal.reactnativegodot

import android.app.Activity
import android.content.res.AssetManager
import android.graphics.PixelFormat
import android.util.DisplayMetrics
import android.util.Log
import android.view.Surface
import android.view.SurfaceControl
import android.view.SurfaceHolder
import android.view.SurfaceView
import org.godotengine.godot.Godot
import org.godotengine.godot.GodotHost
import org.godotengine.godot.GodotIO
import org.godotengine.godot.GodotLib
import org.godotengine.godot.GodotRenderView
import org.godotengine.godot.IGodotLib
import org.godotengine.godot.input.GodotInputHandler
import org.godotengine.godot.io.directory.DirectoryAccessHandler
import org.godotengine.godot.io.file.FileAccessHandler
import org.godotengine.godot.plugin.AndroidRuntimePlugin
import org.godotengine.godot.plugin.GodotPlugin
import org.godotengine.godot.tts.GodotTTS
import org.godotengine.godot.utils.GodotNetUtils

class RTNLibGodot private constructor() : IGodotLib, GodotHost, GodotRenderView {
  private var godot: Godot? = null
  private var inputHandler: GodotInputHandler? = null
  private val hostPlugins = HashSet<GodotPlugin>()

  override fun initialize(
    godot: Godot,
    assetManager: AssetManager,
    godotIO: GodotIO,
    godotNetUtils: GodotNetUtils,
    directoryAccessHandler: DirectoryAccessHandler,
    fileAccessHandler: FileAccessHandler,
    unused: Boolean,
  ): Boolean {
    val mainWindow = windowData[""]
    if (mainWindow?.surface == null) {
      Log.e(TAG, "Main window surface is unavailable; call init() before initialize()")
      return false
    }

    initialize(
      assetManager,
      godotNetUtils,
      directoryAccessHandler,
      fileAccessHandler,
      godotIO,
      mainWindow.surface,
      mainWindow.width,
      mainWindow.height,
      godot,
      hostActivity,
      RTNLibGodot::class.java.classLoader,
    )
    return true
  }

  override fun ondestroy() = Unit

  override fun setup(strings: Array<String>, godotTTS: GodotTTS): Boolean = true

  override fun resize(surface: Surface, width: Int, height: Int) {
    Log.i(TAG, "Resize")
  }

  override fun newcontext(surface: Surface) = Unit
  override fun back() = Unit
  override fun step(): Boolean = false
  override fun ttsCallback(a: Int, b: Int, c: Int) = Unit

  override fun dispatchTouchEvent(
    event: Int,
    pointer: Int,
    pointerCount: Int,
    positions: FloatArray,
    doubleTap: Boolean,
  ) {
    dispatchTouchEvent("", event, pointer, pointerCount, positions, doubleTap)
  }

  override fun dispatchMouseEvent(
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
  ) = Unit

  override fun magnify(a: Float, b: Float, c: Float) = Unit
  override fun pan(a: Float, b: Float, c: Float, d: Float) = Unit
  override fun accelerometer(a: Float, b: Float, c: Float) = Unit
  override fun gravity(a: Float, b: Float, c: Float) = Unit
  override fun magnetometer(a: Float, b: Float, c: Float) = Unit
  override fun gyroscope(a: Float, b: Float, c: Float) = Unit
  override fun key(a: Int, b: Int, c: Int, d: Boolean, e: Boolean) = Unit
  override fun joybutton(a: Int, b: Int, c: Boolean) = Unit
  override fun joyaxis(a: Int, b: Int, c: Float) = Unit
  override fun joyhat(a: Int, b: Int, c: Int) = Unit
  override fun joyconnectionchanged(a: Int, b: Boolean, c: String) = Unit
  override fun focusin() = Unit
  override fun focusout() = Unit

  override external fun getGlobal(path: String): String
  override external fun getRendererInfo(): Array<String>

  override fun getEditorSetting(path: String): String = ""
  override fun setEditorSetting(path: String, value: Any?) = Unit
  override fun getEditorProjectMetadata(path: String, key: String, defaultValue: Any?): Any? = null
  override fun setEditorProjectMetadata(path: String, key: String, value: Any?) = Unit
  override fun requestPermissionResult(permission: String, granted: Boolean) = Unit
  override fun onNightModeChanged() = Unit
  override fun hardwareKeyboardConnected(connected: Boolean) = Unit
  override fun filePickerCallback(success: Boolean, files: Array<String>) = Unit
  override fun setVirtualKeyboardHeight(height: Int) = Unit
  override fun onRendererResumed() = Unit
  override fun onRendererPaused() = Unit
  override fun shouldDispatchInputToRenderThread(): Boolean = false
  override fun getProjectResourceDir(): String = ""
  override fun isEditorHint(): Boolean = false
  override fun isProjectManagerHint(): Boolean = false
  override fun providesRenderView(): Boolean = true
  override fun getRenderView(): GodotRenderView = this
  override fun getActivity(): Activity? = hostActivity
  override fun getGodot(): Godot? = godot
  override fun getView(): SurfaceView? = null
  override fun startRenderer() = Unit
  override fun queueOnRenderThread(runnable: Runnable) = Unit
  override fun onActivityPaused() = Unit
  override fun onActivityStopped() = Unit
  override fun onActivityResumed() = Unit
  override fun onActivityStarted() = Unit
  override fun onActivityDestroyed() = Unit
  override fun getInputHandler(): GodotInputHandler? = inputHandler
  override fun configurePointerIcon(a: Int, b: String, c: Float, d: Float) = Unit
  override fun setPointerIcon(pointer: Int) = Unit

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
    if (inited) return
    hostActivity = newActivity
    val currentActivity = hostActivity
    if (currentActivity == null) {
      Log.e(TAG, "Activity not set, abort init")
      return
    }

    val metrics = DisplayMetrics()
    @Suppress("DEPRECATION")
    currentActivity.windowManager.defaultDisplay.getMetrics(metrics)
    getOrCreateWindowSurface("", metrics.widthPixels, metrics.heightPixels)

    GodotLib.setGodotLibImpl(this)
    godot = Godot.getInstance(currentActivity).also { it.setActivity(currentActivity) }
    val currentGodot = godot ?: return
    val runtimePlugins = HashSet<GodotPlugin>().apply {
      add(AndroidRuntimePlugin(currentGodot))
      addAll(hostPlugins)
    }

    if (!currentGodot.initEngine(this, ArrayList(), runtimePlugins)) {
      Log.e(TAG, "Unable to initialize Godot engine layer")
      return
    }

    inputHandler = GodotInputHandler(currentActivity, currentGodot)
    inited = true
  }

  fun shutdown() {
    if (inited) {
      cleanup()
      inited = false
    }
  }

  fun addHostPlugin(plugin: GodotPlugin) {
    hostPlugins.add(plugin)
  }

  fun getHostPlugins(): Set<GodotPlugin> = hostPlugins

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
    private var hostActivity: Activity? = null

    init {
      System.loadLibrary("rtngodot")
    }

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
      io: GodotIO,
      mainSurface: Surface,
      width: Int,
      height: Int,
      godot: Godot,
      hostActivity: Activity?,
      appClassLoader: ClassLoader?,
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
