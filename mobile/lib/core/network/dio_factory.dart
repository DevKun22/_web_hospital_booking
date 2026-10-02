import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';
import 'package:hospital_booking_mobile/core/network/access_token_store.dart';
import 'package:hospital_booking_mobile/core/network/session_refresh_coordinator.dart';

Dio createBaseDio(AppConfig config) {
  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: config.connectTimeout,
      receiveTimeout: config.receiveTimeout,
      sendTimeout: config.connectTimeout,
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
      headers: const {'Accept': Headers.jsonContentType},
    ),
  );

  if (config.enableNetworkLogs) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          debugPrint('[HTTP] ${options.method} ${options.uri.path}');
          handler.next(options);
        },
        onResponse: (response, handler) {
          debugPrint(
            '[HTTP] ${response.statusCode} '
            '${response.requestOptions.uri.path}',
          );
          handler.next(response);
        },
        onError: (error, handler) {
          debugPrint(
            '[HTTP] ${error.response?.statusCode ?? 'ERR'} '
            '${error.requestOptions.uri.path}',
          );
          handler.next(error);
        },
      ),
    );
  }
  return dio;
}

Dio createAuthenticatedDio({
  required AppConfig config,
  required AccessTokenStore accessTokenStore,
  required SessionRefreshCoordinator refreshCoordinator,
}) {
  final dio = createBaseDio(config);
  dio.interceptors.add(
    QueuedInterceptorsWrapper(
      onRequest: (options, handler) {
        final token = accessTokenStore.accessToken;
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final options = error.requestOptions;
        final shouldRefresh =
            error.response?.statusCode == 401 &&
            options.extra['authRetried'] != true &&
            !options.path.contains('/auth/refresh');

        if (!shouldRefresh) {
          handler.next(error);
          return;
        }

        try {
          final session = await refreshCoordinator.refresh();
          options.extra['authRetried'] = true;
          options.headers['Authorization'] = 'Bearer ${session.accessToken}';
          final response = await dio.fetch<dynamic>(options);
          handler.resolve(response);
        } catch (_) {
          handler.next(error);
        }
      },
    ),
  );
  return dio;
}
