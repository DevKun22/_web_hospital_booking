import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';
import 'package:hospital_booking_mobile/core/network/access_token_store.dart';
import 'package:hospital_booking_mobile/core/network/dio_factory.dart';
import 'package:hospital_booking_mobile/core/network/session_events.dart';
import 'package:hospital_booking_mobile/core/network/session_refresh_coordinator.dart';
import 'package:hospital_booking_mobile/core/storage/token_storage.dart';

class _MemoryTokenStorage implements TokenStorage {
  String? refreshToken = 'refresh-1';

  @override
  Future<String?> readRefreshToken() async => refreshToken;

  @override
  Future<void> writeRefreshToken(String token) async => refreshToken = token;

  @override
  Future<void> deleteRefreshToken() async => refreshToken = null;

  @override
  Future<String> getOrCreateDeviceId() async => 'device-1';
}

typedef _Handler = FutureOr<ResponseBody> Function(RequestOptions options);

class _ScriptedAdapter implements HttpClientAdapter {
  _ScriptedAdapter(this._handler);

  final _Handler _handler;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return _handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int status, Object body) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

final _config = AppConfig(
  environment: AppEnvironment.development,
  apiBaseUrl: 'http://api.test/api/v1',
  connectTimeout: const Duration(seconds: 5),
  receiveTimeout: const Duration(seconds: 5),
  enableNetworkLogs: false,
);

class _Harness {
  _Harness({required _Handler api, int refreshStatus = 200}) {
    tokenStore.set('old-token');
    refreshAdapter = _ScriptedAdapter((options) async {
      if (refreshStatus != 200) {
        return _json(refreshStatus, {
          'success': false,
          'message': 'refresh failed',
        });
      }
      refreshCalls++;
      return _json(200, {
        'success': true,
        'data': {
          'accessToken': 'new-token',
          'refreshToken': 'refresh-${refreshCalls + 1}',
          'user': {'id': 'user-1', 'fullName': 'An'},
        },
      });
    });
    final authDio = createBaseDio(_config)..httpClientAdapter = refreshAdapter;
    coordinator = SessionRefreshCoordinator(
      authDio: authDio,
      tokenStorage: storage,
      accessTokenStore: tokenStore,
      sessionEvents: events,
    );
    apiAdapter = _ScriptedAdapter(api);
    dio = createAuthenticatedDio(
      config: _config,
      accessTokenStore: tokenStore,
      refreshCoordinator: coordinator,
    )..httpClientAdapter = apiAdapter;
  }

  final storage = _MemoryTokenStorage();
  final tokenStore = AccessTokenStore();
  final events = SessionEvents();
  late final _ScriptedAdapter refreshAdapter;
  late final _ScriptedAdapter apiAdapter;
  late final SessionRefreshCoordinator coordinator;
  late final Dio dio;
  int refreshCalls = 0;
}

void main() {
  test(
    'retries once with the refreshed token and returns the result',
    () async {
      final harness = _Harness(
        api: (options) => options.headers['Authorization'] == 'Bearer old-token'
            ? _json(401, {'success': false})
            : _json(200, {'success': true, 'data': <String, dynamic>{}}),
      );

      final response = await harness.dio
          .get<dynamic>('/me')
          .timeout(const Duration(seconds: 5));

      expect(response.statusCode, 200);
      expect(harness.refreshCalls, 1);
      expect(harness.apiAdapter.requests, hasLength(2));
    },
  );

  test(
    'a retried request that fails with 404 completes instead of hanging',
    () async {
      final harness = _Harness(
        api: (options) => options.headers['Authorization'] == 'Bearer old-token'
            ? _json(401, {'success': false})
            : _json(404, {'success': false, 'message': 'Không tìm thấy'}),
      );

      Object? failure;
      try {
        await harness.dio
            .get<dynamic>('/appointments/missing')
            .timeout(const Duration(seconds: 5));
      } catch (error) {
        failure = error;
      }

      expect(failure, isA<DioException>(), reason: 'yêu cầu phải kết thúc');
      expect((failure! as DioException).response?.statusCode, 404);
    },
  );

  test(
    'requests that failed with the same stale token refresh only once',
    () async {
      final harness = _Harness(
        api: (options) => options.headers['Authorization'] == 'Bearer old-token'
            ? _json(401, {'success': false})
            : _json(200, {'success': true, 'data': <String, dynamic>{}}),
      );

      final results = await Future.wait([
        harness.dio.get<dynamic>('/me'),
        harness.dio.get<dynamic>('/me/appointments'),
        harness.dio.get<dynamic>('/me/invoices'),
      ]).timeout(const Duration(seconds: 5));

      expect(results.map((r) => r.statusCode), everyElement(200));
      expect(
        harness.refreshCalls,
        1,
        reason: 'một phiên hết hạn chỉ cần một lần làm mới',
      );
    },
  );

  test(
    'a slow request rejected after the session was refreshed reuses the new token',
    () async {
      final harness = _Harness(
        api: (options) async {
          final stale = options.headers['Authorization'] == 'Bearer old-token';
          if (stale && options.path.endsWith('/slow')) {
            await Future<void>.delayed(const Duration(milliseconds: 150));
          }
          return stale
              ? _json(401, {'success': false})
              : _json(200, {'success': true, 'data': <String, dynamic>{}});
        },
      );

      final results = await Future.wait([
        harness.dio.get<dynamic>('/slow'),
        harness.dio.get<dynamic>('/me'),
      ]).timeout(const Duration(seconds: 5));

      expect(results.map((r) => r.statusCode), everyElement(200));
      expect(harness.refreshCalls, 1);
    },
  );

  test(
    'a refresh rejected with 401 ends the session and surfaces the 401',
    () async {
      final harness = _Harness(
        api: (options) => _json(401, {'success': false}),
        refreshStatus: 401,
      );
      var invalidated = 0;
      harness.events.invalidated.listen((_) => invalidated++);

      Object? failure;
      try {
        await harness.dio
            .get<dynamic>('/me')
            .timeout(const Duration(seconds: 5));
      } catch (error) {
        failure = error;
      }
      await Future<void>.delayed(Duration.zero);

      expect((failure! as DioException).response?.statusCode, 401);
      expect(invalidated, 1);
      expect(harness.tokenStore.hasToken, isFalse);
      expect(harness.storage.refreshToken, isNull);
    },
  );
}
