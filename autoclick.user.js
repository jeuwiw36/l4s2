// ==UserScript==
// @name         Auto Click Link4Sub / OnThiTracNghiem
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Tự động bấm tất cả các nút unlock trên trang
// @author       You
// @match        https://onthitracnghiem.com/*
// @match        https://link4sub.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
  GHI CHÚ QUAN TRỌNG (đọc trước khi dùng):

  Script này CHỈ chạy được nếu bạn cài nó vào một trình quản lý
  userscript (Tampermonkey / Violentmonkey / Greasemonkey) trong
  trình duyệt của chính bạn. Nó KHÔNG thể được "tiêm" vào iframe
  từ trang cha (index.html) khi iframe đang ở origin khác, vì điều
  đó bị chặn bởi Same-Origin Policy — không có cách nào hợp lệ để
  trang cha (JS thuần, không backend) chạy code bên trong DOM của
  một origin khác.

  Vì vậy, đây là "Phương án A" trong tài liệu: người dùng tự cài
  script này vào Tampermonkey, nó sẽ chạy trực tiếp trên các trang
  https://onthitracnghiem.com/* và https://link4sub.com/* — hoàn
  toàn độc lập với index.html, không liên quan tới iframe nào cả.
*/

(function () {
  'use strict';

  function autoClick() {
    const buttons = document.querySelectorAll(
      'a.stu-btn.link.unlock'
    );

    buttons.forEach(btn => {
      if (!btn.dataset.clicked) {
        btn.dataset.clicked = "true";

        console.log(
          '[AutoClick] Đã click nút:',
          btn.innerText.trim() || btn.href
        );

        setTimeout(() => {
          btn.click();
        }, 500);
      }
    });
  }

  autoClick();

  const observer = new MutationObserver(autoClick);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();
