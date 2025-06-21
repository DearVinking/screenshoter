const keepAlive = () =>
  setInterval(() => {
    console.log("Service worker heartbeat");
  }, 20000);

let heartbeatInterval = keepAlive();

chrome.runtime.onStartup.addListener(() => {
  heartbeatInterval = keepAlive();
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    })
    .then(() => {})
    .catch((err) => {
      console.error("内容脚本注入失败:", err);
    });
});

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = () => {
      console.error("Blob转换为Data URL失败", reader.error);
      reject(reader.error);
    };
    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureAndDownload") {
    try {
      chrome.tabs.captureVisibleTab(
        sender.tab.windowId,
        { format: "png" },
        async (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            const errorMsg =
              "无法捕获标签页:" +
              (chrome.runtime.lastError?.message || "未知错误");
            sendResponse({ success: false, message: errorMsg });
            return;
          }

          try {
            const imageBlob = await (await fetch(dataUrl)).blob();
            const imageBitmap = await createImageBitmap(imageBlob);
            const dpr = request.devicePixelRatio || 1;
            const enhancementFactor = request.enhancementFactor || 1;
            const rect = request.rect;
            const screenWidth = imageBitmap.width / dpr;
            const screenHeight = imageBitmap.height / dpr;

            const adjustedRect = {
              left: Math.max(0, rect.left),
              top: Math.max(0, rect.top),
              width: Math.min(rect.width, screenWidth - rect.left),
              height: Math.min(rect.height, screenHeight - rect.top),
            };

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

            const resultingBlob = await canvas.convertToBlob({
              type: "image/png",
              quality: 1.0,
            });

            const imageDataUrl = await blobToDataUrl(resultingBlob);

            let elementInfo = "";
            if (request.originalRect && request.originalRect.width) {
              elementInfo = `-${Math.round(
                request.originalRect.width
              )}x${Math.round(request.originalRect.height)}`;
            }

            const qualityInfo =
              enhancementFactor > 1 ? `-enhanced${enhancementFactor}x` : "";
            const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");
            const filename = `dom-screenshot${elementInfo}${qualityInfo}-${timestamp}.png`;

            chrome.downloads.download(
              {
                url: imageDataUrl,
                filename: filename,
                saveAs: false,
              },
              (downloadId) => {
                if (chrome.runtime.lastError) {
                  const errorMsg =
                    "下载失败:" + chrome.runtime.lastError.message;
                  sendResponse({ success: false, message: errorMsg });
                } else {
                  sendResponse({
                    success: true,
                    message: "下载已开始",
                    downloadId,
                  });
                }
              }
            );
          } catch (error) {
            const errorMsg = "处理截图时发生错误:" + error.message;
            console.error(errorMsg, error);
            sendResponse({ success: false, message: errorMsg });
          }
        }
      );
    } catch (outerError) {
      console.error("外部捕获的错误:", outerError);
      sendResponse({
        success: false,
        message: "捕获过程中发生错误: " + outerError.message,
      });
    }

    return true;
  }
});

chrome.downloads.onChanged.addListener(function (downloadDelta) {
  if (downloadDelta.state) {
    if (downloadDelta.state.current === "complete") {
      console.log("下载完成:", downloadDelta.id);
    } else if (downloadDelta.state.current === "interrupted") {
      console.error("下载中断:", downloadDelta.id);
    }
  }
});

chrome.runtime.onSuspend.addListener(() => {
  clearInterval(heartbeatInterval);
});
