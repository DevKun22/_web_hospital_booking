import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/invoices/application/invoices_controller.dart';
import 'package:hospital_booking_mobile/features/medical_records/application/medical_records_controller.dart';
import 'package:hospital_booking_mobile/features/prescriptions/application/prescriptions_controller.dart';

final healthHubSummaryProvider = Provider<HealthHubSummary>((ref) {
  final appointments = ref.watch(appointmentsControllerProvider);
  final medicalRecords = ref.watch(medicalRecordsControllerProvider);
  final prescriptions = ref.watch(prescriptionsControllerProvider);
  final invoices = ref.watch(invoicesControllerProvider);
  final dependents = ref.watch(dependentProfilesControllerProvider);

  return HealthHubSummary(
    appointments: HealthHubCount(
      value: appointments.total,
      isLoading: appointments.isInitialLoading,
    ),
    medicalRecords: HealthHubCount(
      value: medicalRecords.total,
      isLoading: medicalRecords.isInitialLoading,
    ),
    prescriptions: HealthHubCount(
      value: prescriptions.total,
      isLoading: prescriptions.isInitialLoading,
    ),
    invoices: HealthHubCount(
      value: invoices.total,
      isLoading: invoices.isInitialLoading,
    ),
    dependents: HealthHubCount(
      value: dependents.items.length,
      isLoading: dependents.isLoading && !dependents.loaded,
    ),
  );
});

class HealthHubSummary {
  const HealthHubSummary({
    required this.appointments,
    required this.medicalRecords,
    required this.prescriptions,
    required this.invoices,
    required this.dependents,
  });

  final HealthHubCount appointments;
  final HealthHubCount medicalRecords;
  final HealthHubCount prescriptions;
  final HealthHubCount invoices;
  final HealthHubCount dependents;
}

class HealthHubCount {
  const HealthHubCount({required this.value, required this.isLoading});

  final int value;
  final bool isLoading;
}
