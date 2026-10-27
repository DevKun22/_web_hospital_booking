import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/main_navigation_shell.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/appointment_detail_screen.dart';
import 'package:hospital_booking_mobile/features/appointments/presentation/appointments_screen.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_start_screen.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_patient_screen.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_success_screen.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/booking_verify_otp_screen.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/department_detail_screen.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/department_list_screen.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/doctor_detail_screen.dart';
import 'package:hospital_booking_mobile/features/chatbot/presentation/chatbot_screen.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/doctor_list_screen.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/package_list_screen.dart';
import 'package:hospital_booking_mobile/features/dependents/presentation/dependent_form_screen.dart';
import 'package:hospital_booking_mobile/features/dependents/presentation/dependents_screen.dart';
import 'package:hospital_booking_mobile/features/auth/application/app_launch_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/login_screen.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/splash_screen.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/verify_otp_screen.dart';
import 'package:hospital_booking_mobile/features/home/presentation/home_screen.dart';
import 'package:hospital_booking_mobile/features/health_hub/presentation/health_hub_screen.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/invoice_detail_screen.dart';
import 'package:hospital_booking_mobile/features/invoices/presentation/invoices_screen.dart';
import 'package:hospital_booking_mobile/features/medical_records/presentation/medical_document_screen.dart';
import 'package:hospital_booking_mobile/features/medical_records/presentation/medical_record_detail_screen.dart';
import 'package:hospital_booking_mobile/features/medical_records/presentation/medical_records_screen.dart';
import 'package:hospital_booking_mobile/features/mobile_tools/presentation/mobile_tools_screen.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/notifications_screen.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/notification_preferences_screen.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';
import 'package:hospital_booking_mobile/features/onboarding/application/onboarding_controller.dart';
import 'package:hospital_booking_mobile/features/onboarding/presentation/welcome_screen.dart';
import 'package:hospital_booking_mobile/features/packages/presentation/package_detail_screen.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_screen.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/profile_edit_screen.dart';
import 'package:hospital_booking_mobile/features/prescriptions/presentation/prescription_detail_screen.dart';
import 'package:hospital_booking_mobile/features/prescriptions/presentation/prescriptions_screen.dart';
import 'package:hospital_booking_mobile/features/support/presentation/support_center_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  final mainNavigationHistory = MainNavigationHistoryController();
  ref.listen(
    authControllerProvider.select(
      (state) => (state.status, state.challenge != null),
    ),
    (_, _) => refresh.value += 1,
  );
  ref.listen(onboardingControllerProvider, (_, _) => refresh.value += 1);
  ref.listen(appLaunchControllerProvider, (_, _) => refresh.value += 1);

  final router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, routeState) {
      final auth = ref.read(authControllerProvider);
      final onboarding = ref.read(onboardingControllerProvider);
      final launchPresentationCompleted = ref.read(appLaunchControllerProvider);
      final welcomeSeen = onboarding.when<bool?>(
        data: (value) => value,
        error: (_, _) => true,
        loading: () => null,
      );
      final location = routeState.matchedLocation;
      final returnTo = routeState.uri.queryParameters['from'] ?? auth.returnTo;
      return resolveAppRedirect(
        authStatus: auth.status,
        hasChallenge: auth.challenge != null,
        welcomeSeen: welcomeSeen,
        launchPresentationCompleted: launchPresentationCompleted,
        location: location,
        returnTo: returnTo,
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
      StatefulShellRoute.indexedStack(
        builder: (_, _, navigationShell) => MainNavigationShell(
          navigationShell: navigationShell,
          historyController: mainNavigationHistory,
        ),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                builder: (_, _) => MainBranchBackScope(
                  controller: mainNavigationHistory,
                  child: const HomeScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/records',
                builder: (_, _) => MainBranchBackScope(
                  controller: mainNavigationHistory,
                  child: const HealthHubScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/booking',
                pageBuilder: (_, state) => NoTransitionPage<void>(
                  // Query parameters describe an explicit booking intent.
                  // Include them in the page identity so an already-mounted
                  // StatefulShell branch cannot retain an older draft.
                  key: ValueKey(state.uri.toString()),
                  child: MainBranchBackScope(
                    controller: mainNavigationHistory,
                    child: BookingStartScreen(
                      packageId: state.uri.queryParameters['packageId'],
                      departmentId: state.uri.queryParameters['departmentId'],
                      doctorId: state.uri.queryParameters['doctorId'],
                      date: state.uri.queryParameters['date'],
                      timeSlotId: state.uri.queryParameters['timeSlotId'],
                      returnTo:
                          safeReturnLocation(
                            state.uri.queryParameters['returnTo'],
                          ) ??
                          (state.uri.queryParameters['origin'] == 'chatbot'
                              ? '/chatbot'
                              : null),
                    ),
                  ),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/notifications',
                builder: (_, _) => MainBranchBackScope(
                  controller: mainNavigationHistory,
                  child: const NotificationsScreen(
                    embeddedInMainNavigation: true,
                  ),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                builder: (_, _) => MainBranchBackScope(
                  controller: mainNavigationHistory,
                  child: const ProfileScreen(),
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/notification-settings',
        builder: (_, _) => const NotificationPreferencesScreen(),
      ),
      GoRoute(
        path: '/chatbot',
        builder: (_, state) => AppRouteBackScope(
          fallbackLocation: '/home',
          child: ChatbotScreen(
            initialPrompt: state.uri.queryParameters['prompt'],
          ),
        ),
      ),
      GoRoute(
        path: '/support',
        builder: (_, _) => const AppRouteBackScope(
          fallbackLocation: '/home',
          child: SupportCenterScreen(),
        ),
      ),
      GoRoute(
        path: '/departments',
        builder: (_, _) => const DepartmentListScreen(),
      ),
      GoRoute(
        path: '/doctors',
        builder: (_, state) => DoctorListScreen(
          initialDepartmentId: state.uri.queryParameters['departmentId'],
          initialSearch: state.uri.queryParameters['search'],
        ),
      ),
      GoRoute(
        path: '/packages',
        builder: (_, state) => PackageListScreen(
          initialSearch: state.uri.queryParameters['search'],
        ),
      ),
      GoRoute(
        path: '/departments/:departmentId',
        builder: (_, state) => DepartmentDetailScreen(
          departmentId: state.pathParameters['departmentId']!,
        ),
      ),
      GoRoute(
        path: '/doctors/:doctorId',
        builder: (_, state) =>
            DoctorDetailScreen(doctorId: state.pathParameters['doctorId']!),
      ),
      GoRoute(
        path: '/packages/:slug',
        builder: (_, state) =>
            PackageDetailScreen(slug: state.pathParameters['slug']!),
      ),
      GoRoute(
        path: '/booking/patient',
        builder: (_, _) => const BookingPatientScreen(),
      ),
      GoRoute(
        path: '/booking/verify',
        builder: (_, _) => const BookingVerifyOtpScreen(),
      ),
      GoRoute(
        path: '/booking/success',
        builder: (_, _) => const BookingSuccessScreen(),
      ),
      GoRoute(
        path: '/appointments',
        builder: (_, _) => const AppRouteBackScope(
          fallbackLocation: '/home',
          child: AppointmentsScreen(),
        ),
      ),
      GoRoute(
        path: '/notification-appointments',
        builder: (_, _) => const AppRouteBackScope(
          fallbackLocation: '/notifications',
          child: AppointmentsScreen(),
        ),
      ),
      GoRoute(
        path: '/appointments/:appointmentId',
        builder: (_, state) => AppointmentDetailScreen(
          appointmentId: state.pathParameters['appointmentId']!,
          notificationType:
              state.uri.queryParameters['origin'] == 'notification'
              ? PatientNotificationType.fromApi(
                  state.uri.queryParameters['notificationType'],
                )
              : null,
          notificationPublishedAt:
              state.uri.queryParameters['origin'] == 'notification'
              ? DateTime.tryParse(
                  state.uri.queryParameters['notificationAt'] ?? '',
                )?.toLocal()
              : null,
        ),
      ),
      GoRoute(
        path: '/medical-records',
        builder: (_, _) => const MedicalRecordsScreen(),
        routes: [
          GoRoute(
            path: ':recordId',
            builder: (_, state) => MedicalRecordDetailScreen(
              recordId: state.pathParameters['recordId']!,
            ),
            routes: [
              GoRoute(
                path: 'file',
                builder: (_, state) => MedicalDocumentScreen(
                  recordId: state.pathParameters['recordId']!,
                ),
              ),
              GoRoute(
                path: 'lab-results/:labResultId/file',
                builder: (_, state) => MedicalDocumentScreen(
                  recordId: state.pathParameters['recordId']!,
                  labResultId: state.pathParameters['labResultId']!,
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/prescriptions',
        builder: (_, _) => const PrescriptionsScreen(),
        routes: [
          GoRoute(
            path: ':prescriptionId',
            builder: (_, state) => PrescriptionDetailScreen(
              prescriptionId: state.pathParameters['prescriptionId']!,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/invoices',
        builder: (_, _) => const InvoicesScreen(),
        routes: [
          GoRoute(
            path: ':invoiceId',
            builder: (_, state) => InvoiceDetailScreen(
              invoiceId: state.pathParameters['invoiceId']!,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/profile/edit',
        builder: (_, _) => const ProfileEditScreen(),
      ),
      GoRoute(
        path: '/mobile-tools',
        builder: (_, _) => const MobileToolsScreen(),
      ),
      GoRoute(
        path: '/dependents',
        builder: (_, _) => const DependentsScreen(),
        routes: [
          GoRoute(path: 'new', builder: (_, _) => const DependentFormScreen()),
          GoRoute(
            path: ':dependentId/edit',
            builder: (_, state) => DependentFormScreen(
              dependentId: state.pathParameters['dependentId']!,
            ),
          ),
        ],
      ),
    ],
  );
  ref.onDispose(() {
    router.dispose();
    mainNavigationHistory.dispose();
    refresh.dispose();
  });
  return router;
});
