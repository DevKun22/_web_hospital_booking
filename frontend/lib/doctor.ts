type DoctorNameSource = { title?: string | null; user: { fullName: string } };

// "BS.CKII Trần Thị Mai": chức danh (nếu có) và họ tên.
export const doctorDisplayName = (doctor: DoctorNameSource) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

// Chữ cái đầu để làm ảnh đại diện khi bác sĩ chưa có ảnh.
export const doctorInitial = (fullName: string, fallback = "B") => fullName.trim().slice(0, 1).toUpperCase() || fallback;
