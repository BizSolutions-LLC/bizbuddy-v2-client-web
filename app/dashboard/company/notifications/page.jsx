'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, 
  Clock, 
  Mail, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  Settings, 
  Sun, 
  Moon, 
  Info, 
  Loader2,
  ArrowLeft 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast, Toaster } from "sonner";
import useAuthStore from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';

export default function NotificationSettings() {
  const { token } = useAuthStore(); 
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState(null); 
  const [settings, setSettings] = useState({
    clockInGracePeriod: 30,
    clockOutGracePeriod: 30,
    notifyEmployeeMissedIn: true,
    notifyEmployeeMissedOut: true,
    notifyAdminMissedClocks: true,
    morningReportTime: '10:00',
    eveningReportTime: '18:00',
  });

  // ✅ Fetch user profile to get role
  useEffect(() => {
    if (!token) return;
    
    fetch(`${API}/api/account/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.user?.role) {
          const role = data.data.user.role.toLowerCase();
          setUserRole(role);
          
          // ✅ Check if admin AFTER role is loaded
          if (!['admin', 'superadmin', 'supervisor'].includes(role)) {
            toast.error('Access denied. Only administrators can access this page.');
            router.push('/dashboard');
          } else {
            // ✅ Only fetch settings if user is admin
            fetchSettings();
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching profile:', err);
        toast.error('Failed to verify permissions');
        router.push('/dashboard');
      });
  }, [token]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/company-settings/notification-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.data);
      } else {
        toast.error(data.message || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Network error while loading settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/company-settings/notification-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Notification settings saved successfully!');
      } else {
        toast.error(data.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Network error while saving settings');
    } finally {
      setSaving(false);
    }
  };

  // ✅ Show loading until we know the role
  if (!userRole) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ✅ If not admin, don't render anything (redirect already happened)
  if (!['admin', 'superadmin', 'supervisor'].includes(userRole)) {
    return null;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/dashboard/company-settings/configurations')}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              Notification Settings
            </h1>
            <p className="text-muted-foreground">
              Configure clock-in/out alerts and management reports
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grace Periods */}
          <Card className="border-2 shadow-lg">
            <div className="h-1 w-full bg-orange-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <Clock className="h-5 w-5 text-orange-500" />
                Grace Periods
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Clock-In Grace Period */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Clock-In Grace Period
                    <span className="text-muted-foreground font-normal ml-2">
                      (minutes after scheduled start)
                    </span>
                  </Label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="5"
                      value={settings.clockInGracePeriod}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        clockInGracePeriod: parseInt(e.target.value) 
                      }))}
                      className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={settings.clockInGracePeriod}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        clockInGracePeriod: parseInt(e.target.value) 
                      }))}
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Employees notified <strong>{settings.clockInGracePeriod} minutes</strong> after scheduled start
                  </p>
                </div>

                {/* Clock-Out Grace Period */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Clock-Out Grace Period
                    <span className="text-muted-foreground font-normal ml-2">
                      (minutes after scheduled end)
                    </span>
                  </Label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="5"
                      value={settings.clockOutGracePeriod}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        clockOutGracePeriod: parseInt(e.target.value) 
                      }))}
                      className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="120"
                      value={settings.clockOutGracePeriod}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        clockOutGracePeriod: parseInt(e.target.value) 
                      }))}
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Employees notified <strong>{settings.clockOutGracePeriod} minutes</strong> after scheduled end
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee Notifications */}
          <Card className="border-2 shadow-lg">
            <div className="h-1 w-full bg-orange-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <Mail className="h-5 w-5 text-orange-500" />
                Employee Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg cursor-pointer hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">⏰</div>
                  <div>
                    <div className="font-medium">Missed Clock-In Alerts</div>
                    <div className="text-sm text-muted-foreground">
                      Send notifications to employees who forget to clock in
                    </div>
                  </div>
                </div>
                <Checkbox
                  checked={settings.notifyEmployeeMissedIn}
                  onCheckedChange={(checked) => setSettings(prev => ({ 
                    ...prev, 
                    notifyEmployeeMissedIn: checked 
                  }))}
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg cursor-pointer hover:bg-orange-100/50 dark:hover:bg-orange-900/20 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="text-2xl">🕐</div>
                  <div>
                    <div className="font-medium">Missed Clock-Out Alerts</div>
                    <div className="text-sm text-muted-foreground">
                      Send notifications to employees who forget to clock out
                    </div>
                  </div>
                </div>
                <Checkbox
                  checked={settings.notifyEmployeeMissedOut}
                  onCheckedChange={(checked) => setSettings(prev => ({ 
                    ...prev, 
                    notifyEmployeeMissedOut: checked 
                  }))}
                />
              </label>
            </CardContent>
          </Card>

          {/* Management Reports */}
          <Card className="border-2 shadow-lg">
            <div className="h-1 w-full bg-orange-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <Users className="h-5 w-5 text-orange-500" />
                Management Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors">
                <div className="flex items-start space-x-3">
                  <Settings className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <div className="font-medium">Daily Reports to Management</div>
                    <div className="text-sm text-muted-foreground">
                      Send daily attendance summaries to admins and supervisors
                    </div>
                  </div>
                </div>
                <Checkbox
                  checked={settings.notifyAdminMissedClocks}
                  onCheckedChange={(checked) => setSettings(prev => ({ 
                    ...prev, 
                    notifyAdminMissedClocks: checked 
                  }))}
                />
              </label>

              {settings.notifyAdminMissedClocks && (
                <div className="pl-8 grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Sun className="h-4 w-4 text-yellow-500" />
                      Morning Report Time
                    </Label>
                    <Input
                      type="time"
                      value={settings.morningReportTime}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        morningReportTime: e.target.value 
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Daily summary of missed clock-ins
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Moon className="h-4 w-4 text-blue-500" />
                      Evening Report Time
                    </Label>
                    <Input
                      type="time"
                      value={settings.eveningReportTime}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        eveningReportTime: e.target.value 
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Daily summary of missed clock-outs
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Help Info */}
          <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    How Notifications Work
                  </h4>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• <strong>Employee Alerts:</strong> Sent immediately via email and in-app notification bell</li>
                    <li>• <strong>Management Reports:</strong> Sent to all admins and supervisors at scheduled times</li>
                    <li>• <strong>Grace Periods:</strong> Determine how long to wait before sending alerts</li>
                    <li>• <strong>Real-time Updates:</strong> Notification bell shows unread count instantly</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}