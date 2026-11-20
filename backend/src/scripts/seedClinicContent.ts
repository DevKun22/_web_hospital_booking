/**
 * Nội dung công khai cho dữ liệu mẫu phòng khám: giới thiệu chuyên khoa, hồ sơ bác sĩ, thông tin gói khám,
 * cơ sở khám và bài viết kiến thức. Chỉ là văn bản tham khảo chung, không nêu bệnh viện, hiệp hội hay thành tích có thật.
 * Dùng bởi seedClinicData.ts; mọi khóa tra cứu là tên chuyên khoa hoặc tên gói trong file đó.
 */

export const CONTENT_REVIEWER = { doctorName: "Nguyễn Minh Hùng", display: "BS.CKII Nguyễn Minh Hùng" };

type Section = { title: string; body: string };

/** Ba mục cho mỗi chuyên khoa: giới thiệu, khi nào nên khám, chuẩn bị trước khi khám. */
export const DEPARTMENT_SECTIONS: Record<string, Section[]> = {
  "Khoa tổng quát": [
    { title: "Giới thiệu", body: "Khoa tổng quát là nơi bắt đầu khi bạn chưa rõ nên khám chuyên khoa nào. Bác sĩ hỏi bệnh, khám lâm sàng, chỉ định xét nghiệm cơ bản và hướng dẫn bạn đến đúng chuyên khoa nếu cần." },
    { title: "Khi nào nên khám", body: "- Mệt mỏi, sốt, đau đầu hoặc chóng mặt kéo dài chưa rõ nguyên nhân.\n- Muốn kiểm tra sức khỏe định kỳ hằng năm.\n- Cần tư vấn trước khi bắt đầu chế độ ăn, tập luyện hoặc dùng thuốc dài ngày." },
    { title: "Chuẩn bị trước khi khám", body: "Mang giấy tờ tùy thân, thẻ BHYT nếu có, đơn thuốc và kết quả xét nghiệm gần nhất. Nếu có xét nghiệm máu, bạn nên nhịn ăn theo hướng dẫn của cơ sở khám." },
  ],
  "Khoa tim mạch": [
    { title: "Giới thiệu", body: "Khoa tim mạch khám và theo dõi tăng huyết áp, rối loạn nhịp tim, bệnh mạch vành và các vấn đề liên quan đến tuần hoàn." },
    { title: "Khi nào nên khám", body: "- Đau tức ngực, hồi hộp, tim đập nhanh hoặc khó thở khi gắng sức.\n- Huyết áp đo tại nhà thường xuyên cao.\n- Gia đình có người mắc bệnh tim mạch sớm.\n\nNếu đau ngực dữ dội, vã mồ hôi, khó thở hoặc ngất, hãy gọi cấp cứu 115 thay vì đặt lịch." },
    { title: "Chuẩn bị trước khi khám", body: "Ghi lại các chỉ số huyết áp đo tại nhà (kèm giờ đo), danh sách thuốc đang dùng và các lần khám tim mạch trước đây. Mặc áo rộng để dễ đo điện tim." },
  ],
  "Khoa nội tiết": [
    { title: "Giới thiệu", body: "Khoa nội tiết tầm soát và theo dõi đái tháo đường, rối loạn tuyến giáp, rối loạn mỡ máu và các vấn đề chuyển hóa." },
    { title: "Khi nào nên khám", body: "- Khát nhiều, tiểu nhiều, sụt cân không rõ lý do.\n- Bướu cổ, hồi hộp, run tay hoặc mệt mỏi, tăng cân bất thường.\n- Kết quả xét nghiệm có đường huyết hoặc mỡ máu cao." },
    { title: "Chuẩn bị trước khi khám", body: "Nhịn ăn 8 đến 10 tiếng nếu được chỉ định xét nghiệm đường huyết hoặc mỡ máu lúc đói; vẫn có thể uống nước lọc. Mang theo kết quả xét nghiệm cũ để bác sĩ so sánh." },
  ],
  "Khoa cơ xương khớp": [
    { title: "Giới thiệu", body: "Khoa cơ xương khớp khám đau lưng, thoái hóa khớp, đau cổ vai gáy và chấn thương vận động nhẹ, kèm hướng dẫn vận động phù hợp." },
    { title: "Khi nào nên khám", body: "- Đau lưng hoặc đau khớp kéo dài hơn vài tuần.\n- Tê tay chân, cứng khớp buổi sáng.\n- Đau tăng khi vận động hoặc ảnh hưởng giấc ngủ." },
    { title: "Chuẩn bị trước khi khám", body: "Mang phim chụp hoặc kết quả chẩn đoán hình ảnh trước đó nếu có. Nên mặc quần áo thoải mái để bác sĩ đánh giá tầm vận động." },
  ],
  "Khoa nhi": [
    { title: "Giới thiệu", body: "Khoa nhi khám bệnh trẻ em, tư vấn dinh dưỡng, tiêm chủng và theo dõi sự phát triển của trẻ theo từng độ tuổi." },
    { title: "Khi nào nên khám", body: "- Trẻ sốt, ho kéo dài hoặc biếng ăn.\n- Chậm tăng cân, phát ban, quấy khóc bất thường.\n- Cần theo dõi phát triển hoặc tư vấn tiêm chủng.\n\nTrẻ sốt cao khó hạ, li bì, thở nhanh hoặc co giật cần được đưa đến cơ sở cấp cứu ngay." },
    { title: "Chuẩn bị trước khi khám", body: "Mang sổ tiêm chủng và sổ khám cũ của trẻ. Ghi lại thời điểm bắt đầu triệu chứng, nhiệt độ đo được và các thuốc trẻ đã dùng." },
  ],
  "Khoa sản": [
    { title: "Giới thiệu", body: "Khoa sản theo dõi thai kỳ, khám phụ khoa và tư vấn sức khỏe sinh sản." },
    { title: "Khi nào nên khám", body: "- Trễ kinh hoặc nghi ngờ có thai.\n- Khám thai định kỳ theo lịch hẹn.\n- Khí hư bất thường, đau bụng dưới hoặc rối loạn kinh nguyệt.\n\nĐau bụng dữ dội, ra máu âm đạo nhiều khi có thai cần đến cơ sở cấp cứu ngay." },
    { title: "Chuẩn bị trước khi khám", body: "Nhớ ngày đầu của kỳ kinh gần nhất, mang sổ khám thai và kết quả siêu âm, xét nghiệm trước đó. Nên đặt lịch ngoài những ngày hành kinh nếu khám phụ khoa." },
  ],
  "Da liễu": [
    { title: "Giới thiệu", body: "Khoa da liễu khám và điều trị mụn, viêm da, dị ứng và hướng dẫn chăm sóc da theo chỉ định của bác sĩ." },
    { title: "Khi nào nên khám", body: "- Ngứa, nổi mẩn hoặc phát ban kéo dài.\n- Mụn viêm nhiều, da đỏ rát sau khi dùng sản phẩm mới.\n- Nốt ruồi hoặc mảng da thay đổi hình dạng, màu sắc." },
    { title: "Chuẩn bị trước khi khám", body: "Hạn chế trang điểm vùng cần khám, mang theo các sản phẩm và thuốc đang bôi để bác sĩ xem thành phần." },
  ],
  "Tai mũi họng": [
    { title: "Giới thiệu", body: "Khoa tai mũi họng khám viêm họng, viêm xoang, ù tai, dị ứng mũi và các bệnh lý hô hấp trên." },
    { title: "Khi nào nên khám", body: "- Đau họng, nghẹt mũi hoặc chảy mũi kéo dài.\n- Ù tai, đau tai hoặc nghe kém.\n- Khàn tiếng kéo dài trên hai tuần." },
    { title: "Chuẩn bị trước khi khám", body: "Mang theo kết quả nội soi hoặc chụp xoang trước đó nếu có. Không tự ý nhỏ thuốc vào tai, mũi trước khi bác sĩ thăm khám." },
  ],
  "Khoa mắt": [
    { title: "Giới thiệu", body: "Khoa mắt khám tật khúc xạ, mỏi mắt, viêm kết mạc và tầm soát bệnh lý võng mạc." },
    { title: "Khi nào nên khám", body: "- Nhìn mờ, mỏi mắt hoặc đau đầu khi nhìn gần lâu.\n- Mắt đỏ, chảy nước mắt hoặc có dử.\n- Người đái tháo đường nên khám đáy mắt định kỳ." },
    { title: "Chuẩn bị trước khi khám", body: "Mang theo kính đang dùng. Nếu đeo kính áp tròng, hãy tháo ra và nghỉ theo hướng dẫn trước khi đo khúc xạ. Sau khi nhỏ thuốc giãn đồng tử bạn nên có người đi cùng." },
  ],
};

