import { useState, useEffect } from "react";
import { X, Chrome } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";

// Chrome Web Store URL — 출판 후 실제 Extension ID로 교체하세요
const STORE_URL = "https://chrome.google.com/webstore/detail/morningbriefai/EXTENSION_ID_HERE";

// 배포 후 Extension ID로 교체하면 설치 여부 자동 감지 가능
const EXTENSION_ID = null;

const DISMISS_KEY = "mb_ext_banner_dismissed";

const isInsideExtension = () =>
  typeof window !== "undefined" &&
  window.location?.protocol === "chrome-extension:";

const pingExtension = (id) =>
  new Promise((resolve) => {
    if (!id || !window.chrome?.runtime?.sendMessage) return resolve(false);
    try {
      window.chrome.runtime.sendMessage(id, { type: "ping" }, (resp) => {
        resolve(resp?.installed === true);
      });
    } catch {
      resolve(false);
    }
  });

const ExtensionInstallBanner = () => {
  const { isDark, borderCls } = useTheme();
  const { i18n } = useTranslation();
  const isKo = i18n.language?.toLowerCase().startsWith("ko");

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInsideExtension()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    if (EXTENSION_ID) {
      pingExtension(EXTENSION_ID).then((installed) => {
        if (!installed) setVisible(true);
      });
    } else {
      setVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm border-b ${borderCls} ${
        isDark
          ? "bg-morning-dark-card text-morning-dark-text"
          : "bg-morning-light-card text-morning-light-text"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Chrome size={16} className="shrink-0 opacity-70" />
        <span className="truncate opacity-90">
          {isKo
            ? "새 탭을 열 때마다 MorningBrief.AI를 바로 만나보세요 —"
            : "Open MorningBrief.AI every time you open a new tab —"}
        </span>
        <a
          href={STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`shrink-0 font-semibold underline underline-offset-2 ${
            isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-500"
          }`}
        >
          {isKo ? "Chrome 확장 설치하기" : "Install Chrome Extension"}
        </a>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="닫기"
        className={`shrink-0 p-1 rounded opacity-60 hover:opacity-100 transition-opacity ${
          isDark ? "hover:bg-morning-dark-hover" : "hover:bg-morning-light-hover"
        }`}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ExtensionInstallBanner;
