import 'dart:ui' show SemanticsAction;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';

void main() {
  test('theme exposes the shared typography, surfaces and touch targets', () {
    final theme = AppTheme.light;
    final buttonSize = theme.filledButtonTheme.style?.minimumSize?.resolve({});
    final cardShape = theme.cardTheme.shape as RoundedRectangleBorder;

    expect(theme.scaffoldBackgroundColor, AppPalette.canvas);
    expect(theme.textTheme.titleLarge?.fontWeight, FontWeight.w800);
    expect(buttonSize?.height, AppSize.controlHeight);
    expect(buttonSize?.width, AppSize.minimumTouchTarget);
    expect(cardShape.borderRadius, BorderRadius.circular(AppRadius.card));
    expect(cardShape.side.color, AppPalette.divider);
  });

  testWidgets('motion tokens honor the operating system reduced-motion flag', (
    tester,
  ) async {
    late Duration duration;
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Builder(
            builder: (context) {
              duration = AppMotion.responsive(context, AppMotion.standard);
              return const SizedBox();
            },
          ),
        ),
      ),
    );

    expect(duration, Duration.zero);
  });

  testWidgets('surface card keeps content and an accessible tap target', (
    tester,
  ) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: AppSurfaceCard(
            semanticLabel: 'Mở lịch hẹn',
            onTap: () => tapped = true,
            child: const Text('Lịch hẹn'),
          ),
        ),
      ),
    );

    expect(find.bySemanticsLabel('Mở lịch hẹn'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('Mở lịch hẹn'));
    expect(tapped, isTrue);
  });

  testWidgets('surface card keeps its semantic tap action', (tester) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: AppSurfaceCard(
            semanticLabel: 'Mở hồ sơ sức khỏe',
            onTap: () => tapped = true,
            child: const Text('Hồ sơ'),
          ),
        ),
      ),
    );

    final semantics = tester.getSemantics(
      find.bySemanticsLabel('Mở hồ sơ sức khỏe'),
    );
    expect(semantics.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);

    await tester.tap(find.bySemanticsLabel('Mở hồ sơ sức khỏe'));
    expect(tapped, isTrue);
  });
}