/** Lĩnh vực chuyên sâu hiện trên hồ sơ bác sĩ, suy ra từ chuyên khoa. */
export const DEPARTMENT_EXPERTISE: Record<string, string[]> = {
  "Khoa tổng quát": ["Khám sức khỏe tổng quát", "Tầm soát bệnh thường gặp", "Tư vấn lối sống"],
  "Khoa tim mạch": ["Tăng huyết áp", "Rối loạn nhịp tim", "Phòng ngừa bệnh tim mạch"],
  "Khoa nội tiết": ["Đái tháo đường", "Bệnh tuyến giáp", "Rối loạn mỡ máu"],
  "Khoa cơ xương khớp": ["Đau lưng, đau cổ vai gáy", "Thoái hóa khớp", "Chấn thương vận động nhẹ"],
  "Khoa nhi": ["Bệnh thường gặp ở trẻ em", "Dinh dưỡng và tăng trưởng", "Tư vấn tiêm chủng"],
  "Khoa sản": ["Theo dõi thai kỳ", "Khám phụ khoa", "Tư vấn sức khỏe sinh sản"],
  "Da liễu": ["Mụn và viêm da", "Dị ứng da", "Chăm sóc da y khoa"],
  "Tai mũi họng": ["Viêm xoang, viêm họng", "Dị ứng mũi", "Ù tai, đau tai"],
  "Khoa mắt": ["Tật khúc xạ", "Mỏi mắt, viêm kết mạc", "Tầm soát võng mạc"],
};

