import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/access_token_store.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/core/network/session_events.dart';
import 'package:hospital_booking_mobile/core/storage/token_storage.dart';

/// Kết quả làm mới phiên: cặp token đã lưu cùng dữ liệu thô máy chủ trả về, để tính năng
/// đăng nhập tự dựng mô hình người dùng mà lớp hạ tầng không cần biết mô hình đó.
class RefreshedSession {
  const RefreshedSession({
    required this.accessToken,
    required this.refreshToken,
    required this.payload,
  });

  final String accessToken;
  final String refreshToken;
  final Map<String, dynamic> payload;
}

class SessionRefreshCoordinator {
  SessionRefreshCoordinator({
    required Dio authDio,
    required TokenStorage tokenStorage,
    required AccessTokenStore accessTokenStore,
    required SessionEvents sessionEvents,
  }) : _authDio = authDio,
       _tokenStorage = tokenStorage,
       _accessTokenStore = accessTokenStore,
       _sessionEvents = sessionEvents;

  final Dio _authDio;
  final TokenStorage _tokenStorage;
  final AccessTokenStore _accessTokenStore;
  final SessionEvents _sessionEvents;
  Future<RefreshedSession>? _refreshing;

  Future<RefreshedSession> refresh() {
    final current = _refreshing;
    if (current != null) return current;

    late final Future<RefreshedSession> operation;
    operation = _performRefresh().whenComplete(() {
      if (identical(_refreshing, operation)) _refreshing = null;
    });
    _refreshing = operation;
    return operation;
  }

  Future<void> persist({
    required String accessToken,
    required String refreshToken,
  }) async {
    if (accessToken.isEmpty || refreshToken.isEmpty) {
      throw const ApiException(
        kind: ApiErrorKind.unknown,
        code: 'INVALID_AUTH_CONTRACT',
        message: 'Thông tin đăng nhập không hợp lệ.',
      );
    }
    _accessTokenStore.set(accessToken);
    await _tokenStorage.writeRefreshToken(refreshToken);
  }

  Future<void> clear({bool notify = false}) async {
    _accessTokenStore.clear();
    await _tokenStorage.deleteRefreshToken();
    if (notify) _sessionEvents.invalidate();
  }

  Future<RefreshedSession> _performRefresh() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      throw const ApiException(
        kind: ApiErrorKind.unauthorized,
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Chưa có phiên đăng nhập.',
      );
    }

    try {
      final deviceId = await _tokenStorage.getOrCreateDeviceId();
      final response = await _authDio.post<dynamic>(
        '/auth/refresh',
        data: {
          'refreshToken': refreshToken,
          'deviceId': deviceId,
          'deviceName': 'Flutter ${defaultTargetPlatform.name}',
          'platform': _platformName,
        },
      );
      final payload = requireDataMap(response.data);
      final user = payload['user'];
      final accessToken = payload['accessToken']?.toString() ?? '';
      final newRefreshToken = payload['refreshToken']?.toString() ?? '';
      if (user is! Map || (user['id']?.toString() ?? '').isEmpty) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_AUTH_CONTRACT',
          message: 'Thông tin đăng nhập không hợp lệ.',
        );
      }
      await persist(accessToken: accessToken, refreshToken: newRefreshToken);
      return RefreshedSession(
        accessToken: accessToken,
        refreshToken: newRefreshToken,
        payload: payload,
      );
    } on DioException catch (error) {
      final exception = ApiException.fromDio(error);
      if (exception.invalidatesSession) {
        await clear(notify: true);
      }
      throw exception;
    }
  }

  String get _platformName => switch (defaultTargetPlatform) {
    TargetPlatform.iOS => 'ios',
    TargetPlatform.android => 'android',
    _ => 'web',
  };
}
