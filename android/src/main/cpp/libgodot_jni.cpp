/**************************************************************************/
/*  libgodot_jni.cpp                                                      */
/**************************************************************************/
/* Copyright (c) 2024-2025 Slay GmbH                                      */
/*                                                                        */
/* Permission is hereby granted, free of charge, to any person obtaining  */
/* a copy of this software and associated documentation files (the        */
/* "Software"), to deal in the Software without restriction, including    */
/* without limitation the rights to use, copy, modify, merge, publish,    */
/* distribute, sublicense, and/or sell copies of the Software, and to     */
/* permit persons to whom the Software is furnished to do so, subject to  */
/* the following conditions:                                              */
/*                                                                        */
/* The above copyright notice and this permission notice shall be         */
/* included in all copies or substantial portions of the Software.        */
/*                                                                        */
/* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,        */
/* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF     */
/* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. */
/* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY   */
/* CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,   */
/* TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE      */
/* SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                 */
/**************************************************************************/

#include "libgodot_jni.h"
#define LOG_TAG "LibGodotJNI"
#include "godot-log.h"

#include <math.h>

#include <GodotModule.h>
#include <android/input.h>
#include <android/native_window_jni.h>
#include <godot_cpp/classes/display_server.hpp>
#include <godot_cpp/classes/display_server_embedded.hpp>
#include <godot_cpp/classes/engine.hpp>
#include <godot_cpp/classes/input.hpp>
#include <godot_cpp/classes/input_event_screen_drag.hpp>
#include <godot_cpp/classes/input_event_screen_touch.hpp>
#include <godot_cpp/classes/main_loop.hpp>
#include <godot_cpp/classes/rendering_native_surface_android.hpp>
#include <godot_cpp/classes/scene_tree.hpp>
#include <godot_cpp/classes/window.hpp>

#include <godot_cpp/classes/project_settings.hpp>
#include <godot_cpp/classes/rendering_server.hpp>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

using NativeWindowRef = std::shared_ptr<ANativeWindow>;

static NativeWindowRef adoptWindow(ANativeWindow *window) {
	return NativeWindowRef(window, [](ANativeWindow *value) {
		if (value) {
			ANativeWindow_release(value);
		}
	});
}

struct WindowData {
	int width;
	int height;
	int32_t id;
	NativeWindowRef surface;
	// Keep the engine's borrowed ANativeWindow alive until replacement or detach.
	NativeWindowRef attachedSurface;
	bool active = true;
	bool updatePending = false;
	uint64_t attachmentGeneration = 1;
	WindowData(NativeWindowRef p_surface, int p_width, int p_height, int32_t p_id = -1) :
			width(p_width), height(p_height), id(p_id), surface(std::move(p_surface)) {}
};

static std::map<std::string, std::shared_ptr<WindowData>> windowMap;
static std::mutex windowMapMutex;

void LibGodot::initialize(JNIEnv *env, jobject p_asset_manager, jobject p_net_utils, jobject p_dir_access_handler, jobject p_file_access_handler, jobject p_godot_io, jobject p_main_surface, jint p_width, jint p_height) {
	LOGI("LibGodot::initialize");
	env->GetJavaVM(&java_vm);
	asset_manager = env->NewGlobalRef(p_asset_manager);
	net_utils = env->NewGlobalRef(p_net_utils);
	dir_access_handler = env->NewGlobalRef(p_dir_access_handler);
	file_access_handler = env->NewGlobalRef(p_file_access_handler);
	godot_io = env->NewGlobalRef(p_godot_io);
	ANativeWindow *mainSurface = ANativeWindow_fromSurface(env, p_main_surface);
	std::lock_guard<std::mutex> lock(windowMapMutex);
	windowMap[""] = std::make_shared<WindowData>(adoptWindow(mainSurface), p_width, p_height, 0);
}

ANativeWindow *LibGodot::get_main_surface() {
	std::lock_guard<std::mutex> lock(windowMapMutex);
	auto it = windowMap.find("");
	if (it == windowMap.end()) {
		return nullptr;
	}
	it->second->attachedSurface = it->second->surface;
	return it->second->surface.get();
}

int LibGodot::get_main_width() {
	std::lock_guard<std::mutex> lock(windowMapMutex);
	auto it = windowMap.find("");
	return it == windowMap.end() ? 0 : it->second->width;
}

