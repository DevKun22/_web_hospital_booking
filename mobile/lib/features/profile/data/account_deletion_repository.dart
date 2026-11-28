import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/core/network/api_guard.dart';
import 'package:hospital_booking_mobile/core/network/json_readers.dart';

/// Thử thách xác nhận xóa tài khoản: mã gửi tới email của chính tài khoản.
class AccountDeletionChallenge {
  const AccountDeletionChallenge({
    required this.challengeId,
    required this.maskedTarget,
    required this.expiresIn,
    this.debugOtp,
  });

  factory AccountDeletionChallenge.fromJson(Map<String, dynamic> json) =>
      AccountDeletionChallenge(
        challengeId: json['challengeId']?.toString() ?? '',
        maskedTarget: json['maskedTarget']?.toString() ?? '',
        expiresIn: jsonInt(json['expiresIn'], fallback: 300),
        debugOtp: json['debugOtp']?.toString(),
      );

  final String challengeId;
  final String maskedTarget;
  final int expiresIn;

  /// Chỉ có khi máy chủ chạy chế độ phát triển.
  final String? debugOtp;
}

class AccountDeletionRepository {
  AccountDeletionRepository(this._dio);

  final Dio _dio;

  Future<AccountDeletionChallenge> requestOtp() => guardApi(() async {
    final response = await _dio.post<dynamic>('/me/account-deletion/otp');
    return AccountDeletionChallenge.fromJson(requireDataMap(response.data));
  });

  Future<void> confirm({required String challengeId, required String otp}) =>
      guardApi(() async {
        await _dio.post<dynamic>(
          '/me/account-deletion/confirm',
          data: {'challengeId': challengeId, 'otp': otp.trim()},
        );
      });
}
