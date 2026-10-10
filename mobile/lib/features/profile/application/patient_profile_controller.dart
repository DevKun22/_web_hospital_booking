import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/profile/data/patient_profile_repository.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

final patientProfileRepositoryProvider = Provider<PatientProfileRepository>(
  (ref) => PatientProfileRepository(ref.watch(authenticatedDioProvider)),
);

final patientProfileControllerProvider =
    NotifierProvider<PatientProfileController, PatientProfileState>(
      PatientProfileController.new,
    );

class PatientProfileState {
  const PatientProfileState({
    this.profile,
    this.error,
    this.isInitialLoading = false,
    this.isRefreshing = false,
    this.isSaving = false,
  });

  final PatientProfile? profile;
  final ApiException? error;
  final bool isInitialLoading;
  final bool isRefreshing;
  final bool isSaving;

  PatientProfileState copyWith({
    PatientProfile? profile,
    ApiException? error,
    bool clearError = false,
    bool? isInitialLoading,
    bool? isRefreshing,
    bool? isSaving,
  }) => PatientProfileState(
    profile: profile ?? this.profile,
    error: clearError ? null : (error ?? this.error),
    isInitialLoading: isInitialLoading ?? this.isInitialLoading,
    isRefreshing: isRefreshing ?? this.isRefreshing,
    isSaving: isSaving ?? this.isSaving,
  );
}

class PatientProfileController extends Notifier<PatientProfileState> {
  int _requestVersion = 0;
  String? _patientId;

  @override
  PatientProfileState build() {
    _requestVersion += 1;
    _patientId = ref.watch(
      authControllerProvider.select((state) => state.user?.id),
    );
    if (_patientId != null) Future<void>.microtask(load);
    return PatientProfileState(isInitialLoading: _patientId != null);
  }

  Future<void> load() async {
    if (_patientId == null) return;
    final requestVersion = ++_requestVersion;
    state = const PatientProfileState(isInitialLoading: true);
    await _fetch(requestVersion);
  }

  Future<void> refresh() async {
    if (_patientId == null || state.isSaving) return;
    final requestVersion = ++_requestVersion;
    state = state.copyWith(
      isInitialLoading: state.profile == null,
      isRefreshing: state.profile != null,
      clearError: true,
    );
    await _fetch(requestVersion);
  }

  Future<void> _fetch(int requestVersion) async {
    try {
      final profile = await ref
          .read(patientProfileRepositoryProvider)
          .getProfile();
      if (requestVersion != _requestVersion || profile.id != _patientId) return;
      state = PatientProfileState(profile: profile);
      ref
          .read(authControllerProvider.notifier)
          .syncUser(profile.toPatientUser());
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(
        isInitialLoading: false,
        isRefreshing: false,
        error: error,
      );
    }
  }

  Future<bool> save(PatientProfileDraft draft) async {
    if (_patientId == null || state.isSaving) return false;
    final requestVersion = _requestVersion;
    final patientId = _patientId;
    state = state.copyWith(isSaving: true, clearError: true);
    try {
      final profile = await ref
          .read(patientProfileRepositoryProvider)
          .updateProfile(draft);
      if (requestVersion != _requestVersion ||
          patientId != _patientId ||
          profile.id != patientId) {
        return false;
      }
      state = PatientProfileState(profile: profile);
      ref
          .read(authControllerProvider.notifier)
          .syncUser(profile.toPatientUser());
      return true;
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion || patientId != _patientId) {
        return false;
      }
      state = state.copyWith(isSaving: false, error: error);
      return false;
    }
  }

  void dismissError() => state = state.copyWith(clearError: true);
}
