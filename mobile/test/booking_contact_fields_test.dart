import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_patient_sections.dart';

Widget _fields({
  required bool skipsOtp,
  String? accountPhone,
  bool isRelative = false,
}) => MaterialApp(
  theme: AppTheme.light,
  home: Scaffold(
    body: SingleChildScrollView(
      child: BookingPatientContactFields(
        name: TextEditingController(text: 'Son'),
        phone: TextEditingController(text: accountPhone ?? ''),
        email: TextEditingController(text: 'son@example.com'),
        isRelative: isRelative,
        isSubmitting: false,
        skipsOtp: skipsOtp,
        accountPhone: accountPhone,
      ),
    ),
  ),
);

bool _readOnly(WidgetTester tester, String label) {
  final field = tester.widget<TextField>(
    find.descendant(
      of: find.widgetWithText(TextFormField, label),
      matching: find.byType(TextField),
    ),
  );
  return field.readOnly;
}

void main() {
  testWidgets(
    'đăng nhập có số: email và số điện thoại khóa, có lối sang Hồ sơ',
    (tester) async {
      await tester.pumpWidget(
        _fields(skipsOtp: true, accountPhone: '0325123346'),
      );
      expect(_readOnly(tester, 'Email đăng nhập *'), isTrue);
      expect(_readOnly(tester, 'Số điện thoại *'), isTrue);
      expect(find.byTooltip('Đổi số trong Hồ sơ'), findsOneWidget);
      expect(find.textContaining('không đổi ở đây'), findsOneWidget);
    },
  );

  testWidgets('đăng nhập chưa có số: số điện thoại vẫn nhập được', (
    tester,
  ) async {
    await tester.pumpWidget(_fields(skipsOtp: true));
    expect(_readOnly(tester, 'Email đăng nhập *'), isTrue);
    expect(_readOnly(tester, 'Số điện thoại *'), isFalse);
    expect(find.byTooltip('Đổi số trong Hồ sơ'), findsNothing);
  });

  testWidgets('khách chưa đăng nhập: các ô đều nhập được', (tester) async {
    await tester.pumpWidget(_fields(skipsOtp: false));
    expect(_readOnly(tester, 'Email *'), isFalse);
    expect(_readOnly(tester, 'Số điện thoại *'), isFalse);
  });
}
