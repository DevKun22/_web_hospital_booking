import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/widgets/app_route_back_scope.dart';

/// Shared frame for searchable/paginated catalogs.
///
/// Feature screens still own state and API calls; this widget only standardizes
/// navigation, pull-to-refresh, spacing and infinite-scroll notification.
class AppCatalogScaffold extends StatelessWidget {
  const AppCatalogScaffold({
    required this.title,
    required this.onRefresh,
    required this.children,
    super.key,
    this.pageStorageKey,
    this.onLoadMore,
    this.fallbackLocation = '/home',
  });

  final String title;
  final Future<void> Function() onRefresh;
  final List<Widget> children;
  final PageStorageKey<String>? pageStorageKey;
  final VoidCallback? onLoadMore;
  final String fallbackLocation;

  @override
  Widget build(BuildContext context) => AppRouteBackScope(
    fallbackLocation: fallbackLocation,
    child: Scaffold(
      appBar: AppBar(
        leading: AppRouteBackButton(fallbackLocation: fallbackLocation),
        title: Text(title),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: onRefresh,
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (onLoadMore != null &&
                  notification.metrics.extentAfter < 360) {
                onLoadMore!();
              }
              return false;
            },
            child: ListView(
              key: pageStorageKey,
              physics: const AlwaysScrollableScrollPhysics(),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.page,
                AppSpacing.sm,
                AppSpacing.page,
                AppSpacing.xl,
              ),
              children: children,
            ),
          ),
        ),
      ),
    ),
  );
}
