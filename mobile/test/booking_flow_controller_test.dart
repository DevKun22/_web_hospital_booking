import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_flow_controller.dart';
import 'package:hospital_booking_mobile/features/booking/data/booking_catalog_repository.dart';
import 'package:hospital_booking_mobile/features/booking/data/booking_selection_store.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';

const _departments = [
  BookingDepartment(id: 'department-1', name: 'Tim mạch'),
  BookingDepartment(id: 'department-2', name: 'Nhi khoa'),
];

const _doctors = [
  BookingDoctor(
    id: 'doctor-1',
    fullName: 'Nguyễn Văn An',
    departmentId: 'department-1',
    departmentName: 'Tim mạch',
    consultationFee: 250000,
  ),
  BookingDoctor(
    id: 'doctor-2',
    fullName: 'Trần Thị Bình',
    departmentId: 'department-2',
    departmentName: 'Nhi khoa',
    consultationFee: 200000,
  ),
];

class _FakeBookingCatalogRepository extends BookingCatalogRepository {
  _FakeBookingCatalogRepository({this.slots = const []}) : super(Dio());

  final List<BookingSlot> slots;

  @override
  Future<BookingCatalog> fetchCatalog() async =>
      const BookingCatalog(departments: _departments, doctors: _doctors);

  @override
  Future<List<BookingSlot>> fetchAvailableSlots({
    required String doctorId,
    required String date,
  }) async => slots;
}

Future<void> _waitUntil(bool Function() condition) async {
  for (var attempt = 0; attempt < 100; attempt++) {
    if (condition()) return;
    await Future<void>.delayed(const Duration(milliseconds: 2));
  }
  fail('Timed out waiting for booking state');
}

String _tomorrowInVietnam() {
  final now = DateTime.now().toUtc().add(const Duration(hours: 7));
  final date = DateTime(
    now.year,
    now.month,
    now.day,
  ).add(const Duration(days: 1));
  return '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}

void main() {
  test('changing an upstream choice clears dependent booking fields', () async {
    final date = _tomorrowInVietnam();
    final store = MemoryBookingSelectionStore();
    final repository = _FakeBookingCatalogRepository(
      slots: [
        BookingSlot(
          id: 'slot-1',
          date: date,
          startTime: '09:00',
          endTime: '09:30',
        ),
      ],
    );
    final container = ProviderContainer(
      overrides: [
        bookingSelectionStoreProvider.overrideWithValue(store),
        bookingCatalogRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(bookingFlowControllerProvider);
    await _waitUntil(
      () => !container.read(bookingFlowControllerProvider).isCatalogLoading,
    );
    final controller = container.read(bookingFlowControllerProvider.notifier);

    await controller.selectDepartment('department-1');
    await controller.selectDoctor('doctor-1');
    await controller.selectDate(date);
    await controller.selectSlot('slot-1');

    expect(
      container.read(bookingFlowControllerProvider).selection.isComplete,
      isTrue,
    );
    expect(store.selection?.slotId, 'slot-1');

    await controller.selectDepartment('department-2');
    final selection = container.read(bookingFlowControllerProvider).selection;
    expect(selection.departmentId, 'department-2');
    expect(selection.doctorId, isNull);
    expect(selection.date, isNull);
    expect(selection.slotId, isNull);
  });

  test('restored slot is removed when backend no longer returns it', () async {
    final date = _tomorrowInVietnam();
    final store = MemoryBookingSelectionStore(
      BookingSelection(
        departmentId: 'department-1',
        doctorId: 'doctor-1',
        date: date,
        slotId: 'stale-slot',
      ),
    );
    final container = ProviderContainer(
      overrides: [
        bookingSelectionStoreProvider.overrideWithValue(store),
        bookingCatalogRepositoryProvider.overrideWithValue(
          _FakeBookingCatalogRepository(),
        ),
      ],
    );
    addTearDown(container.dispose);

    container.read(bookingFlowControllerProvider);
    await _waitUntil(() {
      final state = container.read(bookingFlowControllerProvider);
      return !state.isCatalogLoading && !state.isSlotsLoading;
    });

    final state = container.read(bookingFlowControllerProvider);
    expect(state.selection.doctorId, 'doctor-1');
    expect(state.selection.date, date);
    expect(state.selection.slotId, isNull);
    expect(store.selection?.slotId, isNull);
  });

  test('a deep-link doctor preset wins over a restored draft', () async {
    final date = _tomorrowInVietnam();
    final store = MemoryBookingSelectionStore(
      BookingSelection(
        departmentId: 'department-1',
        doctorId: 'doctor-1',
        date: date,
        slotId: 'slot-1',
      ),
    );
    final container = ProviderContainer(
      overrides: [
        bookingSelectionStoreProvider.overrideWithValue(store),
        bookingCatalogRepositoryProvider.overrideWithValue(
          _FakeBookingCatalogRepository(),
        ),
      ],
    );
    addTearDown(container.dispose);

    final controller = container.read(bookingFlowControllerProvider.notifier);
    await controller.applyPreset(doctorId: 'doctor-2');
    await _waitUntil(
      () => !container.read(bookingFlowControllerProvider).isCatalogLoading,
    );

    final selection = container.read(bookingFlowControllerProvider).selection;
    expect(selection.departmentId, 'department-2');
    expect(selection.doctorId, 'doctor-2');
    expect(selection.date, isNull);
    expect(selection.slotId, isNull);
  });

  test('chatbot preset restores date and a still-available slot', () async {
    final date = _tomorrowInVietnam();
    final store = MemoryBookingSelectionStore();
    final repository = _FakeBookingCatalogRepository(
      slots: [
        BookingSlot(
          id: 'slot-from-chatbot',
          date: date,
          startTime: '10:00',
          endTime: '10:30',
        ),
      ],
    );
    final container = ProviderContainer(
      overrides: [
        bookingSelectionStoreProvider.overrideWithValue(store),
        bookingCatalogRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    final controller = container.read(bookingFlowControllerProvider.notifier);
    await controller.applyPreset(
      departmentId: 'department-1',
      doctorId: 'doctor-1',
      date: date,
      timeSlotId: 'slot-from-chatbot',
    );
    await _waitUntil(() {
      final state = container.read(bookingFlowControllerProvider);
      return !state.isCatalogLoading && !state.isSlotsLoading;
    });

    final selection = container.read(bookingFlowControllerProvider).selection;
    expect(selection.departmentId, 'department-1');
    expect(selection.doctorId, 'doctor-1');
    expect(selection.date, date);
    expect(selection.slotId, 'slot-from-chatbot');
  });
}
