import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/data/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    authDio: ref.watch(authDioProvider),
    authenticatedDio: ref.watch(authenticatedDioProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
    refreshCoordinator: ref.watch(sessionRefreshCoordinatorProvider),
  ),
);
