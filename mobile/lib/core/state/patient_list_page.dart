/// Một trang dữ liệu cá nhân của người khám (lịch hẹn, kết quả khám, đơn thuốc, hóa đơn) do máy chủ trả về.
class PatientListPage<T> {
  const PatientListPage({
    required this.items,
    required this.page,
    required this.total,
    required this.hasNextPage,
  });

  final List<T> items;
  final int page;
  final int total;
  final bool hasNextPage;
}
