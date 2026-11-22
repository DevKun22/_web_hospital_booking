import { prisma } from "../config/prisma.js";

const faqs = [
  {
    question: "Cơ sở khám làm việc mấy giờ?",
    legacyQuestions: ["Benh vien lam viec may gio?"],
    answer:
      "Cơ sở khám hỗ trợ khám trong giờ hành chính. Bạn nên đặt lịch trước để được sắp xếp khung giờ phù hợp và giảm thời gian chờ.",
    keywords: [
      "gio lam viec",
      "lam viec may gio",
      "thoi gian lam viec",
      "gio mo cua",
      "giờ làm việc",
    ],
  },
  {
    question: "Tôi nên chuẩn bị gì trước khi đi khám?",
    legacyQuestions: [],
    answer:
      "Bạn nên mang giấy tờ tùy thân, thẻ BHYT nếu có, đơn thuốc hoặc kết quả xét nghiệm cũ. Nếu đã đặt lịch, hãy lưu mã lịch để tra cứu và xác thực khi cần.",
    keywords: [
      "chuan bi truoc khi kham",
      "can mang gi",
      "giay to",
      "ket qua cu",
      "chuẩn bị",
      "đi khám cần gì",
    ],
  },
  {
    question: "Tôi đặt lịch khám như thế nào?",
    legacyQuestions: ["Toi dat lich kham nhu the nao?"],
    answer:
      "Bạn có thể bắt đầu bằng cách chọn chuyên khoa hoặc mô tả nhu cầu khám. Trợ lý sẽ gợi ý gói khám, bác sĩ và lịch trống phù hợp để bạn tiếp tục đặt lịch.",
    keywords: [
      "huong dan dat lich",
      "cach dat lich",
      "quy trinh dat lich",
      "đặt lịch",
      "đặt lịch khám",
    ],
  },
  {
    question: "Tôi quên mã lịch thì phải làm sao?",
    legacyQuestions: [],
    answer:
      "Bạn không cần mã lịch. Hãy đăng nhập Tài khoản bằng số điện thoại đã đặt lịch và mã OTP để xem toàn bộ lịch hẹn gần đây.",
    keywords: [
      "quen ma lich",
      "quen ma dat lich",
      "khong nho ma lich",
      "tra cuu lich",
      "quên mã",
      "mã lịch",
    ],
  },
  {
    question: "Cơ sở khám hỗ trợ thanh toán như thế nào?",
    legacyQuestions: ["Benh vien ho tro thanh toan nhu the nao?"],
    answer:
      "Hệ thống hỗ trợ ghi nhận thanh toán tại quầy và thanh toán online qua VNPay.",
    keywords: [
      "thanh toan",
      "hoa don",
      "vien phi",
      "vnpay",
      "chuyen khoan",
      "thanh toán",
      "hóa đơn",
    ],
  },
  {
    question: "Có hỗ trợ bảo hiểm y tế không?",
    legacyQuestions: ["Co ho tro bao hiem y te khong?"],
    answer:
      "Một số gói khám có thể hỗ trợ BHYT tùy theo chính sách, tuyến khám và thông tin thẻ của người khám. Bạn nên mang theo thẻ BHYT và giấy tờ liên quan khi đến khám.",
    keywords: [
      "bhyt",
      "bao hiem y te",
      "bao hiem",
      "the bao hiem",
      "bảo hiểm y tế",
      "thẻ bảo hiểm",
    ],
  },
  {
    question: "Tôi tra cứu lịch hẹn ở đâu?",
    legacyQuestions: ["Toi tra cuu lich hen o dau?"],
    answer:
      "Bạn đăng nhập Tài khoản bằng số điện thoại đã đặt lịch và mã OTP để xem, hủy lịch, kết quả khám và hóa đơn. Nếu cần hỗ trợ thêm, hãy liên hệ nhân viên tiếp nhận.",
    keywords: [
      "tra cuu lich hen",
      "kiem tra lich hen",
      "lich hen",
      "ma dat lich",
      "tra cứu lịch hẹn",
      "mã đặt lịch",
    ],
  },
  {
    question: "Tôi có thể hủy hoặc đổi lịch khám không?",
    legacyQuestions: ["Toi co the huy lich kham khong?"],
    answer:
      "Bạn có thể liên hệ nhân viên hỗ trợ để hủy hoặc đổi lịch nếu lịch chưa đến thời gian thực hiện. Một số trường hợp cần kiểm tra trạng thái lịch trước khi thay đổi.",
    keywords: [
      "huy lich",
      "doi lich",
      "huy lich kham",
      "doi lich kham",
      "hủy lịch",
      "đổi lịch",
    ],
  },
  {
    question: "Khi nào cần đi cấp cứu ngay?",
    legacyQuestions: [],
    answer:
      "Nếu có dấu hiệu như đau ngực dữ dội, khó thở nặng, ngất, co giật, yếu liệt hoặc chảy máu nhiều, bạn nên đến cơ sở y tế gần nhất hoặc gọi cấp cứu ngay.",
    keywords: [
      "cap cuu",
      "khan cap",
      "dau nguc du doi",
      "kho tho nang",
      "ngat",
      "co giat",
      "yếu liệt",
      "cấp cứu",
    ],
  },
  {
    question: "Tôi xem kết quả khám và hồ sơ ở đâu?",
    legacyQuestions: [],
    answer:
      "Sau khi hoàn tất khám, hồ sơ khám, đơn thuốc hoặc kết quả cận lâm sàng sẽ được cập nhật theo quy trình của cơ sở khám. Bạn có thể liên hệ nhân viên nếu cần hỗ trợ tra cứu.",
    keywords: [
      "ket qua kham",
      "ho so kham",
      "don thuoc",
      "can lam sang",
      "kết quả",
      "hồ sơ khám",
    ],
  },
  {
    question: "Tôi chưa biết nên chọn chuyên khoa nào?",
    legacyQuestions: [],
    answer:
      "Bạn có thể mô tả triệu chứng, vị trí đau, thời gian xuất hiện và mức độ khó chịu. Trợ lý sẽ gợi ý chuyên khoa phù hợp dựa trên dữ liệu đang có.",
    keywords: [
      "khong biet chon khoa nao",
      "chon chuyen khoa",
      "tu van chuyen khoa",
      "triệu chứng",
      "chuyên khoa nào",
    ],
  },
];

