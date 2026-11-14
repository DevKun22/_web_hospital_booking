import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/core/network/session_refresh_coordinator.dart';
import 'package:hospital_booking_mobile/core/storage/token_storage.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class AuthRepository {
  AuthRepository({
    required Dio authDio,
    required Dio authenticatedDio,
    required TokenStorage tokenStorage,
    required SessionRefreshCoordinator refreshCoordinator,
    Duration logoutRequestTimeout = const Duration(seconds: 3),
  }) : _authDio = authDio,
       _authenticatedDio = authenticatedDio,
       _tokenStorage = tokenStorage,
       _refreshCoordinator = refreshCoordinator,
       _logoutRequestTimeout = logoutRequestTimeout;

  final Dio _authDio;
  final Dio _authenticatedDio;
  final TokenStorage _tokenStorage;
  final SessionRefreshCoordinator _refreshCoordinator;
  final Duration _logoutRequestTimeout;

  /// [identifier] là số điện thoại hoặc email đã dùng khi đặt lịch.
  Future<OtpChallenge> requestOtp(String identifier) async {
    final value = identifier.trim();
    return guardApi(() async {
      final response = await _authDio.post<dynamic>(
        '/auth/patient/request-otp',
        data: value.contains('@')
            ? {'email': value.toLowerCase()}
            : {'phone': value},
      );
      return OtpChallenge.fromJson(requireDataMap(response.data));
    });
  }

  Future<AuthSession> verifyOtp({
    required String challengeId,
    required String otp,
  }) async {
    return guardApi(() async {
      final deviceId = await _tokenStorage.getOrCreateDeviceId();
      final response = await _authDio.post<dynamic>(
        '/auth/patient/verify-otp',
        data: {
          'challengeId': challengeId,
          'otp': otp.trim(),
          'deviceId': deviceId,
          'deviceName': 'Flutter ${defaultTargetPlatform.name}',
          'platform': _platformName,
        },
      );
      final session = AuthSession.fromJson(requireDataMap(response.data));
      if (!session.isValid) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_AUTH_CONTRACT',
          message: 'Thông tin đăng nhập không hợp lệ.',
        );
      }
      await _refreshCoordinator.persist(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      );
      return session;
    });
  }

  Future<AuthSession?> restoreSession() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) return null;
    return AuthSession.fromJson((await _refreshCoordinator.refresh()).payload);
  }

  Future<void> logout() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    try {
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _authDio
            .post<dynamic>('/auth/logout', data: {'refreshToken': refreshToken})
            .timeout(_logoutRequestTimeout);
      }
    } on DioException catch (_) {
      // Local logout must still complete when the server is unavailable.
    } on TimeoutException catch (_) {
      // Local logout must still complete when the server is unavailable.
    } finally {
      await _refreshCoordinator.clear();
    }
  }

  Future<void> verifyAuthenticatedConnection() async {
    return guardApi(() async {
      await _authenticatedDio.get<dynamic>('/me');
    });
  }

  String get _platformName => switch (defaultTargetPlatform) {
    TargetPlatform.iOS => 'ios',
    TargetPlatform.android => 'android',
    _ => 'web',
  };
}