type PackageContent = { audience: string[]; resultTime: string; note?: string; faq: { question: string; answer: string }[] };

const FASTING_FAQ = {
  question: "Tôi có cần nhịn ăn trước khi khám không?",
  answer: "Nếu gói có xét nghiệm máu lúc đói, bạn nhịn ăn 8 đến 10 tiếng và chỉ uống nước lọc. Cơ sở khám sẽ nhắc lại hướng dẫn khi xác nhận lịch.",
};
const CHANGE_FAQ = {
  question: "Tôi có thể đổi giờ hoặc hủy lịch không?",
  answer: "Bạn có thể đổi hoặc hủy lịch trong mục Lịch hẹn của tôi theo thời hạn ghi trên điều khoản đặt lịch.",
};

export const PACKAGE_CONTENT: Record<string, PackageContent> = {
  "Gói khám tổng quát cơ bản": {
    audience: ["Người trưởng thành chưa có bệnh lý nền", "Người muốn kiểm tra sức khỏe lần đầu hoặc khám hằng năm"],
    resultTime: "Trong ngày; xét nghiệm nước tiểu và máu có kết quả sau 2 đến 4 giờ",
    note: "Giá hiển thị là giá tham khảo, chi phí thực tế có thể thay đổi nếu bác sĩ chỉ định thêm.",
    faq: [FASTING_FAQ, CHANGE_FAQ],
  },
  "Gói khám sức khỏe tổng quát nâng cao": {
    audience: ["Người từ 35 tuổi trở lên", "Người có yếu tố nguy cơ như hút thuốc, thừa cân, gia đình có bệnh mạn tính"],
    resultTime: "Xét nghiệm trong ngày; chẩn đoán hình ảnh và bác sĩ kết luận trong 1 đến 2 ngày làm việc",
    faq: [FASTING_FAQ, { question: "Gói này có gồm khám chuyên khoa không?", answer: "Gói gồm khám lâm sàng tổng quát. Nếu kết quả cần theo dõi thêm, bác sĩ sẽ giới thiệu bạn đến chuyên khoa phù hợp." }],
  },
  "Gói khám tim mạch": {
    audience: ["Người hồi hộp, đau tức ngực hoặc khó thở khi gắng sức", "Người tăng huyết áp hoặc có người thân mắc bệnh tim mạch"],
    resultTime: "Điện tim và siêu âm có kết quả ngay sau khi thực hiện",
    faq: [{ question: "Tôi nên mang theo gì?", answer: "Danh sách thuốc đang dùng, chỉ số huyết áp đo tại nhà và kết quả tim mạch trước đây nếu có." }, CHANGE_FAQ],
  },
  "Gói tầm soát đái tháo đường": {
    audience: ["Người thừa cân hoặc ít vận động", "Người có người thân mắc đái tháo đường", "Người có đường huyết hoặc mỡ máu cao ở lần xét nghiệm trước"],
    resultTime: "Đường huyết ngay trong buổi khám; HbA1c và mỡ máu trong ngày",
    faq: [FASTING_FAQ, CHANGE_FAQ],
  },
  "Gói khám cơ xương khớp": {
    audience: ["Người đau lưng, đau cổ vai gáy kéo dài", "Người làm việc văn phòng ngồi lâu hoặc lao động nặng"],
    resultTime: "Khám và tư vấn ngay; phim chụp có kết quả trong ngày",
    faq: [{ question: "Tôi có cần mang phim cũ không?", answer: "Nên mang phim hoặc kết quả chẩn đoán hình ảnh trước đó để bác sĩ so sánh." }, CHANGE_FAQ],
  },
  "Gói khám nhi cơ bản": {
    audience: ["Trẻ em cần khám định kỳ hoặc tư vấn dinh dưỡng", "Trẻ có biểu hiện biếng ăn, chậm tăng cân"],
    resultTime: "Khám và tư vấn ngay trong buổi khám",
    faq: [{ question: "Tôi nên mang theo gì cho bé?", answer: "Sổ tiêm chủng, sổ khám cũ và danh sách thuốc bé đang dùng." }, CHANGE_FAQ],
  },
  "Gói khám thai định kỳ": {
    audience: ["Thai phụ theo dõi thai kỳ theo lịch hẹn", "Người cần tư vấn chăm sóc trước và sau sinh"],
    resultTime: "Siêu âm có kết quả ngay; xét nghiệm trong ngày",
    faq: [{ question: "Tôi nên mang theo gì?", answer: "Sổ khám thai, kết quả siêu âm và xét nghiệm các lần trước." }, CHANGE_FAQ],
  },
  "Gói khám da liễu": {
    audience: ["Người bị mụn, viêm da hoặc dị ứng da", "Người cần xây dựng phác đồ chăm sóc da"],
    resultTime: "Khám và tư vấn ngay trong buổi khám",
    faq: [{ question: "Tôi có nên trang điểm khi đi khám không?", answer: "Nên hạn chế trang điểm vùng cần khám để bác sĩ quan sát rõ tình trạng da." }, CHANGE_FAQ],
  },
  "Gói khám tai mũi họng": {
    audience: ["Người viêm họng, viêm xoang hoặc nghẹt mũi kéo dài", "Người ù tai, đau tai hoặc khàn tiếng"],
    resultTime: "Nội soi có kết quả ngay sau khi thực hiện",
    faq: [{ question: "Nội soi có đau không?", answer: "Nội soi tai mũi họng thường chỉ gây khó chịu nhẹ trong thời gian ngắn; bác sĩ sẽ giải thích trước khi thực hiện." }, CHANGE_FAQ],
  },
  "Gói khám mắt": {
    audience: ["Người nhìn mờ hoặc mỏi mắt khi dùng thiết bị điện tử", "Người cần kiểm tra thị lực định kỳ"],
    resultTime: "Đo thị lực và khúc xạ có kết quả ngay; khám chuyên khoa kết luận trong buổi khám",
    faq: [{ question: "Tôi có cần tháo kính áp tròng không?", answer: "Có. Bạn nên tháo kính áp tròng và nghỉ theo hướng dẫn của cơ sở trước khi đo khúc xạ." }, CHANGE_FAQ],
  },
};

