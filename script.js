"use strict";

/* ================================================================
   1) CONFIG
   ----------------------------------------------------------------
   Toàn bộ hằng số cấu hình của ứng dụng nằm ở đây. Whitelist dựa
   trên ORIGIN chính xác (scheme + host + port), không dùng
   string.includes() để tránh các kiểu bypass như:
     https://link4sub.com.evil.com
     https://evil.com/?redirect=https://link4sub.com
================================================================ */
const CONFIG = Object.freeze({
  HOME_URL: "https://link4sub.com/O03GrwdHOO",

  // Chỉ chấp nhận đúng các origin sau (không tự suy diễn subdomain).
  ALLOWED_ORIGINS: Object.freeze([
    "https://onthitracnghiem.com",
    "https://link4sub.com"
  ]),

  // Các scheme không bao giờ được phép điều hướng tới từ trang cha.
  BLOCKED_SCHEMES: Object.freeze(["javascript:", "data:", "file:", "blob:", "vbscript:"]),

  // Thời gian chờ tối đa cho việc iframe phát sinh sự kiện load (ms).
  LOAD_TIMEOUT_MS: 15000,

  TOAST_DURATION_MS: 3500
});

/* ================================================================
   2) URL VALIDATOR
   ----------------------------------------------------------------
   Chỉ dùng đối tượng URL() chuẩn của trình duyệt để phân tích và
   so sánh origin. Không bao giờ dùng includes()/regex lỏng lẻo.
================================================================ */
const UrlValidator = (() => {

  /**
   * Parse một chuỗi URL một cách an toàn.
   * @returns {URL|null} trả về null nếu URL không hợp lệ.
   */
  function safeParse(rawUrl) {
    try {
      return new URL(rawUrl);
    } catch (err) {
      return null;
    }
  }

  /**
   * Kiểm tra scheme có nằm trong danh sách nguy hiểm không.
   */
  function hasBlockedScheme(urlObj) {
    return CONFIG.BLOCKED_SCHEMES.includes(urlObj.protocol.toLowerCase());
  }

  /**
   * Hàm chính: kiểm tra một URL có được whitelist hay không.
   * So sánh CHÍNH XÁC theo `origin` (protocol + host + port),
   * không so khớp chuỗi con.
   */
  function isAllowedUrl(rawUrl) {
    const urlObj = safeParse(rawUrl);

    if (!urlObj) {
      return { allowed: false, reason: "invalid_url", url: rawUrl, origin: null };
    }

    if (hasBlockedScheme(urlObj)) {
      return { allowed: false, reason: "blocked_scheme", url: rawUrl, origin: urlObj.origin };
    }

    // Chỉ chấp nhận http/https.
    if (urlObj.protocol !== "https:" && urlObj.protocol !== "http:") {
      return { allowed: false, reason: "invalid_protocol", url: rawUrl, origin: urlObj.origin };
    }

    const isWhitelisted = CONFIG.ALLOWED_ORIGINS.includes(urlObj.origin);

    return {
      allowed: isWhitelisted,
      reason: isWhitelisted ? "ok" : "not_whitelisted",
      url: rawUrl,
      origin: urlObj.origin
    };
  }

  return { isAllowedUrl, safeParse };
})();

