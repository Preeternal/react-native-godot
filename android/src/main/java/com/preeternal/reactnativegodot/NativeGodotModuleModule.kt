package com.preeternal.reactnativegodot

import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.LifecycleState
import com.facebook.react.common.annotations.FrameworkAPI
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl
import kotlin.OptIn

@OptIn(FrameworkAPI::class)
@ReactModule(name = NativeGodotModuleModule.NAME)
class NativeGodotModuleModule(
  reactContext: ReactApplicationContext,
) : NativeNativeGodotModuleSpec(reactContext), LifecycleEventListener {
  @DoNotStrip
  @Suppress("unused")
  private val mHybridData: HybridData
  private var invalidated = false

  init {
    RTNLibGodot.getInstance().init(reactContext.currentActivity)

    val callInvokerHolder = requireNotNull(reactContext.jsCallInvokerHolder) {
      "The JavaScript call invoker is not available"
    }
    require(callInvokerHolder is CallInvokerHolderImpl) {
      "Unsupported JavaScript call invoker implementation: ${callInvokerHolder::class.java.name}"
    }

    mHybridData = initHybrid(
      requireNotNull(reactContext.javaScriptContextHolder).get(),
      callInvokerHolder,
    )
  }

  override fun initialize() {
    super.initialize()
    val context = reactApplicationContext
    UiThreadUtil.runOnUiThread {
      if (invalidated) return@runOnUiThread
      setHostActive(context.lifecycleState == LifecycleState.RESUMED)
      context.addLifecycleEventListener(this)
    }
  }

  override fun invalidate() {
    invalidated = true
    UiThreadUtil.runOnUiThread {
      reactApplicationContext.removeLifecycleEventListener(this)
      setHostActive(false)
    }
    super.invalidate()
  }

  override fun onHostResume() {
    if (!invalidated) setHostActive(true)
  }

  override fun onHostPause() {
    if (!invalidated) setHostActive(false)
  }

  override fun onHostDestroy() = onHostPause()

  private external fun setHostActive(active: Boolean)

  private external fun initHybrid(
    jsContext: Long,
    jsCallInvokerHolder: CallInvokerHolderImpl,
  ): HybridData

  @ReactMethod(isBlockingSynchronousMethod = true)
  override external fun installTurboModule(): Boolean

  companion object {
    const val NAME = NativeNativeGodotModuleSpec.NAME
  }
}
