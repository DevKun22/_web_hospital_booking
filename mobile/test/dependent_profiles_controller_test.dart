import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/data/dependent_profiles_repository.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';

import 'helpers/fake_auth_controller.dart';

class _GatedRepository extends DependentProfilesRepository {
  _GatedRepository() : super(Dio());

  final createGate = Completer<DependentProfile>();

  @override
  Future<List<DependentProfile>> list() async => const [];

  @override
  Future<DependentProfile> create(DependentProfileDraft draft) =>
      createGate.future;
}

void main() {
  test(
    'hồ sơ người thân lưu xong sau khi đổi tài khoản không chen vào danh sách người mới',
    () async {
      final repository = _GatedRepository();
      final container = ProviderContainer(
        overrides: [
          fakeAuthOverride,
          dependentProfilesRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      final auth =
          container.read(authControllerProvider.notifier) as FakeAuthController;
      auth.signInAs('owner-a');
      final sub = container.listen(
        dependentProfilesControllerProvider,
        (_, _) {},
      );
      addTearDown(sub.close);
      await Future<void>.delayed(Duration.zero);

      final saving = container
          .read(dependentProfilesControllerProvider.notifier)
          .create(
            const DependentProfileDraft(
              fullName: 'Người thân của A',
              relationship: DependentRelationship.child,
              hasBhyt: false,
            ),
          );
      auth.signInAs('owner-b');
      await Future<void>.delayed(Duration.zero);
      repository.createGate.complete(
        const DependentProfile(
          id: 'dependent-a',
          fullName: 'Người thân của A',
          relationship: DependentRelationship.child,
          hasBhyt: false,
        ),
      );

      expect(await saving, isNull);
      expect(
        container.read(dependentProfilesControllerProvider).items,
        isEmpty,
      );
    },
  );
}
