import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/navigation/booking_navigation.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/home/application/home_content_controller.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';
import 'package:hospital_booking_mobile/features/support/application/support_action_launcher.dart';

class SupportCenterScreen extends ConsumerWidget {
  const SupportCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final homeState = ref.watch(homeContentControllerProvider);
    final content = homeState.content;

    return Scaffold(
      appBar: AppBar(title: const Text('Trung tâm hỗ trợ')),
      body: RefreshIndicator(
        onRefresh: ref.read(homeContentControllerProvider.notifier).refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            const _SupportIntro(),
            if (homeState.error != null) ...[
              const SizedBox(height: 12),
              AppErrorBanner(
                error: homeState.error!,
                onDismiss: ref
                    .read(homeContentControllerProvider.notifier)
                    .dismissError,
              ),
            ],
            const SizedBox(height: 16),
            _EmergencySupportCard(
              phoneNumber: content?.siteSettings.emergencyHotline,
              onCall: (number) => _confirmAndOpenDialer(
                context,
                ref,
                phoneNumber: number,
                isEmergency: true,
              ),
            ),
            const SizedBox(height: 20),
            const AppSectionHeader(title: 'Hỗ trợ nhanh'),
            const SizedBox(height: 8),
            _SupportOptions(
              hotline: content?.siteSettings.hotline,
              address: content?.siteSettings.address,
              workingHours: content?.siteSettings.workingHours,
              mapUrl: content?.siteSettings.mapUrl,
              onCall: (number) => _confirmAndOpenDialer(
                context,
                ref,
                phoneNumber: number,
                isEmergency: false,
              ),
              onOpenMap: () => _openMap(
                context,
                ref,
                mapUrl: content?.siteSettings.mapUrl,
                address: content?.siteSettings.address,
              ),
            ),
            const SizedBox(height: 20),
            AppSectionHeader(
              title: 'Câu hỏi thường gặp',
              actionLabel: content == null ? 'Tải lại' : null,
              onAction: content == null
                  ? ref.read(homeContentControllerProvider.notifier).refresh
                  : null,
            ),
            const SizedBox(height: 8),
            _FaqSection(
              items: content?.faqs ?? const [],
              isLoading: homeState.isInitialLoading,
            ),
            const SizedBox(height: 18),
            const _MedicalDisclaimer(),
          ],
        ),
      ),
    );
  }

  Future<void> _openMap(
    BuildContext context,
    WidgetRef ref, {
    String? mapUrl,
    String? address,
  }) async {
    var opened = false;
    try {
      opened = await ref
          .read(hospitalLocationLauncherProvider)
          .openLocation(mapUrl: mapUrl, address: address);
    } catch (_) {
      opened = false;
    }
    if (!context.mounted || opened) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(content: Text('Chưa thể mở bản đồ trên thiết bị này.')),
      );
  }

  Future<void> _confirmAndOpenDialer(
    BuildContext context,
    WidgetRef ref, {
    required String phoneNumber,
    required bool isEmergency,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: Icon(
          isEmergency ? Icons.emergency_rounded : Icons.phone_in_talk_rounded,
          color: isEmergency ? const Color(0xFFB64048) : AppTheme.primary,
        ),
        title: Text(isEmergency ? 'Gọi cấp cứu?' : 'Gọi bệnh viện?'),
        content: Text(
          isEmergency
              ? 'Ứng dụng sẽ mở trình quay số với số $phoneNumber. Chỉ sử dụng khi cần hỗ trợ khẩn cấp.'
              : 'Ứng dụng sẽ mở trình quay số với số $phoneNumber để bạn xác nhận cuộc gọi.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Hủy'),
          ),
          FilledButton.icon(
            key: const Key('support-confirm-call-button'),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            icon: const Icon(Icons.phone_rounded),
            label: const Text('Mở trình gọi'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    bool opened;
    try {
      opened = await ref
          .read(supportActionLauncherProvider)
          .openPhoneDialer(phoneNumber);
    } catch (_) {
      opened = false;
    }
    if (!context.mounted || opened) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text(
            'Không thể mở trình gọi trên thiết bị này. Vui lòng nhập số thủ công.',
          ),
        ),
      );
  }
}

