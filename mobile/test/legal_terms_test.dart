import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/legal/legal.dart';

Widget _host({
  required LegalDocuments legal,
  required ValueNotifier<bool> value,
}) {
  return ProviderScope(
    overrides: [legalDocumentsProvider.overrideWith((ref) async => legal)],
    child: MaterialApp(
      home: Scaffold(
        body: ValueListenableBuilder<bool>(
          valueListenable: value,
          builder: (context, checked, _) => TermsConsentTile(
            value: checked,
            onChanged: (next) => value.value = next,
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('không hiện ô đồng ý khi cơ sở khám chưa soạn điều khoản', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(legal: LegalDocuments.empty, value: ValueNotifier(false)),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('terms-consent-checkbox')), findsNothing);
  });

  testWidgets('hiện ô đồng ý, tích được và mở được nội dung điều khoản', (
    tester,
  ) async {
    final value = ValueNotifier(false);
    await tester.pumpWidget(
      _host(
        legal: const LegalDocuments(
          terms: LegalDocument(
            title: 'Điều khoản sử dụng',
            body: 'Nội dung điều khoản thử.',
            version: 'v1',
          ),
        ),
        value: value,
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('terms-consent-checkbox')),
      findsOneWidget,
    );
    expect(find.text('Tôi đồng ý Điều khoản sử dụng.'), findsOneWidget);
    // Chưa có chính sách bảo mật thì không có nút xem chính sách.
    expect(find.text('Xem chính sách bảo mật'), findsNothing);

    await tester.tap(find.byKey(const ValueKey('terms-consent-checkbox')));
    await tester.pump();
    expect(value.value, isTrue);

    await tester.tap(find.text('Xem điều khoản'));
    await tester.pumpAndSettle();
    expect(find.text('Nội dung điều khoản thử.'), findsOneWidget);
  });

  test('chỉ coi là điều khoản khi có nội dung và phiên bản', () {
    expect(LegalDocument.tryParse(null), isNull);
    expect(
      LegalDocument.tryParse({'title': 'x', 'body': '   ', 'version': 'v'}),
      isNull,
    );
    expect(
      LegalDocument.tryParse({'title': 'x', 'body': 'nội dung', 'version': ''}),
      isNull,
    );
    expect(
      LegalDocument.tryParse({
        'title': 'x',
        'body': 'nội dung',
        'version': 'v1',
      })?.version,
      'v1',
    );
  });
}
