# Tài nguyên thương hiệu DevKunCare (mobile)

Biểu tượng ứng dụng lấy từ `frontend/public/favicon.svg` để web và mobile dùng chung một nguồn hình.
Các ảnh nền tảng được sinh bằng:

```bash
node tool/generate_brand_assets.mjs
```

Script cần `npm ci` trong `frontend` (dùng `sharp` ở đó để vẽ SVG). Hình học cần giữ khớp với:

- `lib/core/widgets/app_brand_mark.dart` (biểu tượng trong ứng dụng)
- `android/app/src/main/res/drawable/ic_launcher_foreground.xml` và `ic_launcher_monochrome.xml`
  (biểu tượng thích ứng Android, nền màu `ic_launcher_background` = `#07549C`)

iOS: biểu tượng là ảnh RGB đục; ảnh màn hình khởi động là dấu trong suốt đặt trên nền xanh
`#07549C` của `LaunchScreen.storyboard`.