class _SupportIntro extends StatelessWidget {
  const _SupportIntro();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppTheme.primaryDark, AppTheme.primary],
      ),
      borderRadius: BorderRadius.circular(22),
    ),
    child: Row(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(17),
          ),
          child: const Icon(
            Icons.support_agent_rounded,
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
                'Bạn cần hỗ trợ gì?',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Chọn đúng kênh để được hỗ trợ nhanh và an toàn.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xDFFFFFFF),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _EmergencySupportCard extends StatelessWidget {
  const _EmergencySupportCard({
    required this.phoneNumber,
    required this.onCall,
  });

  final String? phoneNumber;
  final ValueChanged<String> onCall;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('support-emergency-card'),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFFFCEBED),
      border: Border.all(color: const Color(0xFFF2C9CD)),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const CircleAvatar(
              backgroundColor: Color(0xFFB64048),
              foregroundColor: Colors.white,
              child: Icon(Icons.emergency_rounded),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Cấp cứu khẩn cấp 24/7',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    phoneNumber ?? 'Chưa có số cấp cứu',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: const Color(0xFFB64048),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          'Nếu người bệnh khó thở, bất tỉnh hoặc có dấu hiệu nguy hiểm, hãy liên hệ cấp cứu ngay.',
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          key: const Key('support-emergency-call-button'),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFB64048),
          ),
          onPressed: phoneNumber == null ? null : () => onCall(phoneNumber!),
          icon: const Icon(Icons.phone_in_talk_rounded),
          label: const Text('Mở trình gọi cấp cứu'),
        ),
      ],
    ),
  );
}

class _SupportOptions extends StatelessWidget {
  const _SupportOptions({
    required this.hotline,
    required this.address,
    required this.workingHours,
    required this.mapUrl,
    required this.onCall,
    required this.onOpenMap,
  });

  final String? hotline;
  final String? address;
  final String? workingHours;
  final String? mapUrl;
  final ValueChanged<String> onCall;
  final VoidCallback onOpenMap;

  @override
  Widget build(BuildContext context) {
    final locationDetails = [
      address,
      workingHours,
    ].whereType<String>().join(' · ');
    return Card(
      margin: EdgeInsets.zero,
      child: Column(
        children: [
          _SupportOptionTile(
            key: const Key('support-hotline-option'),
            icon: Icons.phone_in_talk_outlined,
            title: 'Tổng đài bệnh viện',
            subtitle: hotline ?? 'Chưa có số tổng đài',
            onTap: hotline == null ? null : () => onCall(hotline!),
          ),
        if (mapUrl != null || address != null) ...[
          const Divider(height: 1, indent: 68),
          _SupportOptionTile(
            key: const Key('support-location-option'),
            icon: Icons.map_outlined,
            title: 'Đường đến bệnh viện',
            subtitle: locationDetails.isEmpty
                ? 'Mở vị trí bệnh viện'
                : locationDetails,
            onTap: onOpenMap,
          ),
        ],
          const Divider(height: 1, indent: 68),
          _SupportOptionTile(
            key: const Key('support-chatbot-option'),
            icon: Icons.smart_toy_outlined,
            title: 'Trợ lý đặt lịch 24/7',
            subtitle: 'Tìm chuyên khoa, bác sĩ và lịch trống',
            onTap: () => context.push('/chatbot'),
          ),
          const Divider(height: 1, indent: 68),
          _SupportOptionTile(
            key: const Key('support-booking-option'),
            icon: Icons.calendar_month_outlined,
            title: 'Đặt lịch khám',
            subtitle: 'Chọn lịch khám phù hợp với nhu cầu',
            onTap: () => openBookingFromCurrentRoute(context, '/booking'),
          ),
        ],
      ),
    );
  }
}

class _SupportOptionTile extends StatelessWidget {
  const _SupportOptionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    super.key,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => ListTile(
    onTap: onTap,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
    leading: Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(icon, color: AppTheme.primary),
    ),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
    subtitle: Text(subtitle),
    trailing: onTap == null
        ? const Icon(Icons.info_outline_rounded)
        : const Icon(Icons.chevron_right_rounded),
  );
}

class _FaqSection extends StatelessWidget {
  const _FaqSection({required this.items, required this.isLoading});

  final List<HomeFaq> items;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    if (isLoading && items.isEmpty) {
      return const AppLoadingSkeleton(height: 140);
    }
    if (items.isEmpty) {
      return const AppEmptyState(
        icon: Icons.help_outline_rounded,
        title: 'Chưa có câu hỏi hướng dẫn',
        message: 'Kéo xuống để tải lại nội dung hỗ trợ từ bệnh viện.',
      );
    }

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          children: [
            for (var index = 0; index < items.length; index++) ...[
              ExpansionTile(
                key: ValueKey('support-faq-${items[index].id}'),
                shape: const Border(),
                collapsedShape: const Border(),
                title: Text(
                  items[index].question,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                expandedCrossAxisAlignment: CrossAxisAlignment.start,
                children: [Text(items[index].answer)],
              ),
              if (index < items.length - 1)
                const Divider(height: 1, indent: 16, endIndent: 16),
            ],
          ],
        ),
      ),
    );
  }
}

class _MedicalDisclaimer extends StatelessWidget {
  const _MedicalDisclaimer();

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(
        Icons.verified_user_outlined,
        size: 18,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          'Trợ lý và nội dung hướng dẫn không thay thế chẩn đoán y khoa. Với tình trạng khẩn cấp, hãy gọi cấp cứu.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    ],
  );
}
