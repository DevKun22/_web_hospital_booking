import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/features/booking/domain/slot_availability.dart';

/// Màu và chữ của từng mức còn trống: xanh lá là còn nhiều, vàng là sắp hết, xám là hết giờ.
extension SlotAvailabilityVisuals on SlotAvailability {
  Color color(AppColors colors) => switch (this) {
    SlotAvailability.plenty => colors.success,
    SlotAvailability.low => colors.warning,
    SlotAvailability.none => colors.muted,
  };

  /// Đọc cho trình đọc màn hình và dùng làm tên mức trong chú thích.
  String get label => switch (this) {
    SlotAvailability.plenty => 'còn nhiều giờ',
    SlotAvailability.low => 'sắp hết giờ',
    SlotAvailability.none => 'hết giờ',
  };
}
