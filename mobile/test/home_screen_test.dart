import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointments_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/auth/domain/patient_user.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/home/application/home_search_history_provider.dart';
import 'package:hospital_booking_mobile/features/home/data/home_search_history_store.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_search_history_entry.dart';
import 'package:hospital_booking_mobile/features/home/presentation/home_screen.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';

class _OtpErrorAuthController extends AuthController {
  @override
  AuthState build() => const AuthState.unauthenticated(
    error: ApiException(
      kind: ApiErrorKind.rateLimited,
      message: 'Vui lòng đợi trước khi gửi lại OTP.',
    ),
    errorOrigin: AuthErrorOrigin.requestOtp,
  );
}

class _OfflineBrowsingAuthController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.offlineBrowsing,
    error: ApiException(
      kind: ApiErrorKind.network,
      message: 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.',
    ),
    errorOrigin: AuthErrorOrigin.sessionRestore,
  );
}

class _AuthenticatedHomeController extends AuthController {
  @override
  AuthState build() => const AuthState(
    status: AuthStatus.authenticated,
    user: PatientUser(
      id: 'patient-1',
      fullName: 'Nguyễn Văn An',
      isPhoneVerified: true,
    ),
  );
}

class _BadgeNotificationsController extends NotificationsController {
  @override
  NotificationsState build() => const NotificationsState(unreadCount: 3);
}

class _IdleAppointmentsController extends AppointmentsController {
  @override
  AppointmentsState build() => const AppointmentsState();
}

class _UpcomingAppointmentsController extends AppointmentsController {
  @override
  AppointmentsState build() => const AppointmentsState(
    items: [
      PatientAppointment(
        id: 'appointment-1',
        bookingCode: 'HB-1001',
        appointmentDate: '2030-01-02',
        startTime: '09:00',
        endTime: '09:30',
        status: PatientAppointmentStatus.confirmed,
        doctorName: 'BS. CKI Nguyễn Văn An',
        departmentName: 'Tim mạch',
        finalAmount: 250000,
      ),
    ],
  );
}

class _IdleHomeContentController extends HomeContentController {
  @override
  HomeContentState build() => const HomeContentState();
}

class _LoadedHomeContentController extends HomeContentController {
  @override
  HomeContentState build() => HomeContentState(
    content: HomeContent(
      banners: const [
        HomeBanner(id: 'banner-1', title: 'Chăm sóc từ trái tim'),
        HomeBanner(id: 'banner-2', title: 'Khám đúng lúc, an tâm hơn'),
      ],
      departments: const [HomeDepartment(id: 'department-1', name: 'Tim mạch')],
      doctors: const [
        HomeDoctor(
          id: 'doctor-1',
          fullName: 'Nguyễn Văn An',
          departmentName: 'Tim mạch',
          consultationFee: 250000,
          title: 'BS. CKI',
          averageRating: 4.9,
          reviewCount: 120,
          todayAvailableSlots: [
            HomeDoctorSlot(startTime: '14:30', endTime: '15:00'),
            HomeDoctorSlot(startTime: '15:00', endTime: '15:30'),
          ],
        ),
      ],
      packages: const [
        HomeMedicalPackage(
          id: 'package-1',
          name: 'Khám tổng quát',
          finalPrice: 1850000,
          isPopular: true,
          isBhytSupport: false,
        ),
      ],
      faqs: const [
        HomeFaq(
          id: 'faq-1',
          question: 'Cần chuẩn bị gì khi đi khám?',
          answer: 'Mang theo giấy tờ tùy thân.',
        ),
      ],
      siteSettings: const HomeSiteSettings(hospitalName: 'Bệnh viện kiểm thử'),
      fetchedAt: DateTime(2030),
    ),
  );
}

