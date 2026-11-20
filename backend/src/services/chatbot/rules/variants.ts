/** Chọn ngẫu nhiên một cách diễn đạt để lời Kun không lặp y nguyên mỗi lần; các biến thể giữ cùng nội dung và cùng từ khóa chính. */
export const vary = <T>(options: readonly T[]): T => options[Math.floor(Math.random() * options.length)];
