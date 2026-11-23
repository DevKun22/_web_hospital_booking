import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/widgets/app_filter_tabs.dart';

class _Host extends StatefulWidget {
  const _Host();

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  static const items = ['a', 'b', 'c'];
  String selected = 'a';

  @override
  Widget build(BuildContext context) => MaterialApp(
    home: Scaffold(
      body: AppSwipeTabs<String>(
        items: items,
        selected: selected,
        onChanged: (value) => setState(() => selected = value),
        child: Column(
          children: [
            AppFilterTabs<String>(
              items: items,
              selected: selected,
              labelOf: (item) => 'Tab $item',
              onChanged: (value) => setState(() => selected = value),
            ),
            Expanded(child: Center(child: Text('Nội dung $selected'))),
          ],
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('chạm tab và vuốt ngang đều đổi tab, không vượt quá hai đầu', (
    tester,
  ) async {
    await tester.pumpWidget(const _Host());
    expect(find.text('Nội dung a'), findsOneWidget);

    // Vuốt phải ở tab đầu: không có tab trước nên giữ nguyên.
    await tester.fling(find.text('Nội dung a'), const Offset(400, 0), 1500);
    await tester.pumpAndSettle();
    expect(find.text('Nội dung a'), findsOneWidget);

    await tester.fling(find.text('Nội dung a'), const Offset(-400, 0), 1500);
    await tester.pumpAndSettle();
    expect(find.text('Nội dung b'), findsOneWidget);

    await tester.tap(find.text('Tab c'));
    await tester.pumpAndSettle();
    expect(find.text('Nội dung c'), findsOneWidget);

    // Vuốt trái ở tab cuối: giữ nguyên.
    await tester.fling(find.text('Nội dung c'), const Offset(-400, 0), 1500);
    await tester.pumpAndSettle();
    expect(find.text('Nội dung c'), findsOneWidget);

    await tester.fling(find.text('Nội dung c'), const Offset(400, 0), 1500);
    await tester.pumpAndSettle();
    expect(find.text('Nội dung b'), findsOneWidget);
  });
}