/* ================================================================
   3) UI STATE
   ----------------------------------------------------------------
   Quản lý toàn bộ trạng thái hiển thị: status pill, overlay,
   toast. Không dùng innerHTML để tránh chèn HTML không tin cậy —
   luôn dùng textContent.
================================================================ */
const UiState = (() => {
  const dom = {
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText"),
    urlText: document.getElementById("urlText"),
    lockIcon: document.getElementById("lockIcon"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    loadingText: document.getElementById("loadingText"),
    blockedOverlay: document.getElementById("blockedOverlay"),
    blockedUrlText: document.getElementById("blockedUrlText"),
    errorOverlay: document.getElementById("errorOverlay"),
    errorMessage: document.getElementById("errorMessage"),
    toastContainer: document.getElementById("toastContainer")
  };

  const STATE_LABELS = {
    loading: "Đang tải…",
    allowed: "Allowed",
    blocked: "Blocked",
    unknown: "Unknown / Cross-Origin",
    error: "Error"
  };

  function setStatus(state, detailText) {
    // Xoá mọi class trạng thái cũ trên dot, gán class mới.
    dom.statusDot.className = "status-dot " + state;
    const label = STATE_LABELS[state] || state;
    dom.statusText.textContent = detailText ? `${label}: ${detailText}` : label;
  }

  function setUrlDisplay(urlString, isSecure) {
    dom.urlText.textContent = urlString;
    dom.lockIcon.textContent = isSecure ? "🔒" : "⚠️";
  }

  function showLoading(message) {
    dom.loadingText.textContent = message || "Đang tải nội dung…";
    dom.loadingOverlay.classList.remove("hidden");
  }

  function hideLoading() {
    dom.loadingOverlay.classList.add("hidden");
  }

  function showBlocked(blockedUrl) {
    dom.blockedUrlText.textContent = blockedUrl || "";
    dom.blockedOverlay.classList.remove("hidden");
  }

  function hideBlocked() {
    dom.blockedOverlay.classList.add("hidden");
  }

  function showError(message) {
    dom.errorMessage.textContent = message;
    dom.errorOverlay.classList.remove("hidden");
  }

  function hideError() {
    dom.errorOverlay.classList.add("hidden");
  }

  function hideAllOverlaysExceptLoading() {
    hideBlocked();
    hideError();
  }

  function showToast(message, type) {
    const toast = document.createElement("div");
    toast.className = "toast " + (type || "info");
    toast.textContent = message; // an toàn: không dùng innerHTML
    dom.toastContainer.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, CONFIG.TOAST_DURATION_MS);
  }

  return {
    setStatus, setUrlDisplay,
    showLoading, hideLoading,
    showBlocked, hideBlocked,
    showError, hideError,
    hideAllOverlaysExceptLoading,
    showToast
  };
})();

/* ================================================================
   4) ERROR HANDLER
   ----------------------------------------------------------------
   Tập trung mọi logic xử lý lỗi / thông báo cho người dùng.
================================================================ */
const ErrorHandler = (() => {

  function handleInvalidUrl(rawUrl) {
    UiState.setStatus("error");
    UiState.showError(`URL không hợp lệ và không thể xử lý:\n"${rawUrl}"`);
    UiState.showToast("URL không hợp lệ.", "error");
  }

  function handleBlockedNavigation(rawUrl) {
    UiState.setStatus("blocked", new URL(rawUrl, location.href).host || rawUrl);
    UiState.showBlocked(rawUrl);
    UiState.showToast("Điều hướng bị chặn: domain không nằm trong whitelist.", "warn");
  }

  function handleIframeLoadError() {
    UiState.hideLoading();
    UiState.setStatus("error");
    UiState.showError("Không thể tải nội dung trong iframe. Vui lòng kiểm tra kết nối mạng hoặc thử tải lại.");
    UiState.showToast("Lỗi tải iframe.", "error");
  }

  function handleTimeout() {
    UiState.hideLoading();
    UiState.setStatus("error");
    UiState.showError("Hết thời gian chờ phản hồi từ trang đích. Trang có thể đang chậm hoặc không phản hồi.");
    UiState.showToast("Iframe không phản hồi (timeout).", "error");
  }

  function handleCrossOriginUnknown() {
    // Đây KHÔNG phải lỗi — đây là giới hạn kỹ thuật hợp lệ của SOP.
    UiState.setStatus("unknown");
    UiState.showToast("Không thể đọc URL bên trong iframe do Same-Origin Policy.", "info");
  }

  return {
    handleInvalidUrl,
    handleBlockedNavigation,
    handleIframeLoadError,
    handleTimeout,
    handleCrossOriginUnknown
  };
})();

