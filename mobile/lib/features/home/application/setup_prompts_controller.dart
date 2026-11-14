import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';

/// Sau khi người dùng chọn "Để sau", gợi ý thiết lập được ẩn trong khoảng này.
const setupPromptsSnoozeDuration = Duration(days: 7);

final setupPromptsControllerProvider =
    NotifierProvider<SetupPromptsController, SetupPromptsState>(
      SetupPromptsController.new,
    );

class SetupPromptsState {
  const SetupPromptsState({this.isLoaded = false, this.isSnoozed = false});

  final bool isLoaded;
  final bool isSnoozed;
}

class SetupPromptsController extends Notifier<SetupPromptsState> {
  @override
  SetupPromptsState build() {
    Future<void>.microtask(_load);
    return const SetupPromptsState();
  }

  Future<void> _load() async {
    var snoozed = false;
    try {
      final dismissedAt = await ref
          .read(appPreferencesProvider)
          .setupPromptsDismissedAt();
      snoozed =
          dismissedAt != null &&
          DateTime.now().difference(dismissedAt) < setupPromptsSnoozeDuration;
    } catch (error) {
      logSwallowedError('setup_prompts_controller', error);
    }
    state = SetupPromptsState(isLoaded: true, isSnoozed: snoozed);
  }

  Future<void> snooze() async {
    state = const SetupPromptsState(isLoaded: true, isSnoozed: true);
    try {
      await ref
          .read(appPreferencesProvider)
          .dismissSetupPrompts(DateTime.now());
    } catch (error) {
      logSwallowedError('setup_prompts_controller', error);
    }
  }
}
