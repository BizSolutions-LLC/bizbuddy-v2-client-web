// components/system-admin/ScreenshotButton.jsx

"use client";

import { useState } from "react";
import { Camera, Download } from "lucide-react";
import html2canvas from "html2canvas";

// compact: icon-only (used in the nav), label shown as a tooltip
export default function ScreenshotButton({ compact = false }) {
  const [capturing, setCapturing] = useState(false);
  const [failed, setFailed] = useState(false); // shown on the button (no alert(); not every page mounts a toaster)

  const captureScreenshot = async () => {
    setCapturing(true);
    
    try {
      // Wait a moment for the button to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture the entire page
      const canvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        scale: 2, // Higher quality
        backgroundColor: "#ffffff",
        windowWidth: document.body.scrollWidth,
        windowHeight: document.body.scrollHeight,
      });

      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          // Create download link
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
          link.download = `bizbuddy-analytics-${timestamp}.png`;
          link.href = url;
          link.click();
          
          // Cleanup
          URL.revokeObjectURL(url);
        }
        setCapturing(false);
      });
    } catch (error) {
      console.error("Screenshot error:", error);
      setFailed(true);
      setTimeout(() => setFailed(false), 4000);
      setCapturing(false);
    }
  };

  return (
    <button
      onClick={captureScreenshot}
      disabled={capturing}
      className={`flex items-center gap-2 ${compact ? "p-2" : "px-4 py-2"} bg-white hover:bg-neutral-50 border ${failed ? "border-red-400 text-red-700" : "border-neutral-300 text-neutral-700"} hover:border-orange-400 rounded-lg transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed`}
      title={failed ? "Couldn't capture the screenshot. Try again." : "Capture Screenshot"}
      aria-label={failed ? "Screenshot failed. Try again." : "Capture Screenshot"}
    >
      {capturing ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
          {!compact && <span className="text-sm font-medium">Capturing...</span>}
        </>
      ) : (
        <>
          <Camera className="w-4 h-4" />
          {!compact && <span className="text-sm font-medium hidden sm:inline">{failed ? "Failed · try again" : "Screenshot"}</span>}
        </>
      )}
    </button>
  );
}