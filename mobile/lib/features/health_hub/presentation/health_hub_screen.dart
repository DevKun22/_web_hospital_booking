import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/health_hub/application/health_hub_summary.dart';

class HealthHubScreen extends ConsumerWidget {
  const HealthHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(healthHubSummaryProvider);
    final destinations = <_HealthDestination>[
      _HealthDestination(
        title: 'Lịch khám',
        description: 'Theo dõi lịch sắp tới và lịch sử khám',
        icon: Icons.calendar_month_outlined,
        location: '/appointments',
        count: summary.appointments,
      ),
      _HealthDestination(
        title: 'Kết quả khám',
        description: 'Xem hồ sơ và kết quả đã được công bố',
        icon: Icons.folder_shared_outlined,
        location: '/medical-records',
        count: summary.medicalRecords,
      ),
      _HealthDestination(
        title: 'Đơn thuốc',
        description: 'Tra cứu hướng dẫn dùng thuốc sau buổi khám',
        icon: Icons.medication_outlined,
        location: '/prescriptions',
        count: summary.prescriptions,
      ),
      _HealthDestination(
        title: 'Hóa đơn',
        description: 'Kiểm tra chi phí và trạng thái thanh toán',
        icon: Icons.receipt_long_outlined,
        location: '/invoices',
        count: summary.invoices,
      ),
      _HealthDestination(
        title: 'Hồ sơ người thân',
        description: 'Quản lý thông tin người thân để đặt lịch nhanh hơn',
        icon: Icons.family_restroom_outlined,
        location: '/dependents',
        count: summary.dependents,
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ sức khỏe')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            16,
            8,
            16,
            appFloatingActionContentBottomInset,
          ),
          children: [
            const _PrivacyHeader(),
            const SizedBox(height: 20),
            const AppPageIntro(
              title: 'Thông tin của tôi',
              subtitle:
                  'Dữ liệu được đồng bộ từ quá trình đặt lịch và khám bệnh.',
            ),
            const SizedBox(height: 14),
            ...destinations.map(
              (destination) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _HealthDestinationCard(
                  destination: destination,
                  onTap: () => context.push(destination.location),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrivacyHeader extends StatelessWidget {
  const _PrivacyHeader();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppTheme.primaryDark, AppTheme.primary],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(22),
    ),
    child: Row(
      children: [
        Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(17),
          ),
          child: const Icon(
            Icons.health_and_safety_outlined,
            color: Colors.white,
            size: 28,
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Dữ liệu y tế của bạn',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Chỉ hiển thị sau khi xác thực đúng tài khoản bệnh nhân.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.86),
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _HealthDestinationCard extends StatelessWidget {
  const _HealthDestinationCard({
    required this.destination,
    required this.onTap,
  });

  final _HealthDestination destination;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => AppSurfaceCard(
    onTap: onTap,
    semanticLabel: '${destination.title}. ${destination.description}',
    child: Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(15),
          ),
          child: Icon(
            destination.icon,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                destination.title,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 3),
              Text(
                destination.description,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        _HealthCountBadge(count: destination.count),
        const SizedBox(width: 4),
        const Icon(Icons.chevron_right_rounded),
      ],
    ),
  );
}

class _HealthCountBadge extends StatelessWidget {
  const _HealthCountBadge({required this.count});

  final HealthHubCount count;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 36,
    child: count.isLoading
        ? const Center(
            child: SizedBox.square(
              dimension: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          )
        : Text(
            count.value > 99 ? '99+' : '${count.value}',
            textAlign: TextAlign.center,
            semanticsLabel: '${count.value} mục',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
  );
}

class _HealthDestination {
  const _HealthDestination({
    required this.title,
    required this.description,
    required this.icon,
    required this.location,
    required this.count,
  });

  final String title;
  final String description;
  final IconData icon;
  final String location;
  final HealthHubCount count;
}