void main() {
  testWidgets('home never renders an OTP request error', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_OtpErrorAuthController.new),
          homeContentControllerProvider.overrideWith(
            _IdleHomeContentController.new,
          ),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    expect(find.text('MEDCARE BOOKING'), findsOneWidget);
    expect(find.text('Vui lòng đợi trước khi gửi lại OTP.'), findsNothing);
  });

  testWidgets('home renders synchronized public content', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_OtpErrorAuthController.new),
          homeContentControllerProvider.overrideWith(
            _LoadedHomeContentController.new,
          ),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    expect(find.text('Bệnh viện kiểm thử'), findsOneWidget);
    expect(find.text('Chăm sóc từ trái tim'), findsOneWidget);
    expect(find.text('Tim mạch'), findsWidgets);
    expect(find.text('BS. CKI Nguyễn Văn An'), findsOneWidget);
    expect(find.text('4.9 (120)'), findsOneWidget);
    expect(find.text('14:30'), findsOneWidget);
    expect(find.text('15:00'), findsOneWidget);
    expect(find.text('Khám tổng quát'), findsOneWidget);
    expect(find.text('Dịch vụ chăm sóc'), findsOneWidget);
    expect(find.text('Trợ lý đặt lịch 24/7'), findsNothing);
    expect(find.text('Tất cả'), findsOneWidget);

    await tester.tap(find.text('Tất cả'));
    await tester.pumpAndSettle();
    expect(find.text('Tất cả dịch vụ'), findsOneWidget);
    expect(find.text('Danh sách chuyên khoa'), findsOneWidget);
    expect(find.text('Trợ lý đặt lịch 24/7'), findsOneWidget);
  });

  testWidgets('authenticated home shows the unread notification badge', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedHomeController.new),
          homeContentControllerProvider.overrideWith(
            _LoadedHomeContentController.new,
          ),
          notificationsControllerProvider.overrideWith(
            _BadgeNotificationsController.new,
          ),
          appointmentsControllerProvider.overrideWith(
            _IdleAppointmentsController.new,
          ),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    expect(find.byTooltip('3 thông báo chưa đọc'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
  });

  testWidgets('authenticated home prioritizes appointment actions and QR', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedHomeController.new),
          homeContentControllerProvider.overrideWith(
            _LoadedHomeContentController.new,
          ),
          notificationsControllerProvider.overrideWith(
            _BadgeNotificationsController.new,
          ),
          appointmentsControllerProvider.overrideWith(
            _UpcomingAppointmentsController.new,
          ),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    expect(find.text('Lịch khám sắp tới'), findsOneWidget);
    expect(find.byKey(const Key('home-appointment-qr')), findsOneWidget);
    expect(find.text('Trợ lý đặt lịch 24/7'), findsNothing);

    await tester.tap(find.byKey(const Key('home-appointment-qr')));
    await tester.pumpAndSettle();
    expect(find.text('Vé khám QR'), findsWidgets);
    expect(find.text('HB-1001'), findsWidgets);
  });

  testWidgets('home search filters synchronized content', (tester) async {
    tester.view.physicalSize = const Size(800, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_OtpErrorAuthController.new),
          homeContentControllerProvider.overrideWith(
            _LoadedHomeContentController.new,
          ),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    await tester.tap(find.byKey(const Key('home-search-button')));
    await tester.pumpAndSettle();
    expect(find.text('Tìm dịch vụ chăm sóc'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('home-search-field')),
      'Nguyễn Văn An',
    );
    await tester.pump();
    expect(
      find.byKey(const ValueKey('home-search-result-/doctors/doctor-1')),
      findsOneWidget,
    );
    expect(
      find.byKey(
        const ValueKey('home-search-result-/departments/department-1'),
      ),
      findsNothing,
    );
  });

  testWidgets('home search shows and clears device-only recent items', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final history = MemoryHomeSearchHistoryStore(const [
      HomeSearchHistoryEntry(
        title: 'Nhi khoa gần đây',
        subtitle: 'Chuyên khoa',
        location: '/departments/old-department',
        kind: HomeSearchHistoryKind.department,
      ),
    ]);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_OtpErrorAuthController.new),
          homeContentControllerProvider.overrideWith(
            _LoadedHomeContentController.new,
          ),
          homeSearchHistoryStoreProvider.overrideWithValue(history),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    await tester.tap(find.byKey(const Key('home-search-button')));
    await tester.pumpAndSettle();
    expect(find.text('Tìm gần đây'), findsOneWidget);
    expect(find.text('Nhi khoa gần đây'), findsOneWidget);
    expect(find.text('Gợi ý dịch vụ'), findsOneWidget);

    await tester.tap(find.byKey(const Key('home-search-clear-recent')));
    await tester.pumpAndSettle();
    expect(find.text('Nhi khoa gần đây'), findsNothing);
    expect(await history.read(), isEmpty);
  });

  testWidgets('hero banners auto play and update their indicator', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_OtpErrorAuthController.new),
          homeContentControllerProvider.overrideWith(
            _LoadedHomeContentController.new,
          ),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    double indicatorWidth(int index) => tester
        .getSize(find.byKey(ValueKey('home-hero-indicator-$index')))
        .width;

    expect(indicatorWidth(0), 24);
    expect(indicatorWidth(1), 8);

    await tester.pump(const Duration(seconds: 6));
    await tester.pump(const Duration(milliseconds: 500));
    expect(indicatorWidth(0), 8);
    expect(indicatorWidth(1), 24);

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('offline home explains restricted access and offers retry', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            _OfflineBrowsingAuthController.new,
          ),
          homeContentControllerProvider.overrideWith(
            _LoadedHomeContentController.new,
          ),
        ],
        child: const MaterialApp(home: HomeScreen()),
      ),
    );

    expect(
      find.byKey(const Key('home-offline-content-notice')),
      findsOneWidget,
    );
    expect(find.text('Kết nối lại'), findsOneWidget);
    expect(find.textContaining('nội dung công khai đã lưu'), findsOneWidget);
    expect(find.text('Cần mạng'), findsWidgets);
    expect(find.text('Đã có tài khoản bệnh nhân?'), findsNothing);

    await tester.tap(find.text('Tra cứu lịch hẹn'));
    await tester.pump();
    expect(
      find.text('Cần kết nối mạng và khôi phục phiên để mở thông tin cá nhân.'),
      findsOneWidget,
    );
  });
}
