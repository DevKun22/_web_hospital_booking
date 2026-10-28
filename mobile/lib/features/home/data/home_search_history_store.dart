import 'dart:convert';

import 'package:hospital_booking_mobile/features/home/domain/home_search_history_entry.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract interface class HomeSearchHistoryStore {
  Future<List<HomeSearchHistoryEntry>> read();
  Future<void> remember(HomeSearchHistoryEntry entry);
  Future<void> clear();
}

class SharedHomeSearchHistoryStore implements HomeSearchHistoryStore {
  SharedHomeSearchHistoryStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const _storageKey = 'home_search_history_v1';
  static const _maxItems = 5;
  final SharedPreferencesAsync _preferences;

  @override
  Future<List<HomeSearchHistoryEntry>> read() async {
    final encoded = await _preferences.getStringList(_storageKey) ?? const [];
    return encoded
        .map(_decode)
        .whereType<HomeSearchHistoryEntry>()
        .where((item) => item.isValid)
        .take(_maxItems)
        .toList(growable: false);
  }

  @override
  Future<void> remember(HomeSearchHistoryEntry entry) async {
    if (!entry.isValid) return;
    final current = await read();
    final updated = <HomeSearchHistoryEntry>[
      entry,
      ...current.where((item) => item.location != entry.location),
    ].take(_maxItems);
    await _preferences.setStringList(
      _storageKey,
      updated.map((item) => jsonEncode(item.toJson())).toList(growable: false),
    );
  }

  @override
  Future<void> clear() => _preferences.remove(_storageKey);

  HomeSearchHistoryEntry? _decode(String value) {
    try {
      final json = jsonDecode(value);
      if (json is! Map) return null;
      return HomeSearchHistoryEntry.fromJson(Map<String, dynamic>.from(json));
    } catch (_) {
      return null;
    }
  }
}

class MemoryHomeSearchHistoryStore implements HomeSearchHistoryStore {
  MemoryHomeSearchHistoryStore([
    Iterable<HomeSearchHistoryEntry> initial = const [],
  ]) : entries = initial.take(5).toList();

  final List<HomeSearchHistoryEntry> entries;

  @override
  Future<List<HomeSearchHistoryEntry>> read() async =>
      List.unmodifiable(entries);

  @override
  Future<void> remember(HomeSearchHistoryEntry entry) async {
    if (!entry.isValid) return;
    entries.removeWhere((item) => item.location == entry.location);
    entries.insert(0, entry);
    if (entries.length > 5) entries.removeRange(5, entries.length);
  }

  @override
  Future<void> clear() async => entries.clear();
}
