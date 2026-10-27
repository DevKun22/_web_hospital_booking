import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/widgets/app_brand_mark.dart';

void main() {
  testWidgets('brand mark keeps its requested size and accessible label', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: Center(child: AppBrandMark(size: 64))),
      ),
    );

    expect(find.bySemanticsLabel('Medcare Booking'), findsOneWidget);
    expect(tester.getSize(find.byType(AppBrandMark)), const Size.square(64));
  });

  testWidgets('foreground glyph can match a native launch canvas', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: Center(child: AppBrandGlyph(size: 108))),
      ),
    );

    expect(tester.getSize(find.byType(AppBrandGlyph)), const Size.square(108));
  });
}