/* ================================================================
   5) IFRAME CONTROLLER
   ----------------------------------------------------------------
   Quản lý vòng đời của thẻ <iframe>: load, reload, timeout,
   lịch sử điều hướng nội bộ (để nút "Quay lại" hoạt động ở mức
   có thể, trong giới hạn của trình duyệt).

   GIỚI HẠN QUAN TRỌNG:
   Trình duyệt KHÔNG cho phép JavaScript của trang cha đọc
   `iframe.contentWindow.location.href` khi iframe đang ở một
   origin khác với trang cha (Same-Origin Policy). Vì vậy:
     - Ta chỉ chắc chắn biết URL ban đầu (do ta đặt ra) và các
       URL mà chính trang trong iframe TỰ NGUYỆN báo về qua
       postMessage.
     - Khi không có postMessage, sau khi điều hướng cross-origin,
       trạng thái URL hiển thị sẽ là "Unknown / Cross-Origin".
     - Đây không phải là thiếu sót của code — đó là giới hạn nền
       tảng của mọi trình duyệt hiện đại, áp dụng cho MỌI trang
       web thuần HTML/CSS/JS không có backend/proxy.
================================================================ */
const IframeController = (() => {
  const iframe = document.getElementById("browserFrame");

  let timeoutHandle = null;
  let history = [CONFIG.HOME_URL]; // lịch sử các URL "đã biết" mà ta chủ động điều hướng tới
  let currentKnownUrl = CONFIG.HOME_URL;
  let lastOriginWasSameAsInitial = true;

  function clearLoadTimeout() {
    if (timeoutHandle) {
      window.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  }

  function armLoadTimeout() {
    clearLoadTimeout();
    timeoutHandle = window.setTimeout(() => {
      ErrorHandler.handleTimeout();
    }, CONFIG.LOAD_TIMEOUT_MS);
  }

  /**
   * Điều hướng iframe tới một URL ĐÃ được xác nhận whitelist.
   * Đây là con đường duy nhất trong app được phép set iframe.src
   * cho một URL mới do người dùng/hệ thống khởi tạo (không tính
   * việc trang bên trong tự chuyển hướng, cái đó SOP không cho
   * ta chặn theo thời gian thực).
   */
  function navigateTo(rawUrl, pushHistory) {
    UiState.showLoading("Đang chuyển hướng…");
    UiState.setStatus("loading");
    armLoadTimeout();

    iframe.src = rawUrl;
    currentKnownUrl = rawUrl;

    if (pushHistory !== false) {
      history.push(rawUrl);
    }
  }

  function reload() {
    UiState.showLoading("Đang tải lại…");
    UiState.setStatus("loading");
    UiState.hideAllOverlaysExceptLoading();
    armLoadTimeout();

    // Với cross-origin, contentWindow.location.reload() thường bị
    // chặn bởi SOP, nên cách an toàn nhất là gán lại src.
    try {
      iframe.contentWindow.location.reload();
    } catch (err) {
      // Bị chặn bởi SOP — fallback: gán lại src hiện tại đã biết.
      iframe.src = currentKnownUrl;
    }
  }

  function goBack() {
    if (history.length > 1) {
      history.pop(); // bỏ URL hiện tại
      const previous = history[history.length - 1];
      navigateTo(previous, false);
      UiState.showToast("Đã quay lại URL trước đó (đã biết).", "info");
    } else {
      UiState.showToast("Không còn lịch sử điều hướng nội bộ để quay lại.", "warn");
    }
  }

  function goHome() {
    history = [CONFIG.HOME_URL];
    navigateTo(CONFIG.HOME_URL, false);
  }

  /**
   * Cố gắng đọc origin hiện tại của iframe MỘT CÁCH AN TOÀN.
   * Nếu same-origin với trang cha thì đọc được; nếu không, trình
   * duyệt sẽ ném lỗi (đây là hành vi chuẩn của SOP, không phải bug).
   */
  function tryReadCurrentOrigin() {
    try {
      const href = iframe.contentWindow.location.href;
      return href; // chỉ thành công nếu same-origin thật sự
    } catch (err) {
      return null; // cross-origin — không thể đọc được, đúng như thiết kế
    }
  }

  function attachLoadListener(onLoadCallback) {
    iframe.addEventListener("load", () => {
      clearLoadTimeout();
      onLoadCallback();
    });

    iframe.addEventListener("error", () => {
      clearLoadTimeout();
      ErrorHandler.handleIframeLoadError();
    });
  }

  function getCurrentKnownUrl() {
    return currentKnownUrl;
  }

  return {
    navigateTo,
    reload,
    goBack,
    goHome,
    tryReadCurrentOrigin,
    attachLoadListener,
    getCurrentKnownUrl,
    armLoadTimeout,
    clearLoadTimeout
  };
})();

/* ================================================================
   6) NAVIGATION HANDLER
   ----------------------------------------------------------------
   Xử lý logic "điều hướng có nhận biết được" — tức các trường hợp
   ta THỰC SỰ biết URL đích (do postMessage từ trang con báo về,
   hoặc do same-origin đọc được, hoặc do chính người dùng bấm nút
   trong app này). Với các redirect cross-origin mà trang con không
   chủ động báo, ta KHÔNG THỂ chặn theo thời gian thực chỉ bằng
   HTML/CSS/JS thuần — iframe sẽ tự tải nội dung mới trước khi ta
   kịp biết URL là gì. Đây là giới hạn nền tảng, đã ghi rõ trong
   phần "Giới hạn kỹ thuật" ở footer và trong tài liệu đi kèm.
================================================================ */
const NavigationHandler = (() => {

  /**
   * Được gọi khi ta CÓ được một URL đích đáng tin cậy (từ postMessage
   * hoặc từ việc đọc same-origin thành công). Quyết định allow/block.
   */
  function evaluateAndApply(candidateUrl) {
    const result = UrlValidator.isAllowedUrl(candidateUrl);

    if (!result.origin && result.reason === "invalid_url") {
      ErrorHandler.handleInvalidUrl(candidateUrl);
      return;
    }

    if (!result.allowed) {
      ErrorHandler.handleBlockedNavigation(candidateUrl);
      return;
    }

    // Hợp lệ — cập nhật UI, không cần load lại iframe vì nó tự
    // điều hướng rồi (trường hợp same-origin/postMessage).
    UiState.setStatus("allowed", new URL(candidateUrl).host);
    UiState.setUrlDisplay(candidateUrl, candidateUrl.startsWith("https://"));
    UiState.hideAllOverlaysExceptLoading();
    UiState.hideLoading();
  }

  /**
   * Lắng nghe postMessage từ trang con (nếu trang con hợp tác gửi
   * thông tin URL hiện tại). Đây là cơ chế AN TOÀN duy nhất để biết
   * URL cross-origin theo thời gian thực mà không vi phạm SOP.
   *
   * Trang con có thể gửi:
   *   window.parent.postMessage({ type: "url-changed", url: "..." }, "*");
   */
  function initPostMessageListener() {
    window.addEventListener("message", (event) => {
      // Chỉ chấp nhận message có cấu trúc mong đợi, không tin tưởng
      // mù quáng nguồn gốc vì ta không kiểm soát trang con.
      const data = event.data;
      if (!data || typeof data !== "object" || data.type !== "url-changed") {
        return;
      }
      if (typeof data.url !== "string") {
        return;
      }
      evaluateAndApply(data.url);
    });
  }

  /**
   * Được gọi mỗi khi iframe phát ra sự kiện 'load'. Thử đọc URL
   * theo cách an toàn (chỉ thành công nếu same-origin); nếu không
   * đọc được, hiển thị trạng thái "Unknown / Cross-Origin" — đây là
   * hành xử trung thực, không giả vờ kiểm soát được điều không thể.
   */
  function handleIframeLoadEvent() {
    UiState.hideLoading();

    const readableUrl = IframeController.tryReadCurrentOrigin();

    if (readableUrl === null) {
      // Cross-origin thật sự — không đọc được, đúng theo thiết kế SOP.
      // Ta vẫn coi là "allowed" theo nghĩa: URL ban đầu ta set ra đã
      // được validate trước khi set, nên nếu người dùng chưa tương
      // tác thêm gì bên trong trang con dẫn tới redirect ta không
      // biết, trạng thái an toàn nhất để hiển thị là "unknown".
      ErrorHandler.handleCrossOriginUnknown();
      return;
    }

    // Same-origin thật (hiếm khi xảy ra với domain thật, nhưng có
    // thể xảy ra nếu bạn mở file này cùng origin với trang đích,
    // hoặc trang đích là about:blank ban đầu).
    evaluateAndApply(readableUrl);
  }

  return {
    initPostMessageListener,
    handleIframeLoadEvent,
    evaluateAndApply
  };
})();

/* ================================================================
   7) BOOTSTRAP — gắn sự kiện cho toàn bộ UI
================================================================ */
(function bootstrap() {
  // Trạng thái ban đầu: URL home đã được ta viết cứng, đã biết
  // trước là hợp lệ (validate lại cho chắc để không viết config sai).
  const initialCheck = UrlValidator.isAllowedUrl(CONFIG.HOME_URL);

  if (!initialCheck.allowed) {
    // Nếu ai đó lỡ sửa CONFIG.HOME_URL thành domain ngoài whitelist,
    // chặn ngay từ đầu thay vì tải một URL không hợp lệ.
    UiState.setStatus("error");
    UiState.showError("Cấu hình HOME_URL không hợp lệ hoặc không nằm trong whitelist.");
  } else {
    UiState.setUrlDisplay(CONFIG.HOME_URL, true);
    UiState.setStatus("loading");
    UiState.showLoading("Đang tải nội dung ban đầu…");
    IframeController.armLoadTimeout();
  }

  // Gắn listener cho sự kiện load/error của iframe.
  IframeController.attachLoadListener(NavigationHandler.handleIframeLoadEvent);

  // Lắng nghe postMessage từ trang con (nếu có hợp tác).
  NavigationHandler.initPostMessageListener();

  // ---- Nút điều khiển trên topbar ----
  document.getElementById("btnReload").addEventListener("click", () => {
    IframeController.reload();
  });

  document.getElementById("btnBack").addEventListener("click", () => {
    IframeController.goBack();
  });

  document.getElementById("btnHome").addEventListener("click", () => {
    UiState.setUrlDisplay(CONFIG.HOME_URL, true);
    IframeController.goHome();
  });

  // ---- Nút trong overlay "Blocked" ----
  document.getElementById("btnBlockedBack").addEventListener("click", () => {
    UiState.hideBlocked();
    IframeController.goBack();
  });

  document.getElementById("btnBlockedReload").addEventListener("click", () => {
    UiState.hideBlocked();
    IframeController.goHome();
  });

  // ---- Nút trong overlay "Error" ----
  document.getElementById("btnErrorReload").addEventListener("click", () => {
    UiState.hideError();
    IframeController.reload();
  });

  document.getElementById("btnErrorHome").addEventListener("click", () => {
    UiState.hideError();
    UiState.setUrlDisplay(CONFIG.HOME_URL, true);
    IframeController.goHome();
  });

  // ---- Trạng thái kết nối mạng của trình duyệt (bonus UX) ----
  window.addEventListener("offline", () => {
    UiState.showToast("Mất kết nối mạng.", "error");
  });
  window.addEventListener("online", () => {
    UiState.showToast("Đã kết nối lại mạng.", "success");
  });
})();
