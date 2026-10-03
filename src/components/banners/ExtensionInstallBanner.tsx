import { useState, useEffect } from "react";
import { X, Chrome } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";

declare const chrome: { runtime?: { sendMessage?: (...args: unknown[]) => void } } | undefined;

// 웹스토어 출판 후 Extension ID를 넣으면 배너가 켜지고 설치 여부도 자동 감지됨.
// null인 동안은 배너를 숨김 (가짜 스토어 링크 노출 방지)
const EXTENSION_ID: string | null = null;
const STORE_URL = `https://chromewebstore.google.com/detail/${EXTENSION_ID}`;

const DISMISS_KEY = "mb_ext_banner_dismissed";

const isInsideExtension = (): boolean =>
  typeof window !== "undefined" &&
  window.location?.protocol === "chrome-extension:";

const pingExtension = (id: string): Promise<boolean> =>
  new Promise((resolve) => {
    if (!id || typeof chrome === "undefined" || !chrome?.runtime?.sendMessage) return resolve(false);
    try {
      chrome.runtime.sendMessage(id, { type: "ping" }, (resp: unknown) => {
        resolve((resp as Record<string, unknown>)?.installed === true);
      });
    } catch {
      resolve(false);
    }
  });

const ExtensionInstallBanner = () => {
  const { isDark, borderCls } = useTheme();
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!EXTENSION_ID || isInsideExtension()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    pingExtension(EXTENSION_ID).then((installed) => {
      if (!installed) setVisible(true);
    });
  }, []);

  const handleDismiss = (): void => {
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
          {t("banner.extension_prompt")}
        </span>
        <a
          href={STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`shrink-0 font-semibold underline underline-offset-2 ${
            isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-500"
          }`}
        >
          {t("banner.install_extension")}
        </a>
      </div>
      <button
        onClick={handleDismiss}
        aria-label={t("common.close")}
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
