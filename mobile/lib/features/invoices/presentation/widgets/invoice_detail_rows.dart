import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/formatters/display_formatters.dart';

class InvoiceMoneyRow extends StatelessWidget {
  const InvoiceMoneyRow({
    super.key,
    required this.label,
    required this.amount,
    this.highlight = false,
  });

  final String label;
  final int amount;
  final bool highlight;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text(
          amount < 0 ? '-${formatVnd(-amount)}' : formatVnd(amount),
          style: TextStyle(
            color: highlight ? Theme.of(context).colorScheme.primary : null,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class InvoiceTextRow extends StatelessWidget {
  const InvoiceTextRow({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label)),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    ),
  );
}

class InvoiceIconLine extends StatelessWidget {
  const InvoiceIconLine({super.key, required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 10),
      Expanded(child: Text(value)),
    ],
  );
}
