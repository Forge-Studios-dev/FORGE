import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let messenger = engineBridge.applicationRegistrar.messenger()
    let channel = FlutterMethodChannel(name: "forge/pip", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "isSupported":
        result(PipManager.shared.isSupported())
      case "setAutoEnter":
        if let enabled = call.arguments as? Bool {
          // Android-shaped call (bool only) — ignore URL on iOS.
          PipManager.shared.setAutoEnter(enabled: enabled, url: nil, positionMs: 0)
          result(nil)
          return
        }
        let args = call.arguments as? [String: Any]
        let enabled = args?["enabled"] as? Bool ?? false
        let url = args?["url"] as? String
        let positionMs: Int64
        if let n = args?["positionMs"] as? NSNumber {
          positionMs = n.int64Value
        } else if let i = args?["positionMs"] as? Int {
          positionMs = Int64(i)
        } else {
          positionMs = 0
        }
        PipManager.shared.setAutoEnter(enabled: enabled, url: url, positionMs: positionMs)
        result(nil)
      case "enter":
        let args = call.arguments as? [String: Any]
        guard let url = args?["url"] as? String, !url.isEmpty else {
          // Android Activity PiP needs no URL; iOS requires HLS.
          result(false)
          return
        }
        let positionMs: Int64
        if let n = args?["positionMs"] as? NSNumber {
          positionMs = n.int64Value
        } else if let i = args?["positionMs"] as? Int {
          positionMs = Int64(i)
        } else {
          positionMs = 0
        }
        result(PipManager.shared.enter(url: url, positionMs: positionMs))
      case "stop":
        PipManager.shared.stop()
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }
}
