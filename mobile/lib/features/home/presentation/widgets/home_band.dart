import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';

/// Chiều cao phần nền màu của dải đầu Trang chủ (không tính thẻ nổi đè lên phía dưới).
double homeBandHeight(BuildContext context) =>
    MediaQuery.paddingOf(context).top + 10 + _controlSize + 58;

const double _controlSize = 44;

/// Dải đầu Trang chủ: avatar (hoặc biểu tượng đăng nhập), ô tìm kiếm dạng viên có nút hỏi Kun, và chuông thông báo.
class HomeBand extends StatelessWidget {
  const HomeBand({
    super.key,
    required this.isAuthenticated,
    required this.avatar,
    required this.unreadNotificationCount,
    required this.onAccount,
    required this.onSearch,
    required this.onAsk,
    required this.onNotifications,
  });

  final bool isAuthenticated;
  final String? avatar;
  final int unreadNotificationCount;
  final VoidCallback onAccount;
  final VoidCallback onSearch;
  final VoidCallback onAsk;
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: homeBandHeight(context),
    child: ColoredBox(
      color: AppPalette.heroMid,
      child: Padding(
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
            child: Row(
              children: [
                _AccountButton(
                  isAuthenticated: isAuthenticated,
                  avatar: avatar,
                  onTap: onAccount,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _SearchPill(onSearch: onSearch, onAsk: onAsk),
                ),
                const SizedBox(width: 8),
                _BellButton(
                  unreadCount: unreadNotificationCount,
                  onTap: onNotifications,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _AccountButton extends StatelessWidget {
  const _AccountButton({
    required this.isAuthenticated,
    required this.avatar,
    required this.onTap,
  });

  final bool isAuthenticated;
  final String? avatar;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasAvatar = isAuthenticated && avatar?.trim().isNotEmpty == true;
    return Semantics(
      button: true,
      label: isAuthenticated ? 'Mở tài khoản' : 'Đăng nhập',
      child: InkResponse(
        key: const Key('home-login-button'),
        onTap: onTap,
        radius: 26,
        child: CircleAvatar(
          radius: _controlSize / 2,
          backgroundColor: Colors.white,
          backgroundImage: hasAvatar
              ? resizedNetworkImage(
                  context,
                  avatar,
                  logicalWidth: _controlSize,
                  logicalHeight: _controlSize,
                )
              : null,
          child: hasAvatar
              ? null
              : Icon(
                  isAuthenticated ? Icons.person_rounded : Icons.login_rounded,
                  color: AppPalette.heroMid,
                ),
        ),
      ),
    );
  }
}

class _SearchPill extends StatelessWidget {
  const _SearchPill({required this.onSearch, required this.onAsk});

  final VoidCallback onSearch;
  final VoidCallback onAsk;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Material(
      color: Colors.white,
      shape: const StadiumBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: const Key('home-search-button'),
        onTap: onSearch,
        child: Padding(
          padding: const EdgeInsets.only(left: 14, right: 5),
          child: Row(
            children: [
              Icon(Icons.search_rounded, color: AppPalette.heroMid, size: 22),
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
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: colors.primarySoft,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.auto_awesome_rounded,
                      size: 19,
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
                size: 24,
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
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
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
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ),
    ],
  );
}
