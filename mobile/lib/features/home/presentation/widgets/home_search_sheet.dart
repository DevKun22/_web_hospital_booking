import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/home/data/home_search_history_store.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_content.dart';
import 'package:hospital_booking_mobile/features/home/domain/home_search_history_entry.dart';

void showHomeSearch(
  BuildContext context,
  HomeContent content,
  HomeSearchHistoryStore historyStore,
) {
  showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    useSafeArea: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => FractionallySizedBox(
      heightFactor: 0.88,
      child: _HomeSearchSheet(
        content: content,
        historyStore: historyStore,
        onSelected: (location) {
          Navigator.of(sheetContext).pop();
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) context.push(location);
          });
        },
      ),
    ),
  );
}

class _HomeSearchSheet extends StatefulWidget {
  const _HomeSearchSheet({
    required this.content,
    required this.historyStore,
    required this.onSelected,
  });

  final HomeContent content;
  final HomeSearchHistoryStore historyStore;
  final ValueChanged<String> onSelected;

  @override
  State<_HomeSearchSheet> createState() => _HomeSearchSheetState();
}

class _HomeSearchSheetState extends State<_HomeSearchSheet> {
  String _query = '';
  List<HomeSearchHistoryEntry> _recent = const [];

  @override
  void initState() {
    super.initState();
    unawaited(_loadRecent());
  }

  List<_HomeSearchResult> get _results {
    final results = <_HomeSearchResult>[
      for (final item in widget.content.departments)
        _HomeSearchResult(
          title: item.name,
          subtitle: 'Chuyên khoa',
          icon: Icons.local_hospital_outlined,
          kind: HomeSearchHistoryKind.department,
          location: '/departments/${Uri.encodeComponent(item.id)}',
        ),
      for (final item in widget.content.doctors)
        _HomeSearchResult(
          title: item.displayName,
          subtitle: item.specialization ?? item.departmentName,
          icon: Icons.person_search_outlined,
          kind: HomeSearchHistoryKind.doctor,
          location: '/doctors/${Uri.encodeComponent(item.id)}',
        ),
      for (final item in widget.content.packages)
        _HomeSearchResult(
          title: item.name,
          subtitle: 'Gói khám • ${formatVnd(item.finalPrice)}',
          icon: Icons.health_and_safety_outlined,
          kind: HomeSearchHistoryKind.medicalPackage,
          location: item.slug == null
              ? '/booking?packageId=${Uri.encodeQueryComponent(item.id)}'
              : '/packages/${Uri.encodeComponent(item.slug!)}',
        ),
    ];
    final normalized = _query.trim().toLowerCase();
    if (normalized.isEmpty) return results.take(10).toList(growable: false);
    final matches = results
        .where(
          (item) =>
              item.title.toLowerCase().contains(normalized) ||
              item.subtitle.toLowerCase().contains(normalized),
        )
        .toList(growable: false);
    final encoded = Uri.encodeQueryComponent(_query.trim());
    return [
      ...matches,
      _HomeSearchResult(
        title: 'Tìm tất cả bác sĩ',
        subtitle: 'Kết quả đầy đủ cho “${_query.trim()}”',
        icon: Icons.manage_search_rounded,
        kind: HomeSearchHistoryKind.doctor,
        location: '/doctors?search=$encoded',
      ),
      _HomeSearchResult(
        title: 'Tìm tất cả gói khám',
        subtitle: 'Kết quả đầy đủ cho “${_query.trim()}”',
        icon: Icons.manage_search_rounded,
        kind: HomeSearchHistoryKind.medicalPackage,
        location: '/packages?search=$encoded',
      ),
    ];
  }

  Future<void> _loadRecent() async {
    try {
      final items = await widget.historyStore.read();
      if (mounted) setState(() => _recent = items);
    } catch (_) {
      // Search remains fully usable when local preferences are unavailable.
    }
  }

  Future<void> _select(_HomeSearchResult item) async {
    try {
      await widget.historyStore.remember(item.toHistoryEntry());
    } catch (_) {
      // Local history is optional and must never block navigation.
    }
    if (mounted) widget.onSelected(item.location);
  }

