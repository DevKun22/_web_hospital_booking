import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';

void main() {
  testWidgets(
    'a long status badge wraps inside a narrow card instead of overflowing',
    (tester) async {
      const longLabel =
          'Cơ sở khám hết thuốc này, vui lòng mua tại nhà thuốc bên ngoài theo đơn';
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            body: Center(
              child: SizedBox(
                width: 260,
                child: AppStatusBadge(
                  label: longLabel,
                  tone: AppStatusTone.warning,
                ),
              ),
            ),
          ),
        ),
      );

      // Trước khi sửa, Row không co lại nên Flutter ném lỗi tràn (RenderFlex overflowed).
      expect(tester.takeException(), isNull);
      final badge = tester.getSize(find.byType(AppStatusBadge));
      expect(badge.width, lessThanOrEqualTo(260));
      expect(
        badge.height,
        greaterThan(30),
        reason: 'chữ phải xuống nhiều dòng',
      );
    },
  );

  testWidgets('a short status badge keeps a single line', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(
          body: Align(
            alignment: Alignment.topLeft,
            child: AppStatusBadge(label: 'Đã cấp', tone: AppStatusTone.success),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(AppStatusBadge)).height, lessThan(40));
  });
}