int LibGodot::get_main_height() {
	std::lock_guard<std::mutex> lock(windowMapMutex);
	auto it = windowMap.find("");
	return it == windowMap.end() ? 0 : it->second->height;
}

void LibGodot::cleanup(JNIEnv *env) {
	if (asset_manager) {
		env->DeleteGlobalRef(asset_manager);
		asset_manager = nullptr;
	}
	if (net_utils) {
		env->DeleteGlobalRef(net_utils);
		net_utils = nullptr;
	}
	if (dir_access_handler) {
		env->DeleteGlobalRef(dir_access_handler);
		dir_access_handler = nullptr;
	}
	if (file_access_handler) {
		env->DeleteGlobalRef(file_access_handler);
		file_access_handler = nullptr;
	}
	if (godot_io) {
		env->DeleteGlobalRef(godot_io);
		godot_io = nullptr;
	}
	{
		std::lock_guard<std::mutex> lock(windowMapMutex);
		for (const auto &[name, state] : windowMap) {
			state->active = false;
			++state->attachmentGeneration;
		}
		windowMap.clear();
	}

	java_vm = nullptr;
}

JNIEnv *LibGodot::get_jni_env() {
	if (!java_vm) {
		LOGE("LibGodot::get_jni_env() called before JavaVM initialization");
		return nullptr;
	}
	JNIEnv *env;
	java_vm->AttachCurrentThread(&env, nullptr);
	return env;
}

void LibGodot::set_java_vm(JavaVM *vm) {
	java_vm = vm;
}

static void applyWindowUpdate(const std::string &p_window_name, const std::shared_ptr<WindowData> &state) {
	int p_width, p_height;
	NativeWindowRef surface;
	{
		std::lock_guard<std::mutex> lock(windowMapMutex);
		state->updatePending = false;
		if (!state->active) {
			return;
		}
		p_width = state->width;
		p_height = state->height;
		surface = state->surface;
	}
	// This function and engine teardown are serialized on the Godot thread.
	auto *instance = GodotModule::get_singleton()->get_instance();
	if (!instance || !instance->is_started() || !surface || p_width <= 0 || p_height <= 0) {
		return;
	}
	ANativeWindow *p_window_surface = surface.get();
	godot::DisplayServerEmbedded *dse = godot::DisplayServerEmbedded::get_singleton();
	if (!dse) {
		return;
	}
	int32_t windowId = -1;
	if (p_window_name == "") {
		// Default id
		windowId = 0;
	} else {
		// Find window
		godot::MainLoop *mainLoop = godot::Engine::get_singleton()->get_main_loop();
		godot::SceneTree *sceneTree = godot::Object::cast_to<godot::SceneTree>(mainLoop);
		if (!sceneTree) {
			LOGE("Unable to get SceneTree from Godot!");
			return;
		}
		godot::Node *node = sceneTree->get_root()->find_child(
				godot::String::utf8(p_window_name.c_str()), true, false);
		godot::Window *newWindow = godot::Object::cast_to<godot::Window>(node);

		if (newWindow) {
			bool change_surface = true;
			godot::Ref<godot::RenderingNativeSurfaceAndroid> ns = newWindow->get_native_surface();
			if (ns.is_valid()) {
				ANativeWindow *current_window = (ANativeWindow *)ns->get_window();
				if (current_window == p_window_surface) {
					change_surface = false;
				}
			}

			if (change_surface) {
				LOGI("Changing surface");
				godot::Ref<godot::RenderingNativeSurfaceAndroid> androidSurface = godot::RenderingNativeSurfaceAndroid::create(
						(uint64_t)p_window_surface, p_width, p_height);
				if (androidSurface.is_null()) {
					return;
				}

				newWindow->set_visible(true);
				newWindow->set_native_surface(androidSurface);
			}

			windowId = newWindow->get_window_id();
		}
	}
	if (windowId >= 0) {
		LOGI("Resizing Window: %d %d %d", windowId, p_width, p_height);
		dse->resize_window(godot::Vector2i(p_width, p_height), windowId);
		std::lock_guard<std::mutex> lock(windowMapMutex);
		state->id = windowId;
		state->attachedSurface = surface;
	}
}

