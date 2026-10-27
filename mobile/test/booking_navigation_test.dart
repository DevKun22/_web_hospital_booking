import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';

void main() {
  test('booking intent preserves its preset and a safe in-app return path', () {
    final location = bookingLocationWithReturnTo(
      bookingLocation: '/booking?packageId=package-1&departmentId=department-1',
      returnTo: '/packages?search=tong%20quat',
    );
    final uri = Uri.parse(location);

    expect(uri.path, '/booking');
    expect(uri.queryParameters['packageId'], 'package-1');
    expect(uri.queryParameters['departmentId'], 'department-1');
    expect(uri.queryParameters['returnTo'], '/packages?search=tong%20quat');
  });
}
