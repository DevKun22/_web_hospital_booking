import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

/// Biểu tượng và vùng màu của một chuyên khoa. Mọi nơi hiện chuyên khoa (lưới, trang chủ, thẻ gói khám) lấy từ đây,
/// nên thêm hay đổi hình một khoa chỉ sửa bảng [_rules].
class DepartmentVisual {
  const DepartmentVisual(this.icon, this.zone);

  final IconData icon;
  final AppZone? zone;
}

const _fallbackIcon = Icons.medical_services_outlined;

/// Từ khóa (đã bỏ dấu, chữ thường) tìm trong tên hoặc slug khoa; khớp từ khóa đầu tiên theo thứ tự bảng.
const _rules = <(List<String>, DepartmentVisual)>[
  (['nhi'], DepartmentVisual(Icons.child_care_outlined, AppZone.primary)),
  (
    ['tim mach'],
    DepartmentVisual(Icons.monitor_heart_outlined, AppZone.danger),
  ),
  (['mat'], DepartmentVisual(Icons.visibility_outlined, AppZone.care)),
  (['da lieu'], DepartmentVisual(Icons.spa_outlined, AppZone.warning)),
  (['tai mui hong'], DepartmentVisual(Icons.hearing_outlined, AppZone.violet)),
  (
    ['san', 'phu khoa'],
    DepartmentVisual(Icons.pregnant_woman_outlined, AppZone.violet),
  ),
  (['noi tiet'], DepartmentVisual(Icons.bloodtype_outlined, AppZone.care)),
  (
    ['tong quat', 'noi tong'],
    DepartmentVisual(Icons.health_and_safety_outlined, AppZone.success),
  ),
  (['than kinh'], DepartmentVisual(Icons.psychology_outlined, AppZone.violet)),
  (['ho hap', 'phoi'], DepartmentVisual(Icons.air_outlined, AppZone.care)),
  (
    ['xuong', 'khop', 'chinh hinh'],
    DepartmentVisual(Icons.accessibility_new_outlined, AppZone.warning),
  ),
  (
    ['tieu hoa'],
    DepartmentVisual(Icons.lunch_dining_outlined, AppZone.warning),
  ),
  (
    ['tiet nieu', 'than'],
    DepartmentVisual(Icons.water_drop_outlined, AppZone.care),
  ),
  (['rang'], DepartmentVisual(Icons.mood_outlined, AppZone.primary)),
  (['ung buou'], DepartmentVisual(Icons.biotech_outlined, AppZone.danger)),
];

const _fold = {
  'à': 'a',
  'á': 'a',
  'ả': 'a',
  'ã': 'a',
  'ạ': 'a',
  'ă': 'a',
  'ằ': 'a',
  'ắ': 'a',
  'ẳ': 'a',
  'ẵ': 'a',
  'ặ': 'a',
  'â': 'a',
  'ầ': 'a',
  'ấ': 'a',
  'ẩ': 'a',
  'ẫ': 'a',
  'ậ': 'a',
  'è': 'e',
  'é': 'e',
  'ẻ': 'e',
  'ẽ': 'e',
  'ẹ': 'e',
  'ê': 'e',
  'ề': 'e',
  'ế': 'e',
  'ể': 'e',
  'ễ': 'e',
  'ệ': 'e',
  'ì': 'i',
  'í': 'i',
  'ỉ': 'i',
  'ĩ': 'i',
  'ị': 'i',
  'ò': 'o',
  'ó': 'o',
  'ỏ': 'o',
  'õ': 'o',
  'ọ': 'o',
  'ô': 'o',
  'ồ': 'o',
  'ố': 'o',
  'ổ': 'o',
  'ỗ': 'o',
  'ộ': 'o',
  'ơ': 'o',
  'ờ': 'o',
  'ớ': 'o',
  'ở': 'o',
  'ỡ': 'o',
  'ợ': 'o',
  'ù': 'u',
  'ú': 'u',
  'ủ': 'u',
  'ũ': 'u',
  'ụ': 'u',
  'ư': 'u',
  'ừ': 'u',
  'ứ': 'u',
  'ử': 'u',
  'ữ': 'u',
  'ự': 'u',
  'ỳ': 'y',
  'ý': 'y',
  'ỷ': 'y',
  'ỹ': 'y',
  'ỵ': 'y',
  'đ': 'd',
};

String _plain(String input) {
  final lower = input.toLowerCase();
  final out = StringBuffer();
  for (final rune in lower.runes) {
    final ch = String.fromCharCode(rune);
    out.write(_fold[ch] ?? ch);
  }
  // Ghép khoảng trắng và gạch nối để "tim-mach" và "tim mạch" cùng khớp.
  return ' ${out.toString().replaceAll('-', ' ')} ';
}

/// Biểu tượng và vùng màu của khoa; khoa chưa có trong bảng dùng biểu tượng chung và vùng xoay vòng theo [index].
({IconData icon, ({Color background, Color foreground}) tint}) departmentVisual(
  BuildContext context, {
  required String name,
  String? slug,
  int index = 0,
}) {
  final text = _plain('$name ${slug ?? ''}');
  for (final (keys, visual) in _rules) {
    // Khớp nguyên từ (có khoảng trắng hai đầu) để "nhi" không nhầm với "nhiem".
    if (keys.any((k) => text.contains(' $k '))) {
      final colors = context.colors;
      return (
        icon: visual.icon,
        tint: visual.zone == null
            ? colors.zoneAt(index)
            : colors.zone(visual.zone!),
      );
    }
  }
  return (icon: _fallbackIcon, tint: context.colors.zoneAt(index));
}
