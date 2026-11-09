/**************************************************************************/
/*  LibGodotABI.h                                                         */
/**************************************************************************/
/* LibGodot C ABI used by the native bridge.                              */
/* Keep this bridge-local declaration in sync with the selected LibGodot headers. */
/**************************************************************************/

#pragma once

#include <gdextension_interface.h>
#include <godot_cpp/variant/string.hpp>
#include <godot_cpp/variant/string_name.hpp>

#include <stdbool.h>

// Generated builtin layouts depend on the target architecture. Mixing ARM32
// headers with an ARM64 library corrupts memory even when the C ABI matches.
static_assert(sizeof(godot::StringName) == sizeof(void *),
		"LibGodot godot-cpp StringName headers do not match the target ABI. Use headers generated for this architecture.");
static_assert(sizeof(godot::String) == sizeof(void *),
		"LibGodot godot-cpp String headers do not match the target ABI. Use headers generated for this architecture.");

#if defined(__ANDROID__) || defined(ANDROID)
#include <jni.h>
#endif

using RNLibGodotLogCallbackData = void *;
using RNLibGodotLogCallbackFunction = void (*)(RNLibGodotLogCallbackData p_data, const char *p_log_message, bool p_err);

using RNLibGodotCreateFunction = GDExtensionObjectPtr (*)(
		int p_argc,
		char *p_argv[],
		GDExtensionInitializationFunction p_init_func,
		RNLibGodotLogCallbackFunction p_log_func,
		RNLibGodotLogCallbackData p_log_data);

using RNLibGodotDestroyFunction = void (*)(GDExtensionObjectPtr p_godot_instance);

#if defined(__ANDROID__) || defined(ANDROID)
using RNLibGodotCreateAndroidFunction = GDExtensionObjectPtr (*)(
		int p_argc,
		char *p_argv[],
		GDExtensionInitializationFunction p_init_func,
		RNLibGodotLogCallbackFunction p_log_func,
		RNLibGodotLogCallbackData p_log_data,
		JNIEnv *p_env,
		jobject p_asset_manager,
		jobject p_net_utils,
		jobject p_directory_access_handler,
		jobject p_file_access_handler,
		jobject p_godot_io_wrapper);
#endif
