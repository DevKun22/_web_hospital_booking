import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class ChatbotRepository {
  /// [_authenticatedDio] gắn token người khám (nếu đã đăng nhập) và tự làm mới khi hết hạn: máy chủ nhận ra
  /// đúng người để Kun xem và hủy lịch của chính họ. [_publicDio] không có token, dùng cho cài đặt công khai
  /// và để hỏi lại như khách khi phiên đăng nhập đã hỏng hẳn.
  ChatbotRepository(
    this._authenticatedDio,
    this._publicDio, {
    bool Function()? hasAccessToken,
  }) : _hasAccessToken = hasAccessToken ?? (() => false);

  final Dio _authenticatedDio;
  final Dio _publicDio;

  /// App còn giữ token người khám không (sau khi đã thử làm mới).
  final bool Function() _hasAccessToken;

  Future<ChatbotSettings> getSettings() async {
    return guardApi(() async {
      final response = await _publicDio.get<dynamic>('/chatbot/settings');
      return ChatbotSettings.fromJson(requireDataMap(response.data));
    });
  }

  /// Gửi đánh giá "hữu ích / chưa đúng" cho một câu trả lời (máy chủ chỉ nhận khi mã tin thuộc đúng phiên này).
  Future<void> sendFeedback({
    required String sessionId,
    required String messageId,
    required bool helpful,
  }) async {
    await guardApi(() async {
      await _publicDio.post<dynamic>(
        '/chatbot/feedback',
        data: {
          'sessionId': sessionId,
          'messageId': messageId,
          'value': helpful ? 'HELPFUL' : 'NOT_HELPFUL',
        },
      );
    });
  }

  Future<ChatbotResponse> sendMessage({
    required String message,
    String? sessionId,
    ChatbotAction? action,
  }) async {
    // Trạng thái hội thoại do máy chủ giữ: chỉ gửi mã phiên, tin nhắn và nút vừa bấm.
    final body = {
      'sessionId': ?sessionId,
      'message': message.trim(),
      'action': ?action?.toJson(),
    };
    try {
      return await _post(_authenticatedDio, body);
    } on ApiException catch (error) {
      // Chỉ hỏi lại như khách khi phiên đăng nhập đã thật sự hết (app đã bỏ token). Làm mới lỗi tạm thời (mất mạng, máy chủ
      // 5xx) mà token vẫn còn thì báo lỗi để người dùng thử lại, không âm thầm hạ xuống khách và mất ngữ cảnh tài khoản.
      if (error.statusCode != 401 || _hasAccessToken()) rethrow;
      return _post(_publicDio, body);
    }
  }

  Future<ChatbotResponse> _post(Dio dio, Map<String, Object?> body) {
    return guardApi(() async {
      final response = await dio.post<dynamic>('/chatbot/message', data: body);
      final result = ChatbotResponse.fromJson(requireDataMap(response.data));
      if (result.sessionId.isEmpty || result.reply.trim().isEmpty) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_API_CONTRACT',
          message: 'Phản hồi chatbot không đúng định dạng.',
        );
      }
      return result;
    });
  }
}