  Future<void> _clearRecent() async {
    try {
      await widget.historyStore.clear();
    } catch (_) {
      // Still clear the in-memory view for the current search session.
    }
    if (mounted) setState(() => _recent = const []);
  }

  @override
  Widget build(BuildContext context) {
    final results = _results;
    return Material(
      color: Colors.white,
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
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Tìm dịch vụ chăm sóc',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: AppPalette.publicInk,
                      fontWeight: FontWeight.w900,
                    ),
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
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TextField(
              key: const Key('home-search-field'),
              autofocus: true,
              onChanged: (value) => setState(() => _query = value),
              cursorColor: AppPalette.clinicalBlue,
              decoration: InputDecoration(
                hintText: 'Tên bác sĩ, chuyên khoa hoặc gói khám',
                filled: true,
                fillColor: AppPalette.publicSurfaceMuted,
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  color: AppPalette.clinicalBlue,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: const BorderSide(color: AppPalette.publicBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide: const BorderSide(
                    color: AppPalette.clinicalBlue,
                    width: 1.8,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: results.isEmpty
                ? const AppEmptyState(
                    icon: Icons.search_off_rounded,
                    title: 'Không tìm thấy kết quả',
                    message: 'Thử từ khóa ngắn hơn hoặc chọn một dịch vụ khác.',
                  )
                : ListView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                    children: [
                      if (_query.trim().isEmpty && _recent.isNotEmpty) ...[
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Tìm gần đây',
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                            ),
                            TextButton(
                              key: const Key('home-search-clear-recent'),
                              onPressed: _clearRecent,
                              child: const Text('Xóa'),
                            ),
                          ],
                        ),
                        for (final item in _recent)
                          _HomeSearchResultTile(
                            item: _HomeSearchResult.fromHistory(item),
                            isRecent: true,
                            onTap: _select,
                          ),
                        const Padding(
                          padding: EdgeInsets.only(top: 12, bottom: 6),
                          child: Text(
                            'Gợi ý dịch vụ',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                      for (final item in results)
                        _HomeSearchResultTile(item: item, onTap: _select),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _HomeSearchResult {
  const _HomeSearchResult({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.kind,
    required this.location,
  });

  factory _HomeSearchResult.fromHistory(HomeSearchHistoryEntry entry) =>
      _HomeSearchResult(
        title: entry.title,
        subtitle: entry.subtitle,
        icon: switch (entry.kind) {
          HomeSearchHistoryKind.department => Icons.local_hospital_outlined,
          HomeSearchHistoryKind.doctor => Icons.person_search_outlined,
          HomeSearchHistoryKind.medicalPackage =>
            Icons.health_and_safety_outlined,
        },
        kind: entry.kind,
        location: entry.location,
      );

  final String title;
  final String subtitle;
  final IconData icon;
  final HomeSearchHistoryKind kind;
  final String location;

  HomeSearchHistoryEntry toHistoryEntry() => HomeSearchHistoryEntry(
    title: title,
    subtitle: subtitle,
    location: location,
    kind: kind,
  );
}

class _HomeSearchResultTile extends StatelessWidget {
  const _HomeSearchResultTile({
    required this.item,
    required this.onTap,
    this.isRecent = false,
  });

  final _HomeSearchResult item;
  final ValueChanged<_HomeSearchResult> onTap;
  final bool isRecent;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      ListTile(
        key: ValueKey(
          '${isRecent ? 'home-search-recent' : 'home-search-result'}-${item.location}',
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
        onTap: () => onTap(item),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: AppPalette.clinicalBlueContainer,
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(
            isRecent ? Icons.history_rounded : item.icon,
            color: AppPalette.clinicalBlue,
          ),
        ),
        title: Text(
          item.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          item.subtitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: const Icon(
          Icons.chevron_right_rounded,
          color: AppPalette.clinicalBlue,
        ),
      ),
      const Divider(height: 1),
    ],
  );
}
