import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/global_error_handler.dart';

void main() {
  late FlutterExceptionHandler? originalFlutterHandler;
  late ErrorCallback? originalDispatcherHandler;

  setUp(() {
    originalFlutterHandler = FlutterError.onError;
    originalDispatcherHandler = PlatformDispatcher.instance.onError;
  });

  tearDown(() {
    FlutterError.onError = originalFlutterHandler;
    PlatformDispatcher.instance.onError = originalDispatcherHandler;
  });

  test('uncaught async errors are logged by type only and swallowed', () {
    final lines = <String>[];
    installGlobalErrorHandlers(log: lines.add);

    final handled = PlatformDispatcher.instance.onError!(
      const FormatException('so-dien-thoai-0912345678'),
      StackTrace.empty,
    );

    expect(handled, isTrue);
    expect(lines, ['[UNCAUGHT_ERROR] FormatException']);
    expect(lines.join(), isNot(contains('0912345678')));
  });

  test(
    'framework errors are logged without the message and still forwarded',
    () {
      final lines = <String>[];
      var forwarded = 0;
      FlutterError.onError = (_) => forwarded++;
      installGlobalErrorHandlers(log: lines.add);

      FlutterError.onError!(
        FlutterErrorDetails(
          exception: StateError('noi-dung-nhay-cam'),
          library: 'widgets library',
        ),
      );

      expect(lines, ['[FLUTTER_ERROR] StateError in widgets library']);
      expect(lines.join(), isNot(contains('nhay-cam')));
      expect(forwarded, 1);
    },
  );
}
