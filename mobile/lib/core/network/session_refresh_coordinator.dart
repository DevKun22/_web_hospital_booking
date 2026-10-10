import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/access_token_store.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/core/network/session_events.dart';
import 'package:hospital_booking_mobile/core/storage/token_storage.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';

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
  Future<AuthSession>? _refreshing;

  Future<AuthSession> refresh() {
    final current = _refreshing;
    if (current != null) return current;

    late final Future<AuthSession> operation;
    operation = _performRefresh().whenComplete(() {
      if (identical(_refreshing, operation)) _refreshing = null;
    });
    _refreshing = operation;
    return operation;
  }

  Future<void> persist(AuthSession session) async {
    if (!session.isValid) {
      throw const ApiException(
        kind: ApiErrorKind.unknown,
        code: 'INVALID_AUTH_CONTRACT',
        message: 'Thông tin đăng nhập không hợp lệ.',
      );
    }
    _accessTokenStore.set(session.accessToken);
    await _tokenStorage.writeRefreshToken(session.refreshToken);
  }

  Future<void> clear({bool notify = false}) async {
    _accessTokenStore.clear();
    await _tokenStorage.deleteRefreshToken();
    if (notify) _sessionEvents.invalidate();
  }

  Future<AuthSession> _performRefresh() async {
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
      final session = AuthSession.fromJson(requireDataMap(response.data));
      await persist(session);
      return session;
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
