import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';

void main() {
  test('light theme keeps system bars readable on the app canvas', () {
    final overlay = AppTheme.light.appBarTheme.systemOverlayStyle;

    expect(overlay, isNotNull);
    expect(overlay!.statusBarColor, Colors.transparent);
    expect(overlay.statusBarIconBrightness, Brightness.dark);
    expect(overlay.systemNavigationBarColor, AppColors.light.canvas);
    expect(overlay.systemNavigationBarIconBrightness, Brightness.dark);
  });

  test('dark theme uses light system icons on the dark canvas', () {
    final overlay = AppTheme.dark.appBarTheme.systemOverlayStyle;

    expect(overlay, isNotNull);
    expect(overlay!.statusBarIconBrightness, Brightness.light);
    expect(overlay.systemNavigationBarColor, AppColors.dark.canvas);
    expect(overlay.systemNavigationBarIconBrightness, Brightness.light);
  });
}
