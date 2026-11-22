import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/config/app_brand.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/widgets/app_motion.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:url_launcher/url_launcher.dart';

typedef _Service = ({
  String label,
  IconData icon,
  void Function(BuildContext) open,
});

typedef _Group = ({String title, List<_Service> items});

void _web(String path) => unawaited(
  launchUrl(
    Uri.parse('${AppBrand.webUrl}$path'),
    mode: LaunchMode.externalApplication,
  ),
);

final List<_Group> _groups = [
  (
    title: 'Đặt lịch',
    items: <_Service>[
      (
        label: 'Đặt lịch ngay',
        icon: Icons.event_available_outlined,
        open: (c) => c.go('/booking'),
      ),
      (
        label: 'Chuyên khoa',
        icon: Icons.medical_services_outlined,
        open: (c) => unawaited(c.push<void>('/departments')),
      ),
      (
        label: 'Bác sĩ',
        icon: Icons.groups_2_outlined,
        open: (c) => unawaited(c.push<void>('/doctors')),
      ),
      (
        label: 'Gói khám',
        icon: Icons.inventory_2_outlined,
        open: (c) => unawaited(c.push<void>('/packages')),
      ),
    ],
  ),
  (
    title: 'Hồ sơ của tôi',
    items: <_Service>[
      (
        label: 'Lịch hẹn',
        icon: Icons.calendar_month_outlined,
        open: (c) => c.go('/appointments'),
      ),
      (
        label: 'Kết quả khám',
        icon: Icons.folder_shared_outlined,
        open: (c) => unawaited(c.push<void>('/medical-records')),
      ),
      (
        label: 'Đơn thuốc',
        icon: Icons.medication_outlined,
        open: (c) => unawaited(c.push<void>('/prescriptions')),
      ),
      (
        label: 'Hóa đơn',
        icon: Icons.receipt_long_outlined,
        open: (c) => unawaited(c.push<void>('/invoices')),
      ),
      (
        label: 'Người thân',
        icon: Icons.family_restroom_outlined,
        open: (c) => unawaited(c.push<void>('/dependents')),
      ),
      (
        label: 'Thẻ số',
        icon: Icons.qr_code_2_rounded,
        open: (c) => unawaited(c.push<void>('/mobile-tools')),
      ),
    ],
  ),
  (
    title: 'Thông tin',
    items: <_Service>[
      (
        label: 'Kiến thức',
        icon: Icons.menu_book_outlined,
        open: (_) => _web('/kien-thuc'),
      ),
      (
        label: 'Hỏi Kun',
        icon: Icons.auto_awesome_outlined,
        open: (c) => unawaited(c.push<void>('/chatbot')),
      ),
      (
        label: 'Hỗ trợ',
        icon: Icons.support_agent_rounded,
        open: (c) => unawaited(c.push<void>('/support')),
      ),
      (
        label: 'Điều khoản',
        icon: Icons.description_outlined,
        open: (_) => _web('/dieu-khoan'),
      ),
      (
        label: 'Bảo mật',
        icon: Icons.privacy_tip_outlined,
        open: (_) => _web('/chinh-sach-bao-mat'),
      ),
    ],
  ),
];

/// Trang Tất cả dịch vụ (tab Dịch vụ): ô tìm, tab theo nhóm, lưới biểu tượng. Gõ vào ô tìm thì hiện kết quả của mọi nhóm.
class ServicesHubScreen extends StatefulWidget {
  const ServicesHubScreen({super.key});

  @override
  State<ServicesHubScreen> createState() => _ServicesHubScreenState();
}

class _ServicesHubScreenState extends State<ServicesHubScreen> {
  String _query = '';

  List<_Service> get _matches {
    final q = _query.trim().toLowerCase();
    return [
      for (final group in _groups)
        for (final item in group.items)
          if (item.label.toLowerCase().contains(q)) item,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final searching = _query.trim().isNotEmpty;
    return DefaultTabController(
      length: _groups.length,
      child: Scaffold(
        backgroundColor: colors.canvas,
        appBar: AppBar(
          title: const Text('Tất cả dịch vụ'),
          automaticallyImplyLeading: false,
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
              child: TextField(
                key: const Key('services-search'),
                onChanged: (value) => setState(() => _query = value),
                decoration: InputDecoration(
                  hintText: 'Tìm dịch vụ',
                  prefixIcon: const Icon(Icons.search_rounded, size: 20),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    borderSide: BorderSide(color: colors.border, width: 0.5),
                  ),
                ),
              ),
            ),
            if (!searching)
              TabBar(
                tabAlignment: TabAlignment.start,
                isScrollable: true,
                labelColor: colors.ink,
                unselectedLabelColor: colors.muted,
                indicatorColor: colors.primary,
                dividerColor: colors.border,
                labelStyle: Theme.of(context).textTheme.labelLarge,
                tabs: [for (final group in _groups) Tab(text: group.title)],
              ),
            Expanded(
              child: searching
                  ? _ServiceGrid(
                      items: _matches,
                      emptyText: 'Không có dịch vụ phù hợp',
                    )
                  : TabBarView(
                      children: [
                        for (final group in _groups)
                          _ServiceGrid(items: group.items),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceGrid extends StatelessWidget {
  const _ServiceGrid({required this.items, this.emptyText});

  final List<_Service> items;
  final String? emptyText;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(
        child: Text(
          emptyText ?? '',
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: context.colors.muted),
        ),
      );
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, appMainContentBottomInset),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: context.colors.border, width: 0.5),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
          child: Wrap(
            runSpacing: 14,
            children: [
              for (final (index, item) in items.indexed)
                FractionallySizedBox(
                  widthFactor: 0.25,
                  child: FadeSlideIn(
                    order: index,
                    child: _ServiceTile(item: item),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({required this.item});

  final _Service item;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: item.label,
    excludeSemantics: true,
    child: PressScale(
      child: InkWell(
        onTap: () => item.open(context),
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: context.colors.primarySoft,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(item.icon, color: context.colors.primary, size: 24),
              ),
              const SizedBox(height: 6),
              Text(
                item.label,
                maxLines: 2,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: context.colors.textSoft,
                  height: 1.2,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
