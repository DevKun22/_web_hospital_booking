import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';
import 'package:hospital_booking_mobile/features/support/application/support_action_launcher.dart';
import 'package:hospital_booking_mobile/features/support/presentation/support_center_screen.dart';

class _LoadedHomeContentController extends HomeContentController {
  @override
  HomeContentState build() => HomeContentState(
    content: HomeContent(
      banners: const [],
      departments: const [],
      doctors: const [],
      packages: const [],
      faqs: const [
        HomeFaq(
          id: 'faq-1',
          question: 'Cần mang gì khi đi khám?',
          answer: 'Mang theo giấy tờ tùy thân và thẻ BHYT nếu có.',
        ),
      ],
      siteSettings: const HomeSiteSettings(
        hospitalName: 'Bệnh viện kiểm thử',
        hotline: '1900 1234',
        emergencyHotline: '1900 1080',
      ),
      fetchedAt: DateTime(2030),
    ),
  );
}

class _FakeSupportActionLauncher implements SupportActionLauncher {
  _FakeSupportActionLauncher({this.shouldOpen = true});

  final bool shouldOpen;
  final List<String> calls = [];

  @override
  Future<bool> openPhoneDialer(String phoneNumber) async {
    calls.add(phoneNumber);
    return shouldOpen;
  }
}

void main() {
  testWidgets('shows synchronized support content and FAQ', (tester) async {
    final launcher = _FakeSupportActionLauncher();
    await _pumpScreen(tester, launcher);

    expect(find.text('Trung tâm hỗ trợ'), findsOneWidget);
    expect(find.text('1900 1080'), findsOneWidget);
    expect(find.text('1900 1234'), findsOneWidget);
    expect(find.text('Cần mang gì khi đi khám?'), findsOneWidget);

    await tester.tap(find.text('Cần mang gì khi đi khám?'));
    await tester.pumpAndSettle();
    expect(
      find.text('Mang theo giấy tờ tùy thân và thẻ BHYT nếu có.'),
      findsOneWidget,
    );
  });

  testWidgets('requires confirmation before opening the phone dialer', (
    tester,
  ) async {
    final launcher = _FakeSupportActionLauncher();
    await _pumpScreen(tester, launcher);

    await tester.tap(find.byKey(const Key('support-emergency-call-button')));
    await tester.pumpAndSettle();
    expect(find.text('Gọi cấp cứu?'), findsOneWidget);
    expect(launcher.calls, isEmpty);

    await tester.tap(find.byKey(const Key('support-confirm-call-button')));
    await tester.pumpAndSettle();
    expect(launcher.calls, ['1900 1080']);
  });

  testWidgets('explains when the device cannot open the dialer', (
    tester,
  ) async {
    final launcher = _FakeSupportActionLauncher(shouldOpen: false);
    await _pumpScreen(tester, launcher);

    await tester.tap(find.byKey(const Key('support-hotline-option')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('support-confirm-call-button')));
    await tester.pumpAndSettle();

    expect(launcher.calls, ['1900 1234']);
    expect(
      find.text(
        'Không thể mở trình gọi trên thiết bị này. Vui lòng nhập số thủ công.',
      ),
      findsOneWidget,
    );
  });
}

Future<void> _pumpScreen(
  WidgetTester tester,
  SupportActionLauncher launcher,
) async {
  tester.view.physicalSize = const Size(430, 1000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeContentControllerProvider.overrideWith(
          _LoadedHomeContentController.new,
        ),
        supportActionLauncherProvider.overrideWithValue(launcher),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: const SupportCenterScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}
