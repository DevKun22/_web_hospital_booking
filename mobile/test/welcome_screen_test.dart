import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/core/storage/app_preferences.dart';
import 'package:hospital_booking_mobile/features/onboarding/presentation/welcome_screen.dart';

void main() {
  testWidgets('welcome offers guest booking, login and service discovery', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appPreferencesProvider.overrideWithValue(MemoryAppPreferences()),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const WelcomeScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Đặt lịch ngay'), findsOneWidget);
    expect(find.text('Tôi đã có tài khoản'), findsOneWidget);
    expect(find.text('Khám phá dịch vụ trước'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
