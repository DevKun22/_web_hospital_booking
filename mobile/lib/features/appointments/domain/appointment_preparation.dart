enum AppointmentPreparationItem {
  identityDocument(
    id: 'identity_document',
    title: 'Giấy tờ tùy thân',
    description: 'Mang CCCD hoặc giấy tờ định danh còn hiệu lực.',
  ),
  bookingInformation(
    id: 'booking_information',
    title: 'Thông tin lịch hẹn',
    description: 'Chuẩn bị mã lịch và điện thoại đã dùng khi đặt khám.',
  ),
  healthInsurance(
    id: 'health_insurance',
    title: 'Thẻ BHYT',
    description:
        'Mang thẻ BHYT và giấy chuyển tuyến nếu trường hợp của bạn cần.',
  ),
  previousMedicalDocuments(
    id: 'previous_medical_documents',
    title: 'Hồ sơ y tế liên quan',
    description: 'Mang đơn thuốc, kết quả xét nghiệm hoặc chẩn đoán cũ nếu có.',
  ),
  arriveEarly(
    id: 'arrive_early',
    title: 'Sắp xếp đến sớm',
    description: 'Nên có mặt trước giờ khám khoảng 15 phút để làm thủ tục.',
  );

  const AppointmentPreparationItem({
    required this.id,
    required this.title,
    required this.description,
  });

  final String id;
  final String title;
  final String description;
}

List<AppointmentPreparationItem> buildAppointmentPreparationItems({
  required bool hasBhyt,
}) => [
  AppointmentPreparationItem.identityDocument,
  AppointmentPreparationItem.bookingInformation,
  if (hasBhyt) AppointmentPreparationItem.healthInsurance,
  AppointmentPreparationItem.previousMedicalDocuments,
  AppointmentPreparationItem.arriveEarly,
];
