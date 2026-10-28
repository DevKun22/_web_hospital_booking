import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/appointments/application/appointment_preparation_controller.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/appointment_preparation.dart';
import 'package:hospital_booking_mobile/features/appointments/domain/patient_appointment.dart';

class AppointmentPreparationCard extends ConsumerStatefulWidget {
  const AppointmentPreparationCard({
    required this.userId,
    required this.appointment,
    super.key,
  });

  final String userId;
  final PatientAppointment appointment;

  static bool supports(PatientAppointmentStatus status) => switch (status) {
    PatientAppointmentStatus.pendingOtp ||
    PatientAppointmentStatus.pendingConfirm ||
    PatientAppointmentStatus.confirmed ||
    PatientAppointmentStatus.rescheduled => true,
    _ => false,
  };

  @override
  ConsumerState<AppointmentPreparationCard> createState() =>
      _AppointmentPreparationCardState();
}

class _AppointmentPreparationCardState
    extends ConsumerState<AppointmentPreparationCard> {
  Set<String> _completed = {};
  bool _isLoading = true;
  bool _isSaving = false;

  List<AppointmentPreparationItem> get _items =>
      buildAppointmentPreparationItems(hasBhyt: widget.appointment.hasBhyt);

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_load);
  }

  @override
  void didUpdateWidget(covariant AppointmentPreparationCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.userId != widget.userId ||
        oldWidget.appointment.id != widget.appointment.id) {
      setState(() {
        _completed = {};
        _isLoading = true;
      });
      Future<void>.microtask(_load);
    }
  }

  Future<void> _load() async {
    try {
      final values = await ref
          .read(appointmentPreparationControllerProvider)
          .load(userId: widget.userId, appointmentId: widget.appointment.id);
      if (!mounted) return;
      final allowedIds = _items.map((item) => item.id).toSet();
      setState(() {
        _completed = values.intersection(allowedIds);
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  Future<void> _toggle(String itemId, bool checked) async {
    if (_isSaving) return;
    final previous = {..._completed};
    setState(() {
      _isSaving = true;
      if (checked) {
        _completed.add(itemId);
      } else {
        _completed.remove(itemId);
      }
    });
    try {
      await ref
          .read(appointmentPreparationControllerProvider)
          .save(
            userId: widget.userId,
            appointmentId: widget.appointment.id,
            completedItemIds: _completed,
          );
      if (mounted) setState(() => _isSaving = false);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _completed = previous;
        _isSaving = false;
      });
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Chưa lưu được checklist trên thiết bị.'),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final completedCount = _items
        .where((item) => _completed.contains(item.id))
        .length;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.fact_check_outlined,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Chuẩn bị trước buổi khám',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Text(
                  '$completedCount/${_items.length}',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            LinearProgressIndicator(
              value: _items.isEmpty ? 0 : completedCount / _items.length,
              minHeight: 5,
              borderRadius: BorderRadius.circular(999),
            ),
            const SizedBox(height: 8),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              for (final item in _items)
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: _completed.contains(item.id),
                  onChanged: _isSaving
                      ? null
                      : (value) => _toggle(item.id, value == true),
                  title: Text(
                    item.title,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(item.description),
                ),
            Text(
              'Dấu tích chỉ được lưu trên thiết bị này và không thay thế hướng dẫn của bệnh viện.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
