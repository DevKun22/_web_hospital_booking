import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/network/access_token_store.dart';
import 'package:hospital_booking_mobile/core/network/session_events.dart';
import 'package:hospital_booking_mobile/core/network/session_refresh_coordinator.dart';
import 'package:hospital_booking_mobile/core/storage/token_storage.dart';
import 'package:hospital_booking_mobile/features/auth/data/auth_repository.dart';

void main() {
  test(
    'restoreSession treats a missing refresh token as a normal guest',
    () async {
      final authDio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
      final authenticatedDio = Dio(
        BaseOptions(baseUrl: 'https://example.test/api/v1'),
      );
      var networkCalls = 0;
      authDio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            networkCalls += 1;
            handler.reject(
              DioException(requestOptions: options, message: 'Unexpected call'),
            );
          },
        ),
      );
      final tokenStorage = MemoryTokenStorage();
      final events = SessionEvents();
      final repository = AuthRepository(
        authDio: authDio,
        authenticatedDio: authenticatedDio,
        tokenStorage: tokenStorage,
        refreshCoordinator: SessionRefreshCoordinator(
          authDio: authDio,
          tokenStorage: tokenStorage,
          accessTokenStore: AccessTokenStore(),
          sessionEvents: events,
        ),
      );

      final session = await repository.restoreSession();

      expect(session, isNull);
      expect(networkCalls, 0);

      await events.dispose();
      authDio.close(force: true);
      authenticatedDio.close(force: true);
    },
  );

  test('logout clears local tokens when the revoke request stalls', () async {
    final authDio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
    final authenticatedDio = Dio(
      BaseOptions(baseUrl: 'https://example.test/api/v1'),
    );
    authDio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (_, _) {
          // Deliberately leave the request unresolved to exercise the timeout.
        },
      ),
    );
    final tokenStorage = MemoryTokenStorage()..refreshToken = 'refresh-token';
    final accessStore = AccessTokenStore()..set('access-token');
    final events = SessionEvents();
    final repository = AuthRepository(
      authDio: authDio,
      authenticatedDio: authenticatedDio,
      tokenStorage: tokenStorage,
      refreshCoordinator: SessionRefreshCoordinator(
        authDio: authDio,
        tokenStorage: tokenStorage,
        accessTokenStore: accessStore,
        sessionEvents: events,
      ),
      logoutRequestTimeout: const Duration(milliseconds: 20),
    );

    await repository.logout();

    expect(tokenStorage.refreshToken, isNull);
    expect(accessStore.accessToken, isNull);

    await events.dispose();
    authDio.close(force: true);
    authenticatedDio.close(force: true);
  });
}
