import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/services/presentation/services_hub_screen.dart';

Future<GoRouter> _pump(WidgetTester tester) async {
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => const ServicesHubScreen()),
      GoRoute(
        path: '/doctors',
        builder: (_, _) => const Text('Danh sách bác sĩ'),
      ),
    ],
  );
  await tester.pumpWidget(
    MaterialApp.router(theme: AppTheme.light, routerConfig: router),
  );
  await tester.pumpAndSettle();
  return router;
}

void main() {
  testWidgets('groups appear as tabs and each tab lists its services', (
    tester,
  ) async {
    await _pump(tester);
    expect(find.text('Đặt lịch ngay'), findsOneWidget);
    expect(find.text('Hóa đơn'), findsNothing);

    await tester.tap(find.text('Hồ sơ của tôi'));
    await tester.pumpAndSettle();
    expect(find.text('Hóa đơn'), findsOneWidget);
    expect(find.text('Đặt lịch ngay'), findsNothing);
  });

  testWidgets('search filters services across every group', (tester) async {
    await _pump(tester);
    await tester.enterText(find.byKey(const Key('services-search')), 'hóa');
    await tester.pumpAndSettle();
    expect(find.text('Hóa đơn'), findsOneWidget);
    expect(find.text('Bác sĩ'), findsNothing);

    await tester.enterText(find.byKey(const Key('services-search')), 'zzz');
    await tester.pumpAndSettle();
    expect(find.text('Không có dịch vụ phù hợp'), findsOneWidget);
  });

  testWidgets('tapping a service opens its screen', (tester) async {
    await _pump(tester);
    await tester.tap(find.text('Bác sĩ'));
    await tester.pumpAndSettle();
    expect(find.text('Danh sách bác sĩ'), findsOneWidget);
  });
}
