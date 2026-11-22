import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';

/// Chiều cao phần nền màu của dải đầu Trang chủ (không tính banner nổi đè lên phía dưới).
double homeBandHeight(BuildContext context) =>
    MediaQuery.paddingOf(context).top + 10 + _controlSize + 52;

const double _controlSize = 40;

/// Dải đầu Trang chủ: ô tìm kiếm dạng viên có nút hỏi Kun, và chuông thông báo khi đã đăng nhập (khách không thấy).
/// Nền có hai lớp sóng mờ trôi chậm.
class HomeBand extends StatelessWidget {
  const HomeBand({
    super.key,
    required this.showBell,
    required this.unreadNotificationCount,
    required this.onSearch,
    required this.onAsk,
    required this.onNotifications,
  });

  final bool showBell;
  final int unreadNotificationCount;
  final VoidCallback onSearch;
  final VoidCallback onAsk;
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: homeBandHeight(context),
    child: ColoredBox(
      color: AppPalette.heroMid,
      child: Stack(
        children: [
          const Positioned(left: 0, right: 0, bottom: 0, child: WaveBackdrop()),
          Padding(
            padding: EdgeInsets.fromLTRB(
              12,
              MediaQuery.paddingOf(context).top + 10,
              12,
              0,
            ),
            child: Align(
              alignment: Alignment.topCenter,
              child: SizedBox(
                height: _controlSize,
                child: HomeSearchRow(
                  showBell: showBell,
                  unreadNotificationCount: unreadNotificationCount,
                  onSearch: onSearch,
                  onAsk: onAsk,
                  onNotifications: onNotifications,
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

/// Hàng tìm kiếm dùng cho cả dải đầu lẫn thanh thu gọn khi cuộn.
class HomeSearchRow extends StatelessWidget {
  const HomeSearchRow({
    super.key,
    required this.showBell,
    required this.unreadNotificationCount,
    required this.onSearch,
    required this.onAsk,
    required this.onNotifications,
  });

  final bool showBell;
  final int unreadNotificationCount;
  final VoidCallback onSearch;
  final VoidCallback onAsk;
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: _SearchPill(onSearch: onSearch, onAsk: onAsk),
      ),
      if (showBell) ...[
        const SizedBox(width: 8),
        _BellButton(
          unreadCount: unreadNotificationCount,
          onTap: onNotifications,
        ),
      ],
    ],
  );
}

class _SearchPill extends StatelessWidget {
  const _SearchPill({required this.onSearch, required this.onAsk});

  final VoidCallback onSearch;
  final VoidCallback onAsk;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    shape: const StadiumBorder(),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      key: const Key('home-search-button'),
      onTap: onSearch,
      child: Padding(
        padding: const EdgeInsets.only(left: 14, right: 4),
        child: Row(
          children: [
            Icon(Icons.search_rounded, color: AppPalette.heroMid, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Tìm bác sĩ, khoa, gói',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF4F6663),
                ),
              ),
            ),
            Tooltip(
              message: 'Hỏi Kun',
              child: InkResponse(
                key: const Key('home-ask-kun-button'),
                onTap: onAsk,
                radius: 22,
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: context.colors.primarySoft,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.auto_awesome_rounded,
                    size: 18,
                    color: AppPalette.heroMid,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _BellButton extends StatelessWidget {
  const _BellButton({required this.unreadCount, required this.onTap});

  final int unreadCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Stack(
    clipBehavior: Clip.none,
    children: [
      Material(
        color: Colors.white.withValues(alpha: 0.2),
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Tooltip(
            message: unreadCount == 0
                ? 'Thông báo'
                : '$unreadCount thông báo chưa đọc',
            child: const SizedBox.square(
              dimension: _controlSize,
              child: Icon(
                Icons.notifications_none_rounded,
                color: Colors.white,
                size: 22,
              ),
            ),
          ),
        ),
      ),
      if (unreadCount > 0)
        Positioned(
          right: -2,
          top: -2,
          child: IgnorePointer(
            child: Container(
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.error,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                unreadCount > 99 ? '99+' : '$unreadCount',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onError,
                  fontSize: 10,
                ),
              ),
            ),
          ),
        ),
    ],
  );
}
