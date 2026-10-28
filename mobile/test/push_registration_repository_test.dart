import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/notifications/data/push_registration_repository.dart';

void main() {
  test('registers and disables the FCM token on the current session', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests.add(options);
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'data': {'enabled': options.method == 'PUT'},
              },
            ),
          );
        },
      ),
    );
    final repository = PushRegistrationRepository(dio);

    await repository.register(
      token: 'fcm-installation-token-0001',
      platform: 'android',
      appVersion: '1.0.0',
    );
    await repository.disable();

    expect(requests[0].method, 'PUT');
    expect(requests[0].path, '/auth/push-token');
    expect(requests[0].data, {
      'pushToken': 'fcm-installation-token-0001',
      'platform': 'android',
      'appVersion': '1.0.0',
    });
    expect(requests[1].method, 'DELETE');
    expect(requests[1].path, '/auth/push-token');
    dio.close(force: true);
  });
}
