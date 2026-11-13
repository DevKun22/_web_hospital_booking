"use client";

import { create } from "zustand";
import { bookingReducer, type BookingAction } from "@/features/booking/reducer";
import { createInitialState, type BookingState } from "@/features/booking/model";

type BookingStore = {
  state: BookingState;
  dispatch: (action: BookingAction) => void;
};

// Một nơi duy nhất giữ toàn bộ trạng thái đặt lịch (bước, lựa chọn, thông tin, phiếu chờ OTP),
// nên người dùng sang xem trang bác sĩ rồi quay lại vẫn còn nguyên. Mọi thay đổi đi qua reducer thuần.
export const useBookingStore = create<BookingStore>((set) => ({
  state: createInitialState(),
  dispatch: (action) => set((current) => ({ state: bookingReducer(current.state, action) })),
}));
