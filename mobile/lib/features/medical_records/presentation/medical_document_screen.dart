import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/medical_records/application/medical_records_controller.dart';
import 'package:hospital_booking_mobile/features/medical_records/domain/patient_medical_record.dart';
import 'package:pdfx/pdfx.dart';

class MedicalDocumentScreen extends ConsumerWidget {
  const MedicalDocumentScreen({
    required this.recordId,
    this.labResultId,
    super.key,
  });

  final String recordId;
  final String? labResultId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final request = MedicalDocumentRequest(
      recordId: recordId,
      labResultId: labResultId,
    );
    final document = ref.watch(medicalDocumentProvider(request));
    return Scaffold(
      appBar: AppBar(
        title: Text(
          labResultId == null ? 'Tệp kết quả khám' : 'Tệp xét nghiệm',
        ),
        actions: [
          IconButton(
            tooltip: 'Tải lại tệp',
            onPressed: () => ref.invalidate(medicalDocumentProvider(request)),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: document.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _DocumentError(
            error: error,
            onRetry: () => ref.invalidate(medicalDocumentProvider(request)),
          ),
          data: (data) {
            if (data.isPdf) {
              return _PdfDocumentView(
                bytes: data.bytes,
                sourceName: data.fileName,
              );
            }
            if (data.isImage) {
              return InteractiveViewer(
                minScale: 0.5,
                maxScale: 5,
                child: Center(child: Image.memory(data.bytes)),
              );
            }
            return const AppEmptyState(
              icon: Icons.insert_drive_file_outlined,
              title: 'Chưa hỗ trợ định dạng tệp',
              message:
                  'Ứng dụng hiện hỗ trợ xem trực tiếp tệp PDF và hình ảnh kết quả.',
            );
          },
        ),
      ),
    );
  }
}

class _PdfDocumentView extends StatefulWidget {
  const _PdfDocumentView({required this.bytes, required this.sourceName});

  final Uint8List bytes;
  final String sourceName;

  @override
  State<_PdfDocumentView> createState() => _PdfDocumentViewState();
}

class _PdfDocumentViewState extends State<_PdfDocumentView> {
  late final PdfControllerPinch _controller = PdfControllerPinch(
    document: PdfDocument.openData(widget.bytes),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: PdfViewPinch(
      controller: _controller,
      builders: PdfViewPinchBuilders<DefaultBuilderOptions>(
        options: const DefaultBuilderOptions(),
        documentLoaderBuilder: (_) =>
            const Center(child: CircularProgressIndicator()),
        pageLoaderBuilder: (_) =>
            const Center(child: CircularProgressIndicator()),
        errorBuilder: (_, _) => const AppEmptyState(
          icon: Icons.picture_as_pdf_outlined,
          title: 'Không đọc được tệp PDF',
          message: 'Tệp có thể bị lỗi hoặc dùng định dạng chưa được hỗ trợ.',
        ),
      ),
    ),
  );
}

class _DocumentError extends StatelessWidget {
  const _DocumentError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      if (error is ApiException)
        AppErrorBanner(error: error as ApiException)
      else
        const AppEmptyState(
          icon: Icons.cloud_off_outlined,
          title: 'Không tải được tệp kết quả',
          message: 'Kiểm tra kết nối mạng rồi thử lại.',
        ),
      const SizedBox(height: 14),
      FilledButton.icon(
        onPressed: onRetry,
        icon: const Icon(Icons.refresh_rounded),
        label: const Text('Thử lại'),
      ),
    ],
  );
}
