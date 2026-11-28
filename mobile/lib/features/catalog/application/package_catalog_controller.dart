import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/catalog/application/doctor_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/catalog/application/paged_catalog_controller.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_page.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

enum PackageCatalogFilter { all, popular, bhyt }

typedef PackageCatalogState =
    PagedCatalogState<MedicalPackage, PackageCatalogFilter>;

final packageCatalogControllerProvider =
    NotifierProvider<PackageCatalogController, PackageCatalogState>(
      PackageCatalogController.new,
    );

class PackageCatalogController
    extends PagedCatalogController<MedicalPackage, PackageCatalogFilter> {
  @override
  PackageCatalogFilter get initialFilter => PackageCatalogFilter.all;

  @override
  String idOf(MedicalPackage item) => item.id;

  @override
  Future<CatalogPage<MedicalPackage>> fetchPage({
    required String query,
    required PackageCatalogFilter filter,
    required int page,
  }) => ref
      .read(catalogRepositoryProvider)
      .fetchPackages(
        search: query,
        isPopular: filter == PackageCatalogFilter.popular ? true : null,
        isBhytSupport: filter == PackageCatalogFilter.bhyt ? true : null,
        page: page,
      );
}
