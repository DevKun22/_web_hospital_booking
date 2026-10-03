import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/storage/app_preferences.dart';
import 'package:hospital_booking_mobile/features/onboarding/application/onboarding_controller.dart';

void main() {
  test('welcome completion persists locally', () async {
    final preferences = MemoryAppPreferences();
    final container = ProviderContainer(
      overrides: [appPreferencesProvider.overrideWithValue(preferences)],
    );
    addTearDown(container.dispose);

    expect(await container.read(onboardingControllerProvider.future), isFalse);

    await container
        .read(onboardingControllerProvider.notifier)
        .completeWelcome();

    expect(preferences.welcomeSeen, isTrue);
    expect(container.read(onboardingControllerProvider).value, isTrue);
  });
}
