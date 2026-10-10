import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';

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

class MainNavigationShell extends StatelessWidget {
  const MainNavigationShell({
    required this.navigationShell,
    required this.historyController,
    super.key,
  });

  final StatefulNavigationShell navigationShell;
  final MainNavigationHistoryController historyController;

  @override
  Widget build(BuildContext context) {
    historyController.attach(navigationShell);
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(12, 0, 12, 8),
        child: _FloatingNavigationBar(
          currentIndex: navigationShell.currentIndex,
          onDestinationSelected: historyController.selectBranch,
        ),
      ),
    );
  }
}

class _FloatingNavigationBar extends StatelessWidget {
  const _FloatingNavigationBar({
    required this.currentIndex,
    required this.onDestinationSelected,
  });

  final int currentIndex;
  final ValueChanged<int> onDestinationSelected;

  static const _destinations = <_NavigationDestination>[
    _NavigationDestination(
      label: 'Trang chủ',
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_rounded,
    ),
    _NavigationDestination(
      label: 'Lịch khám',
      icon: Icons.calendar_month_outlined,
      selectedIcon: Icons.calendar_month_rounded,
    ),
    _NavigationDestination(
      label: 'Đặt khám',
      icon: Icons.add_rounded,
      selectedIcon: Icons.add_rounded,
      isPrimaryAction: true,
    ),
    _NavigationDestination(
      label: 'Trợ lý',
      icon: Icons.forum_outlined,
      selectedIcon: Icons.forum_rounded,
    ),
    _NavigationDestination(
      label: 'Tài khoản',
      icon: Icons.person_outline_rounded,
      selectedIcon: Icons.person_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    elevation: 10,
    shadowColor: AppTheme.primaryDark.withValues(alpha: 0.2),
    surfaceTintColor: Colors.transparent,
    borderRadius: BorderRadius.circular(24),
    clipBehavior: Clip.antiAlias,
    child: DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: AppTheme.softBorder),
        borderRadius: BorderRadius.circular(24),
      ),
      child: SizedBox(
        height: 72,
        child: Row(
          children: List.generate(_destinations.length, (index) {
            final destination = _destinations[index];
            return Expanded(
              child: _NavigationItem(
                destination: destination,
                selected: currentIndex == index,
                onTap: () => onDestinationSelected(index),
              ),
            );
          }),
        ),
      ),
    ),
  );
}

class _NavigationItem extends StatelessWidget {
  const _NavigationItem({
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
    final foreground = selected
        ? colorScheme.primary
        : colorScheme.onSurfaceVariant;

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
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOutCubic,
                  width: destination.isPrimaryAction ? 42 : 38,
                  height: destination.isPrimaryAction ? 36 : 30,
                  decoration: BoxDecoration(
                    color: destination.isPrimaryAction
                        ? colorScheme.primary
                        : selected
                        ? colorScheme.primaryContainer
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(
                      destination.isPrimaryAction ? 14 : 12,
                    ),
                    boxShadow: destination.isPrimaryAction
                        ? [
                            BoxShadow(
                              color: colorScheme.primary.withValues(alpha: 0.2),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                          ]
                        : null,
                  ),
                  child: AnimatedScale(
                    duration: const Duration(milliseconds: 180),
                    scale: selected ? 1 : 0.92,
                    child: Icon(
                      selected ? destination.selectedIcon : destination.icon,
                      size: destination.isPrimaryAction ? 25 : 22,
                      color: destination.isPrimaryAction
                          ? colorScheme.onPrimary
                          : foreground,
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
                    color: destination.isPrimaryAction || selected
                        ? colorScheme.primary
                        : colorScheme.onSurfaceVariant,
                    fontSize: 10.5,
                    height: 1.15,
                    fontWeight: selected || destination.isPrimaryAction
                        ? FontWeight.w700
                        : FontWeight.w500,
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
