import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

/// Chỉ nhận đường dẫn nội bộ làm điểm quay lại sau đăng nhập; chặn địa chỉ ngoài và vòng lặp về màn đăng nhập.
String? safeReturnLocation(String? value) {
  if (value == null || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }

  final uri = Uri.tryParse(value);
  if (uri == null || uri.hasAuthority) return null;
  if (uri.path == '/login') return null;
  return uri.toString();
}

String loginLocation(String returnTo) =>
    Uri(path: '/login', queryParameters: {'from': returnTo}).toString();

/// Định tuyến chỉ lo luồng đăng nhập. Màn cần tài khoản tự mời đăng nhập tại chỗ (xem `AuthGate`), nên không còn
/// chuyển hướng theo từng loại đường dẫn hay màn khởi động.
String? resolveAppRedirect({
  required AuthStatus authStatus,
  required String location,
  String? returnTo,
}) {
  final normalizedReturnTo = safeReturnLocation(returnTo);
  // Nhập email và nhập mã cùng nằm trên màn /login (hoặc ngay trong màn cần tài khoản),
  // nên chỉ còn một việc: đăng nhập xong thì rời /login về nơi đã định.
  if (authStatus == AuthStatus.authenticated && location == '/login') {
    return normalizedReturnTo ?? '/home';
  }
  return null;
}
