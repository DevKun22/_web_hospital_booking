import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_service_catalog.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_service_tiles.dart';

/// Entry point for capabilities that already exist in the patient app.
///
/// Keeping the catalog here prevents Home from owning authentication and
/// navigation rules for every shortcut. New services should only be added
/// after their route and backend capability are available.
class HomeServiceHub extends StatelessWidget {
  const HomeServiceHub({
    required this.isAuthenticated,
    required this.isOfflineBrowsing,
    super.key,
  });

  final bool isAuthenticated;
  final bool isOfflineBrowsing;

  @override
  Widget build(BuildContext context) {
    final visibleServices = homePrimaryServices;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Tiện ích khám chữa bệnh',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppPalette.ink,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            TextButton(
              key: const Key('home-all-services-button'),
              onPressed: () => _showAllServices(context),
              style: TextButton.styleFrom(
                foregroundColor: AppPalette.primaryDark,
              ),
              child: const Text('Tất cả'),
            ),
          ],
        ),
        const SizedBox(height: 2),
        GridView.builder(
          shrinkWrap: true,
          primary: false,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: visibleServices.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            mainAxisSpacing: 6,
            crossAxisSpacing: 6,
            mainAxisExtent: 76,
          ),
          itemBuilder: (context, index) {
            final service = visibleServices[index];
            final palette =
                homeServicePalettes[index % homeServicePalettes.length];
            return HomeServiceTile(
              icon: service.icon,
              label: service.shortLabel,
              statusLabel: _accessStatus(service),
              backgroundColor: palette.background,
              foregroundColor: palette.foreground,
              onTap: () => _openService(context, service),
            );
          },
        ),
      ],
    );
  }

  String? _accessStatus(HomeService service) {
    if (!service.requiresAccount) return null;
    if (isOfflineBrowsing) return 'Cần mạng';
    if (!isAuthenticated) return 'Đăng nhập';
    return null;
  }

  void _showAllServices(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => FractionallySizedBox(
        heightFactor: 0.82,
        child: HomeAllServicesSheet(
          accessStatus: _accessStatus,
          onSelected: (service) {
            Navigator.of(sheetContext).pop();
            _openService(context, service);
          },
        ),
      ),
    );
  }

  void _openService(BuildContext context, HomeService service) {
    if (service.requiresAccount && isOfflineBrowsing) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text(
              'Cần kết nối mạng và khôi phục phiên để mở thông tin cá nhân.',
            ),
          ),
        );
      return;
    }

    final destination = service.requiresAccount && !isAuthenticated
        ? loginLocation(service.location)
        : service.location;
    if (service.opensMainBranch && destination == service.location) {
      context.go(destination);
      return;
    }
    context.push(destination);
  }
}
