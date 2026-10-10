import 'package:flutter/foundation.dart';

enum AppEnvironment { development, production }

class AppConfig {
  factory AppConfig({
    required AppEnvironment environment,
    required String apiBaseUrl,
    required Duration connectTimeout,
    required Duration receiveTimeout,
    required bool enableNetworkLogs,
  }) {
    final normalizedUrl = _normalizeBaseUrl(apiBaseUrl);
    if (environment == AppEnvironment.production &&
        Uri.parse(normalizedUrl).scheme != 'https') {
      throw ArgumentError.value(
        normalizedUrl,
        'apiBaseUrl',
        'Production bắt buộc dùng HTTPS',
      );
    }
    return AppConfig._(
      environment: environment,
      apiBaseUrl: normalizedUrl,
      connectTimeout: connectTimeout,
      receiveTimeout: receiveTimeout,
      enableNetworkLogs: enableNetworkLogs,
    );
  }

  const AppConfig._({
    required this.environment,
    required this.apiBaseUrl,
    required this.connectTimeout,
    required this.receiveTimeout,
    required this.enableNetworkLogs,
  });

  factory AppConfig.fromEnvironment({
    AppEnvironment defaultEnvironment = AppEnvironment.development,
  }) {
    const environmentValue = String.fromEnvironment('APP_ENV');
    final environment = switch (environmentValue.toLowerCase()) {
      'production' || 'prod' => AppEnvironment.production,
      'development' || 'dev' => AppEnvironment.development,
      _ => defaultEnvironment,
    };
    const configuredUrl = String.fromEnvironment('API_BASE_URL');
    final fallbackUrl = defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:4000/api/v1'
        : 'http://127.0.0.1:4000/api/v1';
    final apiBaseUrl = _normalizeBaseUrl(
      configuredUrl.isEmpty ? fallbackUrl : configuredUrl,
    );
    const connectTimeoutMs = int.fromEnvironment(
      'API_CONNECT_TIMEOUT_MS',
      defaultValue: 10000,
    );
    const receiveTimeoutMs = int.fromEnvironment(
      'API_RECEIVE_TIMEOUT_MS',
      defaultValue: 15000,
    );

    return AppConfig(
      environment: environment,
      apiBaseUrl: apiBaseUrl,
      connectTimeout: const Duration(milliseconds: connectTimeoutMs),
      receiveTimeout: const Duration(milliseconds: receiveTimeoutMs),
      enableNetworkLogs:
          environment == AppEnvironment.development && kDebugMode,
    );
  }

  final AppEnvironment environment;
  final String apiBaseUrl;
  final Duration connectTimeout;
  final Duration receiveTimeout;
  final bool enableNetworkLogs;

  bool get isProduction => environment == AppEnvironment.production;

  static String _normalizeBaseUrl(String value) {
    final normalized = value.trim().replaceFirst(RegExp(r'/+$'), '');
    final uri = Uri.tryParse(normalized);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw ArgumentError.value(value, 'API_BASE_URL', 'URL không hợp lệ');
    }
    if (!normalized.endsWith('/api/v1')) {
      throw ArgumentError.value(
        value,
        'API_BASE_URL',
        'URL phải kết thúc bằng /api/v1',
      );
    }
    if (uri.scheme != 'https' && uri.scheme != 'http') {
      throw ArgumentError.value(
        value,
        'API_BASE_URL',
        'Chỉ hỗ trợ http hoặc https',
      );
    }
    return normalized;
  }
}
