import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/health_hub/application/health_hub_summary.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/medical_records/application/medical_records_controller.dart';
import 'package:hospital_booking_mobile/features/prescriptions/application/prescriptions_controller.dart';

class _Appointments extends AppointmentsController {
  @override
  AppointmentsState build() => const AppointmentsState(total: 4);
}

class _MedicalRecords extends MedicalRecordsController {
  @override
  MedicalRecordsState build() => const MedicalRecordsState(total: 3);
}

class _Prescriptions extends PrescriptionsController {
  @override
  PrescriptionsState build() => const PrescriptionsState(total: 2);
}

class _Invoices extends InvoicesController {
  @override
  InvoicesState build() => const InvoicesState(total: 1);
}

class _Dependents extends DependentProfilesController {
  @override
  DependentProfilesState build() => const DependentProfilesState(loaded: true);
}

void main() {
  test('combines existing feature states without another API contract', () {
    final container = ProviderContainer(
      overrides: [
        appointmentsControllerProvider.overrideWith(_Appointments.new),
        medicalRecordsControllerProvider.overrideWith(_MedicalRecords.new),
        prescriptionsControllerProvider.overrideWith(_Prescriptions.new),
        invoicesControllerProvider.overrideWith(_Invoices.new),
        dependentProfilesControllerProvider.overrideWith(_Dependents.new),
      ],
    );
    addTearDown(container.dispose);

    final summary = container.read(healthHubSummaryProvider);

    expect(summary.appointments.value, 4);
    expect(summary.medicalRecords.value, 3);
    expect(summary.prescriptions.value, 2);
    expect(summary.invoices.value, 1);
    expect(summary.dependents.value, 0);
  });
}
