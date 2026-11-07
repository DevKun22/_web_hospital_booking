import { prisma } from "../config/prisma.js";

const faqs = [
  {
    question: "Bệnh viện làm việc mấy giờ?",
    legacyQuestions: ["Benh vien lam viec may gio?"],
    answer:
      "Bệnh viện hỗ trợ khám trong giờ hành chính. Bạn nên đặt lịch trước để được sắp xếp khung giờ phù hợp và giảm thời gian chờ.",
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
    question: "Bệnh viện hỗ trợ thanh toán như thế nào?",
    legacyQuestions: ["Benh vien ho tro thanh toan nhu the nao?"],
    answer:
      "Hệ thống hỗ trợ ghi nhận thanh toán tại quầy và sẵn sàng tích hợp thanh toán online như MOMO hoặc VNPAY khi cấu hình được kích hoạt.",
    keywords: [
      "thanh toan",
      "hoa don",
      "vien phi",
      "momo",
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
      "Sau khi hoàn tất khám, hồ sơ khám, đơn thuốc hoặc kết quả cận lâm sàng sẽ được cập nhật theo quy trình của bệnh viện. Bạn có thể liên hệ nhân viên nếu cần hỗ trợ tra cứu.",
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

async function seedChatbotFAQ() {
  for (const faq of faqs) {
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

  console.log(`Seeded ${faqs.length} chatbot FAQs`);
}

seedChatbotFAQ()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
