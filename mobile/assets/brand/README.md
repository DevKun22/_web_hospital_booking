# Medcare Booking brand assets

`medcare_app_icon.png` is the review-sized master generated for the current
launcher identity. Platform PNG variants are generated deterministically by:

```powershell
python tool/generate_brand_assets.py
```

Keep the geometry in the generator aligned with:

- `lib/core/widgets/app_brand_mark.dart`
- `android/app/src/main/res/drawable/ic_launcher_foreground.xml`
- `android/app/src/main/res/drawable/ic_launcher_monochrome.xml`

Android adaptive icons intentionally use a solid teal background so launcher
masks remain clean. iOS launcher icons are opaque RGB images; launch-screen
marks are transparent RGBA images placed over the same dark teal background.
