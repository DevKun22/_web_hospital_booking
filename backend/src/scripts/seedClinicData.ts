/**
 * Nạp dữ liệu danh mục cho phòng khám: tài khoản nhân sự, chuyên khoa, bác sĩ,
 * lịch làm việc, gói khám, danh mục thuốc kèm tồn kho và nội dung website.
 * Không tạo dữ liệu người bệnh (hồ sơ, lịch hẹn, bệnh án, hóa đơn).
 *
 * Bắt buộc: SEED_PASSWORD (>= 12 ký tự, dùng chung cho mọi tài khoản nhân sự).
 * Tùy chọn: SEED_ADMIN_EMAIL (mặc định devkun22@gmail.com).
 * Xóa sạch dữ liệu cũ trước khi nạp: RESET_DATABASE=true và ALLOW_DATABASE_RESET=true.
 */
import { prisma } from "../config/prisma.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";
import { hashPassword } from "../utils/password.js";
import { buildTimeSlots } from "../utils/time.js";

const SLOT_DAYS = 14;
const EMAIL_DOMAIN = "devkuncare.com";

const runtimeConfig = getRuntimeConfig();

const toSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const startOfTodayUtc = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

async function resetDatabase() {
  if (!runtimeConfig.demoSeed.resetRequested) return;
  if (!runtimeConfig.demoSeed.resetAllowed) {
    throw new Error("Reset database bị chặn. Đặt RESET_DATABASE=true và ALLOW_DATABASE_RESET=true nếu chắc chắn.");
  }

  // TRUNCATE bỏ qua trigger chống xóa của sổ kho; giữ nguyên bảng migration.
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((table) => `"${table.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

type Role = "ADMIN" | "STAFF" | "DOCTOR" | "PHARMACIST";

async function createUser(data: { fullName: string; phone: string; email: string; role: Role; password: string }) {
  const password = await hashPassword(data.password);
  const fields = {
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    password,
    isActive: true,
    isPhoneVerified: true,
    isEmailVerified: true,
  };
  return prisma.user.upsert({
    where: { phone: data.phone },
    update: fields,
    create: { phone: data.phone, ...fields },
  });
}

const DEPARTMENTS = [
  {
    name: "Khoa tổng quát",
    description: "Khám ban đầu, tư vấn sức khỏe và tầm soát các vấn đề thường gặp.",
    symptomKeywords: ["mệt mỏi", "sốt", "đau đầu", "chóng mặt", "khó chịu toàn thân", "khám sức khỏe"],
    triageDescription: "Đánh giá ban đầu khi triệu chứng chưa định hướng rõ chuyên khoa.",
    isTriageFallback: true,
  },
  {
    name: "Khoa tim mạch",
    description: "Khám và theo dõi tăng huyết áp, rối loạn nhịp tim, bệnh mạch vành.",
    symptomKeywords: ["đau ngực", "hồi hộp", "tim đập nhanh", "tăng huyết áp", "khó thở khi gắng sức"],
    triageDescription: "Các triệu chứng liên quan tim mạch và huyết áp.",
  },
  {
    name: "Khoa nội tiết",
    description: "Tầm soát và theo dõi đái tháo đường, rối loạn tuyến giáp, rối loạn mỡ máu.",
    symptomKeywords: ["khát nhiều", "tiểu nhiều", "sụt cân", "bướu cổ", "mỡ máu cao", "đường huyết"],
    triageDescription: "Rối loạn chuyển hóa, đường huyết và tuyến giáp.",
  },
  {
    name: "Khoa cơ xương khớp",
    description: "Khám đau lưng, thoái hóa khớp, đau cổ vai gáy và chấn thương vận động nhẹ.",
    symptomKeywords: ["đau lưng", "đau khớp", "đau cổ vai gáy", "tê tay chân", "cứng khớp buổi sáng"],
    triageDescription: "Đau và hạn chế vận động ở cột sống, khớp và cơ.",
  },
  {
    name: "Khoa nhi",
    description: "Khám bệnh trẻ em, tư vấn dinh dưỡng, tiêm chủng và theo dõi phát triển.",
    symptomKeywords: ["trẻ sốt", "trẻ ho", "trẻ biếng ăn", "chậm tăng cân", "phát ban ở trẻ"],
    triageDescription: "Các vấn đề sức khỏe ở trẻ em.",
  },
  {
    name: "Khoa sản",
    description: "Theo dõi thai kỳ, khám phụ khoa và tư vấn sức khỏe sinh sản.",
    symptomKeywords: ["đau bụng thai kỳ", "trễ kinh", "khí hư", "đau bụng dưới", "khám thai"],
    triageDescription: "Thai kỳ, phụ khoa và sức khỏe sinh sản.",
  },
  {
    name: "Da liễu",
    description: "Khám và điều trị mụn, viêm da, dị ứng, chăm sóc da y khoa.",
    symptomKeywords: ["ngứa da", "nổi mẩn", "phát ban", "mụn", "viêm da", "dị ứng da"],
    triageDescription: "Các vấn đề về da, tóc, móng, ngứa và phát ban.",
  },
  {
    name: "Tai mũi họng",
    description: "Khám viêm họng, viêm xoang, ù tai, dị ứng mũi và bệnh lý hô hấp trên.",
    symptomKeywords: ["đau họng", "nghẹt mũi", "chảy mũi", "ù tai", "đau tai", "khàn tiếng", "viêm xoang"],
    triageDescription: "Triệu chứng ở tai, mũi, họng và đường hô hấp trên.",
  },
  {
    name: "Khoa mắt",
    description: "Khám tật khúc xạ, mỏi mắt, viêm kết mạc và tầm soát bệnh lý võng mạc.",
    symptomKeywords: ["mờ mắt", "mỏi mắt", "đỏ mắt", "chảy nước mắt", "nhìn đôi"],
    triageDescription: "Giảm thị lực, đỏ mắt và các bệnh lý về mắt.",
  },
] as const;

const DOCTORS = [
  { name: "Nguyễn Minh Hùng", phone: "0352147202", dept: "Khoa tổng quát", title: "BS.CKII", experience: 18, fee: 200_000, avatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=480&q=85" },
  { name: "Trần Thị Mai", phone: "0352147203", dept: "Khoa tim mạch", title: "BS.CKII", experience: 16, fee: 300_000, avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=480&q=85" },
  { name: "Lê Quốc Bảo", phone: "0352147209", dept: "Khoa tim mạch", title: "BS.CKI", experience: 9, fee: 250_000 },
  { name: "Phan Thị Thu Hà", phone: "0352147210", dept: "Khoa nội tiết", title: "ThS.BS", experience: 11, fee: 250_000 },
  { name: "Vũ Đức Thành", phone: "0352147211", dept: "Khoa cơ xương khớp", title: "BS.CKI", experience: 12, fee: 250_000 },
  { name: "Lê Hoàng An", phone: "0352412319", dept: "Khoa nhi", title: "ThS.BS", experience: 10, fee: 220_000, avatar: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=480&q=85" },
  { name: "Ngô Thị Bích Ngọc", phone: "0352147212", dept: "Khoa nhi", title: "BS.CKI", experience: 8, fee: 200_000 },
  { name: "Phạm An Nhiên", phone: "0352147205", dept: "Khoa sản", title: "BS.CKI", experience: 14, fee: 280_000, avatar: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=480&q=85" },
  { name: "Đỗ Quang Huy", phone: "0352147206", dept: "Da liễu", title: "BS.CKII", experience: 15, fee: 250_000, avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=480&q=85" },
  { name: "Võ Thanh Tâm", phone: "0352147207", dept: "Tai mũi họng", title: "ThS.BS", experience: 10, fee: 220_000, avatar: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=480&q=85" },
  { name: "Hoàng Thị Lan Anh", phone: "0352147213", dept: "Khoa mắt", title: "BS.CKI", experience: 9, fee: 220_000 },
];

type PackageSeed = {
  name: string;
  department: string;
  description: string;
  summary: string;
  serviceFee: number;
  isPopular?: boolean;
  isBHYTSupport?: boolean;
  items: [string, string, number][];
};

const PACKAGES: PackageSeed[] = [
  {
    name: "Gói khám tổng quát cơ bản",
    department: "Khoa tổng quát",
    description: "Kiểm tra sức khỏe ban đầu cho người trưởng thành chưa có bệnh lý nền.",
    summary: "Khám lâm sàng, sinh hiệu, xét nghiệm máu và nước tiểu cơ bản.",
    serviceFee: 20_000,
    isPopular: true,
    isBHYTSupport: true,
    items: [
      ["Khám lâm sàng tổng quát", "Khai thác tiền sử, khám các cơ quan.", 150_000],
      ["Đo sinh hiệu, BMI", "Mạch, huyết áp, nhiệt độ, chiều cao, cân nặng.", 30_000],
      ["Tổng phân tích tế bào máu", "Công thức máu 18 chỉ số.", 90_000],
      ["Đường huyết lúc đói", "Tầm soát đái tháo đường.", 40_000],
      ["Tổng phân tích nước tiểu", "10 thông số.", 60_000],
      ["Tư vấn kết quả", "Bác sĩ giải thích kết quả và hướng theo dõi.", 50_000],
    ],
  },
  {
    name: "Gói khám sức khỏe tổng quát nâng cao",
    department: "Khoa tổng quát",
    description: "Tầm soát toàn diện định kỳ hằng năm cho người từ 35 tuổi hoặc có yếu tố nguy cơ.",
    summary: "Xét nghiệm mỡ máu, chức năng gan thận, điện tim, X-quang ngực, siêu âm bụng.",
    serviceFee: 40_000,
    isPopular: true,
    items: [
      ["Khám lâm sàng tổng quát", "Khai thác tiền sử, khám các cơ quan.", 150_000],
      ["Tổng phân tích tế bào máu", "Công thức máu 18 chỉ số.", 90_000],
      ["Bộ mỡ máu", "Cholesterol toàn phần, HDL, LDL, Triglyceride.", 160_000],
      ["Chức năng gan", "AST, ALT, GGT.", 90_000],
      ["Chức năng thận", "Creatinine, Ure, eGFR.", 80_000],
      ["Đường huyết lúc đói và HbA1c", "Tầm soát và theo dõi đái tháo đường.", 190_000],
      ["Điện tim ECG", "Ghi nhận hoạt động điện của tim.", 100_000],
      ["X-quang ngực thẳng", "Tầm soát bệnh lý phổi, tim.", 150_000],
      ["Siêu âm bụng tổng quát", "Gan, mật, tụy, lách, thận, bàng quang.", 200_000],
      ["Tư vấn kết quả", "Bác sĩ giải thích kết quả và hướng theo dõi.", 80_000],
    ],
  },
  {
    name: "Gói khám tim mạch",
    department: "Khoa tim mạch",
    description: "Dành cho người hồi hộp, đau ngực, tăng huyết áp hoặc có yếu tố nguy cơ tim mạch.",
    summary: "Khám chuyên khoa, điện tim và siêu âm tim.",
    serviceFee: 30_000,
    isPopular: true,
    isBHYTSupport: true,
    items: [
      ["Khám chuyên khoa tim mạch", "Đánh giá triệu chứng và nguy cơ.", 250_000],
      ["Điện tim ECG", "Ghi nhận hoạt động điện của tim.", 100_000],
      ["Siêu âm tim", "Đánh giá cấu trúc và chức năng tim.", 350_000],
      ["Tư vấn điều trị", "Định hướng theo dõi và tái khám.", 80_000],
    ],
  },
  {
    name: "Gói tầm soát đái tháo đường",
    department: "Khoa nội tiết",
    description: "Tầm soát và đánh giá kiểm soát đường huyết.",
    summary: "Khám nội tiết, đường huyết, HbA1c và mỡ máu.",
    serviceFee: 25_000,
    isBHYTSupport: true,
    items: [
      ["Khám chuyên khoa nội tiết", "Đánh giá nguy cơ chuyển hóa.", 250_000],
      ["Đường huyết lúc đói", "Xét nghiệm glucose máu.", 40_000],
      ["HbA1c", "Đường huyết trung bình 3 tháng.", 150_000],
      ["Bộ mỡ máu", "Cholesterol toàn phần, HDL, LDL, Triglyceride.", 160_000],
    ],
  },
  {
    name: "Gói khám cơ xương khớp",
    department: "Khoa cơ xương khớp",
    description: "Khám đau lưng, đau khớp, thoái hóa cột sống.",
    summary: "Khám chuyên khoa kèm X-quang khi có chỉ định.",
    serviceFee: 25_000,
    isBHYTSupport: true,
    items: [
      ["Khám chuyên khoa cơ xương khớp", "Đánh giá vận động và vị trí đau.", 250_000],
      ["X-quang cột sống hoặc khớp", "Một vị trí theo chỉ định.", 150_000],
      ["Tư vấn vật lý trị liệu", "Hướng dẫn bài tập và theo dõi.", 80_000],
    ],
  },
  {
    name: "Gói khám nhi cơ bản",
    department: "Khoa nhi",
    description: "Khám bệnh trẻ em, tư vấn chăm sóc và dinh dưỡng.",
    summary: "Khám nhi, đo tăng trưởng, tư vấn dinh dưỡng.",
    serviceFee: 20_000,
    isBHYTSupport: true,
    items: [
      ["Khám nhi tổng quát", "Bác sĩ đánh giá triệu chứng của trẻ.", 200_000],
      ["Theo dõi tăng trưởng", "Cân nặng, chiều cao, vòng đầu và biểu đồ phát triển.", 70_000],
      ["Tư vấn dinh dưỡng", "Chế độ ăn phù hợp theo độ tuổi.", 60_000],
    ],
  },
  {
    name: "Gói khám thai định kỳ",
    department: "Khoa sản",
    description: "Theo dõi thai kỳ và tư vấn chăm sóc mẹ bầu.",
    summary: "Khám sản khoa, siêu âm thai và tư vấn.",
    serviceFee: 40_000,
    isPopular: true,
    items: [
      ["Khám sản khoa", "Đánh giá sức khỏe mẹ và thai.", 280_000],
      ["Siêu âm thai", "Đo các chỉ số thai nhi.", 250_000],
      ["Tư vấn thai kỳ", "Hướng dẫn chăm sóc và lịch tái khám.", 90_000],
    ],
  },
  {
    name: "Gói khám da liễu",
    department: "Da liễu",
    description: "Khám mụn, viêm da, dị ứng và tư vấn chăm sóc da.",
    summary: "Soi da, khám da liễu và xây dựng phác đồ chăm sóc.",
    serviceFee: 25_000,
    items: [
      ["Khám da liễu", "Đánh giá tình trạng da hiện tại.", 250_000],
      ["Soi da", "Soi da bằng máy phóng đại.", 100_000],
      ["Tư vấn phác đồ", "Hướng dẫn chăm sóc và dùng thuốc.", 80_000],
    ],
  },
  {
    name: "Gói khám tai mũi họng",
    department: "Tai mũi họng",
    description: "Khám viêm họng, viêm xoang, ù tai và dị ứng mũi.",
    summary: "Khám chuyên khoa và nội soi tai mũi họng.",
    serviceFee: 25_000,
    isBHYTSupport: true,
    items: [
      ["Khám tai mũi họng", "Đánh giá triệu chứng đường hô hấp trên.", 200_000],
      ["Nội soi tai mũi họng", "Kiểm tra niêm mạc, vách ngăn, amidan.", 180_000],
    ],
  },
  {
    name: "Gói khám mắt",
    department: "Khoa mắt",
    description: "Kiểm tra thị lực và tầm soát bệnh lý về mắt.",
    summary: "Đo thị lực, đo khúc xạ, khám mắt chuyên khoa.",
    serviceFee: 20_000,
    isBHYTSupport: true,
    items: [
      ["Đo thị lực", "Kiểm tra thị lực nhìn xa, nhìn gần.", 40_000],
      ["Đo khúc xạ tự động", "Phát hiện cận, viễn, loạn thị.", 80_000],
      ["Khám mắt chuyên khoa", "Khám bán phần trước, đo nhãn áp.", 200_000],
    ],
  },
];

// Giá bán (VND) là giá tham khảo; tồn kho nhập theo lô với hạn dùng khác nhau.
type MedicineSeed = {
  code: string;
  name: string;
  activeIngredient: string;
  strength: string | null;
  dosageForm: string;
  unit: string;
  unitPrice: number;
  minStock: number;
  batches: { batchNumber: string; expiryDays: number; quantity: number }[];
};

const MEDICINES: MedicineSeed[] = [
  { code: "PARA500", name: "Paracetamol", activeIngredient: "Paracetamol", strength: "500mg", dosageForm: "Viên nén", unit: "viên", unitPrice: 1_000, minStock: 200, batches: [{ batchNumber: "PA2611A", expiryDays: 700, quantity: 1000 }, { batchNumber: "PA2603B", expiryDays: 400, quantity: 500 }] },
  { code: "IBU400", name: "Ibuprofen", activeIngredient: "Ibuprofen", strength: "400mg", dosageForm: "Viên nén bao phim", unit: "viên", unitPrice: 1_500, minStock: 100, batches: [{ batchNumber: "IB2610A", expiryDays: 600, quantity: 600 }] },
  { code: "AMOX500", name: "Amoxicillin", activeIngredient: "Amoxicillin", strength: "500mg", dosageForm: "Viên nang", unit: "viên", unitPrice: 2_500, minStock: 150, batches: [{ batchNumber: "AM2610A", expiryDays: 500, quantity: 600 }] },
  { code: "AUG625", name: "Amoxicillin + Acid clavulanic", activeIngredient: "Amoxicillin/Clavulanic", strength: "625mg", dosageForm: "Viên nén bao phim", unit: "viên", unitPrice: 9_000, minStock: 80, batches: [{ batchNumber: "AG2609A", expiryDays: 450, quantity: 300 }] },
  { code: "AZI250", name: "Azithromycin", activeIngredient: "Azithromycin", strength: "250mg", dosageForm: "Viên nang", unit: "viên", unitPrice: 6_000, minStock: 60, batches: [{ batchNumber: "AZ2608A", expiryDays: 520, quantity: 240 }] },
  { code: "CET10", name: "Cetirizin", activeIngredient: "Cetirizine", strength: "10mg", dosageForm: "Viên nén", unit: "viên", unitPrice: 1_200, minStock: 100, batches: [{ batchNumber: "CT2611A", expiryDays: 650, quantity: 500 }] },
  { code: "LORA10", name: "Loratadin", activeIngredient: "Loratadine", strength: "10mg", dosageForm: "Viên nén", unit: "viên", unitPrice: 1_500, minStock: 100, batches: [{ batchNumber: "LR2610A", expiryDays: 620, quantity: 400 }] },
  { code: "OME20", name: "Omeprazol", activeIngredient: "Omeprazole", strength: "20mg", dosageForm: "Viên nang", unit: "viên", unitPrice: 2_000, minStock: 100, batches: [{ batchNumber: "OM2609A", expiryDays: 540, quantity: 500 }] },
  { code: "AMLO5", name: "Amlodipin", activeIngredient: "Amlodipine", strength: "5mg", dosageForm: "Viên nén", unit: "viên", unitPrice: 1_000, minStock: 150, batches: [{ batchNumber: "AL2610A", expiryDays: 720, quantity: 900 }] },
  { code: "MET850", name: "Metformin", activeIngredient: "Metformin", strength: "850mg", dosageForm: "Viên nén bao phim", unit: "viên", unitPrice: 1_200, minStock: 150, batches: [{ batchNumber: "MF2610A", expiryDays: 680, quantity: 800 }] },
  { code: "ATOR20", name: "Atorvastatin", activeIngredient: "Atorvastatin", strength: "20mg", dosageForm: "Viên nén bao phim", unit: "viên", unitPrice: 3_000, minStock: 100, batches: [{ batchNumber: "AT2609A", expiryDays: 640, quantity: 500 }] },
  { code: "SALB2", name: "Salbutamol", activeIngredient: "Salbutamol", strength: "2mg", dosageForm: "Viên nén", unit: "viên", unitPrice: 800, minStock: 100, batches: [{ batchNumber: "SB2608A", expiryDays: 560, quantity: 400 }] },
  { code: "ORS", name: "Oresol", activeIngredient: "Muối khoáng và glucose", strength: null, dosageForm: "Gói bột", unit: "gói", unitPrice: 3_000, minStock: 100, batches: [{ batchNumber: "OR2611A", expiryDays: 420, quantity: 300 }, { batchNumber: "OR2606B", expiryDays: 45, quantity: 80 }] },
  { code: "VITC500", name: "Vitamin C", activeIngredient: "Acid ascorbic", strength: "500mg", dosageForm: "Viên nén", unit: "viên", unitPrice: 700, minStock: 100, batches: [{ batchNumber: "VC2609A", expiryDays: 500, quantity: 600 }] },
  { code: "NACL09", name: "Natri clorid 0,9% nhỏ mắt, mũi", activeIngredient: "Natri clorid", strength: "0,9%", dosageForm: "Dung dịch nhỏ", unit: "lọ", unitPrice: 6_000, minStock: 40, batches: [{ batchNumber: "NC2610A", expiryDays: 480, quantity: 200 }] },
];

async function createSchedules(doctorId: string) {
  const ranges = [
    { startTime: "08:00", endTime: "11:30" },
    { startTime: "13:30", endTime: "16:30" },
  ];
  await prisma.doctorSchedule.createMany({
    data: [1, 2, 3, 4, 5, 6].flatMap((dayOfWeek) =>
      ranges.map((range) => ({ doctorId, dayOfWeek, ...range, slotDuration: 30, maxPatients: 1, isActive: true })),
    ),
  });
}

async function generateSlots(doctorId: string) {
  const today = startOfTodayUtc();
  const schedules = await prisma.doctorSchedule.findMany({ where: { doctorId, isActive: true } });
  let count = 0;
  for (let offset = 0; offset < SLOT_DAYS; offset += 1) {
    const date = addDays(today, offset);
    const slots = schedules
      .filter((schedule) => schedule.dayOfWeek === date.getUTCDay())
      .flatMap((schedule) =>
        buildTimeSlots(schedule.startTime, schedule.endTime, schedule.slotDuration).map((slot) => ({
          doctorId,
          date,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      );
    if (slots.length) {
      await prisma.doctorTimeSlot.createMany({ data: slots, skipDuplicates: true });
      count += slots.length;
    }
  }
  return count;
}

async function seedMedicines(actorId: string) {
  const today = Date.parse(`${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)}T00:00:00Z`);
  for (const item of MEDICINES) {
    const total = item.batches.reduce((sum, batch) => sum + batch.quantity, 0);
    await prisma.$transaction(async (tx) => {
      const medicine = await tx.medicine.create({
        data: {
          code: item.code,
          name: item.name,
          activeIngredient: item.activeIngredient,
          strength: item.strength,
          dosageForm: item.dosageForm,
          unit: item.unit,
          unitPrice: item.unitPrice,
          minStock: item.minStock,
          stockQuantity: total,
        },
      });
      let balance = 0;
      for (const batch of item.batches) {
        const created = await tx.stockBatch.create({
          data: {
            medicineId: medicine.id,
            batchNumber: batch.batchNumber,
            expiryDate: new Date(today + batch.expiryDays * 86_400_000),
            receivedQuantity: batch.quantity,
            quantity: batch.quantity,
          },
        });
        balance += batch.quantity;
        await tx.stockMovement.create({
          data: {
            medicineId: medicine.id,
            batchId: created.id,
            type: "RECEIPT",
            quantity: batch.quantity,
            balanceAfter: balance,
            reason: "Nhập kho ban đầu",
            actorId,
          },
        });
      }
    });
  }
  return MEDICINES.length;
}

async function seedSiteContent() {
  const value = {
    hospitalName: "DevKun Care",
    hotline: "1900 1234",
    emergencyHotline: "115",
    email: `contact@${EMAIL_DOMAIN}`,
    address: "475A Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh",
    workingHours: "Thứ 2 - Thứ 7, 08:00 - 16:30",
    mapUrl: "https://maps.google.com/?q=475A+Điện+Biên+Phủ,+Bình+Thạnh",
  };
  await prisma.siteSetting.upsert({
    where: { key: "site_settings" },
    update: { value, isActive: true },
    create: { key: "site_settings", value, description: "Thông tin liên hệ và giờ làm việc", isActive: true },
  });

  await prisma.chatbotSetting.upsert({
    where: { key: "runtime" },
    update: {},
    create: {
      key: "runtime",
      value: {
        aiEnabled: false,
        fallbackEnabled: true,
        faqEnabled: true,
        model: runtimeConfig.chatbot.model,
        maxSuggestedActions: 4,
        sessionExpiresDays: 7,
      },
      description: "Cấu hình trợ lý ảo",
      isActive: true,
    },
  });

  await prisma.banner.createMany({
    data: [
      { title: "Đặt lịch khám chủ động", subtitle: "Chọn chuyên khoa, bác sĩ và khung giờ phù hợp chỉ trong vài bước.", image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1600&q=80", linkUrl: "/chuyen-khoa", target: "_self", position: "HOME_HERO", order: 1, isActive: true },
      { title: "Gói khám sức khỏe tổng quát", subtitle: "Tầm soát định kỳ với chi phí minh bạch.", image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1600&q=80", linkUrl: "/goi-kham", target: "_self", position: "HOME_HERO", order: 2, isActive: true },
      { title: "Cần tư vấn trước khi đến khám?", subtitle: "Xem hướng dẫn đặt lịch hoặc hỏi trợ lý ảo.", image: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1600&q=80", linkUrl: "/huong-dan/dat-lich", target: "_self", position: "HOME_PROMO", order: 1, isActive: true },
    ],
  });
}

async function seedClinicData() {
  const password = process.env.SEED_PASSWORD ?? "";
  if (password.length < 12) {
    throw new Error("Đặt SEED_PASSWORD (tối thiểu 12 ký tự) trước khi chạy seed.");
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim() || "devkun22@gmail.com";

  await resetDatabase();

  const admin = await createUser({ fullName: "Quản trị viên", phone: "0352412318", email: adminEmail, role: "ADMIN", password });
  await createUser({ fullName: "Nguyễn Thị Thanh Thảo", phone: "0352147201", email: `staff@${EMAIL_DOMAIN}`, role: "STAFF", password });
  await createUser({ fullName: "Trần Văn Khôi", phone: "0352147208", email: `pharmacist@${EMAIL_DOMAIN}`, role: "PHARMACIST", password });

  const departments = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const created = await prisma.department.upsert({
      where: { name: dept.name },
      update: { slug: toSlug(dept.name), isActive: true },
      create: {
        name: dept.name,
        slug: toSlug(dept.name),
        description: dept.description,
        symptomKeywords: [...dept.symptomKeywords],
        triageDescription: dept.triageDescription,
        isTriageFallback: "isTriageFallback" in dept ? dept.isTriageFallback : false,
        isActive: true,
      },
    });
    departments.set(dept.name, created.id);
  }

  let slotTotal = 0;
  for (const doctor of DOCTORS) {
    const emailLocal = `doctor.${toSlug(doctor.name).replace(/-/g, "")}`;
    const user = await createUser({ fullName: doctor.name, phone: doctor.phone, email: `${emailLocal}@${EMAIL_DOMAIN}`, role: "DOCTOR", password });
    if (doctor.avatar) await prisma.user.update({ where: { id: user.id }, data: { avatar: doctor.avatar } });
    const departmentName = doctor.dept;
    const profile = await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        slug: toSlug(doctor.name),
        departmentId: departments.get(departmentName)!,
        title: doctor.title,
        specialization: departmentName.replace(/^Khoa /, ""),
        bio: `${doctor.title} ${doctor.name} có ${doctor.experience} năm kinh nghiệm khám và điều trị tại ${departmentName.toLowerCase()}.`,
        experience: doctor.experience,
        consultationFee: doctor.fee,
        isAvailable: true,
      },
    });
    await createSchedules(profile.id);
    slotTotal += await generateSlots(profile.id);
  }

  for (const pack of PACKAGES) {
    const basePrice = pack.items.reduce((sum, [, , price]) => sum + price, 0);
    await prisma.package.create({
      data: {
        name: pack.name,
        slug: toSlug(pack.name),
        description: pack.description,
        summary: pack.summary,
        departmentId: departments.get(pack.department)!,
        basePrice,
        serviceFee: pack.serviceFee,
        isPopular: pack.isPopular ?? false,
        isBHYTSupport: pack.isBHYTSupport ?? false,
        isActive: true,
        items: {
          create: pack.items.map(([name, description, price], index) => ({ name, description, price, included: true, order: index + 1 })),
        },
      },
    });
  }

  const medicineCount = await seedMedicines(admin.id);
  await seedSiteContent();

  console.log("Seed dữ liệu phòng khám hoàn tất");
  console.table([
    { key: "adminEmail", value: adminEmail },
    { key: "departments", value: DEPARTMENTS.length },
    { key: "doctors", value: DOCTORS.length },
    { key: "packages", value: PACKAGES.length },
    { key: "medicines", value: medicineCount },
    { key: "generatedSlots", value: slotTotal },
    { key: "reset", value: runtimeConfig.demoSeed.resetRequested ? "yes" : "no" },
  ]);
}

seedClinicData()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
