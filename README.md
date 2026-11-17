# YT480 TV

Bản dành cho TV box Android (đã nhắm tới FPT Play Box 2018, Android 6.0.1) của YT480:
WebView tải `m.youtube.com`, ép H.264 để dùng giải mã phần cứng, thêm điều khiển bằng remote.

## Điều khiển

| Phím | Ở trang danh sách | Khi đang xem video |
|---|---|---|
| ← ↑ ↓ → | Di chuyển viền vàng giữa các video | ←/→ tua 10 giây (giữ lâu: 30–60 giây); ↑/↓ hiện thanh thông tin |
| OK | Mở video đang chọn | Tạm dừng / phát (nếu có nút "Bỏ qua" quảng cáo thì bấm nút đó) |
| Back | Quay lại trang trước, hết thì thoát | Thoát video về danh sách |
| Menu | Mở Cài đặt | Mở Cài đặt |
| Play/Pause, Tua tới, Tua lui | — | Như tên phím |

Từ video đầu hàng, bấm ↑ để lên thanh tìm kiếm. Trên thanh: OK vào ô tìm kiếm để gõ, ↓ để quay lại trang.

## Cài đặt (nút Cài đặt hoặc phím Menu)

Chất lượng (360p/480p/720p/**1080p** mặc định), cỡ chữ, ẩn Shorts, ẩn bình luận,
ẩn đề xuất trang chủ, tự phát video kế tiếp. Lựa chọn được lưu lại.

## Build

Đẩy lên GitHub, tab Actions → "Build APK" → tải `YT480-TV-apk`.
Khóa ký debug nằm sẵn trong `app/debug.keystore` nên các bản sau cài đè được lên bản trước.
(Nếu đang cài bản cũ ký bằng khóa khác, gỡ một lần: `adb uninstall com.lite.yt480`.)

## Cài qua ADB

    adb connect <IP-box>
    adb install -r app-debug.apk
