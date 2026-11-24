import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';

/// Từ chung đứng đầu tên khoa, gói ("Khoa", "Gói khám"...) không mang nghĩa nên bỏ khi lấy chữ viết tắt.
const _genericWords = {'khoa', 'chuyên', 'gói', 'khám', 'dịch', 'vụ'};

/// Hai chữ đầu của tên khoa hoặc gói sau khi bỏ từ chung: "Khoa Tim mạch" → "TM", "Gói khám tổng quát" → "TQ".
String entityInitials(String name) {
  final words = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty)
      .toList();
  final meaningful = words
      .skipWhile((word) => _genericWords.contains(word.toLowerCase()))
      .toList();
  final source = meaningful.isEmpty ? words : meaningful;
  if (source.isEmpty) return '?';
  return source
      .take(2)
      .map((word) => word.characters.first)
      .join()
      .toUpperCase();
}

/// Dấu nhận diện của khoa hoặc gói khám: ảnh do quản trị tải lên, chưa có ảnh (hay ảnh lỗi) thì là chữ viết tắt.
/// Mọi khoa, gói dùng chung một tông màu của thương hiệu, nên thêm khoa mới không cần chọn biểu tượng hay màu.
class AppEntityMark extends StatelessWidget {
  const AppEntityMark({
    super.key,
    required this.name,
    this.image,
    this.size = AppTileSize.lg,
    this.onTinted = false,
  });

  final String name;
  final String? image;
  final AppTileSize size;

  /// Đặt trên nền đã tô màu (đầu trang chi tiết): nền chữ viết tắt đổi sang màu bề mặt cho nổi.
  final bool onTinted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final picture = resizedNetworkImage(
      context,
      image,
      logicalWidth: size.box,
      logicalHeight: size.box,
    );
    final monogram = _Monogram(
      label: entityInitials(name),
      size: size,
      background: onTinted ? colors.surface : colors.primarySoft,
      foreground: colors.primaryDark,
    );
    return ExcludeSemantics(
      child: picture == null
          ? monogram
          : ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: SizedBox(
                width: size.box,
                height: size.box,
                child: Image(
                  image: picture,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => monogram,
                ),
              ),
            ),
    );
  }
}

class _Monogram extends StatelessWidget {
  const _Monogram({
    required this.label,
    required this.size,
    required this.background,
    required this.foreground,
  });

  final String label;
  final AppTileSize size;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final style = size == AppTileSize.sm || size == AppTileSize.md
        ? text.labelLarge
        : text.titleMedium;
    return Container(
      width: size.box,
      height: size.box,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(AppSpacing.xxs),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          label,
          maxLines: 1,
          style: style?.copyWith(
            color: foreground,
            fontWeight: AppFontWeight.strong,
          ),
        ),
      ),
    );
  }
}
