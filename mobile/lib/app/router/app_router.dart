import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/core/widgets/protected_feature_placeholder_screen.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_start_screen.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/login_screen.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/splash_screen.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/verify_otp_screen.dart';
import 'package:hospital_booking_mobile/features/home/presentation/home_screen.dart';
import 'package:hospital_booking_mobile/features/onboarding/application/onboarding_controller.dart';
import 'package:hospital_booking_mobile/features/onboarding/presentation/welcome_screen.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(
    authControllerProvider.select(
      (state) => (state.status, state.challenge != null),
    ),
    (_, _) => refresh.value += 1,
  );
  ref.listen(onboardingControllerProvider, (_, _) => refresh.value += 1);

  final router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, routeState) {
      final auth = ref.read(authControllerProvider);
      final onboarding = ref.read(onboardingControllerProvider);
      final welcomeSeen = onboarding.when<bool?>(
        data: (value) => value,
        error: (_, _) => true,
        loading: () => null,
      );
      final location = routeState.matchedLocation;
      return resolveAppRedirect(
        authStatus: auth.status,
        hasChallenge: auth.challenge != null,
        welcomeSeen: welcomeSeen,
        location: location,
        returnTo: routeState.uri.queryParameters['from'],
      );
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
      GoRoute(
        path: '/login',
        builder: (_, state) => LoginScreen(
          returnTo: safeReturnLocation(state.uri.queryParameters['from']),
        ),
      ),
      GoRoute(
        path: '/verify-otp',
        builder: (_, state) => VerifyOtpScreen(
          returnTo: safeReturnLocation(state.uri.queryParameters['from']),
        ),
      ),
      GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
      GoRoute(path: '/booking', builder: (_, _) => const BookingStartScreen()),
      GoRoute(
        path: '/appointments',
        builder: (_, _) => const ProtectedFeaturePlaceholderScreen(
          title: 'Lịch khám của tôi',
          message:
              'Danh sách lịch khám sẽ được kết nối với patient portal ở mốc tiếp theo.',
          icon: Icons.event_note_outlined,
        ),
      ),
      GoRoute(
        path: '/medical-records',
        builder: (_, _) => const ProtectedFeaturePlaceholderScreen(
          title: 'Hồ sơ sức khỏe',
          message:
              'Kết quả khám và tệp y tế chỉ hiển thị sau khi xác thực tài khoản.',
          icon: Icons.folder_shared_outlined,
        ),
      ),
      GoRoute(
        path: '/prescriptions',
        builder: (_, _) => const ProtectedFeaturePlaceholderScreen(
          title: 'Đơn thuốc',
          message: 'Đơn thuốc điện tử sẽ được đồng bộ từ hồ sơ bệnh nhân.',
          icon: Icons.medication_outlined,
        ),
      ),
      GoRoute(
        path: '/invoices',
        builder: (_, _) => const ProtectedFeaturePlaceholderScreen(
          title: 'Hóa đơn',
          message:
              'Hóa đơn và trạng thái thanh toán sẽ được kết nối ở mốc nghiệp vụ.',
          icon: Icons.receipt_long_outlined,
        ),
      ),
      GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
    ],
  );
  ref.onDispose(() {
    router.dispose();
    refresh.dispose();
  });
  return router;
});
