import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';

void main() {
  test('light theme keeps system bars readable on the app canvas', () {
    final overlay = AppTheme.light.appBarTheme.systemOverlayStyle;

    expect(overlay, isNotNull);
    expect(overlay!.statusBarColor, Colors.transparent);
    expect(overlay.statusBarIconBrightness, Brightness.dark);
    expect(overlay.systemNavigationBarColor, AppTheme.quietCanvas);
    expect(overlay.systemNavigationBarIconBrightness, Brightness.dark);
  });
}
