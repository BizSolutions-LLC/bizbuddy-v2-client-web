"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, AlertCircle, CheckCircle, Chrome, RefreshCw, Monitor, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LocationGuard({ children }) {
  const [locationEnabled, setLocationEnabled] = useState(null);
  const [checking, setChecking] = useState(false);
  const [browserType, setBrowserType] = useState("chrome");
  const [errorMessage, setErrorMessage] = useState("");

  // Check location permission on mount
  useEffect(() => {
    checkLocationPermission();
    detectBrowser();
  }, []);

  const detectBrowser = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("chrome") && !ua.includes("edge")) setBrowserType("chrome");
    else if (ua.includes("firefox")) setBrowserType("firefox");
    else if (ua.includes("safari") && !ua.includes("chrome")) setBrowserType("safari");
    else if (ua.includes("edge")) setBrowserType("edge");
    else setBrowserType("chrome"); // default
  };

const checkLocationPermission = async () => {
    setChecking(true);
    setErrorMessage(""); // ✅ Clear previous errors
    
    try {      
      // Try to get location with relaxed settings
      const position = await new Promise((resolve, reject) => {
        // if (!("geolocation" in navigator)) {
        //   reject(new Error("Geolocation not supported by browser"));
        //   return;
        // }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            // console.log('✅ Location obtained:', pos.coords);
            resolve(pos);
          },
          (err) => {
            // console.error('❌ Location error:', err);
            reject(err);
          },
          { 
            enableHighAccuracy: false, // ✅ CHANGED: Use false for faster response
            timeout: 15000, // ✅ INCREASED: 15 seconds timeout
            maximumAge: 10000 // ✅ CHANGED: Allow cached location up to 10 seconds old
          }
        );
      });

      if (position.coords.latitude && position.coords.longitude) {
        // console.log('✅ Location enabled successfully');
        setLocationEnabled(true);
      } else {
        // console.error('❌ Location coordinates missing');
        setLocationEnabled(false);
        setErrorMessage("Location coordinates not available");
      }
    } catch (error) {
      // console.error('❌ Location check failed:', error);
      setLocationEnabled(false);
      
      // ✅ Set user-friendly error messages
      if (error.code === 1) {
        setErrorMessage("Location permission denied. Please allow location access.");
      } else if (error.code === 2) {
        setErrorMessage("Location unavailable. Please check your device settings.");
      } else if (error.code === 3) {
        setErrorMessage("Location request timed out. Please try again.");
      } else {
        setErrorMessage(error.message || "Unable to access location");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleRefresh = () => {
    checkLocationPermission();
  };

  // If still checking, show loading
  if (locationEnabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            <MapPin className="h-16 w-16 text-orange-500" />
          </motion.div>
          <p className="mt-4 text-lg font-medium text-neutral-700 dark:text-neutral-300">
            Checking location permissions...
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            This may take a few seconds
          </p>
        </div>
      </div>
    );
  }

  // If location enabled, show app
  if (locationEnabled) {
    return <>{children}</>;
  }

  // If location disabled, show guide modal (non-dismissable)
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900" />
      
      <Dialog open={!locationEnabled} modal>
        <DialogContent 
          className="sm:max-w-2xl border-2 border-orange-200 dark:border-orange-800 max-h-[90vh] overflow-y-auto"
          // ✅ NON-DISMISSABLE: No onOpenChange, no escape key, no click outside
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="h-2 w-full bg-gradient-to-r from-orange-500 to-red-500 -mt-6 mb-4" />
          
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-3 rounded-xl bg-red-500 text-white">
                <AlertCircle className="h-6 w-6" />
              </div>
              Location Access Required
            </DialogTitle>
            <DialogDescription className="text-base">
              This app requires your location to track your work attendance. Please enable location services to continue.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <Alert className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm">
                <strong>Error:</strong> {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Why Location is Required */}
          <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800">
            <MapPin className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-sm">
              <strong>Why we need location:</strong> To verify you're at your designated work location when clocking in/out. 
              Your location is only recorded during punch actions and is not tracked continuously.
            </AlertDescription>
          </Alert>

          {/* Browser-Specific Instructions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-orange-600" />
              How to Enable Location ({browserType === "chrome" ? "Chrome" : browserType === "firefox" ? "Firefox" : browserType === "safari" ? "Safari" : "Edge"})
            </h3>

            {browserType === "chrome" && <ChromeInstructions />}
            {browserType === "firefox" && <FirefoxInstructions />}
            {browserType === "safari" && <SafariInstructions />}
            {browserType === "edge" && <EdgeInstructions />}
          </div>

          {/* Refresh Button */}
          <div className="flex flex-col gap-3 pt-4">
            <Button
              onClick={handleRefresh}
              disabled={checking}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base"
            >
              {checking ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Checking Location...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 mr-2" />
                  I've Enabled Location - Check Again
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              After enabling location in your browser settings, click the button above to continue
            </p>
          </div>

          {/* Troubleshooting */}
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm">
              <strong>Still not working?</strong> Try refreshing the page (F5) or clearing your browser cache. 
              Contact your supervisor if you continue to experience issues.
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Browser-Specific Instructions
// ============================================================================

function ChromeInstructions() {
  return (
    <div className="space-y-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">1</Badge>
        <div className="flex-1">
          <p className="font-medium">Click the lock icon (🔒) in the address bar</p>
          <p className="text-sm text-muted-foreground mt-1">
            Located on the left side of the URL, next to "mybizbuddy.co/"
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">2</Badge>
        <div className="flex-1">
          <p className="font-medium">Find "Location" in the permissions list</p>
          <p className="text-sm text-muted-foreground mt-1">
            You'll see a list of permissions - scroll to find "Location"
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">3</Badge>
        <div className="flex-1">
          <p className="font-medium">Click "Allow" for location access</p>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle the switch or select "Allow" from the dropdown
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-green-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">
          <CheckCircle className="h-4 w-4" />
        </Badge>
        <div className="flex-1">
          <p className="font-medium">Click "Check Again" button below</p>
          <p className="text-sm text-muted-foreground mt-1">
            The page will verify your location access is working
          </p>
        </div>
      </div>
    </div>
  );
}

function FirefoxInstructions() {
  return (
    <div className="space-y-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">1</Badge>
        <div className="flex-1">
          <p className="font-medium">Click the lock or info icon (🔒 or ℹ️) in the address bar</p>
          <p className="text-sm text-muted-foreground mt-1">
            Located on the left side of the URL
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">2</Badge>
        <div className="flex-1">
          <p className="font-medium">Click "Connection secure" or "More information"</p>
          <p className="text-sm text-muted-foreground mt-1">
            This opens the permissions panel
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">3</Badge>
        <div className="flex-1">
          <p className="font-medium">Find "Access Your Location" permission</p>
          <p className="text-sm text-muted-foreground mt-1">
            Look for location-related permissions and set to "Allow"
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-green-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">
          <CheckCircle className="h-4 w-4" />
        </Badge>
        <div className="flex-1">
          <p className="font-medium">Click "Check Again" button below</p>
          <p className="text-sm text-muted-foreground mt-1">
            The page will verify your location access is working
          </p>
        </div>
      </div>
    </div>
  );
}

function SafariInstructions() {
  return (
    <div className="space-y-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">1</Badge>
        <div className="flex-1">
          <p className="font-medium">Click "Safari" in the menu bar, then "Settings"</p>
          <p className="text-sm text-muted-foreground mt-1">
            Or use keyboard shortcut: Cmd + , (comma)
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">2</Badge>
        <div className="flex-1">
          <p className="font-medium">Go to "Websites" tab, then "Location"</p>
          <p className="text-sm text-muted-foreground mt-1">
            You'll see a list of websites with location permissions
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">3</Badge>
        <div className="flex-1">
          <p className="font-medium">Find "localhost" and set to "Allow"</p>
          <p className="text-sm text-muted-foreground mt-1">
            Or look for your current website in the list
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-green-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">
          <CheckCircle className="h-4 w-4" />
        </Badge>
        <div className="flex-1">
          <p className="font-medium">Refresh the page and click "Check Again"</p>
          <p className="text-sm text-muted-foreground mt-1">
            Safari may require a page refresh after changing permissions
          </p>
        </div>
      </div>
    </div>
  );
}

function EdgeInstructions() {
  return (
    <div className="space-y-3 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">1</Badge>
        <div className="flex-1">
          <p className="font-medium">Click the lock icon (🔒) in the address bar</p>
          <p className="text-sm text-muted-foreground mt-1">
            Located on the left side of the URL, next to "mybizbuddy.co/"
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">2</Badge>
        <div className="flex-1">
          <p className="font-medium">Click "Permissions for this site"</p>
          <p className="text-sm text-muted-foreground mt-1">
            This opens the site permissions panel
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-orange-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">3</Badge>
        <div className="flex-1">
          <p className="font-medium">Find "Location" and set to "Allow"</p>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle the switch or select "Allow" from the dropdown
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Badge className="bg-green-500 text-white text-lg h-8 w-8 flex items-center justify-center shrink-0">
          <CheckCircle className="h-4 w-4" />
        </Badge>
        <div className="flex-1">
          <p className="font-medium">Click "Check Again" button below</p>
          <p className="text-sm text-muted-foreground mt-1">
            The page will verify your location access is working
          </p>
        </div>
      </div>
    </div>
  );
}