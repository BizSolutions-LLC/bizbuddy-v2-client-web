// components/Home/BizChat.jsx
"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export default function BizChat({ clientId }) {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    function killWidget() {
      if (window.BizSupport?.destroy) {
        window.BizSupport.destroy();
        delete window.BizSupport;
      }

      document.querySelectorAll(`script[data-client="${clientId}"]`).forEach((node) => node.remove());

      const selectors = ['iframe[src*="bizsupport"]', '[id^="bizsupport"]', '[class*="bizsupport"]', "bizsupport-widget"];
      document.querySelectorAll(selectors.join(",")).forEach((el) => el.remove());
    }
    killWidget();

    const script = document.createElement("script");
    script.src = "https://bizsupport-b452e.web.app/widget.js";
    script.async = true;
    script.defer = true;
    script.setAttribute("data-client", clientId);
    script.setAttribute("data-theme", resolvedTheme || "light");
    document.body.appendChild(script);
    return () => killWidget();
  }, [clientId, resolvedTheme]);

  return null;
}
