package com.preeternal.reactnativegodot

import android.annotation.SuppressLint
import android.content.Context
import android.util.Log
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup

class RTNGodotView(context: Context) : SurfaceView(context), SurfaceHolder.Callback2 {
  private var windowName = ""
  private var doubleTap = false
  private val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
    override fun onDown(event: MotionEvent): Boolean = true
    override fun onDoubleTap(event: MotionEvent): Boolean {
      doubleTap = true
      return true
    }
  })

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
    if (event.actionMasked == MotionEvent.ACTION_DOWN) doubleTap = false
    gestureDetector.onTouchEvent(event)
    val positions = FloatArray(event.pointerCount * 6)
    for (index in 0 until event.pointerCount) {
      val offset = index * 6
      positions[offset] = event.getPointerId(index).toFloat()
      positions[offset + 1] = event.getX(index)
      positions[offset + 2] = event.getY(index)
      positions[offset + 3] = event.getPressure(index)
      val tilt = event.getAxisValue(MotionEvent.AXIS_TILT, index)
      val orientation = event.getOrientation(index)
      positions[offset + 4] = -kotlin.math.sin(orientation) * kotlin.math.sin(tilt)
      positions[offset + 5] = kotlin.math.cos(orientation) * kotlin.math.sin(tilt)
    }
    RTNLibGodot.getInstance().dispatchTouchEvent(
      windowName,
      event.actionMasked,
      event.getPointerId(event.actionIndex),
      event.pointerCount,
      positions,
      doubleTap,
    )
    return true
  }

  companion object {
    private const val TAG = "RTNGodotView"
  }
}
