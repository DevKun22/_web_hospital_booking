import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/profile/data/patient_profile_repository.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';

Map<String, dynamic> _profileJson({String fullName = 'Nguyễn Văn An'}) => {
  'id': 'patient-1',
  'fullName': fullName,
  'phone': '0912345678',
  'email': 'an@example.test',
  'avatar': null,
  'isPhoneVerified': true,
  'patientProfile': {
    'dateOfBirth': '1995-05-20T00:00:00.000Z',
    'gender': 'MALE',
    'cccd': '012345678901',
    'address': 'TP. Hồ Chí Minh',
    'hasBHYT': true,
    'healthInsuranceCode': 'DN4012345678901',
    'registeredHospital': 'Bệnh viện Đại học Y Dược',
    'bloodType': 'O+',
    'height': 170,
    'weight': 65.5,
    'allergies': 'Không',
    'medicalHistory': 'Không',
    'familyHistory': null,
    'bloodPressure': '120/80',
  },
};

void main() {
  test(
    'loads and updates the authenticated patient profile contract',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api/v1'));
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            final data = switch ((options.method, options.path)) {
              ('GET', '/me') => {'success': true, 'data': _profileJson()},
              ('PATCH', '/me') => {
                'success': true,
                'data': _profileJson(fullName: 'Nguyễn Văn Bình'),
              },
              _ => throw StateError(
                'Unexpected request ${options.method} ${options.path}',
              ),
            };
            handler.resolve(
              Response<dynamic>(
                requestOptions: options,
                statusCode: 200,
                data: data,
              ),
            );
          },
        ),
      );
      final repository = PatientProfileRepository(dio);

      final profile = await repository.getProfile();
      final updated = await repository.updateProfile(
        const PatientProfileDraft(
          fullName: '  Nguyễn Văn Bình  ',
          email: '  binh@example.test  ',
          dateOfBirth: '1995-05-20',
          gender: PatientGender.male,
          hasBhyt: false,
          healthInsuranceCode: 'SHOULD_BE_CLEARED',
          registeredHospital: 'SHOULD_BE_CLEARED',
          height: 171,
          weight: 66.5,
        ),
      );

      expect(profile.dateOfBirth, '1995-05-20');
      expect(profile.gender, PatientGender.male);
      expect(profile.height, 170);
      expect(profile.weight, 65.5);
      expect(updated.fullName, 'Nguyễn Văn Bình');
      expect(requests.map((request) => request.method), ['GET', 'PATCH']);
      expect(Map<String, dynamic>.from(requests.last.data as Map), {
        'fullName': 'Nguyễn Văn Bình',
        'email': 'binh@example.test',
        'dateOfBirth': '1995-05-20',
        'gender': 'MALE',
        'cccd': null,
        'address': null,
        'hasBHYT': false,
        'healthInsuranceCode': null,
        'registeredHospital': null,
        'bloodType': null,
        'height': 171.0,
        'weight': 66.5,
        'allergies': null,
        'medicalHistory': null,
        'familyHistory': null,
        'bloodPressure': null,
      });

      dio.close(force: true);
    },
  );
}
