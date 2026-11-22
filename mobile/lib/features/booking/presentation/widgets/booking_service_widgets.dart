import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';

class BookingServiceModePicker extends StatelessWidget {
  const BookingServiceModePicker({
    super.key,
    required this.selected,
    required this.onSelected,
  });

  final BookingServiceMode selected;
  final ValueChanged<BookingServiceMode> onSelected;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SizedBox(
        width: double.infinity,
        child: SegmentedButton<BookingServiceMode>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(
              value: BookingServiceMode.doctor,
              icon: Icon(Icons.person_search_outlined),
              label: Text('Theo bác sĩ'),
            ),
            ButtonSegment(
              value: BookingServiceMode.package,
              icon: Icon(Icons.health_and_safety_outlined),
              label: Text('Theo gói khám'),
            ),
          ],
          selected: {selected},
          onSelectionChanged: (values) => onSelected(values.first),
        ),
      ),
    ],
  );
}
