class PatientUser {
  const PatientUser({
    required this.id,
    required this.fullName,
    required this.isEmailVerified,
    this.phone,
    this.email,
    this.avatar,
  });

  factory PatientUser.fromJson(Map<String, dynamic> json) => PatientUser(
    id: json['id']?.toString() ?? '',
    fullName: json['fullName']?.toString() ?? 'Người khám',
    phone: json['phone']?.toString(),
    email: json['email']?.toString(),
    avatar: json['avatar']?.toString(),
    isEmailVerified: json['isEmailVerified'] == true,
  );

  final String id;
  final String fullName;
  final String? phone;
  final String? email;
  final String? avatar;
  final bool isEmailVerified;
}
