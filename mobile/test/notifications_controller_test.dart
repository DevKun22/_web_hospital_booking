import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';
import 'package:hospital_booking_mobile/features/notifications/data/notifications_repository.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';

const _patient = PatientUser(
  id: 'patient-1',
  fullName: 'Nguyễn Văn An',
  phone: '0912345678',
  isPhoneVerified: true,
);

PatientNotification _notification(String id, {bool isRead = false}) =>
    PatientNotification(
      id: id,
      type: PatientNotificationType.appointmentReminder,
      title: 'Nhắc lịch khám',
      body: 'Bạn có lịch khám sắp tới.',
      entityType: 'APPOINTMENT',
      entityId: 'appointment-$id',
      publishedAt: DateTime(2030, 1, 2, 9),
      isRead: isRead,
      readAt: isRead ? DateTime(2030, 1, 2, 9, 1) : null,
    );

class _AuthenticatedController extends AuthController {
  @override
  AuthState build() =>
      const AuthState(status: AuthStatus.authenticated, user: _patient);

  void becomeGuest() => state = const AuthState.unauthenticated();
}

class _FakeNotificationsRepository extends NotificationsRepository {
  _FakeNotificationsRepository()
    : super(Dio(BaseOptions(baseUrl: 'https://example.test/api/v1')));

  int markAllCalls = 0;
  bool failMarkRead = false;
  Completer<PatientNotification>? markReadGate;

  @override
  Future<NotificationPage> list({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async => NotificationPage(
    items: page == 1 ? [_notification('1')] : [_notification('2')],
    page: page,
    total: 2,
    unreadCount: 2,
    hasNextPage: page == 1,
  );

  @override
  Future<int> unreadCount() async => 2;

  @override
  Future<PatientNotification> markRead(String id) async {
    if (failMarkRead) {
      throw const ApiException(
        kind: ApiErrorKind.network,
        message: 'Mất kết nối',
      );
    }
    return (markReadGate ??= Completer<PatientNotification>()).future;
  }

  @override
  Future<int> markAllRead() async {
    markAllCalls += 1;
    return 1;
  }
}

void main() {
  test('loads pages and updates the unread badge optimistically', () async {
    final repository = _FakeNotificationsRepository();
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthenticatedController.new),
        notificationsRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(notificationsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    var state = container.read(notificationsControllerProvider);
    expect(state.items.map((item) => item.id), ['1']);
    expect(state.unreadCount, 2);
    expect(state.hasNextPage, isTrue);

    await container.read(notificationsControllerProvider.notifier).loadMore();
    state = container.read(notificationsControllerProvider);
    expect(state.items.map((item) => item.id), ['1', '2']);

    final markFuture = container
        .read(notificationsControllerProvider.notifier)
        .markRead('1');
    await Future<void>.delayed(Duration.zero);
    state = container.read(notificationsControllerProvider);
    expect(state.items.first.isRead, isTrue);
    expect(state.unreadCount, 1);

    repository.markReadGate!.complete(_notification('1', isRead: true));
    expect(await markFuture, isTrue);

    expect(
      await container
          .read(notificationsControllerProvider.notifier)
          .markAllRead(),
      isTrue,
    );
    state = container.read(notificationsControllerProvider);
    expect(state.unreadCount, 0);
    expect(state.items.every((item) => item.isRead), isTrue);
    expect(repository.markAllCalls, 1);
  });

  test('clears protected notification state after logout', () async {
    final repository = _FakeNotificationsRepository();
    final auth = _AuthenticatedController();
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(() => auth),
        notificationsRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(notificationsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(notificationsControllerProvider).items, isNotEmpty);

    auth.becomeGuest();
    await Future<void>.delayed(Duration.zero);

    final state = container.read(notificationsControllerProvider);
    expect(state.items, isEmpty);
    expect(state.unreadCount, 0);
    expect(state.isInitialLoading, isFalse);
  });

  test('rolls back an optimistic read when synchronization fails', () async {
    final repository = _FakeNotificationsRepository()..failMarkRead = true;
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(_AuthenticatedController.new),
        notificationsRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);

    container.read(notificationsControllerProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    final result = await container
        .read(notificationsControllerProvider.notifier)
        .markRead('1');
    final state = container.read(notificationsControllerProvider);

    expect(result, isFalse);
    expect(state.items.first.isRead, isFalse);
    expect(state.unreadCount, 2);
    expect(state.error?.kind, ApiErrorKind.network);
  });
}
