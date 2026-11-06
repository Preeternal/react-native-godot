package com.preeternal.reactnativegodot

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.RTNGodotViewManagerDelegate
import com.facebook.react.viewmanagers.RTNGodotViewManagerInterface

@ReactModule(name = RTNGodotViewManager.NAME)
class RTNGodotViewManager : SimpleViewManager<RTNGodotView>(),
  RTNGodotViewManagerInterface<RTNGodotView> {
  private val delegate: ViewManagerDelegate<RTNGodotView> =
    RTNGodotViewManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<RTNGodotView> = delegate

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): RTNGodotView {
    RTNLibGodot.getInstance().init(context.currentActivity)
    return RTNGodotView(context)
  }

  @ReactProp(name = "windowName")
  override fun setWindowName(view: RTNGodotView?, value: String?) {
    view?.setWindowName(value)
  }

  companion object {
    const val NAME = "RTNGodotView"
  }
}
