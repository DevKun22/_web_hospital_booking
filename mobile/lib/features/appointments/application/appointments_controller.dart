import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/appointments/data/appointments_repository.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';

final appointmentsRepositoryProvider = Provider<AppointmentsRepository>(
  (ref) => AppointmentsRepository(ref.watch(authenticatedDioProvider)),
);

final appointmentsControllerProvider =
    NotifierProvider<AppointmentsController, AppointmentsState>(
      AppointmentsController.new,
    );

final appointmentDetailProvider = FutureProvider.autoDispose
    .family<PatientAppointment, String>((ref, appointmentId) async {
      ref.watch(authControllerProvider.select((state) => state.user?.id));
      return ref.watch(appointmentsRepositoryProvider).getById(appointmentId);
    });

class AppointmentsState {
  const AppointmentsState({
    this.items = const [],
    this.total = 0,
    this.nextPage = 1,
    this.hasNextPage = false,
    this.isInitialLoading = false,
    this.isRefreshing = false,
    this.isLoadingMore = false,
    this.cancellingId,
    this.error,
  });

  final List<PatientAppointment> items;
  final int total;
  final int nextPage;
  final bool hasNextPage;
  final bool isInitialLoading;
  final bool isRefreshing;
  final bool isLoadingMore;
  final String? cancellingId;
  final ApiException? error;

  bool get hasItems => items.isNotEmpty;

  AppointmentsState copyWith({
    List<PatientAppointment>? items,
    int? total,
    int? nextPage,
    bool? hasNextPage,
    bool? isInitialLoading,
    bool? isRefreshing,
    bool? isLoadingMore,
    String? cancellingId,
    bool clearCancellingId = false,
    ApiException? error,
    bool clearError = false,
  }) => AppointmentsState(
    items: items ?? this.items,
    total: total ?? this.total,
    nextPage: nextPage ?? this.nextPage,
    hasNextPage: hasNextPage ?? this.hasNextPage,
    isInitialLoading: isInitialLoading ?? this.isInitialLoading,
    isRefreshing: isRefreshing ?? this.isRefreshing,
    isLoadingMore: isLoadingMore ?? this.isLoadingMore,
    cancellingId: clearCancellingId
        ? null
        : (cancellingId ?? this.cancellingId),
    error: clearError ? null : (error ?? this.error),
  );
}

class AppointmentsController extends Notifier<AppointmentsState> {
  static const _pageSize = 20;
  int _requestVersion = 0;
  String? _patientId;

  @override
  AppointmentsState build() {
    // Authentication changes invalidate every request started for the
    // previous patient so protected data can never cross sessions.
    _requestVersion += 1;
    final patientId = ref.watch(
      authControllerProvider.select((state) => state.user?.id),
    );
    _patientId = patientId;
    if (patientId != null) Future<void>.microtask(load);
    return AppointmentsState(isInitialLoading: patientId != null);
  }

  Future<void> load() async {
    if (_patientId == null) return;
    final requestVersion = ++_requestVersion;
    state = const AppointmentsState(isInitialLoading: true);
    await _loadFirstPage(requestVersion);
  }

  Future<void> refresh() async {
    if (_patientId == null) return;
    final requestVersion = ++_requestVersion;
    state = state.copyWith(
      isInitialLoading: state.items.isEmpty,
      isRefreshing: state.items.isNotEmpty,
      isLoadingMore: false,
      clearError: true,
    );
    await _loadFirstPage(requestVersion);
  }

  Future<void> _loadFirstPage(int requestVersion) async {
    try {
      final page = await ref
          .read(appointmentsRepositoryProvider)
          .list(limit: _pageSize);
      if (requestVersion != _requestVersion) return;
      state = AppointmentsState(
        items: page.items,
        total: page.total,
        nextPage: page.page + 1,
        hasNextPage: page.hasNextPage,
      );
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(
        isInitialLoading: false,
        isRefreshing: false,
        error: error,
      );
    }
  }

  Future<void> loadMore() async {
    if (_patientId == null ||
        state.isInitialLoading ||
        state.isRefreshing ||
        state.isLoadingMore ||
        !state.hasNextPage) {
      return;
    }
    final requestVersion = _requestVersion;
    state = state.copyWith(isLoadingMore: true, clearError: true);
    try {
      final page = await ref
          .read(appointmentsRepositoryProvider)
          .list(page: state.nextPage, limit: _pageSize);
      if (requestVersion != _requestVersion) return;
      final byId = <String, PatientAppointment>{
        for (final item in state.items) item.id: item,
        for (final item in page.items) item.id: item,
      };
      state = state.copyWith(
        items: byId.values.toList(growable: false),
        total: page.total,
        nextPage: page.page + 1,
        hasNextPage: page.hasNextPage,
        isLoadingMore: false,
      );
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion) return;
      state = state.copyWith(isLoadingMore: false, error: error);
    }
  }

  Future<bool> cancel({required String id, required String reason}) async {
    if (_patientId == null || state.cancellingId != null) return false;
    final requestVersion = _requestVersion;
    final patientId = _patientId;
    state = state.copyWith(cancellingId: id, clearError: true);
    try {
      final updated = await ref
          .read(appointmentsRepositoryProvider)
          .cancel(id: id, reason: reason);
      if (requestVersion != _requestVersion || patientId != _patientId) {
        return false;
      }
      state = state.copyWith(
        items: [
          for (final item in state.items)
            if (item.id == id) updated else item,
        ],
        clearCancellingId: true,
      );
      ref.invalidate(appointmentDetailProvider(id));
      return true;
    } on ApiException catch (error) {
      if (requestVersion != _requestVersion || patientId != _patientId) {
        return false;
      }
      state = state.copyWith(clearCancellingId: true, error: error);
      return false;
    }
  }

  void dismissError() => state = state.copyWith(clearError: true);
}
