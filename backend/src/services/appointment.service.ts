import { AppointmentBookingUseCases } from "./appointment/appointmentBooking.service.js";
import { AppointmentDashboardUseCases } from "./appointment/appointmentDashboard.service.js";
import { AppointmentLifecycleUseCases } from "./appointment/appointmentLifecycle.service.js";
import { AppointmentTransitionUseCases } from "./appointment/appointmentTransition.service.js";

export { HEALTH_CONSENT_VERSION } from "./appointment/appointment.shared.js";

// Facade tương thích cho controller/worker. Mỗi nhóm nghiệp vụ chỉ có một
// implementation trong use-case service tương ứng; facade không chứa business logic.
class AppointmentService {
  private readonly transitions = new AppointmentTransitionUseCases();
  private readonly lifecycle = new AppointmentLifecycleUseCases(this.transitions);
  private readonly booking = new AppointmentBookingUseCases(this.lifecycle);
  private readonly dashboard = new AppointmentDashboardUseCases();

  create(...args: Parameters<AppointmentService["booking"]["create"]>) {
    return this.booking.create(...args);
  }

  abandonPendingOtp(
    ...args: Parameters<AppointmentService["booking"]["abandonPendingOtp"]>
  ) {
    return this.booking.abandonPendingOtp(...args);
  }

  resendOtp(...args: Parameters<AppointmentService["booking"]["resendOtp"]>) {
    return this.booking.resendOtp(...args);
  }

  verifyOtp(...args: Parameters<AppointmentService["booking"]["verifyOtp"]>) {
    return this.booking.verifyOtp(...args);
  }

  cancelByPatient(
    ...args: Parameters<AppointmentService["booking"]["cancelByPatient"]>
  ) {
    return this.booking.cancelByPatient(...args);
  }

  dashboardList(
    ...args: Parameters<AppointmentService["dashboard"]["dashboardList"]>
  ) {
    return this.dashboard.dashboardList(...args);
  }

  dashboardGetById(
    ...args: Parameters<AppointmentService["dashboard"]["dashboardGetById"]>
  ) {
    return this.dashboard.dashboardGetById(...args);
  }

  updatePatientInfo(
    ...args: Parameters<AppointmentService["dashboard"]["updatePatientInfo"]>
  ) {
    return this.dashboard.updatePatientInfo(...args);
  }

  confirm(...args: Parameters<AppointmentService["transitions"]["confirm"]>) {
    return this.transitions.confirm(...args);
  }

  cancel(...args: Parameters<AppointmentService["transitions"]["cancel"]>) {
    return this.transitions.cancel(...args);
  }

  reschedule(...args: Parameters<AppointmentService["transitions"]["reschedule"]>) {
    return this.transitions.reschedule(...args);
  }

  checkIn(...args: Parameters<AppointmentService["transitions"]["checkIn"]>) {
    return this.transitions.checkIn(...args);
  }

  start(...args: Parameters<AppointmentService["transitions"]["start"]>) {
    return this.transitions.start(...args);
  }

  complete(...args: Parameters<AppointmentService["transitions"]["complete"]>) {
    return this.transitions.complete(...args);
  }

  markNoShow(
    ...args: Parameters<AppointmentService["transitions"]["markNoShow"]>
  ) {
    return this.transitions.markNoShow(...args);
  }

  reconcileNoShows(
    ...args: Parameters<AppointmentService["lifecycle"]["reconcileNoShows"]>
  ) {
    return this.lifecycle.reconcileNoShows(...args);
  }

  expirePendingOtpAppointment(
    ...args: Parameters<
      AppointmentService["lifecycle"]["expirePendingOtpAppointment"]
    >
  ) {
    return this.lifecycle.expirePendingOtpAppointment(...args);
  }

  reconcileExpiredPendingOtp(
    ...args: Parameters<
      AppointmentService["lifecycle"]["reconcileExpiredPendingOtp"]
    >
  ) {
    return this.lifecycle.reconcileExpiredPendingOtp(...args);
  }

  expirePastPendingConfirmation(
    ...args: Parameters<
      AppointmentService["lifecycle"]["expirePastPendingConfirmation"]
    >
  ) {
    return this.lifecycle.expirePastPendingConfirmation(...args);
  }

  reconcilePastPendingConfirmations(
    ...args: Parameters<
      AppointmentService["lifecycle"]["reconcilePastPendingConfirmations"]
    >
  ) {
    return this.lifecycle.reconcilePastPendingConfirmations(...args);
  }
}

export default new AppointmentService();
