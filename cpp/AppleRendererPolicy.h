#pragma once

#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace rn_godot {

struct AppleRendererSelection {
	std::string_view driver;
	std::string_view method;
	std::string_view error;
};

// Choose before engine creation; an unsupported explicit request never retries.
constexpr AppleRendererSelection select_apple_renderer(bool simulator,
		std::string_view driver = {}, std::string_view method = {}) {
	if (driver.empty()) {
		driver = method == "gl_compatibility" ? "opengl3" : (simulator ? "opengl3" : "metal");
	}
	const bool opengl = driver.starts_with("opengl3");
	if (method.empty()) {
		method = opengl ? "gl_compatibility" : "mobile";
	}
	if (simulator && driver == "metal") {
		return {driver, method, "Metal is unavailable in this iOS Simulator slice. Use opengl3/gl_compatibility, or an iPhone/iPad device for Metal."};
	}
	if (opengl && method != "gl_compatibility") {
		return {driver, method, "OpenGL rendering requires gl_compatibility."};
	}
	if (driver == "metal" && method == "gl_compatibility") {
		return {driver, method, "Metal rendering requires mobile or forward_plus."};
	}
	return {driver, method, {}};
}

struct AppleRendererArguments {
	std::string requested_driver;
	std::string requested_method;
	std::string driver;
	std::string method;
	std::string error;
};

inline AppleRendererArguments configure_apple_renderer(std::vector<std::string> &args, bool simulator) {
	AppleRendererArguments result;
	std::vector<std::string> normalized;
	bool has_driver = false;
	bool has_method = false;
	for (size_t i = 0; i < args.size(); ++i) {
		bool is_driver = args[i] == "--rendering-driver" || args[i].starts_with("--rendering-driver=");
		bool is_method = args[i] == "--rendering-method" || args[i].starts_with("--rendering-method=");
		if (!is_driver && !is_method) {
			normalized.push_back(args[i]);
			continue;
		}
		const std::string option = is_driver ? "--rendering-driver" : "--rendering-method";
		std::string value;
		if (args[i] == option) {
			if (i + 1 == args.size() || args[i + 1].starts_with("--")) {
				result.error = option + " requires a value.";
				return result;
			}
			value = args[++i];
		} else {
			value = args[i].substr(option.size() + 1);
		}
		if (value.empty()) {
			result.error = option + " requires a value.";
			return result;
		}
		if (is_driver) {
			has_driver = true;
			result.requested_driver = value;
		} else {
			has_method = true;
			result.requested_method = value;
		}
		normalized.insert(normalized.end(), {option, value});
	}
	const auto selection = select_apple_renderer(simulator, result.requested_driver, result.requested_method);
	result.driver = selection.driver;
	result.method = selection.method;
	result.error = selection.error;
	if (!result.error.empty()) {
		return result;
	}
	if (!has_driver) normalized.insert(normalized.end(), {"--rendering-driver", result.driver});
	if (!has_method) normalized.insert(normalized.end(), {"--rendering-method", result.method});
	args = std::move(normalized);
	return result;
}

} // namespace rn_godot
