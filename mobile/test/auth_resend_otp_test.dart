import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/data/auth_repository.dart';
import 'package:hospital_booking_mobile/features/auth/domain/auth_session.dart';

/// Kho đăng nhập giả: mỗi lần gửi mã trả về kết quả kế tiếp trong hàng (mã thử thách hoặc lỗi).
class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository(this.results);

  final List<Object> results;

  @override
  Future<AuthSession?> restoreSession() async => null;

  @override
  Future<OtpChallenge> requestOtp(String email, {String? termsVersion}) async {
    final next = results.removeAt(0);
    if (next is ApiException) throw next;
    return next as OtpChallenge;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

OtpChallenge _challenge(String id) => OtpChallenge(
  challengeId: id,
  expiresAt: DateTime.now().add(const Duration(minutes: 5)),
  maskedTarget: 'a***@example.test',
);

Future<ProviderContainer> _signedOtpStep(List<Object> results) async {
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(_FakeAuthRepository(results)),
    ],
  );
  container.read(authControllerProvider);
  await Future<void>.delayed(Duration.zero);
  final sent = await container
      .read(authControllerProvider.notifier)
      .requestOtp('an@example.test');
  expect(sent, isTrue);
  return container;
}

void main() {
  test('a failed resend keeps the current code usable', () async {
    final container = await _signedOtpStep([
      _challenge('c1'),
      const ApiException(
        kind: ApiErrorKind.rateLimited,
        code: 'OTP_COOLDOWN',
        message: 'Vui lòng đợi 42 giây để gửi lại OTP',
        retryAfterSeconds: 42,
      ),
    ]);
    addTearDown(container.dispose);

    final resent = await container
        .read(authControllerProvider.notifier)
        .resendOtp();

    final state = container.read(authControllerProvider);
    expect(resent, isFalse);
    // Vẫn ở bước nhập mã với mã cũ; lỗi mang số giây chờ để giao diện đếm ngược đúng.
    expect(state.status, AuthStatus.awaitingOtp);
    expect(state.challenge?.challengeId, 'c1');
    expect(state.errorFor(AuthErrorOrigin.requestOtp)?.retryAfterSeconds, 42);
  });

  test('a successful resend swaps in the new challenge', () async {
    final container = await _signedOtpStep([
      _challenge('c1'),
      _challenge('c2'),
    ]);
    addTearDown(container.dispose);

    final resent = await container
        .read(authControllerProvider.notifier)
        .resendOtp();

    final state = container.read(authControllerProvider);
    expect(resent, isTrue);
    expect(state.status, AuthStatus.awaitingOtp);
    expect(state.challenge?.challengeId, 'c2');
    expect(state.error, isNull);
  });

  test('the code countdown follows expiresIn, not the server clock', () {
    final challenge = OtpChallenge.fromJson({
      'challengeId': 'c1',
      'expiresIn': 300,
      // Giờ máy chủ lệch một giờ so với máy: hạn vẫn tính đúng 5 phút từ lúc nhận.
      'expiresAt': DateTime.now()
          .subtract(const Duration(hours: 1))
          .toIso8601String(),
    });
    final left = challenge.expiresAt.difference(DateTime.now()).inSeconds;
    expect(left, inInclusiveRange(295, 300));
  });
}
