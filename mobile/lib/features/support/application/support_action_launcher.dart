import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

final supportActionLauncherProvider = Provider<SupportActionLauncher>(
  (ref) => const UrlSupportActionLauncher(),
);

final hospitalLocationLauncherProvider = Provider<HospitalLocationLauncher>(
  (ref) => const UrlHospitalLocationLauncher(),
);

abstract interface class SupportActionLauncher {
  Future<bool> openPhoneDialer(String phoneNumber);
}

class UrlSupportActionLauncher implements SupportActionLauncher {
  const UrlSupportActionLauncher();

  @override
  Future<bool> openPhoneDialer(String phoneNumber) async {
    final dialableNumber = normalizeDialablePhone(phoneNumber);
    if (dialableNumber == null) return false;

    return launchUrl(
      Uri(scheme: 'tel', path: dialableNumber),
      mode: LaunchMode.externalApplication,
    );
  }
}

abstract interface class HospitalLocationLauncher {
  Future<bool> openLocation({String? mapUrl, String? address});
}

class UrlHospitalLocationLauncher implements HospitalLocationLauncher {
  const UrlHospitalLocationLauncher();

  @override
  Future<bool> openLocation({String? mapUrl, String? address}) async {
    final configured = Uri.tryParse(mapUrl?.trim() ?? '');
    final target =
        configured != null &&
            (configured.scheme == 'https' || configured.scheme == 'http')
        ? configured
        : Uri.https('www.google.com', '/maps/search/', {
            'api': '1',
            'query': address?.trim() ?? '',
          });
    if ((address == null || address.trim().isEmpty) && configured == null) {
      return false;
    }
    return launchUrl(target, mode: LaunchMode.externalApplication);
  }
}

/// Keeps only the characters accepted by common phone dialers.
///
/// A leading `+` is preserved for international numbers. Labels and malformed
/// input are rejected so a value received from the CMS cannot become an
/// arbitrary external URI.
String? normalizeDialablePhone(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;

  final hasLeadingPlus = trimmed.startsWith('+');
  final digits = trimmed.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.length < 3) return null;
  return hasLeadingPlus ? '+$digits' : digits;
}
