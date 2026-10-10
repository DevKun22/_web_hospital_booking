import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/booking/data/booking_catalog_repository.dart';
import 'package:hospital_booking_mobile/features/booking/data/booking_selection_store.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

final bookingSelectionStoreProvider = Provider<BookingSelectionStore>(
  (ref) => SharedBookingSelectionStore(),
);

final bookingCatalogRepositoryProvider = Provider<BookingCatalogRepository>(
  (ref) => BookingCatalogRepository(ref.watch(authDioProvider)),
);

final doctorDetailProvider = FutureProvider.autoDispose
    .family<BookingDoctor, String>(
      (ref, doctorId) =>
          ref.watch(bookingCatalogRepositoryProvider).fetchDoctor(doctorId),
    );

final bookingFlowControllerProvider =
    NotifierProvider<BookingFlowController, BookingFlowState>(
      BookingFlowController.new,
    );

class BookingFlowState {
  const BookingFlowState({
    this.departments = const [],
    this.doctors = const [],
    this.packages = const [],
    this.slots = const [],
    this.selection = const BookingSelection(),
    this.error,
    this.isCatalogLoading = false,
    this.isSlotsLoading = false,
  });

  final List<BookingDepartment> departments;
  final List<BookingDoctor> doctors;
  final List<MedicalPackage> packages;
  final List<BookingSlot> slots;
  final BookingSelection selection;
  final ApiException? error;
  final bool isCatalogLoading;
  final bool isSlotsLoading;

  List<BookingDoctor> get visibleDoctors {
    final departmentId = selection.departmentId;
    if (departmentId == null) return doctors;
    return doctors
        .where((doctor) => doctor.departmentId == departmentId)
        .toList(growable: false);
  }

  MedicalPackage? get selectedPackage =>
      _firstWhereOrNull(packages, (item) => item.id == selection.packageId);

  BookingDepartment? get selectedDepartment => _firstWhereOrNull(
    departments,
    (item) => item.id == selection.departmentId,
  );

  BookingDoctor? get selectedDoctor =>
      _firstWhereOrNull(doctors, (item) => item.id == selection.doctorId);

  BookingSlot? get selectedSlot =>
      _firstWhereOrNull(slots, (item) => item.id == selection.slotId);
}

class BookingFlowController extends Notifier<BookingFlowState> {
  int _catalogRequestVersion = 0;
  int _slotRequestVersion = 0;
  String? _presetPackageId;
  String? _presetDepartmentId;
  String? _presetDoctorId;
  String? _presetDate;
  String? _presetTimeSlotId;

  @override
  BookingFlowState build() {
    Future<void>.microtask(load);
    return const BookingFlowState(isCatalogLoading: true);
  }

  Future<void> load() async {
    final requestVersion = ++_catalogRequestVersion;
    _slotRequestVersion += 1;
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
      slots: state.slots,
      selection: state.selection,
      isCatalogLoading: true,
    );

    BookingSelection stored = const BookingSelection();
    try {
      stored = await ref.read(bookingSelectionStoreProvider).read() ?? stored;
    } catch (_) {
      // Local persistence must not prevent loading the live catalog.
    }

