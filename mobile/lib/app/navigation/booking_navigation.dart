import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

String bookingLocationWithReturnTo({
  required String bookingLocation,
  required String returnTo,
}) {
  final target = Uri.parse(bookingLocation);
  return target
      .replace(
        queryParameters: {...target.queryParameters, 'returnTo': returnTo},
      )
      .toString();
}

void openBookingFromCurrentRoute(BuildContext context, String bookingLocation) {
  final returnTo = GoRouterState.of(context).uri.toString();
  context.go(
    bookingLocationWithReturnTo(
      bookingLocation: bookingLocation,
      returnTo: returnTo,
    ),
  );
}
