if (window.isDomScreenshoterActive) {
} else {
  window.isDomScreenshoterActive = true;
  // --- 配置参数 ---
  // 截图边距设置（单位：像素）
  const SCREENSHOT_PADDING = 10;

  // 截图延迟时间（毫秒），确保高亮框完全消失
  const SCREENSHOT_DELAY = 100;

  // 质量增强因子（2.0表示图像尺寸扩大为原来的2倍）
  const QUALITY_ENHANCEMENT_FACTOR = 2.0;

  const overlay = document.createElement("div");
  overlay.id = "dom-screenshoter-overlay";
  Object.assign(overlay.style, {
    position: "absolute",
    border: "2px dashed #007bff",
    backgroundColor: "rgba(0, 123, 255, 0.2)",
    borderRadius: "0.25rem",
    boxSizing: "border-box",
    pointerEvents: "none",
    zIndex: "999999999",
  });
  document.body.appendChild(overlay);

  // 添加操作提示
  const hintElement = document.createElement("div");
  hintElement.id = "dom-screenshoter-hint";
  Object.assign(hintElement.style, {
    position: "fixed",
    bottom: "10px",
    left: "50%",
    transform: "translateX(-50%)",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "white",
    padding: "6px 12px",
    borderRadius: "4px",
    zIndex: "9999999998",
    fontFamily: "Arial, sans-serif",
    fontSize: "13px",
    textAlign: "center",
    pointerEvents: "none",
    userSelect: "none",
  });
  hintElement.textContent = "左键点击截图 | 右键点击退出";
  document.body.appendChild(hintElement);

  let currentTarget = null;

  const mouseoverHandler = (e) => {
    e.stopPropagation();
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
    const rect = target.getBoundingClientRect();

    Object.assign(overlay.style, {
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
    });
  };

  const clickHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 右键点击退出
    if (e.button === 2) {
      cleanup();
      return;
    }

    // 左键点击截图
    if (e.button === 0 && currentTarget) {
      const rect = currentTarget.getBoundingClientRect();
      const selectedElement = currentTarget;
      document.removeEventListener("mouseover", mouseoverHandler);
      document.removeEventListener("click", clickHandler, true);
      document.removeEventListener("contextmenu", contextMenuHandler, true);

      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }

      if (hintElement && hintElement.parentNode) {
        hintElement.parentNode.removeChild(hintElement);
      }

      const statusElement = document.createElement("div");
      Object.assign(statusElement.style, {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "white",
        padding: "8px 16px",
        borderRadius: "4px",
        zIndex: "9999999999",
      });
      statusElement.textContent = "正在处理截图";
      document.body.appendChild(statusElement);

      setTimeout(() => {
        const paddedRect = {
          left: Math.max(0, rect.left - SCREENSHOT_PADDING),
          top: Math.max(0, rect.top - SCREENSHOT_PADDING),
          width: rect.width + SCREENSHOT_PADDING * 2,
          height: rect.height + SCREENSHOT_PADDING * 2,
        };
        try {
          chrome.runtime.sendMessage(
            {
              action: "captureAndDownload",
              rect: paddedRect,
              originalRect: rect,
              devicePixelRatio: window.devicePixelRatio,
              url: window.location.href,
              enhancementFactor: QUALITY_ENHANCEMENT_FACTOR,
            },
            (response) => {
              if (chrome.runtime.lastError) {
                statusElement.textContent =
                  "截图失败: " + chrome.runtime.lastError.message;
                statusElement.style.backgroundColor = "rgba(255, 0, 0, 0.7)";
              } else if (response && response.success) {
                statusElement.textContent = `截图成功! 正在下载图像`;
              } else {
                statusElement.textContent =
                  "截图失败: " + (response?.message || "未知错误");
                statusElement.style.backgroundColor = "rgba(255, 0, 0, 0.7)";
              }

              setTimeout(() => {
                statusElement.remove();
                window.isDomScreenshoterActive = false;
              }, 3000);
            }
          );
        } catch (err) {
          statusElement.textContent = "发送消息时出错: " + err.message;
          statusElement.style.backgroundColor = "rgba(255, 0, 0, 0.7)";

          setTimeout(() => {
            statusElement.remove();
            window.isDomScreenshoterActive = false;
          }, 3000);
        }
      }, SCREENSHOT_DELAY);
    }
  };

  // 处理右键菜单事件
  const contextMenuHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    cleanup();
    return false;
  };

  const cleanup = () => {
    document.removeEventListener("mouseover", mouseoverHandler);
    document.removeEventListener("click", clickHandler, true);
    document.removeEventListener("contextmenu", contextMenuHandler, true);

    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    if (hintElement && hintElement.parentNode) {
      hintElement.parentNode.removeChild(hintElement);
    }

    window.isDomScreenshoterActive = false;

    // 创建一个快速反馈提示
    const feedbackElement = document.createElement("div");
    Object.assign(feedbackElement.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      color: "white",
      padding: "8px 16px",
      borderRadius: "4px",
      zIndex: "9999999999",
      fontFamily: "Arial, sans-serif",
      opacity: "1",
      transition: "opacity 0.5s ease",
    });
    feedbackElement.textContent = "已退出截图模式";
    document.body.appendChild(feedbackElement);

    // 淡出效果
    setTimeout(() => {
      feedbackElement.style.opacity = "0";
      setTimeout(() => feedbackElement.remove(), 500);
    }, 1000);
  };

  document.addEventListener("mouseover", mouseoverHandler);
  document.addEventListener("click", clickHandler, true);
  document.addEventListener("contextmenu", contextMenuHandler, true);
}
