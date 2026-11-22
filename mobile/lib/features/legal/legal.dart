import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';

/// Điều khoản sử dụng và chính sách bảo mật do cơ sở khám soạn. Chưa soạn (null) thì ứng dụng không hiện ô đồng ý
/// và máy chủ không đòi đồng ý trước khi gửi OTP.
class LegalDocument {
  const LegalDocument({
    required this.title,
    required this.body,
    required this.version,
  });

  final String title;
  final String body;
  final String version;

  static LegalDocument? tryParse(Object? json) {
    if (json is! Map) return null;
    final title = json['title']?.toString() ?? '';
    final body = json['body']?.toString() ?? '';
    final version = json['version']?.toString() ?? '';
    if (body.trim().isEmpty || version.isEmpty) return null;
    return LegalDocument(title: title, body: body, version: version);
  }
}

class LegalDocuments {
  const LegalDocuments({this.terms, this.privacy});

  final LegalDocument? terms;
  final LegalDocument? privacy;

  static const empty = LegalDocuments();
}

final legalDocumentsProvider = FutureProvider.autoDispose<LegalDocuments>((
  ref,
) async {
  final Dio dio = ref.watch(authDioProvider);
  try {
    final response = await dio.get<dynamic>('/legal');
    final data = requireDataMap(response.data);
    return LegalDocuments(
      terms: LegalDocument.tryParse(data['terms']),
      privacy: LegalDocument.tryParse(data['privacy']),
    );
  } catch (_) {
    // Không tải được thì coi như chưa có điều khoản; nếu máy chủ vẫn đòi, người dùng sẽ thấy thông báo lỗi rõ ràng.
    return LegalDocuments.empty;
  }
});

const termsRequiredMessage =
    'Vui lòng đọc và đồng ý Điều khoản sử dụng trước khi nhận mã OTP.';

/// Điều khoản khách phải đồng ý trước khi nhận OTP; null khi không áp dụng (đã đăng nhập hoặc cơ sở khám chưa soạn).
LegalDocument? requiredTerms(WidgetRef ref, {bool authenticated = false}) =>
    authenticated ? null : ref.read(legalDocumentsProvider).value?.terms;

void showTermsRequired(BuildContext context) => ScaffoldMessenger.of(
  context,
).showSnackBar(const SnackBar(content: Text(termsRequiredMessage)));

/// Điều khoản vừa được cập nhật (máy chủ trả TERMS_OUTDATED): tải lại bản mới, người dùng phải đồng ý lại.
bool refreshIfTermsOutdated(WidgetRef ref, String? errorCode) {
  if (errorCode != 'TERMS_OUTDATED') return false;
  ref.invalidate(legalDocumentsProvider);
  return true;
}

/// Ô đồng ý điều khoản trước khi gửi OTP. Không hiện gì khi cơ sở khám chưa soạn điều khoản.
class TermsConsentTile extends ConsumerWidget {
  const TermsConsentTile({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final legal = ref.watch(legalDocumentsProvider).value;
    final terms = legal?.terms;
    if (terms == null) return const SizedBox.shrink();
    final privacy = legal?.privacy;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CheckboxListTile(
          key: const ValueKey('terms-consent-checkbox'),
          contentPadding: EdgeInsets.zero,
          dense: true,
          visualDensity: VisualDensity.compact,
          controlAffinity: ListTileControlAffinity.leading,
          value: value,
          onChanged: (checked) => onChanged(checked ?? false),
          title: Text(
            privacy == null
                ? 'Tôi đồng ý Điều khoản sử dụng.'
                : 'Tôi đồng ý Điều khoản sử dụng và Chính sách bảo mật.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        Wrap(
          spacing: 4,
          children: [
            TextButton(
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onPressed: () => _showDocument(context, terms),
              child: const Text('Xem điều khoản'),
            ),
            if (privacy != null)
              TextButton(
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: () => _showDocument(context, privacy),
                child: const Text('Xem chính sách bảo mật'),
              ),
          ],
        ),
      ],
    );
  }

  Future<void> _showDocument(BuildContext context, LegalDocument document) {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(document.title),
        content: SingleChildScrollView(child: Text(document.body)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }
}
