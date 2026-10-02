import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

abstract interface class TokenStorage {
  Future<String?> readRefreshToken();
  Future<void> writeRefreshToken(String token);
  Future<void> deleteRefreshToken();
  Future<String> getOrCreateDeviceId();
}

class SecureTokenStorage implements TokenStorage {
  SecureTokenStorage({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const _refreshTokenKey = 'patient_refresh_token';
  static const _deviceIdKey = 'installation_device_id';
  final FlutterSecureStorage _storage;

  @override
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  @override
  Future<void> writeRefreshToken(String token) =>
      _storage.write(key: _refreshTokenKey, value: token);

  @override
  Future<void> deleteRefreshToken() => _storage.delete(key: _refreshTokenKey);

  @override
  Future<String> getOrCreateDeviceId() async {
    final current = await _storage.read(key: _deviceIdKey);
    if (current != null && current.isNotEmpty) return current;

    final deviceId = const Uuid().v4();
    await _storage.write(key: _deviceIdKey, value: deviceId);
    return deviceId;
  }
}

class MemoryTokenStorage implements TokenStorage {
  String? refreshToken;
  String? deviceId;

  @override
  Future<void> deleteRefreshToken() async => refreshToken = null;

  @override
  Future<String> getOrCreateDeviceId() async => deviceId ??= const Uuid().v4();

  @override
  Future<String?> readRefreshToken() async => refreshToken;

  @override
  Future<void> writeRefreshToken(String token) async => refreshToken = token;
}