// Câu hỏi bổ sung: mỗi câu đối chiếu với mã nguồn hiện tại (xem chú thích), không có số liệu hay lời khuyên y khoa.
// Chỉ TẠO khi chưa có câu cùng nội dung; không ghi đè câu quản trị đã sửa và không xóa câu nào.
const extraFaqs: { question: string; answer: string; keywords: string[] }[] = [
  {
    // booking-steps.tsx: "Cổng thông tin ... Không bắt buộc"; appointmentBooking.service.ts: xác thực bằng OTP gửi tới email.
    question: "Đặt lịch có cần tạo tài khoản không?",
    answer:
      "Không bắt buộc. Bạn chọn chuyên khoa hoặc gói khám, bác sĩ và khung giờ, nhập thông tin người khám rồi xác thực bằng mã OTP gửi về email. Tài khoản chỉ cần khi bạn muốn theo dõi lịch, hóa đơn và hồ sơ trong Cổng thông tin.",
    keywords: ["tao tai khoan", "dang ky tai khoan", "khong can tai khoan", "dat lich khong dang nhap", "tài khoản", "không đăng nhập"],
  },
  {
    // patientAuth.service.ts: OTP gửi về chính email; booking-steps.tsx: "Nhập mã gửi về email".
    question: "Mã OTP được gửi qua đâu?",
    answer:
      "Mã OTP được gửi về địa chỉ email bạn nhập khi đặt lịch hoặc đăng nhập. Hãy nhập đúng email của mình và kiểm tra cả thư mục thư rác nếu chưa thấy thư.",
    keywords: ["ma otp", "otp gui ve dau", "khong nhan duoc otp", "email otp", "mã xác thực", "không nhận được mã"],
  },
  {
    // invoice.service.ts: thanh toán VNPAY online qua API; Cổng thông tin có mục Hóa đơn (app/tai-khoan/(portal)/hoa-don).
    question: "Cơ sở khám có hỗ trợ thanh toán online qua VNPay không?",
    answer:
      "Cơ sở khám hỗ trợ thanh toán online qua VNPay và thanh toán tại quầy. Bạn xem hóa đơn và trạng thái thanh toán trong Cổng thông tin (mục Hóa đơn) sau khi đăng nhập.",
    keywords: ["vnpay", "thanh toan online", "thanh toan hoa don", "tra tien online", "thanh toán trực tuyến", "hóa đơn"],
  },
  {
    // policy.service.ts / chunker policyDoc: giữ chỗ và mốc tự hủy do cơ sở cấu hình, nên không nêu số cụ thể ở đây.
    question: "Khung giờ đặt được giữ trong bao lâu?",
    answer:
      "Sau khi chọn khung giờ, hệ thống giữ chỗ trong một khoảng thời gian ngắn để bạn nhập mã OTP. Quá thời hạn mà chưa xác thực thì khung giờ được nhả ra và bạn cần đặt lại. Thời gian giữ chỗ cụ thể hiển thị ngay trên màn hình đặt lịch.",
    keywords: ["giu cho", "het han giu cho", "khung gio bi nha", "thoi gian giu lich", "giữ chỗ", "hết hạn"],
  },
  {
    // appointmentBooking.service.ts: tự hủy cho tới mốc patientCancelCutoffHours trước giờ khám (cấu hình ở chính sách).
    question: "Tôi tự hủy lịch trên website được đến khi nào?",
    answer:
      "Bạn có thể tự hủy lịch trong Cổng thông tin (mục Lịch hẹn) cho đến một mốc trước giờ khám do cơ sở quy định. Sau mốc này hoặc khi cần đổi lịch, bạn liên hệ nhân viên hỗ trợ để được giúp.",
    keywords: ["huy lich tren web", "tu huy lich", "han huy lich", "huy truoc bao lau", "hủy lịch", "mốc hủy"],
  },
  {
    // app/tai-khoan/(portal): lich-hen, hoa-don, ho-so-suc-khoe, thong-bao.
    question: "Cổng thông tin cho tôi xem những gì?",
    answer:
      "Sau khi đăng nhập bằng email và mã OTP, Cổng thông tin cho bạn xem lịch hẹn, hóa đơn và thanh toán, hồ sơ sức khỏe cùng kết quả khám đã được công bố, và thông báo từ cơ sở khám.",
    keywords: ["cong thong tin", "tai khoan nguoi kham", "xem lich hoa don ket qua", "portal", "cổng thông tin", "hồ sơ sức khỏe"],
  },
  {
    // booking-steps.tsx: "Nhập thông tin — Thông tin người khám và BHYT nếu có."
    question: "Tôi nhập thông tin BHYT ở bước nào khi đặt lịch?",
    answer:
      "Ở bước Nhập thông tin của trang đặt lịch, bạn điền thông tin người khám và thông tin BHYT nếu có. Việc BHYT áp dụng cho dịch vụ nào tùy theo từng gói khám và quy định của cơ sở.",
    keywords: ["nhap bhyt", "the bhyt khi dat lich", "bao hiem y te o buoc nao", "thông tin bhyt", "bước nhập thông tin"],
  },
];

