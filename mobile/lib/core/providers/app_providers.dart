import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';
import 'package:hospital_booking_mobile/core/network/access_token_store.dart';
import 'package:hospital_booking_mobile/core/network/dio_factory.dart';
import 'package:hospital_booking_mobile/core/network/session_events.dart';
import 'package:hospital_booking_mobile/core/network/session_refresh_coordinator.dart';
import 'package:hospital_booking_mobile/core/storage/token_storage.dart';
import 'package:hospital_booking_mobile/features/auth/data/auth_repository.dart';

final appConfigProvider = Provider<AppConfig>(
  (ref) => throw StateError('AppConfig must be overridden during bootstrap.'),
);

final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => SecureTokenStorage(),
);

final accessTokenStoreProvider = Provider<AccessTokenStore>(
  (ref) => AccessTokenStore(),
);

final sessionEventsProvider = Provider<SessionEvents>((ref) {
  final events = SessionEvents();
  ref.onDispose(events.dispose);
  return events;
});

final authDioProvider = Provider<Dio>((ref) {
  final dio = createBaseDio(ref.watch(appConfigProvider));
  ref.onDispose(() => dio.close(force: true));
  return dio;
});

final sessionRefreshCoordinatorProvider = Provider<SessionRefreshCoordinator>(
  (ref) => SessionRefreshCoordinator(
    authDio: ref.watch(authDioProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
    accessTokenStore: ref.watch(accessTokenStoreProvider),
    sessionEvents: ref.watch(sessionEventsProvider),
  ),
);

final authenticatedDioProvider = Provider<Dio>((ref) {
  final dio = createAuthenticatedDio(
    config: ref.watch(appConfigProvider),
    accessTokenStore: ref.watch(accessTokenStoreProvider),
    refreshCoordinator: ref.watch(sessionRefreshCoordinatorProvider),
  );
  ref.onDispose(() => dio.close(force: true));
  return dio;
});

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    authDio: ref.watch(authDioProvider),
    authenticatedDio: ref.watch(authenticatedDioProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
    refreshCoordinator: ref.watch(sessionRefreshCoordinatorProvider),
  ),
);
