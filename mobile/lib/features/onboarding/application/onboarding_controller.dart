import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';

final onboardingControllerProvider =
    AsyncNotifierProvider<OnboardingController, bool>(OnboardingController.new);

class OnboardingController extends AsyncNotifier<bool> {
  @override
  Future<bool> build() => ref.read(appPreferencesProvider).hasSeenWelcome();

  Future<void> completeWelcome() async {
    if (state.asData?.value == true) return;

    state = const AsyncLoading<bool>();
    state = await AsyncValue.guard(() async {
      await ref.read(appPreferencesProvider).setWelcomeSeen();
      return true;
    });
  }
}
