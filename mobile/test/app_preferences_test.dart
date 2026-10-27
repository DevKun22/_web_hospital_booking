import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/storage/app_preferences.dart';

void main() {
  test('app lock preference stays device-local and defaults to disabled', () async {
    final preferences = MemoryAppPreferences();

    expect(await preferences.isAppLockEnabled(), isFalse);
    await preferences.setAppLockEnabled(true);
    expect(await preferences.isAppLockEnabled(), isTrue);
    await preferences.setAppLockEnabled(false);
    expect(await preferences.isAppLockEnabled(), isFalse);
  });
}
