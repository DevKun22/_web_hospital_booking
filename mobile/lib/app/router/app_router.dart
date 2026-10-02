import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/login_screen.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/splash_screen.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/verify_otp_screen.dart';
import 'package:hospital_booking_mobile/features/home/presentation/home_screen.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authStatus = ref.watch(
    authControllerProvider.select((state) => state.status),
  );
  final hasChallenge = ref.watch(
    authControllerProvider.select((state) => state.challenge != null),
  );

  final router = GoRouter(
    initialLocation: '/splash',
    redirect: (context, routeState) {
      final location = routeState.matchedLocation;
      final isAuthRoute = location == '/login' || location == '/verify-otp';

      if (authStatus == AuthStatus.bootstrapping ||
          authStatus == AuthStatus.offline) {
        return location == '/splash' ? null : '/splash';
      }
      if (authStatus == AuthStatus.authenticated) {
        return location == '/splash' || isAuthRoute ? '/home' : null;
      }
      if ((authStatus == AuthStatus.awaitingOtp ||
              authStatus == AuthStatus.verifyingOtp) &&
          hasChallenge) {
        return location == '/verify-otp' ? null : '/verify-otp';
      }
      return location == '/login' ? null : '/login';
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/verify-otp', builder: (_, _) => const VerifyOtpScreen()),
      GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
      GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
