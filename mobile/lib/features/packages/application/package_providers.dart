import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/packages/data/package_repository.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

final packageRepositoryProvider = Provider<PackageRepository>(
  (ref) => PackageRepository(ref.watch(authDioProvider)),
);

final packageDetailProvider = FutureProvider.autoDispose
    .family<MedicalPackage, String>(
      (ref, slug) => ref.watch(packageRepositoryProvider).fetchBySlug(slug),
    );
