# Chạy bộ nghiệm thu tự động trợ lý Kun trên máy ảo/thiết bị Android, với backend THỬ (không bao giờ trỏ production).
# Yêu cầu: backend chạy chế độ phát triển (OTP_DEBUG_ENABLED=true) trên DB thử có dữ liệu mẫu, nghe ở cổng 4100.
#   .\tool\run_chatbot_acceptance.ps1                      # máy ảo emulator-5554, backend ở máy tính (10.0.2.2:4100)
#   .\tool\run_chatbot_acceptance.ps1 -Device R58M... -ApiBaseUrl http://127.0.0.1:4100/api/v1   # máy thật qua adb reverse
# Kết nối giữa công cụ test và app đôi khi rớt lúc nạp (VmServiceDisappearedException); script tự thử lại tối đa 3 lần
# đúng với lỗi đó, lỗi nghiệm thu thật thì dừng ngay.
param(
  [string]$Device = "emulator-5554",
  [string]$ApiBaseUrl = "http://10.0.2.2:4100/api/v1",
  [int]$Attempts = 3
)

$ErrorActionPreference = "Continue"
# Đường dẫn thư mục tạm dài làm Gradle lỗi "Unable to establish loopback connection": dùng thư mục ngắn.
New-Item -ItemType Directory -Force C:\Temp\hbg | Out-Null
$env:TEMP = "C:\Temp\hbg"; $env:TMP = "C:\Temp\hbg"
Set-Location (Split-Path $PSScriptRoot -Parent)
$log = "C:\Temp\hbg\chatbot-acceptance.log"
# Dùng đúng adb của bộ SDK mà Flutter dùng (trộn hai bản adb làm rớt kết nối thiết bị).
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "C:\Android\Sdk" }
$adb = Join-Path $sdk "platform-tools\adb.exe"

for ($i = 1; $i -le $Attempts; $i++) {
  Write-Host "Lần chạy $i/$Attempts trên $Device ..."
  flutter test integration_test/chatbot_acceptance_test.dart -d $Device --timeout 8m `
    --dart-define=APP_ENV=development --dart-define=API_BASE_URL=$ApiBaseUrl 2>&1 | Out-File -Encoding utf8 $log
  $code = $LASTEXITCODE
  $text = Get-Content $log -Raw -Encoding UTF8
  if ($code -eq 0) { Write-Host "ĐẠT: toàn bộ hành trình nghiệm thu."; exit 0 }
  # Lỗi kết nối khi nạp test (rớt VM service, hoặc app treo ở màn khởi động chờ trình gỡ lỗi): thử lại.
  $loadFailure = $text -match "VmServiceDisappearedException" -or ($text -match "loading .*chatbot_acceptance_test.dart \[E\]")
  if (-not $loadFailure) {
    Select-String -Path $log -Pattern "Hết thời gian|Kun trả lời:|Kun báo lỗi|Kun không trả lời|Expected:|Actual:|chatbot_acceptance_test.dart:\d+:\d+\)" |
      Select-Object -First 8 | ForEach-Object { Write-Host $_.Line }
    Write-Host "KHÔNG ĐẠT (nhật ký đầy đủ: $log)"; exit 1
  }
  Write-Host "Kết nối với app bị rớt khi nạp test, khởi động lại adb và thử lại..."
  & $adb kill-server | Out-Null; & $adb start-server | Out-Null; & $adb -s $Device wait-for-device
  & $adb -s $Device shell am force-stop dev.ngoloi.devkuncare | Out-Null
}
Write-Host "Không nạp được test sau $Attempts lần (nhật ký: $log)"; exit 2
