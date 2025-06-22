const DEFAULT_CONFIG = {
  screenshotPadding: 0,
  screenshotDelay: 100,
  qualityEnhancementFactor: 2.0,
};

const screenshotPaddingInput = document.getElementById("screenshotPadding");
const screenshotDelayInput = document.getElementById("screenshotDelay");
const qualityEnhancementFactorInput = document.getElementById(
  "qualityEnhancementFactor"
);
const saveButton = document.getElementById("saveSettings");
const statusElement = document.getElementById("status");

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
    screenshotPaddingInput.value = items.screenshotPadding;
    screenshotDelayInput.value = items.screenshotDelay;
    qualityEnhancementFactorInput.value = items.qualityEnhancementFactor;
  });
}

function saveSettings() {
  const config = {
    screenshotPadding:
      parseInt(screenshotPaddingInput.value, 10) ||
      DEFAULT_CONFIG.screenshotPadding,
    screenshotDelay:
      parseInt(screenshotDelayInput.value, 10) ||
      DEFAULT_CONFIG.screenshotDelay,
    qualityEnhancementFactor:
      parseFloat(qualityEnhancementFactorInput.value) ||
      DEFAULT_CONFIG.qualityEnhancementFactor,
  };

  chrome.storage.sync.set(config, () => {
    showStatus("设置已保存");
  });
}

function showStatus(message) {
  statusElement.textContent = message;
  statusElement.classList.add("success");
  statusElement.style.display = "block";

  setTimeout(() => {
    statusElement.style.display = "none";
  }, 3000);
}

document.addEventListener("DOMContentLoaded", loadSettings);
saveButton.addEventListener("click", saveSettings);
