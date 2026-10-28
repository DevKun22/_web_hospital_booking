import 'package:shared_preferences/shared_preferences.dart';

abstract interface class AppPreferences {
  Future<bool> hasSeenWelcome();
  Future<void> setWelcomeSeen();
  Future<bool> hasRequestedNotificationPermission();
  Future<void> setNotificationPermissionRequested();
  Future<bool> isAppLockEnabled();
  Future<void> setAppLockEnabled(bool enabled);
}

class SharedAppPreferences implements AppPreferences {
  SharedAppPreferences({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const _welcomeSeenKey = 'welcome_seen_v1';
  static const _notificationPermissionRequestedKey =
      'notification_permission_requested_v1';
  static const _appLockEnabledKey = 'app_lock_enabled_v1';
  final SharedPreferencesAsync _preferences;

  @override
  Future<bool> hasSeenWelcome() async =>
      await _preferences.getBool(_welcomeSeenKey) ?? false;

  @override
  Future<void> setWelcomeSeen() => _preferences.setBool(_welcomeSeenKey, true);

  @override
  Future<bool> hasRequestedNotificationPermission() async =>
      await _preferences.getBool(_notificationPermissionRequestedKey) ?? false;

  @override
  Future<void> setNotificationPermissionRequested() =>
      _preferences.setBool(_notificationPermissionRequestedKey, true);

  @override
  Future<bool> isAppLockEnabled() async =>
      await _preferences.getBool(_appLockEnabledKey) ?? false;

  @override
  Future<void> setAppLockEnabled(bool enabled) =>
      _preferences.setBool(_appLockEnabledKey, enabled);
}

class MemoryAppPreferences implements AppPreferences {
  MemoryAppPreferences({
    this.welcomeSeen = false,
    this.notificationPermissionRequested = false,
    this.appLockEnabled = false,
  });

  bool welcomeSeen;
  bool notificationPermissionRequested;
  bool appLockEnabled;

  @override
  Future<bool> hasSeenWelcome() async => welcomeSeen;

  @override
  Future<void> setWelcomeSeen() async => welcomeSeen = true;

  @override
  Future<bool> hasRequestedNotificationPermission() async =>
      notificationPermissionRequested;

  @override
  Future<void> setNotificationPermissionRequested() async =>
      notificationPermissionRequested = true;

  @override
  Future<bool> isAppLockEnabled() async => appLockEnabled;

  @override
  Future<void> setAppLockEnabled(bool enabled) async =>
      appLockEnabled = enabled;
}
