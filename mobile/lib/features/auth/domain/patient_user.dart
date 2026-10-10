class PatientUser {
  const PatientUser({
    required this.id,
    required this.fullName,
    required this.isPhoneVerified,
    this.phone,
    this.email,
    this.avatar,
  });

  factory PatientUser.fromJson(Map<String, dynamic> json) => PatientUser(
    id: json['id']?.toString() ?? '',
    fullName: json['fullName']?.toString() ?? 'Bệnh nhân',
    phone: json['phone']?.toString(),
    email: json['email']?.toString(),
    avatar: json['avatar']?.toString(),
    isPhoneVerified: json['isPhoneVerified'] == true,
  );

  final String id;
  final String fullName;
  final String? phone;
  final String? email;
  final String? avatar;
  final bool isPhoneVerified;
}
