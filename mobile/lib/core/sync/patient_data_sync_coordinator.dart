import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/app/navigation/main_navigation_destination.dart';
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

class DefaultPatientDataSyncCoordinator implements PatientDataSyncCoordinator {
  DefaultPatientDataSyncCoordinator(this._ref);

  static const _appointmentsResumeMaxAge = Duration(seconds: 10);
  static const _notificationsResumeMaxAge = Duration(seconds: 30);
  static const _clinicalDataResumeMaxAge = Duration(seconds: 60);
  static const _profileResumeMaxAge = Duration(seconds: 60);
  static const _dependentsResumeMaxAge = Duration(seconds: 60);

  final Ref _ref;

  bool get _isAuthenticated =>
      _ref.read(authControllerProvider).isAuthenticated;

  @override
  Future<void> handleAppResumed() async {
    if (!_isAuthenticated) return;
    _ref.invalidate(appointmentDetailProvider);
    _ref.invalidate(medicalRecordDetailProvider);
    _ref.invalidate(prescriptionDetailProvider);
    _ref.invalidate(invoiceDetailProvider);
    final jobs = <Future<void>>[
      _ref
          .read(appointmentsControllerProvider.notifier)
          .refreshIfStale(maxAge: _appointmentsResumeMaxAge),
      _ref
          .read(notificationsControllerProvider.notifier)
          .refreshIfStale(maxAge: _notificationsResumeMaxAge),
    ];
    if (_ref.exists(medicalRecordsControllerProvider)) {
      jobs.add(
        _ref
            .read(medicalRecordsControllerProvider.notifier)
            .refreshIfStale(maxAge: _clinicalDataResumeMaxAge),
      );
    }
    if (_ref.exists(prescriptionsControllerProvider)) {
      jobs.add(
        _ref
            .read(prescriptionsControllerProvider.notifier)
            .refreshIfStale(maxAge: _clinicalDataResumeMaxAge),
      );
    }
    if (_ref.exists(invoicesControllerProvider)) {
      jobs.add(
        _ref
            .read(invoicesControllerProvider.notifier)
            .refreshIfStale(maxAge: _clinicalDataResumeMaxAge),
      );
    }
    if (_ref.exists(patientProfileControllerProvider)) {
      jobs.add(
        _ref
            .read(patientProfileControllerProvider.notifier)
            .refreshIfStale(maxAge: _profileResumeMaxAge),
      );
    }
    if (_ref.exists(dependentProfilesControllerProvider)) {
      jobs.add(
        _ref
            .read(dependentProfilesControllerProvider.notifier)
            .refreshIfStale(maxAge: _dependentsResumeMaxAge),
      );
    }
    await Future.wait(jobs);
  }

  @override
  Future<void> handleMainBranchSelected(int branchIndex) async {
    if (!_isAuthenticated) return;
    switch (MainNavigationBranch.fromIndex(branchIndex)) {
      case MainNavigationBranch.home:
        await Future.wait([
          _ref
              .read(appointmentsControllerProvider.notifier)
              .refreshIfStale(maxAge: _appointmentsResumeMaxAge),
          _ref
              .read(notificationsControllerProvider.notifier)
              .refreshIfStale(maxAge: _notificationsResumeMaxAge),
        ]);
        return;
      case MainNavigationBranch.records:
        final jobs = <Future<void>>[];
        if (_ref.exists(medicalRecordsControllerProvider)) {
          jobs.add(
            _ref
                .read(medicalRecordsControllerProvider.notifier)
                .refreshIfStale(maxAge: _clinicalDataResumeMaxAge),
          );
        }
        if (_ref.exists(prescriptionsControllerProvider)) {
          jobs.add(
            _ref
                .read(prescriptionsControllerProvider.notifier)
                .refreshIfStale(maxAge: _clinicalDataResumeMaxAge),
          );
        }
        if (_ref.exists(invoicesControllerProvider)) {
          jobs.add(
            _ref
                .read(invoicesControllerProvider.notifier)
                .refreshIfStale(maxAge: _clinicalDataResumeMaxAge),
          );
        }
        if (_ref.exists(dependentProfilesControllerProvider)) {
          jobs.add(
            _ref
                .read(dependentProfilesControllerProvider.notifier)
                .refreshIfStale(maxAge: _dependentsResumeMaxAge),
          );
        }
        await Future.wait(jobs);
        return;
      case MainNavigationBranch.notifications:
        await _ref
            .read(notificationsControllerProvider.notifier)
            .refreshIfStale(maxAge: _notificationsResumeMaxAge);
        return;
      case MainNavigationBranch.booking:
        return;
      case MainNavigationBranch.profile:
        await _ref
            .read(patientProfileControllerProvider.notifier)
            .refreshIfStale(maxAge: _profileResumeMaxAge);
        return;
    }
  }

  @override
  Future<void> handleRemoteChange({
    String? entityType,
    String? entityId,
  }) async {
    if (!_isAuthenticated) return;
    final normalizedType = entityType?.trim().toUpperCase();
    final jobs = <Future<void>>[
      _ref.read(notificationsControllerProvider.notifier).refresh(),
    ];

    if (normalizedType == 'APPOINTMENT') {
      jobs.add(handleAppointmentChanged(appointmentId: entityId));
    } else if (normalizedType == 'MEDICAL_RECORD') {
      if (entityId != null && entityId.trim().isNotEmpty) {
        _ref.invalidate(medicalRecordDetailProvider(entityId.trim()));
      }
      jobs.add(_ref.read(medicalRecordsControllerProvider.notifier).refresh());
    } else if (normalizedType == 'PRESCRIPTION') {
      if (entityId != null && entityId.trim().isNotEmpty) {
        _ref.invalidate(prescriptionDetailProvider(entityId.trim()));
      }
      jobs.add(_ref.read(prescriptionsControllerProvider.notifier).refresh());
    } else if (normalizedType == 'INVOICE') {
      if (entityId != null && entityId.trim().isNotEmpty) {
        _ref.invalidate(invoiceDetailProvider(entityId.trim()));
      }
      jobs.add(_ref.read(invoicesControllerProvider.notifier).refresh());
    }

    await Future.wait(jobs);
  }

  @override
  Future<void> handleAppointmentChanged({String? appointmentId}) async {
    if (!_isAuthenticated) return;
    final normalizedId = appointmentId?.trim();
    if (normalizedId != null && normalizedId.isNotEmpty) {
      _ref.invalidate(appointmentDetailProvider(normalizedId));
    }
    await _ref.read(appointmentsControllerProvider.notifier).refresh();
  }

  @override
  Future<void> handleBookingCompleted({String? appointmentId}) async {
    if (!_isAuthenticated) return;
    await Future.wait([
      handleAppointmentChanged(appointmentId: appointmentId),
      _ref.read(patientProfileControllerProvider.notifier).refresh(),
    ]);
  }
}
