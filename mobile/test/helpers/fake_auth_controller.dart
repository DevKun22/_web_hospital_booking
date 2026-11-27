import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';

/// Trạng thái đăng nhập giả cho test: bắt đầu là khách, đổi người dùng bằng [signInAs] / [signOut]
/// mà không kéo theo cấu hình app, kho token hay máy chủ.
class FakeAuthController extends AuthController {
  @override
  AuthState build() => const AuthState.unauthenticated();

  void signInAs(String id) => state = AuthState(
    status: AuthStatus.authenticated,
    user: PatientUser(
      id: id,
      fullName: 'Người khám $id',
      isEmailVerified: true,
    ),
  );

  void signOut() => state = const AuthState.unauthenticated();
}

final fakeAuthOverride = authControllerProvider.overrideWith(
  FakeAuthController.new,
);
