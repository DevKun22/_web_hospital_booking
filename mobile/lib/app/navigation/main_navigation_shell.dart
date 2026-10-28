import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/main_navigation_destination.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/sync/patient_data_sync_coordinator.dart';
import 'package:hospital_booking_mobile/features/notifications/application/notifications_controller.dart';

class MainNavigationHistoryController extends ChangeNotifier {
  static const _homeIndex = 0;
  static const _maximumHistoryLength = 20;

  final List<int> _branchHistory = <int>[];
  StatefulNavigationShell? _navigationShell;
  int? _currentIndex;
  int? _pendingIndex;
  int? _pendingPreviousIndex;
  bool _notificationScheduled = false;
  bool _disposed = false;

  bool get canExitApp =>
      (_currentIndex ?? _homeIndex) == _homeIndex && _branchHistory.isEmpty;

  void attach(StatefulNavigationShell navigationShell) {
    _navigationShell = navigationShell;
    final actualIndex = navigationShell.currentIndex;
    if (_currentIndex == null) {
      _currentIndex = actualIndex;
      return;
    }
    if (actualIndex == _currentIndex) {
      if (_pendingIndex == actualIndex) _clearPendingNavigation();
      return;
    }

    if (_pendingIndex != null) {
      if (actualIndex != _pendingIndex &&
          _branchHistory.lastOrNull == _pendingPreviousIndex) {
        _branchHistory.removeLast();
      }
      _clearPendingNavigation();
    } else {
      _remember(_currentIndex!);
    }
    _currentIndex = actualIndex;
    _scheduleNotification();
  }

  void selectBranch(int index) {
    final navigationShell = _navigationShell;
    if (navigationShell == null) return;
    final currentIndex = _currentIndex ?? navigationShell.currentIndex;
    if (index == currentIndex) {
      navigationShell.goBranch(index, initialLocation: true);
      return;
    }

    _remember(currentIndex);
    _pendingIndex = index;
    _pendingPreviousIndex = currentIndex;
    _currentIndex = index;
    notifyListeners();
    navigationShell.goBranch(index);
  }

  void restorePreviousBranch() {
    final navigationShell = _navigationShell;
    if (navigationShell == null || canExitApp) return;
    final currentIndex = _currentIndex ?? navigationShell.currentIndex;
    final previousIndex = _branchHistory.isNotEmpty
        ? _branchHistory.removeLast()
        : _homeIndex;
    if (previousIndex == currentIndex) return;

    _pendingIndex = previousIndex;
    _pendingPreviousIndex = currentIndex;
    _currentIndex = previousIndex;
    notifyListeners();
    navigationShell.goBranch(previousIndex);
  }

  void _remember(int index) {
    if (_branchHistory.lastOrNull == index) return;
    _branchHistory.add(index);
    if (_branchHistory.length > _maximumHistoryLength) {
      _branchHistory.removeAt(0);
    }
  }

  void _clearPendingNavigation() {
    _pendingIndex = null;
    _pendingPreviousIndex = null;
  }

  void _scheduleNotification() {
    if (_notificationScheduled) return;
    _notificationScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _notificationScheduled = false;
      if (!_disposed) notifyListeners();
    });
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

class MainBranchBackScope extends StatelessWidget {
  const MainBranchBackScope({
    required this.controller,
    required this.child,
    super.key,
  });

  final MainNavigationHistoryController controller;
  final Widget child;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    child: child,
    builder: (context, child) => PopScope<void>(
      canPop: controller.canExitApp,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) controller.restorePreviousBranch();
      },
      child: child!,
    ),
  );
}

class MainNavigationShell extends ConsumerStatefulWidget {
  const MainNavigationShell({
    required this.navigationShell,
    required this.historyController,
    super.key,
  });

  final StatefulNavigationShell navigationShell;
  final MainNavigationHistoryController historyController;

  @override
  ConsumerState<MainNavigationShell> createState() =>
      _MainNavigationShellState();
}

