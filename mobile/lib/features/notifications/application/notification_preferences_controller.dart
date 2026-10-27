import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/data/notification_preferences_repository.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/notification_preferences.dart';

final notificationPreferencesRepositoryProvider =
    Provider<NotificationPreferencesRepository>(
      (ref) => NotificationPreferencesRepository(
        ref.watch(authenticatedDioProvider),
      ),
    );

final notificationPreferencesControllerProvider =
    NotifierProvider<
      NotificationPreferencesController,
      NotificationPreferencesState
    >(NotificationPreferencesController.new);

class NotificationPreferencesState {
  const NotificationPreferencesState({
    this.preferences,
    this.saving = const {},
    this.isLoading = false,
    this.error,
  });

  final NotificationPreferences? preferences;
  final Set<NotificationPreferenceKind> saving;
  final bool isLoading;
  final ApiException? error;

  NotificationPreferencesState copyWith({
    NotificationPreferences? preferences,
    Set<NotificationPreferenceKind>? saving,
    bool? isLoading,
    ApiException? error,
    bool clearError = false,
  }) => NotificationPreferencesState(
    preferences: preferences ?? this.preferences,
    saving: saving ?? this.saving,
    isLoading: isLoading ?? this.isLoading,
    error: clearError ? null : (error ?? this.error),
  );
}

class NotificationPreferencesController
    extends Notifier<NotificationPreferencesState> {
  int _requestVersion = 0;
  String? _patientId;

  @override
  NotificationPreferencesState build() {
    _requestVersion += 1;
    _patientId = ref.watch(
      authControllerProvider.select((state) => state.user?.id),
    );
    if (_patientId != null) Future<void>.microtask(load);
    return NotificationPreferencesState(isLoading: _patientId != null);
  }

  Future<void> load() async {
    if (_patientId == null) return;
    final requestVersion = ++_requestVersion;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final preferences = await ref
          .read(notificationPreferencesRepositoryProvider)
          .get();
      if (requestVersion != _requestVersion) return;
      state = NotificationPreferencesState(preferences: preferences);
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(isLoading: false, error: error);
    }
  }

  Future<bool> setEnabled(NotificationPreferenceKind kind, bool enabled) async {
    final current = state.preferences;
    if (_patientId == null || current == null || state.saving.contains(kind)) {
      return false;
    }
    if (current.valueFor(kind) == enabled) return true;

    final requestVersion = _requestVersion;
    state = state.copyWith(
      preferences: current.withValue(kind, enabled),
      saving: {...state.saving, kind},
      clearError: true,
    );
    try {
      final saved = await ref
          .read(notificationPreferencesRepositoryProvider)
          .update(kind, enabled);
      if (requestVersion != _requestVersion) return false;
      state = state.copyWith(
        preferences: saved,
        saving: {...state.saving}..remove(kind),
      );
      return true;
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return false;
      state = state.copyWith(
        preferences: current,
        saving: {...state.saving}..remove(kind),
        error: error,
      );
      return false;
    }
  }

  void dismissError() => state = state.copyWith(clearError: true);
}
