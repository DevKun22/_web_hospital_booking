// Sinh biểu tượng ứng dụng Android từ biểu tượng web
// (frontend/public/favicon.svg), để web và mobile dùng chung một nguồn hình.
//
// Chạy từ thư mục mobile:  node tool/generate_brand_assets.mjs
// Cần đã cài thư viện trong frontend (`npm ci`), vì dùng `sharp` ở đó để vẽ SVG.

import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

let sharp;
try {
  sharp = require(path.join(root, "../frontend/node_modules/sharp"));
} catch {
  console.error("Không tìm thấy sharp. Chạy `npm ci` trong thư mục frontend trước.");
  process.exit(1);
}

const faviconPath = path.join(root, "../frontend/public/favicon.svg");
const favicon = readFileSync(faviconPath, "utf8");
const BACKGROUND = /<rect width="64" height="64" rx="14" fill="#07549C"\/>/;
if (!BACKGROUND.test(favicon)) {
  console.error("favicon.svg đổi cấu trúc: cập nhật mẫu nền trong tool/generate_brand_assets.mjs.");
  process.exit(1);
}

// Nền vuông không bo góc: Android tự cắt hình theo từng thiết bị.
const squareSvg = favicon.replace(BACKGROUND, '<rect width="64" height="64" fill="#07549C"/>');
// Bản bo góc cho biểu tượng Android cũ không có lớp thích ứng.
const roundedSvg = favicon;
const render = (svg, size, file, { flatten = false } = {}) => {
  mkdirSync(path.dirname(file), { recursive: true });
  let image = sharp(Buffer.from(svg), { density: 384 }).resize(size, size, { fit: "contain" });
  if (flatten) image = image.flatten({ background: "#07549C" });
  return image.png().toFile(file);
};

const jobs = [];
jobs.push(render(squareSvg, 1024, path.join(root, "assets/brand/devkuncare_app_icon.png"), { flatten: true }));

const androidRes = path.join(root, "android/app/src/main/res");
for (const [dir, size] of Object.entries({
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
})) {
  jobs.push(render(roundedSvg, size, path.join(androidRes, dir, "ic_launcher.png")));
}

await Promise.all(jobs);
console.log(`Đã sinh ${jobs.length} ảnh.`);
