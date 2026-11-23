import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';
import 'package:hospital_booking_mobile/core/widgets/app_form.dart';
import 'package:hospital_booking_mobile/core/widgets/birth_date_picker.dart';

void main() {
  Widget viApp(Widget home) => MaterialApp(
    locale: const Locale('vi'),
    supportedLocales: const [Locale('vi')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: home,
  );

  testWidgets('lịch chuẩn: mở ở khoảng 30 năm trước và trả ngày khi bấm Xong', (
    tester,
  ) async {
    final today = vietnamToday();
    DateTime? result;
    await tester.pumpWidget(
      viApp(
        Builder(
          builder: (context) => TextButton(
            onPressed: () async => result = await showBirthDatePicker(context),
            child: const Text('mở'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('mở'));
    await tester.pumpAndSettle();
    expect(find.text('Chọn ngày sinh'), findsOneWidget);

    await tester.tap(find.text('Xong'));
    await tester.pumpAndSettle();
    expect(result, DateTime(today.year - 30, today.month, today.day));
  });

  testWidgets('ngày mở sẵn không bao giờ rơi vào hôm nay hoặc tương lai', (
    tester,
  ) async {
    final today = vietnamToday();
    DateTime? result;
    await tester.pumpWidget(
      viApp(
        Builder(
          builder: (context) => TextButton(
            onPressed: () async => result = await showBirthDatePicker(
              context,
              initial: DateTime(today.year + 1, 1, 1),
            ),
            child: const Text('mở'),
          ),
        ),
      ),
    );
    await tester.tap(find.text('mở'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xong'));
    await tester.pumpAndSettle();

    final yesterday = DateTime(
      today.year,
      today.month,
      today.day,
    ).subtract(const Duration(days: 1));
    expect(result, yesterday);
  });

  testWidgets(
    'chọn giới tính: chạm đổi giá trị, chạm lại mục đang chọn thì bỏ chọn',
    (tester) async {
      String? selected;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) => AppSegmentedChoice<String>(
                label: 'Giới tính',
                items: const ['MALE', 'FEMALE', 'OTHER'],
                selected: selected,
                labelOf: (value) => switch (value) {
                  'MALE' => 'Nam',
                  'FEMALE' => 'Nữ',
                  _ => 'Khác',
                },
                onChanged: (value) => setState(() => selected = value),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Nữ'));
      await tester.pump();
      expect(selected, 'FEMALE');
      await tester.tap(find.text('Nam'));
      await tester.pump();
      expect(selected, 'MALE');
      await tester.tap(find.text('Nam'));
      await tester.pump();
      expect(selected, isNull);
    },
  );

  testWidgets('bộ đếm ký tự chỉ hiện khi sắp chạm giới hạn', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TextField(
            controller: controller,
            maxLength: 20,
            buildCounter: nearLimitCounter,
          ),
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), 'abc');
    await tester.pump();
    expect(find.text('3/20'), findsNothing);

    await tester.enterText(find.byType(TextField), 'abcdefghijklmnopqr');
    await tester.pump();
    expect(find.text('18/20'), findsOneWidget);
  });
}
