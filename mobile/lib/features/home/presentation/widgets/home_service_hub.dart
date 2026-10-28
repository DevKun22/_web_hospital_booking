import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';

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
    final visibleServices = _primaryServices;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Dịch vụ chăm sóc',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
            ),
            TextButton(
              key: const Key('home-all-services-button'),
              onPressed: () => _showAllServices(context),
              child: const Text('Tất cả'),
            ),
          ],
        ),
        const SizedBox(height: 4),
        GridView.builder(
          shrinkWrap: true,
          primary: false,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: visibleServices.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            mainAxisExtent: 110,
          ),
          itemBuilder: (context, index) {
            final service = visibleServices[index];
            final palette = _servicePalettes[index % _servicePalettes.length];
            return _ServiceTile(
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

  String? _accessStatus(_HomeService service) {
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
        child: _AllServicesSheet(
          accessStatus: _accessStatus,
          onSelected: (service) {
            Navigator.of(sheetContext).pop();
            _openService(context, service);
          },
        ),
      ),
    );
  }

  void _openService(BuildContext context, _HomeService service) {
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

class _AllServicesSheet extends StatelessWidget {
  const _AllServicesSheet({
    required this.accessStatus,
    required this.onSelected,
  });

  final String? Function(_HomeService service) accessStatus;
  final ValueChanged<_HomeService> onSelected;

  @override
  Widget build(BuildContext context) => Material(
    color: Theme.of(context).colorScheme.surface,
    borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
    clipBehavior: Clip.antiAlias,
    child: Column(
      children: [
        const SizedBox(height: 10),
        Container(
          width: 42,
          height: 4,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.outlineVariant,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 8, 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tất cả dịch vụ',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Các tiện ích đang có sẵn trong hệ thống',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                tooltip: 'Đóng',
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              for (final section in _serviceSections) ...[
                _ServiceSection(
                  section: section,
                  accessStatus: accessStatus,
                  onSelected: onSelected,
                ),
                if (section != _serviceSections.last)
                  const SizedBox(height: 22),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}

class _ServiceSection extends StatelessWidget {
  const _ServiceSection({
    required this.section,
    required this.accessStatus,
    required this.onSelected,
  });

  final _HomeServiceSection section;
  final String? Function(_HomeService service) accessStatus;
  final ValueChanged<_HomeService> onSelected;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        section.title,
        style: Theme.of(
          context,
        ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 10),
      DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: AppTheme.softBorder),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            for (var index = 0; index < section.services.length; index++) ...[
              _ServiceListTile(
                service: section.services[index],
                statusLabel: accessStatus(section.services[index]),
                onTap: () => onSelected(section.services[index]),
              ),
              if (index < section.services.length - 1)
                const Divider(height: 1, indent: 66),
            ],
          ],
        ),
      ),
    ],
  );
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({
    required this.icon,
    required this.label,
    required this.statusLabel,
    required this.backgroundColor,
    required this.foregroundColor,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String? statusLabel;
  final Color backgroundColor;
  final Color foregroundColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    borderRadius: BorderRadius.circular(16),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 5, 4, 3),
        child: Column(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: backgroundColor,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, size: 24, color: foregroundColor),
            ),
            const SizedBox(height: 7),
            Expanded(
              child: Center(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            if (statusLabel != null) ...[
              const SizedBox(height: 1),
              Text(
                statusLabel!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 10,
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _ServiceListTile extends StatelessWidget {
  const _ServiceListTile({
    required this.service,
    required this.statusLabel,
    required this.onTap,
  });

  final _HomeService service;
  final String? statusLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    onTap: onTap,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    leading: Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(13),
      ),
      child: Icon(
        service.icon,
        size: 21,
        color: Theme.of(context).colorScheme.primary,
      ),
    ),
    title: Text(
      service.label,
      style: Theme.of(
        context,
      ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
    ),
    subtitle: Text(service.description),
    trailing: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (statusLabel != null)
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Text(
              statusLabel!,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        const Icon(Icons.chevron_right_rounded),
      ],
    ),
  );
}

class _HomeService {
  const _HomeService({
    required this.shortLabel,
    required this.label,
    required this.description,
    required this.icon,
    required this.location,
    this.requiresAccount = false,
    this.opensMainBranch = false,
  });

  final String shortLabel;
  final String label;
  final String description;
  final IconData icon;
  final String location;
  final bool requiresAccount;
  final bool opensMainBranch;
}

class _HomeServiceSection {
  const _HomeServiceSection({required this.title, required this.services});

  final String title;
  final List<_HomeService> services;
}

const _bookingService = _HomeService(
  shortLabel: 'Khám theo bác sĩ',
  label: 'Đặt lịch khám',
  description: 'Chọn bác sĩ, chuyên khoa hoặc gói khám',
  icon: Icons.calendar_month_outlined,
  location: '/booking',
  opensMainBranch: true,
);

const _appointmentsService = _HomeService(
  shortLabel: 'Tra cứu lịch hẹn',
  label: 'Lịch khám của tôi',
  description: 'Theo dõi lịch sắp tới và lịch sử khám',
  icon: Icons.event_note_outlined,
  location: '/appointments',
  requiresAccount: true,
);

const _recordsService = _HomeService(
  shortLabel: 'Kết quả khám',
  label: 'Kết quả khám',
  description: 'Xem hồ sơ và kết quả đã được bệnh viện công bố',
  icon: Icons.description_outlined,
  location: '/medical-records',
  requiresAccount: true,
);

const _prescriptionsService = _HomeService(
  shortLabel: 'Đơn thuốc',
  label: 'Đơn thuốc',
  description: 'Xem thuốc và hướng dẫn sử dụng sau khám',
  icon: Icons.medication_outlined,
  location: '/prescriptions',
  requiresAccount: true,
);

const _invoicesService = _HomeService(
  shortLabel: 'Hóa đơn',
  label: 'Hóa đơn',
  description: 'Kiểm tra chi phí và trạng thái thanh toán',
  icon: Icons.receipt_long_outlined,
  location: '/invoices',
  requiresAccount: true,
);

const _healthHubService = _HomeService(
  shortLabel: 'Kết quả & đơn thuốc',
  label: 'Tổng quan hồ sơ',
  description: 'Một nơi cho kết quả khám, đơn thuốc và hóa đơn',
  icon: Icons.health_and_safety_outlined,
  location: '/records',
  requiresAccount: true,
  opensMainBranch: true,
);

const _departmentsService = _HomeService(
  shortLabel: 'Khám chuyên khoa',
  label: 'Danh sách chuyên khoa',
  description: 'Tìm đúng chuyên khoa theo nhu cầu khám',
  icon: Icons.local_hospital_outlined,
  location: '/departments',
);

const _doctorsService = _HomeService(
  shortLabel: 'Tìm bác sĩ',
  label: 'Danh sách bác sĩ',
  description: 'Tìm theo tên, chuyên môn và chuyên khoa',
  icon: Icons.person_search_outlined,
  location: '/doctors',
);

const _packagesService = _HomeService(
  shortLabel: 'Gói khám sức khỏe',
  label: 'Gói khám sức khỏe',
  description: 'Khám phá các gói chăm sóc theo nhu cầu',
  icon: Icons.health_and_safety_outlined,
  location: '/packages',
);

const _chatbotService = _HomeService(
  shortLabel: 'Trợ lý sức khỏe',
  label: 'Trợ lý đặt lịch 24/7',
  description: 'Gợi ý chuyên khoa, bác sĩ và lịch trống',
  icon: Icons.smart_toy_outlined,
  location: '/chatbot',
);

const _notificationsService = _HomeService(
  shortLabel: 'Thông báo',
  label: 'Thông báo',
  description: 'Theo dõi cập nhật lịch khám và hồ sơ',
  icon: Icons.notifications_none_rounded,
  location: '/notifications',
  requiresAccount: true,
  opensMainBranch: true,
);

const _profileService = _HomeService(
  shortLabel: 'Tài khoản',
  label: 'Tài khoản',
  description: 'Quản lý thông tin bệnh nhân và phiên đăng nhập',
  icon: Icons.account_circle_outlined,
  location: '/profile',
  requiresAccount: true,
  opensMainBranch: true,
);

const _supportService = _HomeService(
  shortLabel: 'Hỗ trợ',
  label: 'Trung tâm hỗ trợ',
  description: 'Hotline, cấp cứu và hướng dẫn sử dụng dịch vụ',
  icon: Icons.support_agent_rounded,
  location: '/support',
);

const _primaryServices = <_HomeService>[
  _doctorsService,
  _departmentsService,
  _packagesService,
  _appointmentsService,
  _healthHubService,
  _supportService,
];

const _servicePalettes = <({Color background, Color foreground})>[
  (background: Color(0xFFBFF3E8), foreground: Color(0xFF087A73)),
  (background: Color(0xFFDCEEFF), foreground: Color(0xFF236A9B)),
  (background: Color(0xFFDDF3EE), foreground: Color(0xFF087A73)),
  (background: Color(0xFFFFE7C2), foreground: Color(0xFF9B5B00)),
  (background: Color(0xFFE8EEF8), foreground: Color(0xFF334F70)),
  (background: Color(0xFFFFDADB), foreground: Color(0xFF9F3039)),
];

const _serviceSections = <_HomeServiceSection>[
  _HomeServiceSection(
    title: 'Khám & dịch vụ',
    services: [
      _bookingService,
      _doctorsService,
      _departmentsService,
      _packagesService,
      _chatbotService,
    ],
  ),
  _HomeServiceSection(
    title: 'Hồ sơ sức khỏe',
    services: [
      _healthHubService,
      _appointmentsService,
      _recordsService,
      _prescriptionsService,
      _invoicesService,
    ],
  ),
  _HomeServiceSection(
    title: 'Tài khoản & hỗ trợ',
    services: [_supportService, _notificationsService, _profileService],
  ),
];
