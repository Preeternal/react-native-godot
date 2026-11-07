/**************************************************************************/
/*  RTNGodotView.mm                                                       */
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

#import <React/RCTLog.h>
#import <React/RCTUIManager.h>

#include <cmath>

#include <godot_cpp/classes/display_server_embedded.hpp>
#include <godot_cpp/classes/engine.hpp>
#include <godot_cpp/classes/godot_instance.hpp>
#include <godot_cpp/classes/main_loop.hpp>
#include <godot_cpp/classes/rendering_native_surface.hpp>
#include <godot_cpp/classes/rendering_native_surface_apple.hpp>
#include <godot_cpp/classes/scene_tree.hpp>
#include <godot_cpp/classes/window.hpp>
#include <godot_cpp/core/math.hpp>
#include <godot_cpp/godot.hpp>
#include <godot_cpp/variant/utility_functions.hpp>

#include "GodotModule.h"

#import "RTNGodotView.h"

#import <react/renderer/components/RTNGodotSpec/ComponentDescriptors.h>
#import <react/renderer/components/RTNGodotSpec/EventEmitters.h>
#import <react/renderer/components/RTNGodotSpec/Props.h>
#import <react/renderer/components/RTNGodotSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

static const int MAX_TOUCH_COUNT = 32;

static NSHashTable<UIView *> *_views = [NSHashTable weakObjectsHashTable];
static __weak UIView *_currentView = nil;

@interface RTNGodotView () <RCTRTNGodotViewViewProtocol>
- (void)invalidateAttachment;
- (bool)ownsRenderingLayer;
- (void)addToGodotView;
- (void)removeFromGodotView:(bool)addAfter unregister:(bool)unregister;
@end
@implementation RTNGodotView {
	NSString *_windowName;
	CALayer *_renderingLayer;
	uint64_t _windowId;
	uint64_t _engineGeneration;
	double _contentScaleFactor;
	std::vector<UITouch *> _touches;
	bool _propsUpdated;
	bool _instanceCallbackRegistered;
	bool _isMounted;
	std::atomic<uint64_t> _attachmentGeneration;
	std::atomic<uint64_t> _resizeGeneration;
	godot::Vector2i _lastRequestedPixelSize;
}

+ (BOOL)shouldBeRecycled {
	return NO;
}

+ (void)removeMainLayerFromGodotView:(RTNGodotView *)view promote:(bool)promote {
	// The module has already cleared its layer on Stop. The view owns this reference.
	CALayer *mainLayer = view->_renderingLayer;
	if (promote) {
		[_views removeObject:view];
	}
	if (_currentView != view) {
		return;
	}
	if (mainLayer.superlayer == view.layer) {
		[mainLayer removeFromSuperlayer];
	}
	// Keep the preferred host across Stop/Start, regardless of callback order.
	if (!promote) {
		return;
	}
	_currentView = nil;
	const uint64_t generation = GodotModule::get_singleton()->get_instance_generation();
	for (RTNGodotView *nextView in _views.allObjects) {
		if (!nextView->_isMounted || nextView->_engineGeneration != generation ||
				generation == 0 || !nextView->_renderingLayer) {
			continue;
		}
		[nextView invalidateAttachment];
		_currentView = nextView;
		// The departing host may not have received the new engine's layer yet.
		CALayer *nextLayer = nextView->_renderingLayer;
		[CATransaction begin];
		[CATransaction setDisableActions:YES];
		nextLayer.hidden = YES;
		[nextView.layer addSublayer:nextLayer];
		[CATransaction commit];
		nextView->_lastRequestedPixelSize = godot::Vector2i();
		[nextView setNeedsLayout];
		break;
	}
}

