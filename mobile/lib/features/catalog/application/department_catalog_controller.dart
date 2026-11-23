import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/catalog/application/doctor_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/catalog/application/paged_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_page.dart';

/// Cách xem danh mục chuyên khoa: thường đặt (máy chủ chấm điểm theo bác sĩ, gói, giờ trống),
/// chỉ khoa còn lịch, hoặc theo bảng chữ cái.
enum DepartmentCatalogFilter { popular, available, alphabetical }

typedef DepartmentCatalogState =
    PagedCatalogState<CatalogDepartment, DepartmentCatalogFilter>;

final departmentCatalogControllerProvider =
    NotifierProvider<DepartmentCatalogController, DepartmentCatalogState>(
      DepartmentCatalogController.new,
    );

class DepartmentCatalogController
    extends PagedCatalogController<CatalogDepartment, DepartmentCatalogFilter> {
  @override
  DepartmentCatalogFilter get initialFilter => DepartmentCatalogFilter.popular;

  @override
  Future<CatalogPage<CatalogDepartment>> fetchPage({
    required String query,
    required DepartmentCatalogFilter filter,
    required int page,
  }) => ref
      .read(catalogRepositoryProvider)
      .fetchDepartmentCatalog(
        search: query,
        availableOnly: filter == DepartmentCatalogFilter.available,
        alphabetical: filter == DepartmentCatalogFilter.alphabetical,
        page: page,
      );
}
