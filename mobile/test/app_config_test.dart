import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';

void main() {
  test('production configuration requires HTTPS', () {
    expect(
      () => AppConfig(
        environment: AppEnvironment.production,
        apiBaseUrl: 'http://api.example.com/api/v1',
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        enableNetworkLogs: false,
      ),
      throwsArgumentError,
    );
  });

  test('base URL must end with the versioned API prefix', () {
    expect(
      () => AppConfig(
        environment: AppEnvironment.development,
        apiBaseUrl: 'http://localhost:4000/api',
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        enableNetworkLogs: true,
      ),
      throwsArgumentError,
    );
  });
}