static void scheduleWindowUpdate(const std::string &name, const std::shared_ptr<WindowData> &state) {
	{
		std::lock_guard<std::mutex> lock(windowMapMutex);
		if (!state->active || state->updatePending) {
			return;
		}
		state->updatePending = true;
	}
	GodotModule::get_singleton()->runOnGodotThread([name, state]() {
		applyWindowUpdate(name, state);
	});
}

void LibGodot::updateWindowNative(JNIEnv *env, jstring p_name, jobject p_surface, jint p_width, jint p_height) {
	std::string windowName;
	{
		jboolean isCopy;
		const char *val = env->GetStringUTFChars(p_name, &isCopy);
		windowName = val;
		env->ReleaseStringUTFChars(p_name, val);
	}

	NativeWindowRef surface = adoptWindow(ANativeWindow_fromSurface(env, p_surface));
	if (!surface || p_width <= 0 || p_height <= 0) {
		return;
	}
	std::shared_ptr<WindowData> state;
	{
		std::lock_guard<std::mutex> lock(windowMapMutex);
		auto &entry = windowMap[windowName];
		if (!entry) {
			entry = std::make_shared<WindowData>(surface, p_width, p_height, windowName.empty() ? 0 : -1);
		}
		state = entry;
		if (!state->active || state->surface.get() != surface.get()) {
			++state->attachmentGeneration;
		}
		state->surface = std::move(surface);
		state->active = true;
		state->width = p_width;
		state->height = p_height;
	}
	// Only one pending job per window; it reads the latest requested size.
	scheduleWindowUpdate(windowName, state);
}

void LibGodot::removeWindowNative(JNIEnv *env, jstring p_name) {
	const uint64_t engineGeneration = GodotModule::get_singleton()->get_instance_generation();
	const char *name = env->GetStringUTFChars(p_name, nullptr);
	std::string windowName(name);
	env->ReleaseStringUTFChars(p_name, name);
	std::shared_ptr<WindowData> state;
	{
		std::lock_guard<std::mutex> lock(windowMapMutex);
		auto it = windowMap.find(windowName);
		if (it == windowMap.end()) {
			return;
		}
		state = it->second;
		state->active = false;
		++state->attachmentGeneration;
		if (!windowName.empty()) {
			windowMap.erase(it);
		}
	}
	// The default child SurfaceControl is persistent even while its host is hidden.
	if (windowName.empty()) {
		return;
	}
	// SurfaceHolder requires rendering to stop before a named Surface is destroyed.
	GodotModule::get_singleton()->runOnGodotThread([windowName, state, engineGeneration]() {
		auto *instance = GodotModule::get_singleton()->get_instance();
		if (engineGeneration != 0 && engineGeneration == GodotModule::get_singleton()->get_instance_generation() &&
				instance && instance->is_started()) {
			auto *tree = godot::Object::cast_to<godot::SceneTree>(godot::Engine::get_singleton()->get_main_loop());
			if (tree) {
				auto *window = godot::Object::cast_to<godot::Window>(tree->get_root()->find_child(
						godot::String::utf8(windowName.c_str()), true, false));
				if (window) {
					window->set_native_surface(godot::Ref<godot::RenderingNativeSurface>());
				}
			}
		}
		std::lock_guard<std::mutex> lock(windowMapMutex);
		state->attachedSurface.reset();
		state->surface.reset();
	},
			true);
}

void LibGodot::updateWindow(std::string windowName) {
	std::shared_ptr<WindowData> state;
	{
		std::lock_guard<std::mutex> lock(windowMapMutex);
		auto it = windowMap.find(windowName);
		if (it != windowMap.end()) {
			state = it->second;
		}
	}
	if (state) {
		scheduleWindowUpdate(windowName, state);
	}
}

void LibGodot::updateWindows() {
	std::vector<std::pair<std::string, std::shared_ptr<WindowData>>> windows;
	{
		std::lock_guard<std::mutex> lock(windowMapMutex);
		for (const auto &entry : windowMap) {
			windows.push_back(entry);
		}
	}
	for (const auto &[name, state] : windows) {
		scheduleWindowUpdate(name, state);
	}
}

