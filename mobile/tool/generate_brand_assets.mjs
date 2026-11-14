// Sinh biểu tượng ứng dụng Android/iOS và ảnh màn hình khởi động iOS từ biểu tượng web
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

// Nền vuông không bo góc: iOS và Android tự cắt hình theo từng thiết bị.
const squareSvg = favicon.replace(BACKGROUND, '<rect width="64" height="64" fill="#07549C"/>');
// Bản bo góc cho biểu tượng Android cũ không có lớp thích ứng.
const roundedSvg = favicon;
// Chỉ phần nội dung (không nền), cắt sát để đặt giữa màn hình khởi động.
const glyphSvg = favicon
  .replace(BACKGROUND, "")
  .replace('viewBox="0 0 64 64"', 'viewBox="12 2 52 52"');

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

const iosIcons = path.join(root, "ios/Runner/Assets.xcassets/AppIcon.appiconset");
for (const [name, size] of Object.entries({
  "Icon-App-20x20@1x.png": 20,
  "Icon-App-20x20@2x.png": 40,
  "Icon-App-20x20@3x.png": 60,
  "Icon-App-29x29@1x.png": 29,
  "Icon-App-29x29@2x.png": 58,
  "Icon-App-29x29@3x.png": 87,
  "Icon-App-40x40@1x.png": 40,
  "Icon-App-40x40@2x.png": 80,
  "Icon-App-40x40@3x.png": 120,
  "Icon-App-60x60@2x.png": 120,
  "Icon-App-60x60@3x.png": 180,
  "Icon-App-76x76@1x.png": 76,
  "Icon-App-76x76@2x.png": 152,
  "Icon-App-83.5x83.5@2x.png": 167,
  "Icon-App-1024x1024@1x.png": 1024,
})) {
  jobs.push(render(squareSvg, size, path.join(iosIcons, name), { flatten: true }));
}

const iosLaunch = path.join(root, "ios/Runner/Assets.xcassets/LaunchImage.imageset");
for (const [name, size] of Object.entries({
  "LaunchImage.png": 128,
  "LaunchImage@2x.png": 256,
  "LaunchImage@3x.png": 384,
})) {
  jobs.push(render(glyphSvg, size, path.join(iosLaunch, name)));
}

await Promise.all(jobs);
console.log(`Đã sinh ${jobs.length} ảnh.`);
