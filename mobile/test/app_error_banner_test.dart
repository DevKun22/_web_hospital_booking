import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';

void main() {
  testWidgets('error banner displays the support request id', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AppErrorBanner(
            error: ApiException(
              kind: ApiErrorKind.server,
              message: 'Hệ thống đang bận',
              requestId: 'request-123',
            ),
          ),
        ),
      ),
    );

    expect(find.text('Hệ thống đang bận'), findsOneWidget);
    expect(find.text('Mã hỗ trợ: request-123'), findsOneWidget);
  });
}
