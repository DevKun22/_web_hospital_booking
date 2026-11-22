import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_band.dart';

void main() {
  test('specialization that only repeats the department is hidden', () {
    expect(distinctSpecialization('tổng quát', 'Khoa tổng quát'), isNull);
    expect(distinctSpecialization('Da liễu', 'Da liễu'), isNull);
    expect(distinctSpecialization('  nhi ', 'Khoa nhi'), isNull);
    expect(
      distinctSpecialization('Tim mạch can thiệp', 'Khoa tim mạch'),
      'Tim mạch can thiệp',
    );
    expect(distinctSpecialization(null, 'Khoa nhi'), isNull);
    expect(distinctSpecialization('', 'Khoa nhi'), isNull);
    expect(distinctSpecialization('nhi', null), 'nhi');
  });

  testWidgets('home band shows the bell only for members', (tester) async {
    final taps = <String>[];
    Widget band({required bool member}) => MaterialApp(
      home: Scaffold(
        body: HomeBand(
          showBell: member,
          unreadNotificationCount: 3,
          onSearch: () => taps.add('search'),
          onAsk: () => taps.add('ask'),
          onNotifications: () => taps.add('bell'),
        ),
      ),
    );

    await tester.pumpWidget(band(member: false));
    expect(find.byIcon(Icons.notifications_none_rounded), findsNothing);
    expect(find.byIcon(Icons.login_rounded), findsNothing);
    await tester.tap(find.byKey(const Key('home-search-button')));
    await tester.tap(find.byKey(const Key('home-ask-kun-button')));

    await tester.pumpWidget(band(member: true));
    await tester.tap(find.byTooltip('3 thông báo chưa đọc'));
    expect(taps, ['search', 'ask', 'bell']);
  });
}
