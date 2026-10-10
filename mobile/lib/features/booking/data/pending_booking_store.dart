import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

abstract interface class PendingBookingStore {
  Future<PendingBooking?> read();
  Future<void> write(PendingBooking pending);
  Future<void> clear();
}

class SecurePendingBookingStore implements PendingBookingStore {
  SecurePendingBookingStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'pending_booking_otp_v1';
  final FlutterSecureStorage _storage;

  @override
  Future<PendingBooking?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw);
      return json is Map
          ? PendingBooking.fromJson(Map<String, dynamic>.from(json))
          : null;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> write(PendingBooking pending) =>
      _storage.write(key: _key, value: jsonEncode(pending.toSecureJson()));

  @override
  Future<void> clear() => _storage.delete(key: _key);
}

class MemoryPendingBookingStore implements PendingBookingStore {
  MemoryPendingBookingStore([this.pending]);

  PendingBooking? pending;

  @override
  Future<PendingBooking?> read() async => pending;

  @override
  Future<void> write(PendingBooking pending) async => this.pending = pending;

  @override
  Future<void> clear() async => pending = null;
}
