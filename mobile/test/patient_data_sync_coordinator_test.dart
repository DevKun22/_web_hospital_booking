import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/sync/patient_data_sync_coordinator.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/medical_records/application/medical_records_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:hospital_booking_mobile/features/prescriptions/application/prescriptions_controller.dart';
import 'package:hospital_booking_mobile/features/profile/application/patient_profile_controller.dart';

const _patient = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  isPhoneVerified: true,
);

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _patient);
}

class _RecordingAppointmentsController extends AppointmentsController {
  int refreshCalls = 0;
  int staleRefreshCalls = 0;

  @override
  AppointmentsState build() => const AppointmentsState();

  @override
  Future<void> refresh() async {
    refreshCalls += 1;
  }

  @override
  Future<void> refreshIfStale({required Duration maxAge}) async {
    staleRefreshCalls += 1;
  }
}

class _RecordingNotificationsController extends NotificationsController {
  int refreshCalls = 0;
  int staleRefreshCalls = 0;

  @override
  NotificationsState build() => const NotificationsState();

  @override
  Future<void> refresh() async {
    refreshCalls += 1;
  }

  @override
  Future<void> refreshIfStale({required Duration maxAge}) async {
    staleRefreshCalls += 1;
  }
}

class _RecordingMedicalRecordsController extends MedicalRecordsController {
  int refreshCalls = 0;
  int staleRefreshCalls = 0;

  @override
  MedicalRecordsState build() => const MedicalRecordsState();

  @override
  Future<void> refresh() async => refreshCalls += 1;

  @override
  Future<void> refreshIfStale({required Duration maxAge}) async {
    staleRefreshCalls += 1;
  }
}

class _RecordingPrescriptionsController extends PrescriptionsController {
  int refreshCalls = 0;
  int staleRefreshCalls = 0;

  @override
  PrescriptionsState build() => const PrescriptionsState();

  @override
  Future<void> refresh() async => refreshCalls += 1;

  @override
  Future<void> refreshIfStale({required Duration maxAge}) async {
    staleRefreshCalls += 1;
  }
}

class _RecordingInvoicesController extends InvoicesController {
  int refreshCalls = 0;
  int staleRefreshCalls = 0;

  @override
  InvoicesState build() => const InvoicesState();

  @override
  Future<void> refresh() async => refreshCalls += 1;

  @override
  Future<void> refreshIfStale({required Duration maxAge}) async {
    staleRefreshCalls += 1;
  }
}

class _RecordingPatientProfileController extends PatientProfileController {
  int refreshCalls = 0;
  int staleRefreshCalls = 0;

  @override
  PatientProfileState build() => const PatientProfileState();

  @override
  Future<void> refresh() async => refreshCalls += 1;

  @override
  Future<void> refreshIfStale({required Duration maxAge}) async {
    staleRefreshCalls += 1;
  }
}

class _RecordingDependentsController extends DependentProfilesController {
  int staleRefreshCalls = 0;

  @override
  DependentProfilesState build() => const DependentProfilesState(loaded: true);

  @override
  Future<void> refreshIfStale({required Duration maxAge}) async {
    staleRefreshCalls += 1;
  }
}

