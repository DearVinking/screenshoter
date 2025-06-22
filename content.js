(function () {
  "use strict";

  if (window.isDomScreenshoterActive) return;
  window.isDomScreenshoterActive = true;

  const DEFAULT_CONFIG = {
    screenshotPadding: 10,
    screenshotDelay: 100,
    qualityEnhancementFactor: 2.0,
  };

  let config = DEFAULT_CONFIG;
  let overlay, hintElement, currentTarget;
  let handlers = {};

  chrome.storage.sync
    .get(DEFAULT_CONFIG)
    .then((items) => {
      config = items;
      initializeScreenshoter();
    })
    .catch(() => {
      initializeScreenshoter();
    });

  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "dom-screenshoter-overlay";
    overlay.style.cssText = `
      position: absolute;
      border: 2px dashed #007bff;
      background-color: rgba(0, 123, 255, 0.2);
      border-radius: 0.25rem;
      box-sizing: border-box;
      pointer-events: none;
      z-index: 999999999;
      display: none;
    `;
    return overlay;
  }

  function createHintElement() {
    const hint = document.createElement("div");
    hint.id = "dom-screenshoter-hint";
    hint.textContent = "左键点击截图 | 右键点击退出";
    hint.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 9999999998;
      font: 13px Arial, sans-serif;
      text-align: center;
      pointer-events: none;
      user-select: none;
    `;
    return hint;
  }

  function updateOverlayPosition(rect) {
    if (!overlay) return;

    overlay.style.cssText += `
      display: block;
      width: ${rect.width}px;
      height: ${rect.height}px;
      top: ${rect.top + window.scrollY}px;
      left: ${rect.left + window.scrollX}px;
    `;
  }

  function showStatus(message, isError = false) {
    const status = document.createElement("div");
    status.textContent = message;
    status.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(${isError ? "255, 0, 0" : "0, 0, 0"}, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 9999999998;
      font: 13px Arial, sans-serif;
      text-align: center;
      pointer-events: none;
      user-select: none;
    `;

    document.body.appendChild(status);

    setTimeout(
      () => {
        status.remove();
        if (!isError) window.isDomScreenshoterActive = false;
      },
      isError ? 3000 : 2000
    );

    return status;
  }

  handlers.mouseover = function (e) {
    const target = e.target;
    if (
      target === overlay ||
      target === hintElement ||
      target === document.body ||
      target === document.documentElement
    ) {
      return;
    }

    currentTarget = target;
    updateOverlayPosition(target.getBoundingClientRect());
  };

  handlers.click = function (e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.button === 2) {
      cleanup();
      return;
    }

    if (e.button === 0 && currentTarget) {
      captureElement(currentTarget);
    }
  };

  handlers.contextmenu = function (e) {
    e.preventDefault();
    e.stopPropagation();
    cleanup();
    return false;
  };

  async function captureElement(element) {
    const rect = element.getBoundingClientRect();

    removeEventListeners();
    removeUIElements();

    const status = showStatus("正在处理截图");

    await new Promise((resolve) => requestAnimationFrame(resolve));

    setTimeout(async () => {
      status.style.display = "none";

      const paddedRect = {
        left: Math.max(0, rect.left - config.screenshotPadding),
        top: Math.max(0, rect.top - config.screenshotPadding),
        width: rect.width + config.screenshotPadding * 2,
        height: rect.height + config.screenshotPadding * 2,
      };

      try {
        const response = await chrome.runtime.sendMessage({
          action: "captureAndDownload",
          rect: paddedRect,
          originalRect: rect,
          devicePixelRatio: window.devicePixelRatio,
          url: window.location.href,
          enhancementFactor: config.qualityEnhancementFactor,
        });

        status.style.display = "";

        if (response?.success) {
          status.textContent = "截图成功! 正在下载图像";
          status.style.backgroundColor = "rgba(0, 128, 0, 0.8)";
        } else {
          throw new Error(response?.message || "未知错误");
        }
      } catch (error) {
        status.style.display = "";
        status.textContent = "截图失败: " + error.message;
        status.style.backgroundColor = "rgba(255, 0, 0, 0.8)";
      }
    }, config.screenshotDelay);
  }

  function addEventListeners() {
    document.addEventListener("mouseover", handlers.mouseover, {
      passive: true,
    });
    document.addEventListener("click", handlers.click, true);
    document.addEventListener("contextmenu", handlers.contextmenu, true);
  }

  function removeEventListeners() {
    document.removeEventListener("mouseover", handlers.mouseover);
    document.removeEventListener("click", handlers.click, true);
    document.removeEventListener("contextmenu", handlers.contextmenu, true);
  }

  function removeUIElements() {
    overlay?.remove();
    hintElement?.remove();
  }

  function cleanup() {
    removeEventListeners();
    removeUIElements();
    window.isDomScreenshoterActive = false;
    showStatus("已退出元素选择模式");
  }

  function initializeScreenshoter() {
    overlay = createOverlay();
    hintElement = createHintElement();

    document.body.appendChild(overlay);
    document.body.appendChild(hintElement);

    addEventListeners();
  }

  window.addEventListener("beforeunload", () => {
    window.isDomScreenshoterActive = false;
  });
})();
