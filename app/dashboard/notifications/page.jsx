// dashboard > notifications > page.jsx 

'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  BellDot, 
  Check, 
  CheckCheck,
  Clock, 
  AlertCircle, 
  Info,
  Trash2,
  RefreshCw,
  Filter,
  Eye,
  EyeOff,
  Inbox
} from 'lucide-react';
import { notificationApi } from '@/lib/notificationApi';
import socketService from '@/lib/socketService';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';

const NOTIFICATION_TYPES = {
  MISSED_CLOCK_IN: {
    title: 'Missed Clock-In',
    emoji: '⏰',
    icon: AlertCircle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800'
  },
  MISSED_CLOCK_OUT: {
    title: 'Missed Clock-Out',
    emoji: '🕐',
    icon: AlertCircle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
    borderColor: 'border-orange-200 dark:border-orange-800'
  },
  DAILY_CLOCK_IN_REPORT: {
    title: 'Morning Report',
    emoji: '☀️',
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  DAILY_CLOCK_OUT_REPORT: {
    title: 'Evening Report',
    emoji: '🌙',
    icon: Info,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  DEFAULT: {
    title: 'Notification',
    emoji: '🔔',
    icon: Bell,
    color: 'text-neutral-500',
    bgColor: 'bg-neutral-50 dark:bg-neutral-950/20',
    borderColor: 'border-neutral-200 dark:border-neutral-800'
  }
};

function NotificationCard({ notification, onMarkAsRead, onDelete, onToggleSeen }) {
  const notifType = NOTIFICATION_TYPES[notification.notificationCode] || NOTIFICATION_TYPES.DEFAULT;
  const Icon = notifType.icon;

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: new Date(date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      layout
      className={`relative border-l-4 ${notifType.borderColor} ${
        notification.seen 
          ? 'bg-white dark:bg-neutral-800' 
          : notifType.bgColor
      } rounded-r-lg shadow-sm hover:shadow-md transition-all duration-200`}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon/Emoji */}
          <div className="flex-shrink-0 mt-1">
            <div className="text-3xl">
              {notifType.emoji}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${
                  notification.seen 
                    ? 'text-neutral-700 dark:text-neutral-300' 
                    : 'text-neutral-900 dark:text-neutral-100'
                }`}>
                  {notifType.title}
                </h3>
                {!notification.seen && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                )}
              </div>
            </div>

            <p className={`text-sm mb-3 ${
              notification.seen 
                ? 'text-neutral-600 dark:text-neutral-400' 
                : 'text-neutral-700 dark:text-neutral-300'
            }`}>
              {notification.message}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <Clock className="w-3 h-3" />
                <span>{timeAgo(notification.createdAt)}</span>
              </div>

              <div className="flex items-center gap-1">
                {!notification.seen && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onMarkAsRead(notification.id)}
                    className="h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    <span className="text-xs">Mark Read</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggleSeen(notification.id, !notification.seen)}
                  className="h-8"
                  title={notification.seen ? 'Mark as unread' : 'Mark as read'}
                >
                  {notification.seen ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(notification.id)}
                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [deleteAllDialog, setDeleteAllDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const total = pagination?.total || notifications.length;
    const unread = notifications.filter(n => !n.seen).length;
    const read = notifications.filter(n => n.seen).length;
    
    return { total, unread, read };
  }, [notifications, pagination]);

  // Fetch notifications
  const fetchNotifications = async (pageNum = 1, showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const params = { page: pageNum, limit: 20 };
      
      if (filter === 'unread') params.seen = 'false';
      if (filter === 'read') params.seen = 'true';

      const { data } = await notificationApi.getNotifications(params);
      
      setNotifications(data.data.notifications);
      setPagination(data.data.pagination);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Mark as read
  const handleMarkAsRead = async (id) => {
    try {
      await notificationApi.markAsSeen(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, seen: true, seenAt: new Date() } : n)
      );
      toast.success('Marked as read');
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  // Toggle seen status
  const handleToggleSeen = async (id, newSeenStatus) => {
    try {
      if (newSeenStatus) {
        await notificationApi.markAsSeen(id);
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, seen: true, seenAt: new Date() } : n)
        );
        toast.success('Marked as read');
      } else {
        toast.info('Mark as unread not implemented yet');
      }
    } catch (error) {
      console.error('Error toggling seen status:', error);
      toast.error('Failed to update notification');
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsSeen();
      setNotifications(prev =>
        prev.map(n => ({ ...n, seen: true, seenAt: new Date() }))
      );
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  // Delete notification
  const handleDelete = async (id) => {
    try {
      await notificationApi.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    setDeleting(true);
    try {
      const { data } = await notificationApi.clearAll(); // Using clearAll() from your API
      setNotifications([]);
      setPagination(null);
      setDeleteAllDialog(false);
      toast.success(data.message || 'All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    } finally {
      setDeleting(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchNotifications(1);
  }, [filter]);

  // Socket listener for new notifications
  useEffect(() => {
    socketService.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
    });

    return () => {
      socketService.off('notification');
    };
  }, []);

  // Filter tabs
  const tabs = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'unread', label: 'Unread', count: stats.unread },
    { value: 'read', label: 'Read', count: stats.read },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg">
              <Bell className="h-6 w-6" />
            </div>
            Notifications
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Manage your notification preferences and history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNotifications(page, false)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {stats.unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteAllDialog(true)}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
            <div className="h-1 w-full bg-orange-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Total Notifications
                </CardTitle>
                <Bell className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.total}</div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                all time
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
            <div className="h-1 w-full bg-orange-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Unread
                </CardTitle>
                <BellDot className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.unread}</div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                need attention
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
            <div className="h-1 w-full bg-orange-500" />
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Read
                </CardTitle>
                <CheckCheck className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.read}</div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                already seen
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <Card className="border-2 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.value}
                variant={filter === tab.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(tab.value)}
                className={`gap-2 ${
                  filter === tab.value
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200'
                }`}
              >
                <Filter className="h-4 w-4" />
                {tab.label}
                <Badge variant="secondary" className="ml-1">
                  {tab.count}
                </Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card className="border-2 shadow-lg">
        <div className="h-1 w-full bg-orange-500" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              {filter === 'all' && 'All Notifications'}
              {filter === 'unread' && 'Unread Notifications'}
              {filter === 'read' && 'Read Notifications'}
            </CardTitle>
            {pagination && (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Page {pagination.page} of {pagination.totalPages}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {notifications.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                      onDelete={handleDelete}
                      onToggleSeen={handleToggleSeen}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNotifications(page - 1)}
                    disabled={page === 1 || loading}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                      .filter(p => {
                        return p === 1 || 
                               p === pagination.totalPages || 
                               Math.abs(p - page) <= 1;
                      })
                      .map((p, idx, arr) => (
                        <div key={p} className="flex items-center">
                          {idx > 0 && arr[idx - 1] !== p - 1 && (
                            <span className="px-2 text-neutral-400">...</span>
                          )}
                          <Button
                            variant={p === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => fetchNotifications(p)}
                            className={p === page ? 'bg-orange-500 hover:bg-orange-600' : ''}
                          >
                            {p}
                          </Button>
                        </div>
                      ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchNotifications(page + 1)}
                    disabled={page === pagination.totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center"
            >
              <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Inbox className="h-10 w-10 text-neutral-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                No notifications
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {filter === 'unread' && "You're all caught up! No unread notifications."}
                {filter === 'read' && "You haven't read any notifications yet."}
                {filter === 'all' && "You don't have any notifications yet."}
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={deleteAllDialog} onOpenChange={setDeleteAllDialog}>
        <DialogContent className="sm:max-w-md border-2 border-red-200 dark:border-red-800/50">
          <div className="h-1 w-full bg-red-500 -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              Clear All Notifications
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all notifications? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 my-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              This will permanently delete <strong>{stats.total} notification{stats.total !== 1 ? 's' : ''}</strong> from your account.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteAllDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}