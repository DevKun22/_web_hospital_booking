/// Số khung giờ còn lại từ đây trở xuống được coi là "sắp hết".
const lowSlotThreshold = 3;

/// Mức còn trống của một ngày hoặc một buổi, suy ra từ số khung giờ còn lại.
/// Mọi nơi hiện số giờ trống (lịch chọn ngày, nhóm buổi) dùng chung để màu và chữ luôn khớp nhau.
enum SlotAvailability {
  none,
  low,
  plenty;

  static SlotAvailability of(int count) {
    if (count <= 0) return none;
    if (count <= lowSlotThreshold) return low;
    return plenty;
  }

  bool get isBookable => this != none;
}
