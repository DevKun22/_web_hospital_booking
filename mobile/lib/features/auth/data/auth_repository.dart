import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/core/network/session_refresh_coordinator.dart';
import 'package:hospital_booking_mobile/core/storage/token_storage.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';

class AuthRepository {
  AuthRepository({
    required Dio authDio,
    required Dio authenticatedDio,
    required TokenStorage tokenStorage,
    required SessionRefreshCoordinator refreshCoordinator,
  }) : _authDio = authDio,
       _authenticatedDio = authenticatedDio,
       _tokenStorage = tokenStorage,
       _refreshCoordinator = refreshCoordinator;

  final Dio _authDio;
  final Dio _authenticatedDio;
  final TokenStorage _tokenStorage;
  final SessionRefreshCoordinator _refreshCoordinator;

  Future<OtpChallenge> requestOtp(String phone) async {
    try {
      final response = await _authDio.post<dynamic>(
        '/auth/patient/request-otp',
        data: {'phone': phone.trim()},
      );
      return OtpChallenge.fromJson(requireDataMap(response.data));
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<AuthSession> verifyOtp({
    required String challengeId,
    required String otp,
  }) async {
    try {
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
      await _refreshCoordinator.persist(session);
      return session;
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<AuthSession> restoreSession() => _refreshCoordinator.refresh();

  Future<void> logout() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    try {
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _authDio.post<dynamic>(
          '/auth/logout',
          data: {'refreshToken': refreshToken},
        );
      }
    } on DioException {
      // Local logout must still complete when the server is unavailable.
    } finally {
      await _refreshCoordinator.clear();
    }
  }

  Future<void> verifyAuthenticatedConnection() async {
    try {
      await _authenticatedDio.get<dynamic>('/me');
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  String get _platformName => switch (defaultTargetPlatform) {
    TargetPlatform.iOS => 'ios',
    TargetPlatform.android => 'android',
    _ => 'web',
  };
}
