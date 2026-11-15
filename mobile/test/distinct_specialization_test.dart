import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_chrome.dart';

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

  testWidgets('guests see a login button on the home header, members do not', (
    tester,
  ) async {
    var taps = 0;
    Widget header({required bool authenticated}) => MaterialApp(
      home: Scaffold(
        body: HomeHeader(
          hospitalName: 'DevKunCare',
          userName: authenticated ? 'Gu' : null,
          avatar: null,
          isAuthenticated: authenticated,
          unreadNotificationCount: 0,
          onNotifications: () {},
          onLogin: () => taps += 1,
        ),
      ),
    );

    await tester.pumpWidget(header(authenticated: false));
    await tester.tap(find.byKey(const Key('home-login-button')));
    expect(taps, 1);

    await tester.pumpWidget(header(authenticated: true));
    expect(find.byKey(const Key('home-login-button')), findsNothing);
  });
}
