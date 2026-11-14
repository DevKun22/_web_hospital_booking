import 'package:flutter/material.dart';

import 'package:cached_network_image/cached_network_image.dart';

/// Ảnh mạng có bộ nhớ đệm trên đĩa, giải mã gần đúng cỡ hiển thị để đỡ RAM và đỡ tải lại.
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
    CachedNetworkImageProvider(normalizedUrl),
  );
}
