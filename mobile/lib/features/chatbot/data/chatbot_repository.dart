import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class ChatbotRepository {
  /// [_authenticatedDio] gắn token người khám (nếu đã đăng nhập) và tự làm mới khi hết hạn: máy chủ nhận ra
  /// đúng người để Kun xem và hủy lịch của chính họ. [_publicDio] không có token, dùng cho cài đặt công khai
  /// và để hỏi lại như khách khi phiên đăng nhập đã hỏng hẳn.
  ChatbotRepository(this._authenticatedDio, this._publicDio);

  final Dio _authenticatedDio;
  final Dio _publicDio;

  Future<ChatbotSettings> getSettings() async {
    return guardApi(() async {
      final response = await _publicDio.get<dynamic>('/chatbot/settings');
      return ChatbotSettings.fromJson(requireDataMap(response.data));
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
      // Token sai và làm mới không được (phiên đã bị thu hồi/hết hạn): hỏi lại một lần như khách.
      if (error.statusCode != 401) rethrow;
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
