import 'package:hospital_booking_mobile/core/network/json_readers.dart';

enum PatientPaymentStatus {
  pending,
  success,
  failed,
  cancelled,
  expired,
  unknown;

  factory PatientPaymentStatus.fromJson(dynamic value) =>
      switch (value?.toString().toUpperCase()) {
        'PENDING' => pending,
        'SUCCESS' => success,
        'FAILED' => failed,
        'CANCELLED' => cancelled,
        'EXPIRED' => expired,
        _ => unknown,
      };

  bool get isFinal => this != pending && this != unknown;
}

class PatientPaymentProvider {
  const PatientPaymentProvider({required this.code, required this.label});

  factory PatientPaymentProvider.fromJson(Map<String, dynamic> json) =>
      PatientPaymentProvider(
        code: json['provider']?.toString() ?? '',
        label: json['label']?.toString() ?? '',
      );

  final String code;
  final String label;
}

class PatientPaymentCapabilities {
  const PatientPaymentCapabilities({required this.providers});

  factory PatientPaymentCapabilities.fromJson(Map<String, dynamic> json) {
    final rawProviders = json['providers'];
    return PatientPaymentCapabilities(
      providers: rawProviders is List
          ? rawProviders
                .whereType<Map>()
                .map(
                  (item) => PatientPaymentProvider.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
    );
  }

  final List<PatientPaymentProvider> providers;
}

class PatientPaymentTransaction {
  const PatientPaymentTransaction({
    required this.id,
    required this.provider,
    required this.status,
    required this.amount,
    required this.transactionCode,
    this.paymentUrl,
    this.paidAt,
    this.expiredAt,
  });

  factory PatientPaymentTransaction.fromJson(Map<String, dynamic> json) =>
      PatientPaymentTransaction(
        id: json['id']?.toString() ?? '',
        provider: json['provider']?.toString() ?? '',
        status: PatientPaymentStatus.fromJson(json['status']),
        amount: (json['amount'] as num?)?.toInt() ?? 0,
        transactionCode: json['transactionCode']?.toString() ?? '',
        paymentUrl: _optionalString(json['paymentUrl']),
        paidAt: jsonDateTime(json['paidAt']),
        expiredAt: jsonDateTime(json['expiredAt']),
      );

  final String id;
  final String provider;
  final PatientPaymentStatus status;
  final int amount;
  final String transactionCode;
  final String? paymentUrl;
  final DateTime? paidAt;
  final DateTime? expiredAt;
}

String? _optionalString(dynamic value) {
  final parsed = value?.toString().trim();
  return parsed == null || parsed.isEmpty ? null : parsed;
}
