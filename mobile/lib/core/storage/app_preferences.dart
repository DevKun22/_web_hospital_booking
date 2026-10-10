import 'package:shared_preferences/shared_preferences.dart';

abstract interface class AppPreferences {
  Future<bool> hasSeenWelcome();
  Future<void> setWelcomeSeen();
}

class SharedAppPreferences implements AppPreferences {
  SharedAppPreferences({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const _welcomeSeenKey = 'welcome_seen_v1';
  final SharedPreferencesAsync _preferences;

  @override
  Future<bool> hasSeenWelcome() async =>
      await _preferences.getBool(_welcomeSeenKey) ?? false;

  @override
  Future<void> setWelcomeSeen() => _preferences.setBool(_welcomeSeenKey, true);
}

class MemoryAppPreferences implements AppPreferences {
  MemoryAppPreferences({this.welcomeSeen = false});

  bool welcomeSeen;

  @override
  Future<bool> hasSeenWelcome() async => welcomeSeen;

  @override
  Future<void> setWelcomeSeen() async => welcomeSeen = true;
}