void main() {
  test(
    'refreshes stale patient data on resume and relevant tab entry',
    () async {
      final appointments = _RecordingAppointmentsController();
      final notifications = _RecordingNotificationsController();
      final medicalRecords = _RecordingMedicalRecordsController();
      final prescriptions = _RecordingPrescriptionsController();
      final invoices = _RecordingInvoicesController();
      final profile = _RecordingPatientProfileController();
      final dependents = _RecordingDependentsController();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedController.new),
          appointmentsControllerProvider.overrideWith(() => appointments),
          notificationsControllerProvider.overrideWith(() => notifications),
          medicalRecordsControllerProvider.overrideWith(() => medicalRecords),
          prescriptionsControllerProvider.overrideWith(() => prescriptions),
          invoicesControllerProvider.overrideWith(() => invoices),
          patientProfileControllerProvider.overrideWith(() => profile),
          dependentProfilesControllerProvider.overrideWith(() => dependents),
        ],
      );
      addTearDown(container.dispose);

      container.read(medicalRecordsControllerProvider);
      container.read(prescriptionsControllerProvider);
      container.read(invoicesControllerProvider);
      container.read(patientProfileControllerProvider);
      container.read(dependentProfilesControllerProvider);

      final coordinator = container.read(patientDataSyncCoordinatorProvider);
      await coordinator.handleAppResumed();
      await coordinator.handleMainBranchSelected(1);
      await coordinator.handleMainBranchSelected(0);
      await coordinator.handleMainBranchSelected(4);

      expect(appointments.staleRefreshCalls, 2);
      expect(notifications.staleRefreshCalls, 2);
      expect(medicalRecords.staleRefreshCalls, 2);
      expect(prescriptions.staleRefreshCalls, 2);
      expect(invoices.staleRefreshCalls, 2);
      expect(profile.staleRefreshCalls, 2);
      expect(dependents.staleRefreshCalls, 2);
    },
  );

  test('appointment push refreshes inbox, list and matching detail', () async {
    final appointments = _RecordingAppointmentsController();
    final notifications = _RecordingNotificationsController();
    final medicalRecords = _RecordingMedicalRecordsController();
    final prescriptions = _RecordingPrescriptionsController();
    final invoices = _RecordingInvoicesController();
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthenticatedController.new),
        appointmentsControllerProvider.overrideWith(() => appointments),
        notificationsControllerProvider.overrideWith(() => notifications),
        medicalRecordsControllerProvider.overrideWith(() => medicalRecords),
        prescriptionsControllerProvider.overrideWith(() => prescriptions),
        invoicesControllerProvider.overrideWith(() => invoices),
      ],
    );
    addTearDown(container.dispose);

    await container
        .read(patientDataSyncCoordinatorProvider)
        .handleRemoteChange(
          entityType: 'appointment',
          entityId: 'appointment-1',
        );

    expect(appointments.refreshCalls, 1);
    expect(notifications.refreshCalls, 1);
  });

  test(
    'completed booking refreshes appointments and the saved profile',
    () async {
      final appointments = _RecordingAppointmentsController();
      final profile = _RecordingPatientProfileController();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedController.new),
          appointmentsControllerProvider.overrideWith(() => appointments),
          patientProfileControllerProvider.overrideWith(() => profile),
        ],
      );
      addTearDown(container.dispose);

      await container
          .read(patientDataSyncCoordinatorProvider)
          .handleBookingCompleted(appointmentId: 'appointment-1');

      expect(appointments.refreshCalls, 1);
      expect(profile.refreshCalls, 1);
    },
  );

  test(
    'clinical and billing pushes refresh only their matching data',
    () async {
      final appointments = _RecordingAppointmentsController();
      final notifications = _RecordingNotificationsController();
      final medicalRecords = _RecordingMedicalRecordsController();
      final prescriptions = _RecordingPrescriptionsController();
      final invoices = _RecordingInvoicesController();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedController.new),
          appointmentsControllerProvider.overrideWith(() => appointments),
          notificationsControllerProvider.overrideWith(() => notifications),
          medicalRecordsControllerProvider.overrideWith(() => medicalRecords),
          prescriptionsControllerProvider.overrideWith(() => prescriptions),
          invoicesControllerProvider.overrideWith(() => invoices),
        ],
      );
      addTearDown(container.dispose);

      final coordinator = container.read(patientDataSyncCoordinatorProvider);
      await coordinator.handleRemoteChange(
        entityType: 'MEDICAL_RECORD',
        entityId: 'record-1',
      );
      await coordinator.handleRemoteChange(
        entityType: 'PRESCRIPTION',
        entityId: 'prescription-1',
      );
      await coordinator.handleRemoteChange(
        entityType: 'INVOICE',
        entityId: 'invoice-1',
      );

      expect(notifications.refreshCalls, 3);
      expect(medicalRecords.refreshCalls, 1);
      expect(prescriptions.refreshCalls, 1);
      expect(invoices.refreshCalls, 1);
      expect(appointments.refreshCalls, 0);
    },
  );
}