void LibGodot::registerWindowUpdateCallbackNative(JNIEnv *env, jstring name, jlong handle, jobject r) {
	GodotModule *mod = GodotModule::get_singleton();
	if (!mod) {
		LOGE("GodotModule not available");
		return;
	}

	std::string std_name = jstring_to_std_string(name);

	jobject myRunnable = env->NewGlobalRef(r);

	std::function<void(bool)> callback = [myRunnable](bool adding) {
		JNIEnv *env = get_jni_env();
		jclass runnable_class = env->FindClass("java/lang/Runnable");
		jmethodID runnable_run_method_id = env->GetMethodID(runnable_class, "run", "()V");
		env->CallVoidMethod(myRunnable, runnable_run_method_id);
		if (env->ExceptionCheck()) {
			// Retrieve the last Java exception
			env->ExceptionDescribe();

			// Clear the exception
			env->ExceptionClear();
		}
	};

	mod->registerWindowUpdateCallback(std_name, (void *)handle, callback, myRunnable);
}

void LibGodot::unregisterWindowUpdateCallbackNative(jlong handle) {
	GodotModule *mod = GodotModule::get_singleton();
	if (!mod) {
		LOGE("GodotModule not available");
		return;
	}
	mod->unregisterWindowUpdateCallback((void *)handle);
}

static std::string convertToStdString(JNIEnv *env, jstring s) {
	std::string result;
	{
		jboolean isCopy;
		const char *val = env->GetStringUTFChars(s, &isCopy);
		result = val;
		env->ReleaseStringUTFChars(s, val);
	}
	return result;
}

struct TouchPos {
	int id = 0;
	godot::Point2 pos;
	float pressure = 0;
	godot::Vector2 tilt;
};

static std::map<int32_t, std::vector<TouchPos>> touches;

void LibGodot::clear_input_state() {
	touches.clear();
	std::lock_guard<std::mutex> lock(windowMapMutex);
	for (const auto &[name, state] : windowMap) {
		state->id = name.empty() ? 0 : -1;
	}
}