+ (void)addMainLayer:(CALayer *)mainLayer toGodotView:(RTNGodotView *)view {
	const bool newHost = ![_views containsObject:view];
	[_views addObject:view];
	if (_currentView && _currentView != view && !newHost) {
		return;
	}
	if (_currentView && _currentView != view) {
		[(RTNGodotView *)_currentView invalidateAttachment];
	}
	[CATransaction begin];
	[CATransaction setDisableActions:YES];
	[mainLayer removeFromSuperlayer];
	[view.layer addSublayer:mainLayer];
	mainLayer.hidden = YES;
	[CATransaction commit];
	_currentView = view;
}

- (instancetype)init {
	if (self = [super init]) {
		// Fabric requires the component's own default props before the first update.
		static const auto defaultProps = std::make_shared<const RTNGodotViewProps>();
		_props = defaultProps;
		[self setDefaultValues];
	}
	return self;
}

- (void)setDefaultValues {
	while (self.subviews.firstObject) {
		[self.subviews.firstObject removeFromSuperview];
	}
	self.multipleTouchEnabled = YES;

	_renderingLayer = nil;
	_windowId = 0;
	_engineGeneration = 0;
	_contentScaleFactor = 1.0;
	_touches.reserve(MAX_TOUCH_COUNT);
	for (int i = 0; i < MAX_TOUCH_COUNT; ++i) {
		_touches.push_back(nil);
	}
	_propsUpdated = false;
	_instanceCallbackRegistered = false;
	_windowName = @"";
	_isMounted = false;
	_attachmentGeneration = 0;
	_resizeGeneration = 0;
	_lastRequestedPixelSize = godot::Vector2i();
}

//Setter method
- (void)setWindowName:(NSString *)n {
	if (n == nil) {
		n = @"";
	}
	if ([_windowName isEqualToString:n]) {
		return;
	}

	NSLog(@"Setting windowName to: %@", n);
	if (_isMounted) {
		[self removeFromGodotView:false unregister:true];
	}
	_windowName = n;
	if (_isMounted) {
		[self addToGodotView];
	}
}

//Getter method
- (NSString *)windowName {
	NSLog(@"Returning windowName: %@", _windowName);
	return _windowName;
}

- (void)setNeedsLayout {
	[super setNeedsLayout];
	[self invalidateIntrinsicContentSize];
}

- (CGSize)intrinsicContentSize {
	return [self sizeThatFits:CGSizeMake(CGFLOAT_MAX, CGFLOAT_MAX)];
}

- (void)dealloc {
	if (_instanceCallbackRegistered) {
		GodotModule::get_singleton()->unregisterWindowUpdateCallback((__bridge void *)self);
	}
	if ([NSThread isMainThread]) {
		[RTNGodotView removeMainLayerFromGodotView:self promote:true];
	}
}

- (void)invalidateAttachment {
	++_attachmentGeneration;
	++_resizeGeneration;
	std::vector<int> ids;
	for (int i = 0; i < MAX_TOUCH_COUNT; ++i) {
		if (_touches[i]) {
			ids.push_back(i);
		}
		_touches[i] = nil;
	}
	const uint64_t windowId = _windowId;
	if (ids.empty() || !windowId) {
		return;
	}
	GodotModule::get_singleton()->runWithInstance(_engineGeneration, [windowId, ids]() {
		godot::Window *window = godot::Object::cast_to<godot::Window>(godot::UtilityFunctions::instance_from_id(windowId));
		auto *dse = godot::DisplayServerEmbedded::get_singleton();
		if (window && dse) {
			for (int id : ids) {
				dse->touches_canceled(id, window->get_window_id());
			}
		}
	});
}

- (bool)ownsRenderingLayer {
	return _isMounted && _windowId && _renderingLayer &&
			_engineGeneration != 0 &&
			_engineGeneration == GodotModule::get_singleton()->get_instance_generation() &&
			_renderingLayer.superlayer == self.layer &&
			(![@"" isEqualToString:_windowName] || _currentView == self);
}