class _MainNavigationShellState extends ConsumerState<MainNavigationShell> {
  bool _homeScrolledAway = false;

  @override
  Widget build(BuildContext context) {
    widget.historyController.attach(widget.navigationShell);
    final unreadNotificationCount = ref.watch(
      notificationsControllerProvider.select((state) => state.unreadCount),
    );
    final currentBranch = MainNavigationBranch.fromIndex(
      widget.navigationShell.currentIndex,
    );
    final keyboardVisible = MediaQuery.viewInsetsOf(context).bottom > 0;
    final showChatbot =
        currentBranch != MainNavigationBranch.booking &&
        !keyboardVisible &&
        (currentBranch != MainNavigationBranch.home || _homeScrolledAway);

    return Scaffold(
      body: NotificationListener<ScrollNotification>(
        onNotification: _handleScrollNotification,
        child: widget.navigationShell,
      ),
      floatingActionButton: showChatbot
          ? _ChatbotFloatingButton(onPressed: () => context.push('/chatbot'))
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      bottomNavigationBar: _MainBottomNavigationBar(
        currentIndex: widget.navigationShell.currentIndex,
        unreadNotificationCount: unreadNotificationCount,
        onDestinationSelected: (index) {
          widget.historyController.selectBranch(index);
          unawaited(
            ref
                .read(patientDataSyncCoordinatorProvider)
                .handleMainBranchSelected(index),
          );
        },
      ),
    );
  }

  bool _handleScrollNotification(ScrollNotification notification) {
    if (widget.navigationShell.currentIndex !=
            MainNavigationBranch.home.index ||
        notification.metrics.axis != Axis.vertical ||
        notification.depth != 0) {
      return false;
    }
    final homeScrolledAway = notification.metrics.extentBefore > 56;
    if (homeScrolledAway != _homeScrolledAway) {
      setState(() => _homeScrolledAway = homeScrolledAway);
    }
    return false;
  }
}

class _MainBottomNavigationBar extends StatelessWidget {
  const _MainBottomNavigationBar({
    required this.currentIndex,
    required this.unreadNotificationCount,
    required this.onDestinationSelected,
  });

  final int currentIndex;
  final int unreadNotificationCount;
  final ValueChanged<int> onDestinationSelected;

