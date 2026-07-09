// components/system-admin/ScreenshotButton.jsx

"use client";

import { useState } from "react";
import { Camera, Download } from "lucide-react";
import html2canvas from "html2canvas";

export default function ScreenshotButton() {
  const [capturing, setCapturing] = useState(false);

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
      alert("Failed to capture screenshot. Please try again.");
      setCapturing(false);
    }
  };

  return (
    <button
      onClick={captureScreenshot}
      disabled={capturing}
      className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-50 border border-neutral-300 hover:border-orange-400 text-neutral-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
      title="Capture Screenshot"
    >
      {capturing ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
          <span className="text-sm font-medium">Capturing...</span>
        </>
      ) : (
        <>
          <Camera className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:inline">Screenshot</span>
        </>
      )}
    </button>
  );
}