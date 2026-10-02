import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/network/access_token_store.dart';
import 'package:hospital_booking_mobile/core/network/session_events.dart';
import 'package:hospital_booking_mobile/core/network/session_refresh_coordinator.dart';
import 'package:hospital_booking_mobile/core/storage/token_storage.dart';

void main() {
  test('concurrent callers share one refresh request', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    var refreshCalls = 0;
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          refreshCalls += 1;
          await Future<void>.delayed(const Duration(milliseconds: 20));
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'success': true,
                'data': {
                  'accessToken': 'new-access-token',
                  'refreshToken': 'new-refresh-token',
                  'user': {
                    'id': 'patient-id',
                    'fullName': 'Patient',
                    'isPhoneVerified': true,
                  },
                },
              },
            ),
          );
        },
      ),
    );
    final storage = MemoryTokenStorage()..refreshToken = 'old-refresh-token';
    final accessStore = AccessTokenStore();
    final events = SessionEvents();
    final coordinator = SessionRefreshCoordinator(
      authDio: dio,
      tokenStorage: storage,
      accessTokenStore: accessStore,
      sessionEvents: events,
    );

    final sessions = await Future.wait([
      coordinator.refresh(),
      coordinator.refresh(),
      coordinator.refresh(),
    ]);

    expect(refreshCalls, 1);
    expect(sessions.map((item) => item.accessToken).toSet(), {
      'new-access-token',
    });
    expect(storage.refreshToken, 'new-refresh-token');
    expect(accessStore.accessToken, 'new-access-token');

    await events.dispose();
    dio.close(force: true);
  });
}
