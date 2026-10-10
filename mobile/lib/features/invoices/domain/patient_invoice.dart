import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';

enum PatientInvoiceStatus {
  unpaid('UNPAID'),
  paid('PAID'),
  cancelled('CANCELLED'),
  refunded('REFUNDED'),
  unknown('UNKNOWN');

  const PatientInvoiceStatus(this.apiValue);

  factory PatientInvoiceStatus.fromApi(dynamic value) {
    final normalized = value?.toString().toUpperCase();
    return PatientInvoiceStatus.values.firstWhere(
      (status) => status.apiValue == normalized,
      orElse: () => PatientInvoiceStatus.unknown,
    );
  }

  final String apiValue;

  String get label => switch (this) {
    PatientInvoiceStatus.unpaid => 'Chưa thanh toán',
    PatientInvoiceStatus.paid => 'Đã thanh toán',
    PatientInvoiceStatus.cancelled => 'Đã hủy',
    PatientInvoiceStatus.refunded => 'Đã hoàn tiền',
    PatientInvoiceStatus.unknown => 'Đang cập nhật',
  };

  String get guidance => switch (this) {
    PatientInvoiceStatus.unpaid =>
      'Vui lòng thanh toán theo hướng dẫn của bệnh viện.',
    PatientInvoiceStatus.paid => 'Hóa đơn đã được ghi nhận thanh toán.',
    PatientInvoiceStatus.cancelled => 'Hóa đơn này không còn hiệu lực.',
    PatientInvoiceStatus.refunded =>
      'Khoản thanh toán đã được xử lý hoàn tiền.',
    PatientInvoiceStatus.unknown => 'Trạng thái hóa đơn đang được đồng bộ.',
  };

  AppStatusTone get tone => switch (this) {
    PatientInvoiceStatus.paid => AppStatusTone.success,
    PatientInvoiceStatus.unpaid => AppStatusTone.warning,
    PatientInvoiceStatus.cancelled => AppStatusTone.danger,
    PatientInvoiceStatus.refunded ||
    PatientInvoiceStatus.unknown => AppStatusTone.info,
  };

  IconData get icon => switch (this) {
    PatientInvoiceStatus.paid => Icons.check_circle_outline,
    PatientInvoiceStatus.unpaid => Icons.schedule_outlined,
    PatientInvoiceStatus.cancelled => Icons.cancel_outlined,
    PatientInvoiceStatus.refunded => Icons.currency_exchange_outlined,
    PatientInvoiceStatus.unknown => Icons.info_outline,
  };
}

enum PatientPaymentMethod {
  cash('CASH', 'Tiền mặt'),
  card('CARD', 'Thẻ'),
  bankTransfer('BANK_TRANSFER', 'Chuyển khoản'),
  momo('MOMO', 'MoMo'),
  vnpay('VNPAY', 'VNPay'),
  other('OTHER', 'Khác');

  const PatientPaymentMethod(this.apiValue, this.label);

  factory PatientPaymentMethod.fromApi(dynamic value) =>
      PatientPaymentMethod.values.firstWhere(
        (method) => method.apiValue == value?.toString().toUpperCase(),
        orElse: () => PatientPaymentMethod.other,
      );

  final String apiValue;
  final String label;
}

enum PatientInsuranceRoute {
  rightRoute('RIGHT_ROUTE', 'Đúng tuyến'),
  wrongRoute('WRONG_ROUTE', 'Trái tuyến'),
  referral('REFERRAL', 'Chuyển tuyến'),
  emergency('EMERGENCY', 'Cấp cứu'),
  service('SERVICE', 'Dịch vụ');

  const PatientInsuranceRoute(this.apiValue, this.label);

  factory PatientInsuranceRoute.fromApi(dynamic value) =>
      PatientInsuranceRoute.values.firstWhere(
        (route) => route.apiValue == value?.toString().toUpperCase(),
        orElse: () => PatientInsuranceRoute.service,
      );

  final String apiValue;
  final String label;
}