// Chạy thử: `--dry-run` chỉ đếm, không ghi cơ sở dữ liệu (cả FAQ nền lẫn bổ sung).
const DRY_RUN = process.argv.includes("--dry-run");
// `--extra-only`: chỉ thêm các câu bổ sung (không cập nhật 11 câu nền đã có, tránh ghi đè chỉnh sửa của quản trị).
const EXTRA_ONLY = process.argv.includes("--extra-only");

async function seedChatbotFAQ() {
  for (const faq of DRY_RUN || EXTRA_ONLY ? [] : faqs) {
    const existingFAQ = await prisma.fAQ.findFirst({
      where: {
        OR: [faq.question, ...faq.legacyQuestions].map((question) => ({
          question: {
            equals: question,
            mode: "insensitive" as const,
          },
        })),
      },
      select: { id: true },
    });

    if (existingFAQ) {
      await prisma.fAQ.update({
        where: { id: existingFAQ.id },
        data: {
          question: faq.question,
          answer: faq.answer,
          keywords: faq.keywords,
          useInChatbot: true,
          isActive: true,
        },
      });
      continue;
    }

    await prisma.fAQ.create({
      data: {
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords,
        showOnWeb: false,
        useInChatbot: true,
        isActive: true,
      },
    });
  }

  let created = 0;
  let skipped = 0;
  for (const faq of extraFaqs) {
    const existing = await prisma.fAQ.findFirst({ where: { question: { equals: faq.question, mode: "insensitive" } }, select: { id: true } });
    if (existing) {
      skipped += 1;
      continue;
    }
    if (!DRY_RUN) {
      await prisma.fAQ.create({
        data: { question: faq.question, answer: faq.answer, keywords: faq.keywords, showOnWeb: true, useInChatbot: true, isActive: true },
      });
    }
    created += 1;
  }

  console.log(`${DRY_RUN ? "[chạy thử, không ghi] " : ""}FAQ nền: ${faqs.length}; FAQ bổ sung: ${created} mới, ${skipped} đã có`);
}

seedChatbotFAQ()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
