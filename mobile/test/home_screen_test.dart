import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';
import 'package:hospital_booking_mobile/features/home/presentation/home_screen.dart';

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
      ],
      departments: const [HomeDepartment(id: 'department-1', name: 'Tim mạch')],
      doctors: const [
        HomeDoctor(
          id: 'doctor-1',
          fullName: 'Nguyễn Văn An',
          departmentName: 'Tim mạch',
          consultationFee: 250000,
          title: 'BS. CKI',
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

    expect(find.text('Chăm sóc sức khỏe dễ dàng hơn'), findsOneWidget);
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
    expect(find.text('Khám tổng quát'), findsOneWidget);
    expect(find.text('Trợ lý đặt lịch 24/7'), findsOneWidget);
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

    expect(find.text('Khôi phục phiên'), findsWidgets);
    expect(find.textContaining('nội dung công khai đã lưu'), findsOneWidget);
    expect(find.text('Cần kết nối mạng'), findsNWidgets(3));
    expect(find.text('Đã có tài khoản bệnh nhân?'), findsNothing);

    await tester.tap(find.text('Lịch khám của tôi'));
    await tester.pump();
    expect(
      find.text('Cần kết nối mạng và khôi phục phiên để mở thông tin cá nhân.'),
      findsOneWidget,
    );
  });
}
