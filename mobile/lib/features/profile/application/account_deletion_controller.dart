import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/profile/data/account_deletion_repository.dart';

final accountDeletionRepositoryProvider = Provider<AccountDeletionRepository>(
  (ref) => AccountDeletionRepository(ref.watch(authenticatedDioProvider)),
);

final accountDeletionControllerProvider =
    NotifierProvider.autoDispose<
      AccountDeletionController,
      AccountDeletionState
    >(AccountDeletionController.new);

enum AccountDeletionStep { intro, requesting, awaitingOtp, confirming, deleted }

class AccountDeletionState {
  const AccountDeletionState({
    this.step = AccountDeletionStep.intro,
    this.challenge,
    this.error,
  });

  final AccountDeletionStep step;
  final AccountDeletionChallenge? challenge;
  final ApiException? error;

  bool get isBusy =>
      step == AccountDeletionStep.requesting ||
      step == AccountDeletionStep.confirming;
}

/// Xóa tài khoản: gửi mã tới email của tài khoản, xác nhận bằng mã, rồi thoát phiên trên máy.
/// Máy chủ đóng và ẩn danh tài khoản (hồ sơ khám được giữ theo quy định nhưng không còn gắn danh tính).
class AccountDeletionController extends Notifier<AccountDeletionState> {
  @override
  AccountDeletionState build() => const AccountDeletionState();

  Future<bool> requestOtp() async {
    if (state.isBusy) return false;
    state = AccountDeletionState(
      step: AccountDeletionStep.requesting,
      challenge: state.challenge,
    );
    try {
      final challenge = await ref
          .read(accountDeletionRepositoryProvider)
          .requestOtp();
      if (!ref.mounted) return false;
      state = AccountDeletionState(
        step: AccountDeletionStep.awaitingOtp,
        challenge: challenge,
      );
      return true;
    } on ApiException catch (error) {
      if (!ref.mounted) return false;
      final previous = state.challenge;
      state = AccountDeletionState(
        step: previous == null
            ? AccountDeletionStep.intro
            : AccountDeletionStep.awaitingOtp,
        challenge: previous,
        error: error,
      );
      return false;
    }
  }

  Future<bool> confirm(String otp) async {
    final challenge = state.challenge;
    if (challenge == null || state.isBusy) return false;
    state = AccountDeletionState(
      step: AccountDeletionStep.confirming,
      challenge: challenge,
    );
    try {
      await ref
          .read(accountDeletionRepositoryProvider)
          .confirm(challengeId: challenge.challengeId, otp: otp);
    } on ApiException catch (error) {
      if (!ref.mounted) return false;
      state = AccountDeletionState(
        step: AccountDeletionStep.awaitingOtp,
        challenge: challenge,
        error: error,
      );
      return false;
    }
    // Máy chủ đã thu hồi mọi phiên: bỏ token và dữ liệu phiên trên máy (gọi đăng xuất, lỗi máy chủ được bỏ qua).
    await ref.read(authControllerProvider.notifier).logout();
    if (ref.mounted) {
      state = const AccountDeletionState(step: AccountDeletionStep.deleted);
    }
    return true;
  }

  void dismissError() => state = AccountDeletionState(
    step: state.step,
    challenge: state.challenge,
  );
}
