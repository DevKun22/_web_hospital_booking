import 'package:hospital_booking_mobile/core/formatters/professional_name_formatter.dart';

import 'package:hospital_booking_mobile/core/network/json_readers.dart';

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
      'Vui lòng thanh toán theo hướng dẫn của cơ sở khám.',
    PatientInvoiceStatus.paid => 'Hóa đơn đã được ghi nhận thanh toán.',
    PatientInvoiceStatus.cancelled => 'Hóa đơn này không còn hiệu lực.',
    PatientInvoiceStatus.refunded =>
      'Khoản thanh toán đã được xử lý hoàn tiền.',
    PatientInvoiceStatus.unknown => 'Trạng thái hóa đơn đang được đồng bộ.',
  };

  String get amountLabel => switch (this) {
    PatientInvoiceStatus.unpaid => 'Cần thanh toán',
    PatientInvoiceStatus.paid => 'Đã thanh toán',
    PatientInvoiceStatus.refunded => 'Đã hoàn tiền',
    PatientInvoiceStatus.cancelled ||
    PatientInvoiceStatus.unknown => 'Giá trị hóa đơn',
  };
}

enum PatientPaymentMethod {
  cash('CASH', 'Tiền mặt'),
  card('CARD', 'Thẻ'),
  bankTransfer('BANK_TRANSFER', 'Chuyển khoản'),
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

class PatientInvoiceItem {
  const PatientInvoiceItem({
    required this.id,
    required this.description,
    required this.quantity,
    required this.unitPrice,
    required this.amount,
  });

  factory PatientInvoiceItem.fromJson(Map<String, dynamic> json) =>
      PatientInvoiceItem(
        id: jsonText(json['id']),
        description: jsonText(json['description']),
        quantity: jsonInt(json['quantity']),
        unitPrice: jsonInt(json['unitPrice']),
        amount: jsonInt(json['amount']),
      );

  final String id;
  final String description;
  final int quantity;
  final int unitPrice;
  final int amount;
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
    required this.items,
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
    this.paymentReference,
    this.paidAt,
    this.refundReason,
    this.refundReference,
    this.refundedAt,
    this.createdAt,
    this.packageName,
    this.patientName,
    this.dependentProfileId,
  });

  factory PatientInvoice.fromJson(Map<String, dynamic> json) {
    final appointment = jsonMap(json['appointment']);
    final doctor = jsonMap(appointment['doctor']);
    final doctorUser = jsonMap(doctor['user']);
    final department = jsonMap(appointment['department']);
    final package = jsonMap(appointment['package']);
    final items = json['items'] is List
        ? (json['items'] as List<dynamic>)
              .whereType<Map>()
              .map(
                (item) => PatientInvoiceItem.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
        : const <PatientInvoiceItem>[];
    return PatientInvoice(
      id: jsonText(json['id']),
      invoiceCode: jsonText(json['invoiceCode']),
      totalAmount: jsonInt(json['totalAmount']),
      bhytDiscount: jsonInt(json['bhytDiscount']),
      finalAmount: jsonInt(json['finalAmount']),
      insuranceEligibleAmount: jsonInt(json['insuranceEligibleAmount']),
      insuranceCoverageRate: jsonInt(json['insuranceCoverageRate']),
      insuranceDiscountAmount: jsonInt(json['insuranceDiscountAmount']),
      items: items,
      insuranceRouteType: json['insuranceRouteType'] == null
          ? null
          : PatientInsuranceRoute.fromApi(json['insuranceRouteType']),
      status: PatientInvoiceStatus.fromApi(json['status']),
      paymentMethod: json['paymentMethod'] == null
          ? null
          : PatientPaymentMethod.fromApi(json['paymentMethod']),
      paymentReference: jsonNullableString(json['paymentReference']),
      paidAt: jsonDateTime(json['paidAt']),
      refundReason: jsonNullableString(json['refundReason']),
      refundReference: jsonNullableString(json['refundReference']),
      refundedAt: jsonDateTime(json['refundedAt']),
      createdAt: jsonDateTime(json['createdAt']),
      appointmentId: jsonText(appointment['id']),
      bookingCode: jsonText(appointment['bookingCode']),
      patientName: jsonNullableString(appointment['patientName']),
      dependentProfileId: jsonNullableString(appointment['dependentProfileId']),
      appointmentDate: jsonDateOnly(appointment['appointmentDate']),
      startTime: jsonText(appointment['startTime']),
      endTime: jsonText(appointment['endTime']),
      doctorName: formatProfessionalName(
        title: jsonNullableString(doctor['title']),
        fullName: jsonText(doctorUser['fullName']),
      ),
      departmentName: jsonNullableString(department['name']) ?? '',
      packageName: jsonNullableString(package['name']),
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
  final List<PatientInvoiceItem> items;
  final PatientInsuranceRoute? insuranceRouteType;
  final PatientInvoiceStatus status;
  final PatientPaymentMethod? paymentMethod;
  final String? paymentReference;
  final DateTime? paidAt;
  final String? refundReason;
  final String? refundReference;
  final DateTime? refundedAt;
  final DateTime? createdAt;
  final String appointmentId;
  final String bookingCode;
  final String? patientName;
  final String? dependentProfileId;
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
  bool get isDependentInvoice => dependentProfileId != null;
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