- (void)addToGodotView {
	if (!_isMounted) {
		return;
	}
	auto *module = GodotModule::get_singleton();
	if (!_instanceCallbackRegistered) {
		__weak RTNGodotView *weakSelf = self;
		module->registerWindowUpdateCallback([_windowName UTF8String], (__bridge void *)self, [weakSelf](bool adding) {
			const uint64_t generation = GodotModule::get_singleton()->get_instance_generation();
			dispatch_async(dispatch_get_main_queue(), ^{
				RTNGodotView *view = weakSelf;
				if (!view){ return;
}
				if (adding) {
					if (generation == GodotModule::get_singleton()->get_instance_generation()){ [view addToGodotView];
}
				} else if (view->_engineGeneration == generation) {
					[view removeFromGodotView:false unregister:false];
				}
			}); }, nullptr);
		_instanceCallbackRegistered = true;
	}
	const uint64_t engineGeneration = module->get_instance_generation();
	if (_engineGeneration && _engineGeneration != engineGeneration) {
		[self removeFromGodotView:false unregister:false];
	}
	if (!engineGeneration || (_windowId && _engineGeneration == engineGeneration)) {
		return;
	}
	const uint64_t attachmentGeneration = ++_attachmentGeneration;
	const std::string windowName = [_windowName UTF8String];
	const CGSize initialSize = self.bounds.size;
	module->runWithInstance(engineGeneration, [=]() {
		if (self->_attachmentGeneration.load() != attachmentGeneration) {
			return;
		}
		auto *tree = godot::Object::cast_to<godot::SceneTree>(godot::Engine::get_singleton()->get_main_loop());
		if (!tree) {
			return;
		}
		auto *window = windowName.empty() ? tree->get_root() : godot::Object::cast_to<godot::Window>(tree->get_root()->find_child(godot::String::utf8(windowName.c_str()), true, false));
		if (!window) {
			return;
		}
		const uint64_t windowId = window->get_instance_id();
		const double scale = module->get_content_scale_factor();
		CALayer *layer = nil;
		if (windowName.empty()) {
			layer = (__bridge CALayer *)module->get_main_rendering_layer();
		} else {
			godot::Ref<godot::RenderingNativeSurfaceApple> surface = window->get_native_surface();
			if (surface.is_null()) {
				surface = godot::RenderingNativeSurfaceApple::create(0);
				if (surface.is_null()) {
					return;
				}
				layer = (__bridge CALayer *)(void *)surface->get_layer();
				layer.bounds = CGRectMake(0, 0, godot::MAX(1, initialSize.width), godot::MAX(1, initialSize.height));
				layer.anchorPoint = CGPointZero;
				layer.position = CGPointZero;
				layer.contentsScale = scale;
				window->set_native_surface(surface);
			} else {
				layer = (__bridge CALayer *)(void *)surface->get_layer();
			}
			window->set_visible(true);
			__weak RTNGodotView *weakSelf = self;
			godot::Callable exited = module->create_callable([=](const godot::Variant **, int, godot::Variant &, GDExtensionCallError &) {
				dispatch_async(dispatch_get_main_queue(), ^{
					RTNGodotView *view = weakSelf;
					if (view && view->_engineGeneration == engineGeneration &&
							view->_attachmentGeneration.load() == attachmentGeneration && view->_windowId == windowId) {
						[view removeFromGodotView:false unregister:false];
					}
				});
			});
			window->connect("tree_exited", exited);
		}
		if (!layer) {
			return;
		}
		// Only retain a CALayer across the UI handoff, never a Godot binding/Ref.
		dispatch_async(dispatch_get_main_queue(), ^{
			if (!self->_isMounted || self->_attachmentGeneration.load() != attachmentGeneration ||
					engineGeneration != module->get_instance_generation()) {
				return;
			}
			self->_windowId = windowId;
			self->_engineGeneration = engineGeneration;
			self->_contentScaleFactor = scale;
			self->_renderingLayer = layer;
			self->_lastRequestedPixelSize = godot::Vector2i();
			if (windowName.empty()) {
				[RTNGodotView addMainLayer:layer toGodotView:self];
			} else {
				[self.layer addSublayer:layer];
				layer.hidden = YES;
			}
			[self setNeedsLayout];
		});
	});
}