extern "C" {

JNIEXPORT void JNICALL Java_com_preeternal_reactnativegodot_RTNLibGodot_initialize(JNIEnv *env, jclass clazz, jobject p_asset_manager, jobject p_net_utils, jobject p_dir_access_handler, jobject p_file_access_handler, jobject p_godot_io, jobject p_main_surface, jint p_width, jint p_height) {
	LibGodot::initialize(env, p_asset_manager, p_net_utils, p_dir_access_handler, p_file_access_handler, p_godot_io, p_main_surface, p_width, p_height);
}

JNIEXPORT void JNICALL Java_com_preeternal_reactnativegodot_RTNLibGodot_updateWindowNative(JNIEnv *env, jclass clazz, jstring p_name, jobject p_surface, jint p_width, jint p_height) {
	LibGodot::updateWindowNative(env, p_name, p_surface, p_width, p_height);
}

JNIEXPORT void JNICALL Java_com_preeternal_reactnativegodot_RTNLibGodot_removeWindowNative(JNIEnv *env, jclass clazz, jstring p_name) {
	LibGodot::removeWindowNative(env, p_name);
}

JNIEXPORT void JNICALL Java_com_preeternal_reactnativegodot_RTNLibGodot_cleanup(JNIEnv *env, jclass clazz) {
	LibGodot::cleanup(env);
}

// Called on the UI thread
JNIEXPORT void JNICALL Java_com_preeternal_reactnativegodot_RTNLibGodot_dispatchMouseEvent(JNIEnv *env, jclass clazz, jstring p_name, jint p_event_type, jint p_button_mask, jfloat p_x, jfloat p_y, jfloat p_delta_x, jfloat p_delta_y, jboolean p_double_click, jboolean p_source_mouse_relative, jfloat p_pressure, jfloat p_tilt_x, jfloat p_tilt_y) {
	// godot::GodotInstance *instance = GodotModule::get_singleton()->get_instance();
	// if (!instance || !instance->is_started()) {
	//     return;
	// }

	// input_handler->process_mouse_event(p_event_type, p_button_mask, godot::Point2(p_x, p_y), godot::Vector2(p_delta_x, p_delta_y), p_double_click, p_source_mouse_relative, p_pressure, godot::Vector2(p_tilt_x, p_tilt_y));
}

JNIEXPORT jobjectArray JNICALL Java_com_preeternal_reactnativegodot_RTNLibGodot_getRendererInfo(JNIEnv *env, jclass clazz) {
	std::string driver, method;
	GodotModule::get_singleton()->runOnGodotThread([&]() {
		auto *instance = GodotModule::get_singleton()->get_instance();
		if (!instance || !instance->is_started()) {
			return;
		}
		driver = godot::RenderingServer::get_singleton()->get_current_rendering_driver_name().utf8().get_data();
		method = godot::RenderingServer::get_singleton()->get_current_rendering_method().utf8().get_data();
	},
			true);
	jobjectArray result = env->NewObjectArray(2, env->FindClass("java/lang/String"), nullptr);
	env->SetObjectArrayElement(result, 0, env->NewStringUTF(driver.c_str()));
	env->SetObjectArrayElement(result, 1, env->NewStringUTF(method.c_str()));
	return result;
}

JNIEXPORT jstring JNICALL Java_com_preeternal_reactnativegodot_RTNLibGodot_getGlobal(JNIEnv *env, jclass clazz, jstring path) {
	std::string key = convertToStdString(env, path), value;
	GodotModule::get_singleton()->runOnGodotThread([&]() {
		auto *instance = GodotModule::get_singleton()->get_instance();
		if (!instance || !instance->is_started()) {
			return;
		}
		godot::Variant setting = godot::ProjectSettings::get_singleton()->get_setting_with_override(godot::String::utf8(key.c_str()));
		if (setting.get_type() != godot::Variant::NIL) {
			godot::String text = setting;
			value = text.utf8().get_data();
		}
	},
			true);
	return env->NewStringUTF(value.c_str());
}

JNIEXPORT void JNICALL
Java_com_preeternal_reactnativegodot_RTNLibGodot_registerWindowUpdateCallbackNative(JNIEnv *env, jclass clazz, jstring name, jlong handle, jobject r) {
	LibGodot::registerWindowUpdateCallbackNative(env, name, handle, r);
}

JNIEXPORT void JNICALL
Java_com_preeternal_reactnativegodot_RTNLibGodot_unregisterWindowUpdateCallbackNative(JNIEnv *env, jclass clazz, jlong handle) {
	LibGodot::unregisterWindowUpdateCallbackNative(handle);
}

// Called on the UI thread
JNIEXPORT void JNICALL Java_com_preeternal_reactnativegodot_RTNLibGodot_dispatchTouchEvent(JNIEnv *env, jclass clazz, jstring p_name, jint p_event, jint p_pointer, jint pointer_count, jfloatArray position, jboolean p_double_tap) {
	if (!position || pointer_count < 1 || pointer_count > env->GetArrayLength(position) / 6) {
		return;
	}
	std::vector<float> positions(pointer_count * 6);
	env->GetFloatArrayRegion(position, 0, positions.size(), positions.data());
	if (env->ExceptionCheck()) {
		return;
	}
	std::string windowName = convertToStdString(env, p_name);
	auto *module = GodotModule::get_singleton();
	const uint64_t engineGeneration = module->get_instance_generation();
	std::shared_ptr<WindowData> state;
	uint64_t attachmentGeneration;
	{
		std::lock_guard<std::mutex> lock(windowMapMutex);
		auto it = windowMap.find(windowName);
		if (it == windowMap.end() || !it->second->active) {
			return;
		}
		state = it->second;
		attachmentGeneration = state->attachmentGeneration;
	}
	module->runWithInstance(engineGeneration, [windowName, state, attachmentGeneration, positions = std::move(positions), p_event, p_pointer, pointer_count, p_double_tap]() {
		int32_t windowId;
		{
			std::lock_guard<std::mutex> lock(windowMapMutex);
			if (!state->active || state->attachmentGeneration != attachmentGeneration) {
				return;
			}
			windowId = state->id;
		}
		if (windowId < 0) {
			LOGE("Could not find window for name: %s", windowName.c_str());
			return;
		}
		std::vector<TouchPos> points;
		for (int i = 0; i < pointer_count; i++) {
			const float *p = positions.data() + i * 6;
			TouchPos tp;
			tp.id = (int)p[0];
			tp.pos = godot::Point2(p[1], p[2]);
			tp.pressure = p[3];
			tp.tilt = godot::Vector2(p[4], p[5]);
			points.push_back(tp);
		}

		switch (p_event) {
			case AMOTION_EVENT_ACTION_DOWN: { //gesture begin

				touches[windowId] = points;
				std::vector<TouchPos> &touch = touches[windowId];

				//send touch
				for (int i = 0; i < touch.size(); i++) {
					godot::Ref<godot::InputEventScreenTouch> ev;
					ev.instantiate();
					ev->set_window_id(windowId);
					ev->set_index(touch[i].id);
					ev->set_pressed(true);
					ev->set_canceled(false);
					ev->set_position(touch[i].pos);
					ev->set_double_tap(p_double_tap);
					godot::Input::get_singleton()->parse_input_event(ev);
				}
			} break;
			case AMOTION_EVENT_ACTION_MOVE: { //motion
				std::vector<TouchPos> &touch = touches[windowId];
				if (touch.size() != points.size()) {
					return;
				}

				for (int i = 0; i < touch.size(); i++) {
					int idx = -1;
					for (int j = 0; j < points.size(); j++) {
						if (touch[i].id == points[j].id) {
							idx = j;
							break;
						}
					}

					ERR_CONTINUE(idx == -1);

					if (touch[i].pos == points[idx].pos) {
						continue; // Don't move unnecessarily.
					}

					godot::Ref<godot::InputEventScreenDrag> ev;
					ev.instantiate();
					ev->set_window_id(windowId);
					ev->set_index(touch[i].id);
					ev->set_position(points[idx].pos);
					ev->set_relative(points[idx].pos - touch[i].pos);
					//ev->set_relative_screen_position(ev->get_relative());
					ev->set_pressure(points[idx].pressure);
					ev->set_tilt(points[idx].tilt);
					godot::Input::get_singleton()->parse_input_event(ev);
					touch[i].pos = points[idx].pos;
				}

			} break;
			case AMOTION_EVENT_ACTION_CANCEL: {
				std::vector<TouchPos> &touch = touches[windowId];
				for (int i = 0; i < touch.size(); i++) {
					godot::Ref<godot::InputEventScreenTouch> ev;
					ev.instantiate();
					ev->set_window_id(windowId);
					ev->set_index(touch[i].id);
					ev->set_pressed(false);
					ev->set_canceled(true);
					ev->set_position(touch[i].pos);
					ev->set_double_tap(p_double_tap);
					godot::Input::get_singleton()->parse_input_event(ev);
				}
			} break;
			case AMOTION_EVENT_ACTION_UP: { //release
				std::vector<TouchPos> &touch = touches[windowId];
				for (int i = 0; i < touch.size(); i++) {
					godot::Ref<godot::InputEventScreenTouch> ev;
					ev.instantiate();
					ev->set_window_id(windowId);
					ev->set_index(touch[i].id);
					ev->set_pressed(false);
					ev->set_canceled(false);
					ev->set_position(touch[i].pos);
					ev->set_double_tap(p_double_tap);
					godot::Input::get_singleton()->parse_input_event(ev);
				}
			} break;
			case AMOTION_EVENT_ACTION_POINTER_DOWN: { // add touch
				std::vector<TouchPos> &touch = touches[windowId];
				for (int i = 0; i < points.size(); i++) {
					if (points[i].id == p_pointer) {
						TouchPos tp = points[i];
						touch.push_back(tp);

						godot::Ref<godot::InputEventScreenTouch> ev;
						ev.instantiate();
						ev->set_window_id(windowId);
						ev->set_index(tp.id);
						ev->set_pressed(true);
						ev->set_position(tp.pos);
						godot::Input::get_singleton()->parse_input_event(ev);

						break;
					}
				}
			} break;
			case AMOTION_EVENT_ACTION_POINTER_UP: { // remove touch
				std::vector<TouchPos> &touch = touches[windowId];
				for (int i = 0; i < touch.size(); i++) {
					if (touch[i].id == p_pointer) {
						godot::Ref<godot::InputEventScreenTouch> ev;
						ev.instantiate();
						ev->set_window_id(windowId);
						ev->set_index(touch[i].id);
						ev->set_pressed(false);
						ev->set_position(touch[i].pos);
						godot::Input::get_singleton()->parse_input_event(ev);
						touch.erase(touch.begin() + i);
						break;
					}
				}
			} break;
		}
	});
}
}