  static const _destinations = <_NavigationDestination>[
    _NavigationDestination(
      label: 'Trang chủ',
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_rounded,
    ),
    _NavigationDestination(
      label: 'Hồ sơ',
      icon: Icons.badge_outlined,
      selectedIcon: Icons.badge_rounded,
    ),
    _NavigationDestination(
      label: 'Đặt khám',
      icon: Icons.add_rounded,
      selectedIcon: Icons.add_rounded,
      isPrimaryAction: true,
    ),
    _NavigationDestination(
      label: 'Thông báo',
      icon: Icons.notifications_none_rounded,
      selectedIcon: Icons.notifications_rounded,
    ),
    _NavigationDestination(
      label: 'Tài khoản',
      icon: Icons.person_outline_rounded,
      selectedIcon: Icons.person_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      color: Colors.white,
      boxShadow: AppShadow.floating,
    ),
    child: Material(
      color: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height:
              AppSize.bottomNavigationHeight +
              (MediaQuery.textScalerOf(context).scale(12) - 12)
                  .clamp(0, 14)
                  .toDouble(),
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.topCenter,
            children: [
              Positioned.fill(
                top: 8,
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: AppTheme.softBorder)),
                  ),
                  child: Row(
                    children: List.generate(_destinations.length, (index) {
                      if (index == MainNavigationBranch.booking.index) {
                        return const Expanded(child: SizedBox());
                      }
                      final destination = _destinations[index];
                      return Expanded(
                        child: _NavigationItem(
                          key: ValueKey('main-navigation-item-$index'),
                          destination: destination,
                          selected: currentIndex == index,
                          badgeCount:
                              index == MainNavigationBranch.notifications.index
                              ? unreadNotificationCount
                              : 0,
                          onTap: () => onDestinationSelected(index),
                        ),
                      );
                    }),
                  ),
                ),
              ),
              _PrimaryNavigationItem(
                key: ValueKey(
                  'main-navigation-item-${MainNavigationBranch.booking.index}',
                ),
                destination: _destinations[MainNavigationBranch.booking.index],
                selected: currentIndex == MainNavigationBranch.booking.index,
                onTap: () =>
                    onDestinationSelected(MainNavigationBranch.booking.index),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _NavigationItem extends StatelessWidget {
  const _NavigationItem({
    super.key,
    required this.destination,
    required this.selected,
    required this.badgeCount,
    required this.onTap,
  });

  final _NavigationDestination destination;
  final bool selected;
  final int badgeCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final foreground = selected
        ? colorScheme.primary
        : colorScheme.onSurfaceVariant;
    final animationDuration = AppMotion.responsive(context, AppMotion.fast);

    return Semantics(
      button: true,
      selected: selected,
      label: destination.label,
      excludeSemantics: true,
      child: Tooltip(
        message: destination.label,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(2, 10, 2, 5),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Badge.count(
                  count: badgeCount > 99 ? 99 : badgeCount,
                  isLabelVisible: badgeCount > 0,
                  backgroundColor: colorScheme.error,
                  child: AnimatedContainer(
                    duration: animationDuration,
                    curve: AppMotion.emphasized,
                    width: 38,
                    height: 30,
                    decoration: BoxDecoration(
                      color: selected
                          ? colorScheme.primaryContainer
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: AnimatedScale(
                      duration: animationDuration,
                      scale: selected ? 1 : 0.92,
                      child: Icon(
                        selected ? destination.selectedIcon : destination.icon,
                        size: 22,
                        color: foreground,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  destination.label,
                  maxLines: 1,
                  overflow: TextOverflow.fade,
                  softWrap: false,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: selected
                        ? colorScheme.primary
                        : colorScheme.onSurfaceVariant,
                    fontSize: 11.5,
                    height: 1.15,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PrimaryNavigationItem extends StatelessWidget {
  const _PrimaryNavigationItem({
    super.key,
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final _NavigationDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final animationDuration = AppMotion.responsive(context, AppMotion.fast);
    return Semantics(
      button: true,
      selected: selected,
      label: destination.label,
      excludeSemantics: true,
      child: Tooltip(
        message: destination.label,
        child: InkResponse(
          onTap: onTap,
          radius: 42,
          child: SizedBox(
            width: 86,
            height: 78,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedScale(
                  duration: animationDuration,
                  scale: selected ? 1.05 : 1,
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: colorScheme.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 4),
                      boxShadow: AppShadow.floating,
                    ),
                    child: Icon(
                      destination.selectedIcon,
                      color: colorScheme.onPrimary,
                      size: 28,
                    ),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  destination.label,
                  maxLines: 1,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: colorScheme.primary,
                    fontSize: 11.5,
                    height: 1,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ChatbotFloatingButton extends StatelessWidget {
  const _ChatbotFloatingButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Transform.translate(
    offset: const Offset(0, 10),
    child: Semantics(
      button: true,
      label: 'Mở trợ lý đặt lịch',
      child: Tooltip(
        message: 'Trợ lý đặt lịch',
        child: FloatingActionButton(
          // This button belongs to the persistent shell and is already visible
          // behind root-level detail routes. A Hero transition would therefore
          // discover the same FAB in more than one active route while popping.
          heroTag: null,
          mini: true,
          onPressed: onPressed,
          backgroundColor: AppTheme.primaryDark,
          foregroundColor: Colors.white,
          elevation: 6,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              const Center(child: Icon(Icons.smart_toy_rounded, size: 23)),
              Positioned(
                right: -7,
                top: -7,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppTheme.warmSignal,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  child: const Text(
                    'AI',
                    style: TextStyle(
                      color: AppTheme.clinicalInk,
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _NavigationDestination {
  const _NavigationDestination({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    this.isPrimaryAction = false,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final bool isPrimaryAction;
}
