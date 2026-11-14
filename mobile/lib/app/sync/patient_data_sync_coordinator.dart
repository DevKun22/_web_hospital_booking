import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/app/navigation/main_navigation_destination.dart';
import 'package:hospital_booking_mobile/core/state/synced_notifier.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/medical_records/application/medical_records_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:hospital_booking_mobile/features/prescriptions/application/prescriptions_controller.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';

final patientDataSyncCoordinatorProvider = Provider<PatientDataSyncCoordinator>(
  DefaultPatientDataSyncCoordinator.new,
);

abstract interface class PatientDataSyncCoordinator {
  Future<void> handleAppResumed();

  Future<void> handleMainBranchSelected(int branchIndex);

  Future<void> handleRemoteChange({String? entityType, String? entityId});

  Future<void> handleAppointmentChanged({String? appointmentId});

  Future<void> handleBookingCompleted({String? appointmentId});
}

/// Một nguồn dữ liệu người khám mà bộ đồng bộ có thể làm mới.
abstract interface class _Source {
  /// Controller đã được tạo (người dùng từng mở màn hình dùng nó) hay chưa.
  bool isActive(Ref ref);

  Future<void> refresh(Ref ref);

  Future<void> refreshIfStale(Ref ref);
}

final class _ControllerSource<N extends SyncedNotifier<S>, S>
    implements _Source {
  const _ControllerSource(
    this._provider, {
    required this.maxAge,
    this.onlyWhenActive = false,
  });

  final NotifierProvider<N, S> _provider;

  /// Tuổi tối đa của dữ liệu khi quay lại ứng dụng hoặc chuyển tab.
  final Duration maxAge;

  /// Nguồn chỉ cần làm mới khi đã được dùng; chưa dùng thì màn hình sẽ tự tải lần đầu.
  final bool onlyWhenActive;

  @override
  bool isActive(Ref ref) => ref.exists(_provider);

  @override
  Future<void> refresh(Ref ref) => ref.read(_provider.notifier).refresh();

  @override
  Future<void> refreshIfStale(Ref ref) =>
      ref.read(_provider.notifier).refreshIfStale(maxAge: maxAge);
}

/// Loại thực thể do máy chủ báo thay đổi: nguồn danh sách cần tải lại và cách bỏ chi tiết cũ.
typedef _RemoteEntity = ({
  _Source source,
  void Function(Ref ref, String id) invalidateDetail,
});

class DefaultPatientDataSyncCoordinator implements PatientDataSyncCoordinator {
  DefaultPatientDataSyncCoordinator(this._ref);

  static final _appointments = _ControllerSource(
    appointmentsControllerProvider,
    maxAge: Duration(seconds: 10),
  );
  static final _notifications = _ControllerSource(
    notificationsControllerProvider,
    maxAge: Duration(seconds: 30),
  );
  static final _medicalRecords = _ControllerSource(
    medicalRecordsControllerProvider,
    maxAge: Duration(seconds: 60),
    onlyWhenActive: true,
  );
  static final _prescriptions = _ControllerSource(
    prescriptionsControllerProvider,
    maxAge: Duration(seconds: 60),
    onlyWhenActive: true,
  );
  static final _invoices = _ControllerSource(
    invoicesControllerProvider,
    maxAge: Duration(seconds: 60),
    onlyWhenActive: true,
  );
  static final _profile = _ControllerSource(
    patientProfileControllerProvider,
    maxAge: Duration(seconds: 60),
    onlyWhenActive: true,
  );
  static final _dependents = _ControllerSource(
    dependentProfilesControllerProvider,
    maxAge: Duration(seconds: 60),
    onlyWhenActive: true,
  );

  /// Dữ liệu luôn cần mới ở màn hình chính.
  static final _homeSources = <_Source>[_appointments, _notifications];

  /// Dữ liệu lâm sàng và thanh toán ở tab hồ sơ.
  static final _recordsSources = <_Source>[
    _medicalRecords,
    _prescriptions,
    _invoices,
    _dependents,
  ];

  final Ref _ref;

  bool get _isAuthenticated =>
      _ref.read(authControllerProvider).isAuthenticated;

  Map<String, _RemoteEntity> get _remoteEntities => {
    'MEDICAL_RECORD': (
      source: _medicalRecords,
      invalidateDetail: (ref, id) =>
          ref.invalidate(medicalRecordDetailProvider(id)),
    ),
    'PRESCRIPTION': (
      source: _prescriptions,
      invalidateDetail: (ref, id) =>
          ref.invalidate(prescriptionDetailProvider(id)),
    ),
    'INVOICE': (
      source: _invoices,
      invalidateDetail: (ref, id) => ref.invalidate(invoiceDetailProvider(id)),
    ),
  };

  /// Làm mới những nguồn đã cũ; bỏ qua nguồn chỉ-khi-đã-dùng mà chưa được tạo.
  Future<void> _refreshStale(Iterable<_Source> sources) => Future.wait([
    for (final source in sources)
      if (source is! _ControllerSource ||
          !source.onlyWhenActive ||
          source.isActive(_ref))
        source.refreshIfStale(_ref),
  ]);

  @override
  Future<void> handleAppResumed() async {
    if (!_isAuthenticated) return;
    _ref.invalidate(appointmentDetailProvider);
    _ref.invalidate(medicalRecordDetailProvider);
    _ref.invalidate(prescriptionDetailProvider);
    _ref.invalidate(invoiceDetailProvider);
    await _refreshStale([..._homeSources, ..._recordsSources, _profile]);
  }

  @override
  Future<void> handleMainBranchSelected(int branchIndex) async {
    if (!_isAuthenticated) return;
    switch (MainNavigationBranch.fromIndex(branchIndex)) {
      case MainNavigationBranch.home:
        await _refreshStale(_homeSources);
      case MainNavigationBranch.records:
        await _refreshStale(_recordsSources);
      case MainNavigationBranch.profile:
        // Tab hồ sơ cá nhân luôn đồng bộ, kể cả khi chưa mở màn hình trước đó.
        await _profile.refreshIfStale(_ref);
      case MainNavigationBranch.assistant:
      case MainNavigationBranch.booking:
        return;
    }
  }

  @override
  Future<void> handleRemoteChange({
    String? entityType,
    String? entityId,
  }) async {
    if (!_isAuthenticated) return;
    final type = entityType?.trim().toUpperCase();
    final id = entityId?.trim();
    final jobs = <Future<void>>[_notifications.refresh(_ref)];

    if (type == 'APPOINTMENT') {
      jobs.add(handleAppointmentChanged(appointmentId: id));
    } else if (_remoteEntities[type] case final entity?) {
      if (id != null && id.isNotEmpty) entity.invalidateDetail(_ref, id);
      jobs.add(entity.source.refresh(_ref));
    }

    await Future.wait(jobs);
  }

  @override
  Future<void> handleAppointmentChanged({String? appointmentId}) async {
    if (!_isAuthenticated) return;
    final id = appointmentId?.trim();
    if (id != null && id.isNotEmpty) {
      _ref.invalidate(appointmentDetailProvider(id));
    }
    await _appointments.refresh(_ref);
  }

  @override
  Future<void> handleBookingCompleted({String? appointmentId}) async {
    if (!_isAuthenticated) return;
    await Future.wait([
      handleAppointmentChanged(appointmentId: appointmentId),
      _profile.refresh(_ref),
    ]);
  }
}
