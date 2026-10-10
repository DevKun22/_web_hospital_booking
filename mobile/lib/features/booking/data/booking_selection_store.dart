import 'dart:convert';

import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract interface class BookingSelectionStore {
  Future<BookingSelection?> read();
  Future<void> write(BookingSelection selection);
  Future<void> clear();
}

class SharedBookingSelectionStore implements BookingSelectionStore {
  SharedBookingSelectionStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const _key = 'booking_selection_v1';
  final SharedPreferencesAsync _preferences;

  @override
  Future<BookingSelection?> read() async {
    final raw = await _preferences.getString(_key);
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw);
      return json is Map
          ? BookingSelection.fromJson(Map<String, dynamic>.from(json))
          : null;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(BookingSelection selection) =>
      _preferences.setString(_key, jsonEncode(selection.toJson()));

  @override
  Future<void> clear() => _preferences.remove(_key);
}

class MemoryBookingSelectionStore implements BookingSelectionStore {
  MemoryBookingSelectionStore([this.selection]);

  BookingSelection? selection;

  @override
  Future<BookingSelection?> read() async => selection;

  @override
  Future<void> write(BookingSelection selection) async =>
      this.selection = selection;

  @override
  Future<void> clear() async => selection = null;
}
