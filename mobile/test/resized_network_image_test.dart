import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/widgets/resized_network_image.dart';

void main() {
  testWidgets('network images are decoded near their rendered pixel size', (
    tester,
  ) async {
    ImageProvider<Object>? provider;

    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(devicePixelRatio: 3),
        child: Builder(
          builder: (context) {
            provider = resizedNetworkImage(
              context,
              'https://example.test/avatar.jpg',
              logicalWidth: 56,
              logicalHeight: 56,
            );
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    expect(provider, isA<ResizeImage>());
    expect((provider! as ResizeImage).width, 168);
    expect((provider! as ResizeImage).height, 168);
  });

  testWidgets('blank image URLs keep the local placeholder', (tester) async {
    ImageProvider<Object>? provider;

    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(devicePixelRatio: 3),
        child: Builder(
          builder: (context) {
            provider = resizedNetworkImage(
              context,
              '   ',
              logicalWidth: 56,
              logicalHeight: 56,
            );
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    expect(provider, isNull);
  });
}
