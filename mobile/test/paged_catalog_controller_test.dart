import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/catalog/application/paged_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_page.dart';

/// Danh mục giả: trang 2 lặp lại mục cuối của trang 1 (danh mục vừa có mục mới chen lên đầu giữa hai lần tải).
class _ShiftingCatalog extends PagedCatalogController<String, int> {
  @override
  int get initialFilter => 0;

  @override
  String idOf(String item) => item;

  @override
  Future<CatalogPage<String>> fetchPage({
    required String query,
    required int filter,
    required int page,
  }) async => CatalogPage(
    items: page == 1 ? const ['a', 'b'] : const ['b', 'c'],
    page: page,
    limit: 2,
    total: 3,
    totalPages: 2,
  );
}

final _provider =
    NotifierProvider<_ShiftingCatalog, PagedCatalogState<String, int>>(
      _ShiftingCatalog.new,
    );

void main() {
  test('tải thêm không hiện một mục hai lần', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final controller = container.read(_provider.notifier);

    await controller.load();
    await controller.loadMore();

    expect(container.read(_provider).items, ['a', 'b', 'c']);
  });
}
