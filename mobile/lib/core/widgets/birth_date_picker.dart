import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/formatters/vietnam_time.dart';

/// Chọn ngày sinh bằng lịch tháng chuẩn của Material (bấm tiêu đề tháng để chọn năm, nút bút chì để gõ tay).
/// Ngày sinh phải trước hôm nay (đúng quy tắc của máy chủ). Chưa có giá trị thì mở ở khoảng 30 năm trước.
Future<DateTime?> showBirthDatePicker(
  BuildContext context, {
  DateTime? initial,
}) {
  final today = vietnamToday();
  final lastDate = DateTime(
    today.year,
    today.month,
    today.day,
  ).subtract(const Duration(days: 1));
  var initialDate =
      initial ?? DateTime(today.year - 30, today.month, today.day);
  if (initialDate.isAfter(lastDate)) initialDate = lastDate;
  return showDatePicker(
    context: context,
    firstDate: DateTime(1900),
    lastDate: lastDate,
    initialDate: initialDate,
    helpText: 'Chọn ngày sinh',
    cancelText: 'Hủy',
    confirmText: 'Xong',
    fieldHintText: 'dd/mm/yyyy',
  );
}
