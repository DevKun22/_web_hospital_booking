import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/storage/app_preferences.dart';
import 'package:hospital_booking_mobile/features/home/application/setup_prompts_controller.dart';

Future<SetupPromptsState> _loaded(ProviderContainer container) async {
  container.read(setupPromptsControllerProvider);
  for (var i = 0; i < 50; i += 1) {
    final state = container.read(setupPromptsControllerProvider);
    if (state.isLoaded) return state;
    await Future<void>.delayed(const Duration(milliseconds: 2));
  }
  fail('setup prompts did not load');
}

void main() {
  test('prompts show by default and hide after "Để sau"', () async {
    final preferences = MemoryAppPreferences();
    final container = ProviderContainer(
      overrides: [appPreferencesProvider.overrideWithValue(preferences)],
    );
    addTearDown(container.dispose);

    expect((await _loaded(container)).isSnoozed, isFalse);

    await container.read(setupPromptsControllerProvider.notifier).snooze();
    expect(container.read(setupPromptsControllerProvider).isSnoozed, isTrue);
    expect(preferences.setupPromptsDismissed, isNotNull);
  });

  test(
    'a recent dismissal keeps prompts hidden, an old one lets them return',
    () async {
      for (final (age, snoozed) in [
        (const Duration(days: 2), true),
        (const Duration(days: 8), false),
      ]) {
        final preferences = MemoryAppPreferences()
          ..setupPromptsDismissed = DateTime.now().subtract(age);
        final container = ProviderContainer(
          overrides: [appPreferencesProvider.overrideWithValue(preferences)],
        );
        addTearDown(container.dispose);
        expect((await _loaded(container)).isSnoozed, snoozed, reason: '$age');
      }
    },
  );
}