- (void)removeFromGodotView:(bool)addAfter unregister:(bool)unregister {
	// All callers are on the main queue; teardown callbacks carry their old engine generation.
	[self invalidateAttachment];
	if (unregister) {
		GodotModule::get_singleton()->unregisterWindowUpdateCallback((__bridge void *)self);
		_instanceCallbackRegistered = false;
	}
	if ([@"" isEqualToString:_windowName]) {
		[RTNGodotView removeMainLayerFromGodotView:self promote:unregister];
	} else if (_renderingLayer.superlayer == self.layer) {
		[_renderingLayer removeFromSuperlayer];
	}
	_windowId = 0;
	_engineGeneration = 0;
	_renderingLayer = nil;
	_lastRequestedPixelSize = godot::Vector2i();
	if (addAfter) {
		[self addToGodotView];
	}
}

- (void)layoutSubviews {
	[super layoutSubviews];

	if (![self ownsRenderingLayer]) {
		return;
	}

	CGSize renderingSize = self.bounds.size;
	if (renderingSize.width <= 0 || renderingSize.height <= 0) {
		return;
	}

	double contentScaleFactor = _contentScaleFactor;
	CGRect renderingFrame = CGRectMake(0, 0, renderingSize.width, renderingSize.height);
	uint64_t windowId = _windowId;
	godot::Vector2i pixelSize(
			godot::MAX(1, (int32_t)std::lround(renderingSize.width * contentScaleFactor)),
			godot::MAX(1, (int32_t)std::lround(renderingSize.height * contentScaleFactor)));

	[CATransaction begin];
	[CATransaction setDisableActions:YES];
	_renderingLayer.frame = renderingFrame;
	[CATransaction commit];

	if (_lastRequestedPixelSize == pixelSize) {
		return;
	}

	_lastRequestedPixelSize = pixelSize;
	const uint64_t attachmentGeneration = _attachmentGeneration.load();
	const uint64_t resizeGeneration = ++_resizeGeneration;
	CALayer *renderingLayer = _renderingLayer;

	[CATransaction begin];
	[CATransaction setDisableActions:YES];
	renderingLayer.hidden = YES;
	[CATransaction commit];

	const uint64_t engineGeneration = _engineGeneration;
	GodotModule::get_singleton()->runWithInstance(engineGeneration, [=]() {
		if (self->_attachmentGeneration.load() != attachmentGeneration || self->_resizeGeneration.load() != resizeGeneration) {
			return;
		}
		godot::DisplayServerEmbedded *dse = godot::DisplayServerEmbedded::get_singleton();
		if (dse && godot::UtilityFunctions::is_instance_id_valid(windowId)) {
			godot::Object *obj = godot::UtilityFunctions::instance_from_id(windowId);
			godot::Window *window = godot::Object::cast_to<godot::Window>(obj);
			if (window) {
				dse->resize_window(pixelSize, window->get_window_id());
				// Submit a frame at the new size before exposing the layer. This
				// orders CPU work; it is not a GPU presentation-completion signal.
				GodotModule::get_singleton()->iterate();
				dispatch_async(dispatch_get_main_queue(), ^{
					if (![self ownsRenderingLayer] ||
							self->_attachmentGeneration.load() != attachmentGeneration ||
							self->_resizeGeneration.load() != resizeGeneration ||
							self->_windowId != windowId ||
							self->_renderingLayer != renderingLayer) {
						return;
					}

					[CATransaction begin];
					[CATransaction setDisableActions:YES];
					renderingLayer.hidden = NO;
					[CATransaction commit];

					if (self->_eventEmitter) {
						static_cast<const RTNGodotViewEventEmitter &>(*self->_eventEmitter).onSurfaceReady({});
					}
				});
			}
		}
	});
}

- (int)getTouchId:(UITouch *)touch {
	int first = -1;
	for (int i = 0; i < MAX_TOUCH_COUNT; ++i) {
		if (first == -1 && (i >= _touches.size() || _touches[i] == nil)) {
			first = i;
			continue;
		}
		if (_touches[i] == touch) {
			return i;
		}
	}

	if (first != -1) {
		_touches[first] = touch;
		return first;
	}

	return -1;
}