export const FACILITIES = [
  {
    name: "DevKunCare - Cơ sở Bình Thạnh",
    slug: "co-so-binh-thanh",
    address: "475A Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh",
    workingHours: "Thứ 2 - Thứ 7, 08:00 - 16:30",
    mapUrl: "https://maps.google.com/?q=475A+Điện+Biên+Phủ,+Bình+Thạnh",
    isDefault: true,
  },
  {
    name: "DevKunCare - Cơ sở Thủ Đức",
    slug: "co-so-thu-duc",
    address: "1 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh",
    workingHours: "Thứ 2 - Thứ 6, 08:00 - 16:30",
    mapUrl: "https://maps.google.com/?q=1+Võ+Văn+Ngân,+Thủ+Đức",
    isDefault: false,
  },
] as const;

/** Bác sĩ khám tại cơ sở thứ hai; những bác sĩ còn lại khám tại cơ sở mặc định. */
export const BRANCH_DOCTORS = ["Lê Hoàng An", "Ngô Thị Bích Ngọc", "Võ Thanh Tâm", "Hoàng Thị Lan Anh"];

export type ArticleSeed = { slug: string; title: string; summary: string; category: string; department: string; daysAgo: number; content: string };

export const ARTICLES: ArticleSeed[] = [
  {
    slug: "giac-ngu-lanh-manh-cho-nguoi-truong-thanh",
    title: "Giấc ngủ lành mạnh cho người trưởng thành",
    summary: "Người lớn nên ngủ bao nhiêu, thói quen giúp ngủ ngon và khi nào cần đi khám.",
    category: "Lối sống",
    department: "Khoa tổng quát",
    daysAgo: 4,
    content: "## Người lớn cần ngủ bao nhiêu\n\nPhần lớn người trưởng thành cần khoảng 7 đến 9 tiếng ngủ mỗi đêm. Nhu cầu mỗi người khác nhau, dấu hiệu đủ ngủ là tỉnh táo vào ban ngày mà không cần dựa nhiều vào cà phê.\n\n## Thói quen giúp ngủ ngon\n\n- Đi ngủ và thức dậy vào giờ cố định, kể cả cuối tuần.\n- Giữ phòng ngủ tối, yên tĩnh và mát.\n- Tránh cà phê, trà đặc vào buổi chiều và hạn chế màn hình điện tử trước khi ngủ một giờ.\n- Vận động đều đặn nhưng tránh tập nặng sát giờ ngủ.\n\n## Khi nào cần đi khám\n\nHãy đặt lịch khám nếu bạn mất ngủ kéo dài trên bốn tuần, ngáy to kèm ngưng thở khi ngủ, buồn ngủ gây nguy hiểm khi làm việc hoặc lái xe, hoặc cảm thấy lo âu, buồn bã kéo dài.",
  },
  {
    slug: "nhan-biet-som-dau-hieu-dot-quy-theo-quy-tac-be-fast",
    title: "Nhận biết sớm dấu hiệu đột quỵ theo quy tắc BE-FAST",
    summary: "Sáu dấu hiệu dễ nhớ giúp nhận ra đột quỵ và vì sao phải gọi cấp cứu ngay.",
    category: "Cấp cứu",
    department: "Khoa tim mạch",
    daysAgo: 8,
    content: "## Quy tắc BE-FAST\n\n- **B (Balance)**: mất thăng bằng, chóng mặt đột ngột.\n- **E (Eyes)**: mờ mắt hoặc mất thị lực đột ngột.\n- **F (Face)**: méo miệng, một bên mặt xệ.\n- **A (Arm)**: yếu hoặc tê một tay, một chân.\n- **S (Speech)**: nói khó, nói ngọng, không hiểu lời người khác.\n- **T (Time)**: ghi lại thời điểm bắt đầu và gọi cấp cứu ngay.\n\n## Vì sao phải đi ngay\n\nĐột quỵ cần được xử trí càng sớm càng tốt. Không chờ triệu chứng tự hết, không tự lái xe đến viện, hãy gọi 115.\n\n## Phòng ngừa\n\nKiểm soát huyết áp, đường huyết và mỡ máu, không hút thuốc, vận động đều đặn và khám định kỳ nếu bạn có yếu tố nguy cơ.",
  },
  {
    slug: "chuan-bi-truoc-khi-kham-suc-khoe-tong-quat",
    title: "Chuẩn bị trước khi khám sức khỏe tổng quát",
    summary: "Những việc nên làm trước ngày khám để kết quả chính xác và buổi khám diễn ra thuận lợi.",
    category: "Khám sức khỏe",
    department: "Khoa tổng quát",
    daysAgo: 6,
    content: "## Trước ngày khám\n\n- Đặt lịch trước và lưu mã đặt lịch.\n- Ngủ đủ giấc, tránh rượu bia và thức khuya.\n- Gom các kết quả xét nghiệm, đơn thuốc cũ.\n\n## Sáng ngày khám\n\n- Nếu có xét nghiệm máu lúc đói, nhịn ăn 8 đến 10 tiếng, chỉ uống nước lọc.\n- Mặc quần áo rộng, dễ cởi.\n- Mang giấy tờ tùy thân và thẻ BHYT nếu có.\n\n## Sau khi khám\n\nXem kết quả cùng bác sĩ, hỏi rõ các chỉ số bất thường và lịch tái khám. Không tự suy diễn kết quả khi chưa có tư vấn.",
  },
  {
    slug: "an-uong-lanh-manh-cho-nguoi-tren-40-tuoi",
    title: "Ăn uống lành mạnh cho người trên 40 tuổi",
    summary: "Gợi ý khẩu phần cân bằng giúp kiểm soát cân nặng, huyết áp và đường huyết.",
    category: "Dinh dưỡng",
    department: "Khoa nội tiết",
    daysAgo: 12,
    content: "## Nguyên tắc chung\n\nChia khẩu phần theo đĩa: một nửa là rau củ, một phần tư là đạm nạc như cá, thịt gà, đậu phụ, một phần tư là tinh bột nguyên hạt.\n\n## Nên hạn chế\n\n- Đồ chiên rán, thức ăn nhanh, thịt chế biến sẵn.\n- Nước ngọt và đồ uống có đường.\n- Muối: nêm nhạt dần, hạn chế nước chấm mặn.\n\n## Thói quen đi kèm\n\nUống đủ nước, ăn chậm, vận động ít nhất 150 phút mỗi tuần. Người có bệnh nền nên hỏi bác sĩ hoặc chuyên viên dinh dưỡng trước khi đổi chế độ ăn.",
  },
  {
    slug: "tre-sot-khi-nao-can-den-vien",
    title: "Trẻ sốt: khi nào cần đến viện",
    summary: "Cách theo dõi trẻ sốt tại nhà và những dấu hiệu cần đưa trẻ đi khám ngay.",
    category: "Trẻ em",
    department: "Khoa nhi",
    daysAgo: 15,
    content: "## Theo dõi tại nhà\n\nĐo nhiệt độ đúng cách, cho trẻ uống đủ nước, mặc đồ thoáng và theo dõi tinh thần, khả năng bú hoặc ăn uống. Chỉ dùng thuốc hạ sốt theo liều bác sĩ hoặc dược sĩ hướng dẫn.\n\n## Cần đưa trẻ đi khám ngay khi\n\n- Trẻ dưới 3 tháng tuổi có sốt.\n- Sốt cao khó hạ hoặc kéo dài trên 48 đến 72 giờ.\n- Li bì, khó đánh thức, bỏ bú, nôn nhiều.\n- Thở nhanh, khó thở, co giật hoặc phát ban kèm sốt.\n\nTrong các tình huống nguy hiểm, hãy đến cơ sở cấp cứu gần nhất hoặc gọi 115.",
  },
  {
    slug: "cham-soc-da-khi-troi-nang-nong",
    title: "Chăm sóc da khi trời nắng nóng",
    summary: "Chống nắng, làm sạch và dưỡng ẩm đúng cách; khi nào nên gặp bác sĩ da liễu.",
    category: "Da liễu",
    department: "Da liễu",
    daysAgo: 18,
    content: "## Chống nắng\n\nDùng kem chống nắng phổ rộng mỗi ngày, thoa lại sau 2 đến 3 tiếng khi ở ngoài trời. Kết hợp mũ rộng vành, khẩu trang và áo che nắng.\n\n## Làm sạch và dưỡng ẩm\n\nRửa mặt nhẹ nhàng hai lần mỗi ngày, không chà xát mạnh. Chọn kem dưỡng ẩm kết cấu nhẹ nếu da dầu.\n\n## Khi nào nên gặp bác sĩ\n\nNổi mẩn đỏ, ngứa rát kéo dài, mụn viêm nặng hơn sau khi đổi sản phẩm hoặc nốt ruồi thay đổi hình dạng, màu sắc.",
  },
  {
    slug: "bao-ve-doi-mat-khi-lam-viec-voi-man-hinh",
    title: "Bảo vệ đôi mắt khi làm việc với màn hình",
    summary: "Quy tắc 20-20-20 và vài thay đổi nhỏ giúp giảm mỏi mắt.",
    category: "Mắt",
    department: "Khoa mắt",
    daysAgo: 22,
    content: "## Quy tắc 20-20-20\n\nCứ sau 20 phút nhìn màn hình, hãy nhìn một vật cách khoảng 6 mét trong 20 giây để mắt được nghỉ.\n\n## Điều chỉnh môi trường\n\n- Đặt màn hình thấp hơn tầm mắt một chút, cách khoảng một sải tay.\n- Giảm chói, điều chỉnh độ sáng phù hợp với căn phòng.\n- Chớp mắt chủ động để mắt đỡ khô.\n\n## Khi nào nên khám mắt\n\nNhìn mờ, nhìn đôi, đau mắt, đỏ mắt kéo dài hoặc thấy chớp sáng, điểm đen mới xuất hiện. Người đái tháo đường nên khám đáy mắt định kỳ.",
  },
  {
    slug: "vi-sao-nen-kham-suc-khoe-dinh-ky",
    title: "Vì sao nên khám sức khỏe định kỳ",
    summary: "Phát hiện sớm giúp điều trị hiệu quả hơn; tần suất khám tham khảo theo độ tuổi.",
    category: "Khám sức khỏe",
    department: "Khoa tổng quát",
    daysAgo: 26,
    content: "## Lợi ích\n\nNhiều bệnh như tăng huyết áp, đái tháo đường hay rối loạn mỡ máu ít khi có triệu chứng ở giai đoạn đầu. Khám định kỳ giúp phát hiện sớm và theo dõi diễn tiến.\n\n## Tần suất tham khảo\n\nNgười trưởng thành khỏe mạnh có thể khám mỗi 12 tháng; người có bệnh nền hoặc yếu tố nguy cơ nên khám theo lịch bác sĩ đề xuất.\n\n## Nên khám những gì\n\nKhám lâm sàng, đo huyết áp và BMI, xét nghiệm máu, nước tiểu và các tầm soát phù hợp độ tuổi, giới tính. Bác sĩ sẽ tư vấn nội dung cụ thể cho bạn.",
  },
];
