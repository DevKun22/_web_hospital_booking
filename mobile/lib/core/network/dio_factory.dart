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
  // Không dùng QueuedInterceptorsWrapper: yêu cầu gọi lại đi qua chính `dio` nên nếu hàng đợi lỗi
  // đang giữ bởi lần xử lý 401 đầu tiên thì lỗi của yêu cầu gọi lại (ví dụ 404) chờ hàng đợi đó
  // và lần xử lý đầu chờ yêu cầu gọi lại: treo vĩnh viễn. Làm mới phiên đã được gộp thành một
  // lần chạy duy nhất trong `SessionRefreshCoordinator.refresh`.
  dio.interceptors.add(
    InterceptorsWrapper(
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

        final String token;
        try {
          // Yêu cầu bị 401 vì mang token cũ mà phiên đã được làm mới trong lúc chờ: dùng luôn
          // token hiện tại, không làm mới thêm lần nữa (mỗi lần làm mới xoay refresh token).
          final current = accessTokenStore.accessToken;
          final sentWithCurrentToken =
              current != null &&
              options.headers['Authorization'] == 'Bearer $current';
          token = current != null && current.isNotEmpty && !sentWithCurrentToken
              ? current
              : (await refreshCoordinator.refresh()).accessToken;
        } catch (_) {
          // Không làm mới được phiên: trả lỗi 401 gốc cho nơi gọi.
          handler.next(error);
          return;
        }

        options.extra['authRetried'] = true;
        options.headers['Authorization'] = 'Bearer $token';
        try {
          handler.resolve(await dio.fetch<dynamic>(options));
        } on DioException catch (retryError) {
          // Giữ nguyên lỗi thật của lần gọi lại (404, 409, 422, ...), không che bằng 401 cũ.
          handler.reject(retryError);
        } catch (_) {
          handler.next(error);
        }
      },
    ),
  );
  return dio;
}
