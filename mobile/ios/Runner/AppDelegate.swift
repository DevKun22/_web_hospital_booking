import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    if let controller = window?.rootViewController as? FlutterViewController {
      let settingsChannel = FlutterMethodChannel(
        name: "com.hospitalbooking.hospital_booking_mobile/settings",
        binaryMessenger: controller.binaryMessenger
      )
      settingsChannel.setMethodCallHandler { call, result in
        guard call.method == "openNotificationSettings" else {
          result(FlutterMethodNotImplemented)
          return
        }
        guard let url = URL(string: UIApplication.openSettingsURLString),
              UIApplication.shared.canOpenURL(url) else {
          result(false)
          return
        }
        UIApplication.shared.open(url, options: [:]) { opened in
          result(opened)
        }
      }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
