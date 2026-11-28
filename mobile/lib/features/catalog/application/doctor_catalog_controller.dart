import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/catalog/application/paged_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/catalog/data/catalog_repository.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_page.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>(
  (ref) => CatalogRepository(ref.watch(authDioProvider)),
);

/// Lọc bác sĩ theo khoa; `departmentId` rỗng là tất cả các khoa.
class DoctorCatalogFilter {
  const DoctorCatalogFilter({this.departmentId});

  final String? departmentId;
}

typedef DoctorCatalogState =
    PagedCatalogState<CatalogDoctor, DoctorCatalogFilter>;

final doctorCatalogControllerProvider =
    NotifierProvider<DoctorCatalogController, DoctorCatalogState>(
      DoctorCatalogController.new,
    );

class DoctorCatalogController
    extends PagedCatalogController<CatalogDoctor, DoctorCatalogFilter> {
  @override
  DoctorCatalogFilter get initialFilter => const DoctorCatalogFilter();

  @override
  String idOf(CatalogDoctor item) => item.id;

  @override
  Future<CatalogPage<CatalogDoctor>> fetchPage({
    required String query,
    required DoctorCatalogFilter filter,
    required int page,
  }) => ref
      .read(catalogRepositoryProvider)
      .fetchDoctors(
        search: query,
        departmentId: filter.departmentId,
        page: page,
      );
}

/// Khoa làm chip lọc ở danh sách bác sĩ: lấy trang đầu theo mức thường đặt để dải chip
/// không phình theo số khoa.
final doctorFilterDepartmentsProvider = FutureProvider.autoDispose(
  (ref) async =>
      (await ref
              .watch(catalogRepositoryProvider)
              .fetchDepartmentCatalog(limit: 12))
          .items,
);
