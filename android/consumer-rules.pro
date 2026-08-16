# The embedded Godot engine calls these Java APIs through JNI. R8 cannot see
# those calls and would otherwise remove or rename the entry points.
-keep,allowoptimization class com.rtngodot.NativeGodotModule { *; }
-keep,allowoptimization class com.rtngodot.RTNLibGodot { *; }

-keep,allowoptimization class org.godotengine.godot.Dictionary { *; }
-keep,allowoptimization class org.godotengine.godot.Godot { *; }
-keep,allowoptimization class org.godotengine.godot.GodotIO { *; }
-keep,allowoptimization class org.godotengine.godot.io.directory.DirectoryAccessHandler { *; }
-keep,allowoptimization class org.godotengine.godot.io.file.FileAccessHandler { *; }
-keep,allowoptimization class org.godotengine.godot.tts.GodotTTS { *; }
-keep,allowoptimization class org.godotengine.godot.utils.GodotNetUtils { *; }
-keep,allowoptimization class org.godotengine.godot.variant.Callable { *; }

# Godot discovers Android plugin methods through this runtime annotation.
-keep @interface org.godotengine.godot.plugin.UsedByGodot
-keepclassmembers,allowoptimization class * {
    @org.godotengine.godot.plugin.UsedByGodot <methods>;
}
