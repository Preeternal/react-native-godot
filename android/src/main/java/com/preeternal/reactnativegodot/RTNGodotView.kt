package com.preeternal.reactnativegodot

import android.annotation.SuppressLint
import android.content.Context
import android.util.Log
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup
import org.godotengine.godot.input.GodotInputHandler

class RTNGodotView(context: Context) : SurfaceView(context), SurfaceHolder.Callback2 {
  private val inputHandler: GodotInputHandler? = RTNLibGodot.getInstance().inputHandler
  private var windowName = ""

  init {
    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
    )
    holder.addCallback(this)
  }

  fun setWindowName(newWindowName: String?) {
    windowName = newWindowName ?: ""
  }

  override fun surfaceRedrawNeeded(surfaceHolder: SurfaceHolder) {
    Log.i(TAG, "surfaceRedrawNeeded: $windowName ${surfaceHolder.surface}")
  }

  override fun surfaceCreated(surfaceHolder: SurfaceHolder) {
    Log.i(TAG, "surfaceCreated: $windowName ${surfaceHolder.surface}")
  }

  override fun surfaceChanged(
    surfaceHolder: SurfaceHolder,
    format: Int,
    width: Int,
    height: Int,
  ) {
    Log.i(TAG, "surfaceChanged: $windowName ${surfaceHolder.surface} $format $width $height")
    RTNLibGodot.getInstance().updateWindow(windowName, surfaceControl, surfaceHolder, format, width, height)
  }

  override fun surfaceDestroyed(surfaceHolder: SurfaceHolder) {
    Log.i(TAG, "surfaceRemoved: $windowName ${surfaceHolder.surface}")
    RTNLibGodot.getInstance().removeWindow(windowName)
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    super.onTouchEvent(event)
    return inputHandler?.onTouchEvent(event) ?: false
  }

  override fun onGenericMotionEvent(event: MotionEvent): Boolean =
    inputHandler?.onGenericMotionEvent(event) ?: false

  override fun onCapturedPointerEvent(event: MotionEvent): Boolean =
    inputHandler?.onGenericMotionEvent(event) ?: false

  override fun requestPointerCapture() {
    super.requestPointerCapture()
    inputHandler?.onPointerCaptureChange(true)
  }

  override fun releasePointerCapture() {
    super.releasePointerCapture()
    inputHandler?.onPointerCaptureChange(false)
  }

  override fun onPointerCaptureChange(hasCapture: Boolean) {
    super.onPointerCaptureChange(hasCapture)
    inputHandler?.onPointerCaptureChange(hasCapture)
  }

  companion object {
    private const val TAG = "RTNGodotView"
  }
}
