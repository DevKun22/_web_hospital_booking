import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';

class MainNavigationShell extends StatelessWidget {
  const MainNavigationShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: navigationShell,
    bottomNavigationBar: SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: _FloatingNavigationBar(
        currentIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          );
        },
      ),
    ),
  );
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
