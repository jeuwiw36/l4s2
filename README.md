# Embedded Browser với Domain Whitelist

Website thuần HTML5 + CSS3 + Vanilla JavaScript (không framework, không backend).

## Chạy thử

Mở trực tiếp `index.html` bằng trình duyệt, hoặc chạy static server đơn giản:

```bash
python3 -m http.server 8080
# rồi mở http://localhost:8080
```

## Cấu trúc

```
project/
├── index.html          # UI: topbar, urlbar, iframe, overlays, toast
├── style.css           # Dark glassmorphism, responsive
├── script.js           # CONFIG → URL VALIDATOR → IFRAME CONTROLLER
│                        #        → NAVIGATION HANDLER → UI STATE → ERROR HANDLER
└── autoclick.user.js   # Userscript cho Tampermonkey (Phương án A)
```

## Whitelist hoạt động thế nào

`UrlValidator.isAllowedUrl()` dùng `new URL(rawUrl).origin` và so sánh
**chính xác** với danh sách:

- `https://onthitracnghiem.com`
- `https://link4sub.com`

Không dùng `string.includes()`, nên các chuỗi như
`https://link4sub.com.evil.com` hoặc `https://evil.com/?x=link4sub.com`
đều bị từ chối vì `origin` của chúng không khớp whitelist.

## ⚠️ Giới hạn kỹ thuật quan trọng — Same-Origin Policy

**Đây là phần bắt buộc phải hiểu trước khi dùng ứng dụng này:**

Khi iframe điều hướng sang một origin khác (ví dụ từ `link4sub.com`
sang một domain lạ do trang đó redirect), trình duyệt **chặn hoàn
toàn** khả năng của JavaScript ở trang cha (`script.js`) đọc:

```js
iframe.contentWindow.location.href
```

Đây không phải là lỗi của code — đó là cơ chế bảo mật cốt lõi (Same-
Origin Policy) áp dụng cho **mọi** trang web, mọi trình duyệt hiện
đại, không có cách nào "bypass" bằng HTML/CSS/JS thuần một cách an
toàn và hợp lệ.

**Hệ quả thực tế:**

- Ứng dụng có thể validate và chặn **URL ban đầu** trước khi gán vào
  `iframe.src` (điều này hoạt động 100%).
- Ứng dụng có thể validate URL khi **chính trang trong iframe hợp
  tác** gửi thông tin qua `window.parent.postMessage(...)`.
- Ứng dụng có thể validate URL nếu iframe **vẫn cùng origin** với
  trang cha (hiếm khi xảy ra ở đây vì domain đích khác domain host).
- Ứng dụng **KHÔNG THỂ** ngăn real-time một redirect cross-origin mà
  trang con tự thực hiện và không báo về qua postMessage — tại thời
  điểm đó trình duyệt đã tải nội dung mới trước khi JS của trang cha
  kịp biết URL là gì. Trạng thái hiển thị trong trường hợp này là
  **"Unknown / Cross-Origin"**, phản ánh đúng thực tế thay vì giả vờ
  kiểm soát được.

### Nếu bạn cần kiểm soát tuyệt đối mọi redirect

Điều đó **không thể** làm được chỉ bằng HTML/CSS/JS phía client. Bạn
cần một trong các giải pháp sau:

1. **Reverse proxy / backend**: proxy toàn bộ traffic tới
   `link4sub.com` qua server của bạn, kiểm tra `Location` header của
   mọi response, chặn ngay tại tầng server trước khi trả về trình
   duyệt.
2. **Browser extension** (Manifest V3 `webRequest`/`declarativeNetRequest`):
   chặn/redirect request ở tầng trình duyệt, có quyền truy cập vượt
   ngoài giới hạn của trang web thông thường.
3. **DNS/Firewall-level filtering**: chặn domain lạ ở tầng mạng.

Ứng dụng này (đúng theo yêu cầu: HTML/CSS/JS thuần, không backend)
cung cấp mức bảo vệ **tối đa có thể đạt được ở phía client**, đồng
thời **minh bạch** về những gì nó không thể làm được.

## Auto Click Userscript

File `autoclick.user.js` là script Tampermonkey **độc lập với
index.html** — nó chạy trực tiếp trong tab trình duyệt khi bạn ghé
thăm `onthitracnghiem.com` hoặc `link4sub.com`, không liên quan gì
tới iframe hay Same-Origin Policy vì nó chạy cùng origin với chính
trang đó (Tampermonkey inject script vào context của trang, không
phải từ một origin khác).

Cài đặt: mở Tampermonkey → "Create a new script" → dán nội dung file
→ Save.

Nếu sau này bạn kiểm soát source code của `link4sub.com` hoặc
`onthitracnghiem.com` (Phương án B), có thể tích hợp logic tương tự
trực tiếp vào trang đó, và cho nó gửi `postMessage` về trang cha để
tích hợp trạng thái URL real-time — thay vì cố "vượt rào" SOP.
