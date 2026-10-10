import 'package:flutter/material.dart';

ImageProvider<Object>? resizedNetworkImage(
  BuildContext context,
  String? url, {
  required double logicalWidth,
  required double logicalHeight,
}) {
  final normalizedUrl = url?.trim();
  if (normalizedUrl == null || normalizedUrl.isEmpty) return null;

  final pixelRatio = MediaQuery.devicePixelRatioOf(context);
  final cacheWidth = (logicalWidth * pixelRatio).ceil().clamp(1, 4096);
  final cacheHeight = (logicalHeight * pixelRatio).ceil().clamp(1, 4096);

  return ResizeImage.resizeIfNeeded(
    cacheWidth,
    cacheHeight,
    NetworkImage(normalizedUrl),
  );
}
