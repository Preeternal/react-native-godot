package com.preeternal.reactnativegodot

internal object NativeLibraryLoader {
  var load: (String) -> Unit = System::loadLibrary
}