class PatientInvoice {
  const PatientInvoice({
    required this.id,
    required this.invoiceCode,
    required this.totalAmount,
    required this.bhytDiscount,
    required this.finalAmount,
    required this.insuranceEligibleAmount,
    required this.insuranceCoverageRate,
    required this.insuranceDiscountAmount,
    required this.status,
    required this.appointmentId,
    required this.bookingCode,
    required this.appointmentDate,
    required this.startTime,
    required this.endTime,
    required this.doctorName,
    required this.departmentName,
    this.insuranceRouteType,
    this.paymentMethod,
    this.paidAt,
    this.refundedAt,
    this.createdAt,
    this.packageName,
  });

  factory PatientInvoice.fromJson(Map<String, dynamic> json) {
    final appointment = _map(json['appointment']);
    final doctor = _map(appointment['doctor']);
    final doctorUser = _map(doctor['user']);
    final department = _map(appointment['department']);
    final package = _map(appointment['package']);
    return PatientInvoice(
      id: _string(json['id']),
      invoiceCode: _string(json['invoiceCode']),
      totalAmount: _integer(json['totalAmount']),
      bhytDiscount: _integer(json['bhytDiscount']),
      finalAmount: _integer(json['finalAmount']),
      insuranceEligibleAmount: _integer(json['insuranceEligibleAmount']),
      insuranceCoverageRate: _integer(json['insuranceCoverageRate']),
      insuranceDiscountAmount: _integer(json['insuranceDiscountAmount']),
      insuranceRouteType: json['insuranceRouteType'] == null
          ? null
          : PatientInsuranceRoute.fromApi(json['insuranceRouteType']),
      status: PatientInvoiceStatus.fromApi(json['status']),
      paymentMethod: json['paymentMethod'] == null
          ? null
          : PatientPaymentMethod.fromApi(json['paymentMethod']),
      paidAt: _dateTime(json['paidAt']),
      refundedAt: _dateTime(json['refundedAt']),
      createdAt: _dateTime(json['createdAt']),
      appointmentId: _string(appointment['id']),
      bookingCode: _string(appointment['bookingCode']),
      appointmentDate: _dateOnly(appointment['appointmentDate']),
      startTime: _string(appointment['startTime']),
      endTime: _string(appointment['endTime']),
      doctorName: formatProfessionalName(
        title: _nullableString(doctor['title']),
        fullName: _string(doctorUser['fullName']),
      ),
      departmentName: _nullableString(department['name']) ?? '',
      packageName: _nullableString(package['name']),
    );
  }

  final String id;
  final String invoiceCode;
  final int totalAmount;
  final int bhytDiscount;
  final int finalAmount;
  final int insuranceEligibleAmount;
  final int insuranceCoverageRate;
  final int insuranceDiscountAmount;
  final PatientInsuranceRoute? insuranceRouteType;
  final PatientInvoiceStatus status;
  final PatientPaymentMethod? paymentMethod;
  final DateTime? paidAt;
  final DateTime? refundedAt;
  final DateTime? createdAt;
  final String appointmentId;
  final String bookingCode;
  final String appointmentDate;
  final String startTime;
  final String endTime;
  final String doctorName;
  final String departmentName;
  final String? packageName;

  int get appliedInsuranceDiscount =>
      insuranceDiscountAmount > 0 ? insuranceDiscountAmount : bhytDiscount;

  bool get hasInsuranceBenefit =>
      insuranceEligibleAmount > 0 ||
      insuranceCoverageRate > 0 ||
      appliedInsuranceDiscount > 0 ||
      insuranceRouteType != null;

  String get careUnit => packageName ?? departmentName;
}

class InvoicePage {
  const InvoicePage({
    required this.items,
    required this.page,
    required this.total,
    required this.hasNextPage,
  });

  final List<PatientInvoice> items;
  final int page;
  final int total;
  final bool hasNextPage;
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

String _string(dynamic value) => value?.toString().trim() ?? '';

String? _nullableString(dynamic value) {
  final result = value?.toString().trim();
  return result == null || result.isEmpty ? null : result;
}

String _dateOnly(dynamic value) {
  final raw = _string(value);
  return RegExp(r'^\d{4}-\d{2}-\d{2}').firstMatch(raw)?.group(0) ?? raw;
}

DateTime? _dateTime(dynamic value) =>
    DateTime.tryParse(value?.toString() ?? '');

int _integer(dynamic value) =>
    value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;
