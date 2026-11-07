// Lets device_info_plus compile against an iOS SDK older than 26.1.
//
// From 12.4.0 the plugin calls NSProcessInfo.isiOSAppOnVision behind an
// `@available(iOS 26.1, *)` runtime guard. The guard is fine, but the selector
// is only *declared* in the iOS 26.1 SDK, so building with Xcode 26.0 fails at
// compile time:
//
//   No visible @interface for 'NSProcessInfo' declares the selector
//   'isiOSAppOnVision'
//
// Declaring it ourselves is enough: the property needs no implementation, and
// the plugin's own availability check means it is never called on an OS that
// lacks it. The #if makes this vanish as soon as the SDK catches up, so there
// is nothing to remember to remove.
//
// Injected into the device_info_plus pod only, from ios/Podfile.
//
// The whole file sits behind __OBJC__ because OTHER_CFLAGS force-includes it
// into every C and C++ translation unit in the pod as well, and importing
// Foundation from plain C fails with:
//   Module 'ObjectiveC.NSObject' requires feature 'objc'
#ifdef __OBJC__

#import <Foundation/Foundation.h>

#if !defined(__IPHONE_OS_VERSION_MAX_ALLOWED) || __IPHONE_OS_VERSION_MAX_ALLOWED < 260100
@interface NSProcessInfo (BusAssistVisionCompat)
@property (readonly, getter=isiOSAppOnVision) BOOL iOSAppOnVision;
@end
#endif

#endif  // __OBJC__
