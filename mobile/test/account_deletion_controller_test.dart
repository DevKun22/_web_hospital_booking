import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/profile/application/account_deletion_controller.dart';
import 'package:hospital_booking_mobile/features/profile/data/account_deletion_repository.dart';

import 'helpers/fake_auth_controller.dart';

class _FakeRepository extends AccountDeletionRepository {
  _FakeRepository() : super(Dio());

  ApiException? requestError;
  ApiException? confirmError;
  String? confirmedOtp;

  @override
  Future<AccountDeletionChallenge> requestOtp() async {
    final error = requestError;
    if (error != null) throw error;
    return const AccountDeletionChallenge(
      challengeId: 'challenge-1',
      maskedTarget: 'a***@example.test',
      expiresIn: 300,
    );
  }

  @override
  Future<void> confirm({
    required String challengeId,
    required String otp,
  }) async {
    final error = confirmError;
    if (error != null) throw error;
    confirmedOtp = otp;
  }
}

class _SignedInAuth extends FakeAuthController {
  int logoutCalls = 0;

  @override
  Future<bool> logout() async {
    logoutCalls += 1;
    signOut();
    return true;
  }
}

ProviderContainer _container(_FakeRepository repository) {
  final container = ProviderContainer(
    overrides: [
      authControllerProvider.overrideWith(_SignedInAuth.new),
      accountDeletionRepositoryProvider.overrideWithValue(repository),
    ],
  );
  addTearDown(container.dispose);
  (container.read(authControllerProvider.notifier) as _SignedInAuth).signInAs(
    'patient-1',
  );
  container.listen(accountDeletionControllerProvider, (_, _) {});
  return container;
}

void main() {
  test('xác nhận đúng mã thì xóa và thoát phiên trên máy', () async {
    final repository = _FakeRepository();
    final container = _container(repository);
    final controller = container.read(
      accountDeletionControllerProvider.notifier,
    );

    expect(await controller.requestOtp(), isTrue);
    expect(
      container.read(accountDeletionControllerProvider).step,
      AccountDeletionStep.awaitingOtp,
    );
    expect(await controller.confirm('123456'), isTrue);

    expect(repository.confirmedOtp, '123456');
    final auth =
        container.read(authControllerProvider.notifier) as _SignedInAuth;
    expect(auth.logoutCalls, 1);
    expect(container.read(authControllerProvider).isAuthenticated, isFalse);
  });

  test('còn lịch chưa khám: báo lỗi, không có bước nhập mã', () async {
    final repository = _FakeRepository()
      ..requestError = const ApiException(
        kind: ApiErrorKind.conflict,
        code: 'ACCOUNT_HAS_ACTIVE_APPOINTMENTS',
        message: 'Bạn còn lịch hẹn chưa khám.',
        statusCode: 409,
      );
    final container = _container(repository);

    expect(
      await container
          .read(accountDeletionControllerProvider.notifier)
          .requestOtp(),
      isFalse,
    );
    final state = container.read(accountDeletionControllerProvider);
    expect(state.step, AccountDeletionStep.intro);
    expect(state.error?.code, 'ACCOUNT_HAS_ACTIVE_APPOINTMENTS');
  });

  test('sai mã thì giữ tài khoản và cho nhập lại', () async {
    final repository = _FakeRepository()
      ..confirmError = const ApiException(
        kind: ApiErrorKind.unauthorized,
        code: 'OTP_INVALID',
        message: 'Mã không đúng.',
        statusCode: 401,
      );
    final container = _container(repository);
    final controller = container.read(
      accountDeletionControllerProvider.notifier,
    );
    await controller.requestOtp();

    expect(await controller.confirm('000000'), isFalse);
    expect(
      container.read(accountDeletionControllerProvider).step,
      AccountDeletionStep.awaitingOtp,
    );
    expect(container.read(authControllerProvider).isAuthenticated, isTrue);
  });
}