    try {
      final catalog = await ref
          .read(bookingCatalogRepositoryProvider)
          .fetchCatalog();
      if (requestVersion != _catalogRequestVersion) return;

      final selection = _validatedSelection(stored, catalog);
      state = BookingFlowState(
        departments: catalog.departments,
        doctors: catalog.doctors,
        packages: catalog.packages,
        selection: selection,
      );
      await _persist(selection);

      if (_hasPreset) await _applyPresetToLoadedCatalog();

      final restoredSelection = state.selection;
      if (restoredSelection.doctorId != null &&
          restoredSelection.date != null) {
        await _loadSlots(restoredSelection.doctorId!, restoredSelection.date!);
      }
    } on ApiException catch (error) {
      if (requestVersion != _catalogRequestVersion) return;
      state = BookingFlowState(
        departments: state.departments,
        doctors: state.doctors,
        packages: state.packages,
        slots: state.slots,
        selection: state.selection,
        error: error,
      );
    }
  }

  bool get _hasPreset =>
      _presetPackageId != null ||
      _presetDepartmentId != null ||
      _presetDoctorId != null ||
      _presetDate != null ||
      _presetTimeSlotId != null;

  Future<void> applyPreset({
    String? packageId,
    String? departmentId,
    String? doctorId,
    String? date,
    String? timeSlotId,
  }) async {
    _presetPackageId = packageId;
    _presetDepartmentId = departmentId;
    _presetDoctorId = doctorId;
    _presetDate = date;
    _presetTimeSlotId = timeSlotId;
    if (!state.isCatalogLoading && state.departments.isNotEmpty) {
      await _applyPresetToLoadedCatalog();
    }
  }

  Future<void> _applyPresetToLoadedCatalog() async {
    final packageId = _presetPackageId;
    final departmentId = _presetDepartmentId;
    final doctorId = _presetDoctorId;
    final date = _presetDate;
    final timeSlotId = _presetTimeSlotId;
    _presetPackageId = null;
    _presetDepartmentId = null;
    _presetDoctorId = null;
    _presetDate = null;
    _presetTimeSlotId = null;

    if (packageId != null &&
        state.packages.any((item) => item.id == packageId)) {
      await selectPackage(packageId);
    }
    if (departmentId != null &&
        state.departments.any((item) => item.id == departmentId)) {
      await selectDepartment(departmentId);
    }
    if (doctorId != null && state.doctors.any((item) => item.id == doctorId)) {
      final doctor = state.doctors.firstWhere((item) => item.id == doctorId);
      final fixedDepartmentId = state.selectedPackage?.departmentId;
      if (fixedDepartmentId == null ||
          fixedDepartmentId == doctor.departmentId) {
        if (state.selection.departmentId != doctor.departmentId) {
          await selectDepartment(doctor.departmentId);
        }
        await selectDoctor(doctorId);
      }
    }
    if (date != null && state.selection.doctorId != null) {
      await selectDate(date);
    }
    if (timeSlotId != null &&
        state.slots.any((slot) => slot.id == timeSlotId)) {
      await selectSlot(timeSlotId);
    }
  }

  Future<void> selectServiceMode(BookingServiceMode mode) async {
    if (state.selection.serviceMode == mode) return;
    _slotRequestVersion += 1;
    final selection = BookingSelection(serviceMode: mode);
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
      selection: selection,
    );
    await _persist(selection);
  }

  Future<void> selectPackage(String packageId) async {
    final packageItem = _firstWhereOrNull(
      state.packages,
      (item) => item.id == packageId,
    );
    if (packageItem == null) return;
    if (state.selection.serviceMode == BookingServiceMode.package &&
        state.selection.packageId == packageId) {
      return;
    }
    _slotRequestVersion += 1;
    final selection = BookingSelection(
      serviceMode: BookingServiceMode.package,
      packageId: packageItem.id,
      departmentId: packageItem.departmentId,
    );
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
      selection: selection,
    );
    await _persist(selection);
  }

  Future<void> clearPackage() async {
    if (state.selection.serviceMode != BookingServiceMode.package ||
        state.selection.packageId == null) {
      return;
    }
    _slotRequestVersion += 1;
    const selection = BookingSelection(serviceMode: BookingServiceMode.package);
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
      selection: selection,
    );
    await _persist(selection);
  }

  Future<void> selectDepartment(String departmentId) async {
    final fixedDepartmentId = state.selectedPackage?.departmentId;
    if (fixedDepartmentId != null && fixedDepartmentId != departmentId) return;
    if (state.selection.departmentId == departmentId) return;
    _slotRequestVersion += 1;
    final selection = BookingSelection(
      serviceMode: state.selection.serviceMode,
      packageId: state.selection.packageId,
      departmentId: departmentId,
    );
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
      selection: selection,
    );
    await _persist(selection);
  }

  Future<void> selectDoctor(String doctorId) async {
    final doctor = _firstWhereOrNull(
      state.doctors,
      (item) => item.id == doctorId,
    );
    if (doctor == null) return;
    final fixedDepartmentId = state.selectedPackage?.departmentId;
    if (fixedDepartmentId != null && fixedDepartmentId != doctor.departmentId) {
      return;
    }
    if (state.selection.doctorId == doctorId) return;
    _slotRequestVersion += 1;
    final selection = BookingSelection(
      serviceMode: state.selection.serviceMode,
      packageId: state.selection.packageId,
      departmentId: doctor.departmentId,
      doctorId: doctor.id,
    );
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
      selection: selection,
    );
    await _persist(selection);
  }

  Future<void> selectDate(String date) async {
    final doctorId = state.selection.doctorId;
    if (doctorId == null || !_isSelectableDate(date)) return;
    final selection = BookingSelection(
      serviceMode: state.selection.serviceMode,
      packageId: state.selection.packageId,
      departmentId: state.selection.departmentId,
      doctorId: doctorId,
      date: date,
    );
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
      selection: selection,
      isSlotsLoading: true,
    );
    await _persist(selection);
    await _loadSlots(doctorId, date);
  }

  Future<void> selectSlot(String slotId) async {
    if (!state.slots.any((slot) => slot.id == slotId)) return;
    final selection = BookingSelection(
      serviceMode: state.selection.serviceMode,
      packageId: state.selection.packageId,
      departmentId: state.selection.departmentId,
      doctorId: state.selection.doctorId,
      date: state.selection.date,
      slotId: slotId,
    );
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
      slots: state.slots,
      selection: selection,
    );
    await _persist(selection);
  }

  Future<void> refreshSlots() async {
    final doctorId = state.selection.doctorId;
    final date = state.selection.date;
    if (doctorId == null || date == null) return;
    await _loadSlots(doctorId, date);
  }

  Future<void> clearSelection() async {
    _slotRequestVersion += 1;
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
    );
    try {
      await ref.read(bookingSelectionStoreProvider).clear();
    } catch (_) {
      // The in-memory reset remains authoritative for the current session.
    }
  }

  void dismissError() => state = BookingFlowState(
    departments: state.departments,
    doctors: state.doctors,
    packages: state.packages,
    slots: state.slots,
    selection: state.selection,
  );

  Future<void> _loadSlots(String doctorId, String date) async {
    final requestVersion = ++_slotRequestVersion;
    state = BookingFlowState(
      departments: state.departments,
      doctors: state.doctors,
      packages: state.packages,
      slots: state.slots,
      selection: state.selection,
      isSlotsLoading: true,
    );
    try {
      final slots = await ref
          .read(bookingCatalogRepositoryProvider)
          .fetchAvailableSlots(doctorId: doctorId, date: date);
      if (requestVersion != _slotRequestVersion) return;
      final selectedSlotId =
          slots.any((slot) => slot.id == state.selection.slotId)
          ? state.selection.slotId
          : null;
      final selection = BookingSelection(
        serviceMode: state.selection.serviceMode,
        packageId: state.selection.packageId,
        departmentId: state.selection.departmentId,
        doctorId: state.selection.doctorId,
        date: state.selection.date,
        slotId: selectedSlotId,
      );
      state = BookingFlowState(
        departments: state.departments,
        doctors: state.doctors,
        packages: state.packages,
        slots: slots,
        selection: selection,
      );
      await _persist(selection);
    } on ApiException catch (error) {
      if (requestVersion != _slotRequestVersion) return;
      state = BookingFlowState(
        departments: state.departments,
        doctors: state.doctors,
        packages: state.packages,
        selection: state.selection,
        error: error,
      );
    }
  }

  BookingSelection _validatedSelection(
    BookingSelection value,
    BookingCatalog catalog,
  ) {
    final packageItem = value.serviceMode == BookingServiceMode.package
        ? _firstWhereOrNull(
            catalog.packages,
            (item) => item.id == value.packageId,
          )
        : null;
    if (value.serviceMode == BookingServiceMode.package &&
        packageItem == null) {
      return const BookingSelection(serviceMode: BookingServiceMode.package);
    }

    final departmentId = packageItem?.departmentId ?? value.departmentId;
    final departmentExists = catalog.departments.any(
      (item) => item.id == departmentId,
    );
    if (!departmentExists) {
      return BookingSelection(
        serviceMode: value.serviceMode,
        packageId: packageItem?.id,
      );
    }

    final doctor = _firstWhereOrNull(
      catalog.doctors,
      (item) => item.id == value.doctorId && item.departmentId == departmentId,
    );
    if (doctor == null) {
      return BookingSelection(
        serviceMode: value.serviceMode,
        packageId: packageItem?.id,
        departmentId: departmentId,
      );
    }
    final date = value.date != null && _isSelectableDate(value.date!)
        ? value.date
        : null;
    return BookingSelection(
      serviceMode: value.serviceMode,
      packageId: packageItem?.id,
      departmentId: departmentId,
      doctorId: value.doctorId,
      date: date,
      slotId: date == null ? null : value.slotId,
    );
  }

  Future<void> _persist(BookingSelection selection) async {
    try {
      await ref.read(bookingSelectionStoreProvider).write(selection);
    } catch (_) {
      // A storage failure does not invalidate a live, server-verified choice.
    }
  }
}

T? _firstWhereOrNull<T>(Iterable<T> values, bool Function(T) test) {
  for (final value in values) {
    if (test(value)) return value;
  }
  return null;
}

bool _isSelectableDate(String value) {
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return false;
  final vietnamNow = DateTime.now().toUtc().add(const Duration(hours: 7));
  final today = DateTime(vietnamNow.year, vietnamNow.month, vietnamNow.day);
  final date = DateTime(parsed.year, parsed.month, parsed.day);
  final lastDate = today.add(const Duration(days: 13));
  return !date.isBefore(today) && !date.isAfter(lastDate);
}