- (void)removeTouchId:(int)touchId {
	_touches[touchId] = nil;
}

- (void)touchesBegan:(NSSet<UITouch *> *)touches
		   withEvent:(UIEvent *)event {
	if (![self ownsRenderingLayer]) {
		return;
	}
	const uint64_t windowId = _windowId;
	const uint64_t engineGeneration = _engineGeneration;
	const uint64_t attachmentGeneration = _attachmentGeneration.load();

	for (UITouch *touch in touches) {
		int touchId = [self getTouchId:touch];
		if (touchId == -1) {
			continue;
		}
		CGPoint location = [touch locationInView:self];
		if (!CGRectContainsPoint(_renderingLayer.frame, location)) {
			continue;
		}
		location.x -= _renderingLayer.frame.origin.x;
		location.y -= _renderingLayer.frame.origin.y;
		NSUInteger tapCount = touch.tapCount;
		double contentScaleFactor = _contentScaleFactor;
		GodotModule::get_singleton()->runWithInstance(engineGeneration, [=]() {
			if (self->_attachmentGeneration.load() != attachmentGeneration) {
				return;
			}
			auto *dse = godot::DisplayServerEmbedded::get_singleton();
			if (dse && godot::UtilityFunctions::is_instance_id_valid(windowId)) {
				godot::Object *obj = godot::UtilityFunctions::instance_from_id(windowId);
				godot::Window *window = godot::Object::cast_to<godot::Window>(obj);
				if (!window) {
					return;
				}
				dse->touch_press(touchId, location.x * contentScaleFactor, location.y * contentScaleFactor, true, tapCount > 1, window->get_window_id());
			}
		});
	}
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches
		   withEvent:(UIEvent *)event {
	if (![self ownsRenderingLayer]) {
		return;
	}
	const uint64_t windowId = _windowId;
	const uint64_t engineGeneration = _engineGeneration;
	const uint64_t attachmentGeneration = _attachmentGeneration.load();

	for (UITouch *touch in touches) {
		int touchId = [self getTouchId:touch];
		if (touchId == -1) {
			continue;
		}
		CGPoint location = [touch locationInView:self];
		if (!CGRectContainsPoint(_renderingLayer.frame, location)) {
			continue;
		}
		location.x -= _renderingLayer.frame.origin.x;
		location.y -= _renderingLayer.frame.origin.y;
		CGPoint prevLocation = [touch previousLocationInView:self];
		if (!CGRectContainsPoint(_renderingLayer.frame, prevLocation)) {
			continue;
		}
		prevLocation.x -= _renderingLayer.frame.origin.x;
		prevLocation.y -= _renderingLayer.frame.origin.y;
		CGFloat alt = touch.altitudeAngle;
		CGVector azim = [touch azimuthUnitVectorInView:self];
		CGFloat force = touch.force;
		CGFloat maximumPossibleForce = touch.maximumPossibleForce;
		double contentScaleFactor = _contentScaleFactor;
		GodotModule::get_singleton()->runWithInstance(engineGeneration, [=]() {
			if (self->_attachmentGeneration.load() != attachmentGeneration) {
				return;
			}
			auto *dse = godot::DisplayServerEmbedded::get_singleton();
			if (dse && godot::UtilityFunctions::is_instance_id_valid(windowId)) {
				godot::Object *obj = godot::UtilityFunctions::instance_from_id(windowId);
				godot::Window *window = godot::Object::cast_to<godot::Window>(obj);
				if (!window) {
					return;
				}
				dse->touch_drag(
						touchId,
						prevLocation.x * contentScaleFactor,
						prevLocation.y * contentScaleFactor,
						location.x * contentScaleFactor,
						location.y * contentScaleFactor,
						force / maximumPossibleForce,
						godot::Vector2(azim.dx * cos(alt), azim.dy * cos(alt)),
						window->get_window_id());
			}
		});
	}
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches
		   withEvent:(UIEvent *)event {
	if (![self ownsRenderingLayer]) {
		return;
	}
	const uint64_t windowId = _windowId;
	const uint64_t engineGeneration = _engineGeneration;
	const uint64_t attachmentGeneration = _attachmentGeneration.load();

	for (UITouch *touch in touches) {
		int touchId = [self getTouchId:touch];
		if (touchId == -1) {
			continue;
		}
		[self removeTouchId:touchId];
		CGPoint location = [touch locationInView:self];
		if (!CGRectContainsPoint(_renderingLayer.frame, location)) {
			continue;
		}
		location.x -= _renderingLayer.frame.origin.x;
		location.y -= _renderingLayer.frame.origin.y;
		double contentScaleFactor = _contentScaleFactor;
		GodotModule::get_singleton()->runWithInstance(engineGeneration, [=]() {
			if (self->_attachmentGeneration.load() != attachmentGeneration) {
				return;
			}
			auto *dse = godot::DisplayServerEmbedded::get_singleton();
			if (dse && godot::UtilityFunctions::is_instance_id_valid(windowId)) {
				godot::Object *obj = godot::UtilityFunctions::instance_from_id(windowId);
				godot::Window *window = godot::Object::cast_to<godot::Window>(obj);
				if (!window) {
					return;
				}
				dse->touch_press(touchId, location.x * contentScaleFactor, location.y * contentScaleFactor, false, false, window->get_window_id());
			}
		});
	}
}

- (void)touchesCancelled:(NSSet<UITouch *> *)touches
			   withEvent:(UIEvent *)event {
	if (![self ownsRenderingLayer]) {
		return;
	}
	const uint64_t windowId = _windowId;
	const uint64_t engineGeneration = _engineGeneration;
	const uint64_t attachmentGeneration = _attachmentGeneration.load();

	for (UITouch *touch in touches) {
		int touchId = [self getTouchId:touch];
		if (touchId == -1) {
			continue;
		}
		[self removeTouchId:touchId];
		GodotModule::get_singleton()->runWithInstance(engineGeneration, [=]() {
			if (self->_attachmentGeneration.load() != attachmentGeneration) {
				return;
			}
			auto *dse = godot::DisplayServerEmbedded::get_singleton();
			if (dse && godot::UtilityFunctions::is_instance_id_valid(windowId)) {
				godot::Object *obj = godot::UtilityFunctions::instance_from_id(windowId);
				godot::Window *window = godot::Object::cast_to<godot::Window>(obj);
				if (!window) {
					return;
				}
				dse->touches_canceled(touchId, window->get_window_id());
			}
		});
	}
}

- (void)willMoveToSuperview:(UIView *)newSuperview {
	[super willMoveToSuperview:newSuperview];
	NSLog(@"RTNGodotView: %@ will move to superview %@", self, newSuperview);
	_isMounted = newSuperview != nil;
	if (newSuperview == nil) {
		[self removeFromGodotView:false unregister:true];
	} else {
		[self addToGodotView];
	}
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
	[super updateProps:props oldProps:oldProps];

	// Handle your props here
	if (props != nullptr &&
			(oldProps == nullptr ||
					std::static_pointer_cast<RTNGodotViewProps const>(oldProps)->windowName !=
							std::static_pointer_cast<RTNGodotViewProps const>(props)->windowName)) {
		const auto &newViewProps = *std::static_pointer_cast<RTNGodotViewProps const>(props);
		[self setWindowName:[NSString stringWithUTF8String:newViewProps.windowName.c_str()]];
	}
}

- (void)didMoveToSuperview {
	[super didMoveToSuperview];
	NSLog(@"RTNGodotView: %@ did move to superview %@", self, self.superview);
}

+ (ComponentDescriptorProvider)componentDescriptorProvider {
	return concreteComponentDescriptorProvider<RTNGodotViewComponentDescriptor>();
}

@end
