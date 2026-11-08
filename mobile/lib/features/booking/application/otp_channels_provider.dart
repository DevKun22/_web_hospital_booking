import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_submission.dart';

/// Kênh OTP backend đang hỗ trợ (GET /capabilities). Lỗi mạng thì giả định
/// chỉ có email để người dùng không chọn phải kênh không gửi được.
final otpChannelsProvider = FutureProvider<List<BookingOtpChannel>>((
  ref,
) async {
  try {
    final response = await ref
        .watch(authDioProvider)
        .get<dynamic>('/capabilities');
    final otp = requireDataMap(response.data)['otp'];
    final channels = otp is Map ? otp['channels'] : null;
    if (channels is! List) return const [BookingOtpChannel.email];
    final result = <BookingOtpChannel>[
      if (channels.contains('EMAIL')) BookingOtpChannel.email,
      if (channels.contains('SMS')) BookingOtpChannel.sms,
    ];
    return result.isEmpty ? const [BookingOtpChannel.email] : result;
  } catch (error) {
    logSwallowedError('otp_channels_provider', error);
    return const [BookingOtpChannel.email];
  }
});
