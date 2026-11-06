package com.preeternal.reactnativegodot

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test

class NativeGodotModulePackageTest {
  @After
  fun restoreNativeLibraryLoader() {
    NativeLibraryLoader.load = System::loadLibrary
  }

  @Test
  fun packageInitializationLoadsNativeLibraryBeforeTurboModuleUse() {
    val loadedLibraries = mutableListOf<String>()
    NativeLibraryLoader.load = { loadedLibraries += it }

    Class.forName(
      NativeGodotModulePackage::class.java.name,
      true,
      NativeGodotModulePackage::class.java.classLoader,
    )

    assertEquals(listOf("rtngodot"), loadedLibraries)
  }
}
