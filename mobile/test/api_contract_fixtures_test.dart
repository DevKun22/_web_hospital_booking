import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

/// Mẫu JSON lấy từ phản hồi thật của backend (không có dữ liệu cá nhân). Khi backend đổi hợp đồng,
/// cập nhật mẫu rồi sửa mô hình tương ứng thay vì để mobile bỏ qua trường mới trong im lặng.
Map<String, dynamic> _fixture(String name) =>
    jsonDecode(File('test/fixtures/$name').readAsStringSync())
        as Map<String, dynamic>;

void main() {
  test('package catalog item parses the live backend contract', () {
    final package = MedicalPackage.fromJson(
      _fixture('package_catalog_item.json'),
    );

    expect(package.name, 'Gói khám tổng quát cơ bản');
    expect(package.slug, 'goi-kham-tong-quat-co-ban');
    expect(package.departmentSlug, 'khoa-tong-quat');
    expect(package.basePrice, 420000);
    expect(package.serviceFee, 20000);
    expect(package.includedItemsTotal, 180000);
    expect(package.finalPrice, 200000);
    expect(package.isPopular, isTrue);
    expect(package.isBhytSupport, isTrue);
    expect(package.note, isNull);
    expect(package.items, hasLength(2));
    expect(package.items.first.included, isTrue);
    expect(package.items.first.order, 1);
  });
}
