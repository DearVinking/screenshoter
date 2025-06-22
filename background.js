chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (error) {
    console.error("内容脚本注入失败:", error);
  }
});

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function calculateOptimalRect(rect, screenWidth, screenHeight, dpr) {
  return {
    left: Math.max(0, rect.left),
    top: Math.max(0, rect.top),
    width: Math.min(rect.width, screenWidth - rect.left),
    height: Math.min(rect.height, screenHeight - rect.top),
  };
}

function generateFilename(originalRect, enhancementFactor) {
  const elementInfo = originalRect?.width
    ? `-${Math.round(originalRect.width)}x${Math.round(originalRect.height)}`
    : "";

  const qualityInfo =
    enhancementFactor > 1 ? `-enhanced${enhancementFactor}x` : "";

  const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");

  return `dom-screenshot${elementInfo}${qualityInfo}-${timestamp}.png`;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "captureAndDownload") return false;

  (async () => {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(
          sender.tab.windowId,
          { format: "png" },
          (result) => {
            if (chrome.runtime.lastError || !result) {
              reject(
                new Error(chrome.runtime.lastError?.message || "捕获失败")
              );
            } else {
              resolve(result);
            }
          }
        );
      });

      const imageBlob = await fetch(dataUrl).then((r) => r.blob());
      const imageBitmap = await createImageBitmap(imageBlob);

      const dpr = request.devicePixelRatio || 1;
      const enhancementFactor = request.enhancementFactor || 1;
      const rect = request.rect;

      const screenWidth = imageBitmap.width / dpr;
      const screenHeight = imageBitmap.height / dpr;

      const adjustedRect = calculateOptimalRect(
        rect,
        screenWidth,
        screenHeight,
        dpr
      );

      const enhancedWidth = Math.round(
        adjustedRect.width * dpr * enhancementFactor
      );
      const enhancedHeight = Math.round(
        adjustedRect.height * dpr * enhancementFactor
      );

      const canvas = new OffscreenCanvas(enhancedWidth, enhancedHeight);
      const ctx = canvas.getContext("2d");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(
        imageBitmap,
        adjustedRect.left * dpr,
        adjustedRect.top * dpr,
        adjustedRect.width * dpr,
        adjustedRect.height * dpr,
        0,
        0,
        enhancedWidth,
        enhancedHeight
      );

      const resultBlob = await canvas.convertToBlob({
        type: "image/png",
        quality: 1.0,
      });

      const imageDataUrl = await blobToDataUrl(resultBlob);
      const filename = generateFilename(
        request.originalRect,
        enhancementFactor
      );

      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: imageDataUrl,
            filename: filename,
            saveAs: false,
          },
          (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(id);
            }
          }
        );
      });

      sendResponse({
        success: true,
        message: "下载已开始",
        downloadId,
      });
    } catch (error) {
      console.error("截图处理错误:", error);
      sendResponse({
        success: false,
        message: error.message || "处理截图时发生错误",
      });
    }
  })();

  return true;
});
