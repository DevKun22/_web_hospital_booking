import 'dart:convert';

import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract interface class HomeContentCache {
  Future<HomeContent?> read();
  Future<void> write(HomeContent content);
}

class SharedHomeContentCache implements HomeContentCache {
  SharedHomeContentCache({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const _cacheKey = 'home_content_v1';
  final SharedPreferencesAsync _preferences;

  @override
  Future<HomeContent?> read() async {
    final raw = await _preferences.getString(_cacheKey);
    if (raw == null) return null;

    try {
      final json = jsonDecode(raw);
      return json is Map
          ? HomeContent.fromJson(Map<String, dynamic>.from(json))
          : null;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(HomeContent content) =>
      _preferences.setString(_cacheKey, jsonEncode(content.toJson()));
}

class MemoryHomeContentCache implements HomeContentCache {
  MemoryHomeContentCache([this.content]);

  HomeContent? content;

  @override
  Future<HomeContent?> read() async => content;

  @override
  Future<void> write(HomeContent content) async => this.content = content;
}
