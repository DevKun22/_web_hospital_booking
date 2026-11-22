import 'dart:async';

import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Chạy trước mọi tệp kiểm thử: tắt hiệu ứng nền lặp vô hạn để pumpAndSettle kết thúc được.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  AppMotion.ambientEnabled = false;
  await testMain();
}
