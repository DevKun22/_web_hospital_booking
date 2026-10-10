import 'package:dio/dio.dart';

enum ApiErrorKind {
  validation,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  rateLimited,
  timeout,
  network,
  server,
  unknown,
}

class FieldError {
  const FieldError({required this.field, required this.message});

  factory FieldError.fromJson(Map<String, dynamic> json) => FieldError(
    field: json['field']?.toString() ?? '',
    message: json['message']?.toString() ?? 'Dữ liệu không hợp lệ',
  );

  final String field;
  final String message;
}

class ApiException implements Exception {
  const ApiException({
    required this.kind,
    required this.message,
    this.code,
    this.requestId,
    this.statusCode,
    this.errors = const [],
  });

  factory ApiException.fromDio(DioException error) {
    final statusCode = error.response?.statusCode;
    final body = error.response?.data;
    final json = body is Map
        ? Map<String, dynamic>.from(body)
        : const <String, dynamic>{};
    final rawErrors = json['errors'];
    final errors = rawErrors is List
        ? rawErrors
              .whereType<Map>()
              .map(
                (item) => FieldError.fromJson(Map<String, dynamic>.from(item)),
              )
              .toList(growable: false)
        : const <FieldError>[];

    final isTimeout = {
      DioExceptionType.connectionTimeout,
      DioExceptionType.sendTimeout,
      DioExceptionType.receiveTimeout,
    }.contains(error.type);
    final isNetwork =
        {
          DioExceptionType.connectionError,
          DioExceptionType.unknown,
        }.contains(error.type) &&
        error.response == null;

    final kind = isTimeout
        ? ApiErrorKind.timeout
        : isNetwork
        ? ApiErrorKind.network
        : switch (statusCode) {
            400 => ApiErrorKind.validation,
            401 => ApiErrorKind.unauthorized,
            403 => ApiErrorKind.forbidden,
            404 => ApiErrorKind.notFound,
            409 => ApiErrorKind.conflict,
            410 => ApiErrorKind.conflict,
            422 => ApiErrorKind.validation,
            429 => ApiErrorKind.rateLimited,
            int value when value >= 500 => ApiErrorKind.server,
            _ => ApiErrorKind.unknown,
          };

    return ApiException(
      kind: kind,
      statusCode: statusCode,
      code: json['code']?.toString(),
      requestId: json['requestId']?.toString(),
      errors: errors,
      message:
          json['message']?.toString() ??
          switch (kind) {
            ApiErrorKind.timeout => 'Kết nối quá thời gian. Vui lòng thử lại.',
            ApiErrorKind.network =>
              'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.',
            ApiErrorKind.server => 'Hệ thống đang bận. Vui lòng thử lại sau.',
            ApiErrorKind.rateLimited =>
              'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
            _ => 'Đã xảy ra lỗi. Vui lòng thử lại.',
          },
    );
  }

  final ApiErrorKind kind;
  final String message;
  final String? code;
  final String? requestId;
  final int? statusCode;
  final List<FieldError> errors;

  bool get invalidatesSession =>
      kind == ApiErrorKind.unauthorized ||
      code == 'REFRESH_TOKEN_REUSE' ||
      code == 'SESSION_REVOKED' ||
      code == 'SESSION_EXPIRED';

  @override
  String toString() => 'ApiException($code, $message, requestId: $requestId)';
}
