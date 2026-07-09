'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellDot, X, Check, Clock, AlertCircle, Info } from 'lucide-react';
import { notificationApi } from '@/lib/notificationApi';
import socketService from '@/lib/socketService';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Notification type configuration
const NOTIFICATION_CONFIG = {
  // ── Attendance ────────────────────────────────────────────────
  MISSED_CLOCK_IN:           { title: 'Missed Clock-In',          emoji: '⏰' },
  MISSED_CLOCK_OUT:          { title: 'Missed Clock-Out',         emoji: '🕐' },
  DAILY_CLOCK_IN_REPORT:     { title: 'Morning Report',           emoji: '☀️' },
  DAILY_CLOCK_OUT_REPORT:    { title: 'Evening Report',           emoji: '🌙' },

  // ── Leave Requests ────────────────────────────────────────────
  LEAVE_REQUEST_SUBMITTED:   { title: 'New Leave Request',        emoji: '📋' },
  LEAVE_REQUEST_APPROVED:    { title: 'Leave Approved',           emoji: '✅' },
  LEAVE_REQUEST_REJECTED:    { title: 'Leave Rejected',           emoji: '❌' },

  // ── Overtime Requests ─────────────────────────────────────────
  OVERTIME_REQUEST_SUBMITTED: { title: 'New Overtime Request',    emoji: '⏱️' },
  OVERTIME_REQUEST_APPROVED:  { title: 'Overtime Approved',       emoji: '✅' },
  OVERTIME_REQUEST_REJECTED:  { title: 'Overtime Rejected',       emoji: '❌' },

  // ── Contest / Time Correction Requests ────────────────────────
  CONTEST_REQUEST_SUBMITTED: { title: 'New Time Contest',         emoji: '🔁' },
  CONTEST_REQUEST_APPROVED:  { title: 'Time Contest Approved',    emoji: '✅' },
  CONTEST_REQUEST_REJECTED:  { title: 'Time Contest Rejected',    emoji: '❌' },

  // ── Schedule ──────────────────────────────────────────────────
  SCHEDULE_ASSIGNED:             { title: 'Schedule Assigned',        emoji: '📅' },
  SCHEDULE_ASSIGNED_MANAGEMENT:  { title: 'Schedule Alert',           emoji: '📋' },
  SCHEDULE_REPLACED:             { title: 'Schedule Replaced',        emoji: '🔄' },
  SCHEDULE_UPDATED:              { title: 'Schedule Updated',         emoji: '📅' },

  // ── Auto Clock-Out ────────────────────────────────────────────
  AUTO_CLOCK_OUT:            { title: 'Auto Clock-Out',           emoji: '🔒' },
  CLOCK_OUT_WARNING:         { title: 'Time to Clock Out',        emoji: '⏰' },

  // ── Password ──────────────────────────────────────────────────
  PASSWORD_RESET_SUCCESS:    { title: 'Password Reset',           emoji: '🔑' },

  // ── Payslip ───────────────────────────────────────────────────
  PAYSLIP_GENERATED:         { title: 'Payslip Available',        emoji: '💰' },

  // ── Cutoff Periods ────────────────────────────────────────────
  CUTOFF_PERIOD_LOCKED:      { title: 'Cutoff Period Locked',     emoji: '🔒' },
  CUTOFF_PROCESSED:          { title: 'Cutoff Processed',         emoji: '🏦' },

  // ── Account Deletion ──────────────────────────────────────────
  DELETION_REQUEST_SUBMITTED: { title: 'Deletion Request',        emoji: '🗑️' },
  DELETION_REQUEST_APPROVED:  { title: 'Account Deletion Done',   emoji: '✔️' },

  DEFAULT:                   { title: 'Notification',             emoji: '🔔' },
};

// Time formatter
const formatTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
};

function NotificationItem({ notification, onMarkAsRead, onRemove }) {
  const config = NOTIFICATION_CONFIG[notification.notificationCode] || NOTIFICATION_CONFIG.DEFAULT;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`p-4 border-b border-neutral-200 dark:border-neutral-700 last:border-b-0 
                  hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-200
                  ${!notification.seen ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-1 text-2xl">{config.emoji}</div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className={`text-sm font-medium ${
              !notification.seen 
                ? 'text-neutral-900 dark:text-neutral-100' 
                : 'text-neutral-700 dark:text-neutral-300'
            }`}>
              {config.title}
            </h4>
            {!notification.seen && (
              <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 animate-pulse" />
            )}
          </div>
          
          <p className={`text-sm ${
            !notification.seen 
              ? 'text-neutral-600 dark:text-neutral-400' 
              : 'text-neutral-500 dark:text-neutral-500'
          }`}>
            {notification.message}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formatTimeAgo(notification.createdAt)}
            </span>
            
            <div className="flex items-center space-x-1">
              {!notification.seen && (
                <button
                  onClick={() => onMarkAsRead(notification.id)}
                  className="p-1.5 rounded-md text-orange-600 hover:text-orange-700 
                           hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors"
                  title="Mark as read"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onRemove(notification.id)}
                className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 
                         hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NotificationPanel({ notifications, onMarkAsRead, onRemove, onMarkAllAsRead, onClose }) {
  const router = useRouter();
  const unreadCount = notifications.filter(n => !n.seen).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="absolute right-0 mt-2 w-96 max-w-sm bg-white dark:bg-neutral-900 
                 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 
                 overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/20">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              {unreadCount} new
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-full
                       hover:bg-orange-600 transition-colors font-medium shadow-sm"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-600 
                     hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        <AnimatePresence>
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                onRemove={onRemove}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 text-center"
            >
              <Bell className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-500 dark:text-neutral-400">
                No notifications yet
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
          <button
            onClick={() => {
              onClose();
              router.push('/dashboard/notifications');
            }}
            className="block w-full text-center text-sm text-orange-600 dark:text-orange-400 
                     hover:text-orange-700 dark:hover:text-orange-300 transition-colors font-medium"
          >
            View all notifications →
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const { data } = await notificationApi.getUnreadCount();
      setUnreadCount(data.data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  // Fetch recent notifications
  const fetchNotifications = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const { data } = await notificationApi.getNotifications({ limit: 10 });
      setNotifications(data.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Mark notification as read
  const handleMarkAsRead = useCallback(async (id) => {
    try {
      await notificationApi.markAsSeen(id);
      
      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, seen: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      toast.success('Marked as read');
    } catch (error) {
      console.error('Error marking as read:', error);
      toast.error('Failed to mark as read');
      
      // Revert on error
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [fetchNotifications, fetchUnreadCount]);

  // Remove notification
  const handleRemove = useCallback(async (id) => {
    try {
      const wasUnread = notifications.find(n => n.id === id)?.seen === false;
      
      await notificationApi.deleteNotification(id);
      
      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      toast.success('Notification removed');
    } catch (error) {
      console.error('Error removing notification:', error);
      toast.error('Failed to remove notification');
      
      // Revert on error
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [notifications, fetchNotifications, fetchUnreadCount]);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await notificationApi.markAllAsSeen();
      
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, seen: true })));
      setUnreadCount(0);
      
      toast.success('All marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
      
      // Revert on error
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [fetchNotifications, fetchUnreadCount]);

  // Socket.io listeners
  useEffect(() => {
    fetchUnreadCount();

    const handleNewNotification = (notification) => {
      // console.log('🔔 New notification:', notification);

      // Update state
      setUnreadCount(prev => prev + 1);
      setNotifications(prev => [notification, ...prev].slice(0, 10));

      // Persistent toast for clock-out warning — time-sensitive, must not auto-dismiss
      if (notification.notificationCode === 'CLOCK_OUT_WARNING') {
        toast.warning(notification.message || 'Please clock out soon.', {
          description: notification.title || 'Time to Clock Out',
          duration: Infinity,
          closeButton: true,
        });
        return;
      }

      // Browser notification
      if (typeof window !== 'undefined' && Notification.permission === 'granted') {
        new Notification('BizBuddy', {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        });
      }
    };

    socketService.on('notification', handleNewNotification);

    return () => {
      socketService.off('notification', handleNewNotification);
    };
  }, [fetchUnreadCount]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      fetchNotifications();
    }
  }, [isOpen, notifications.length, fetchNotifications]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const hasUnread = unreadCount > 0;
  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative">
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all duration-200 ${
          isOpen
            ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950'
        }`}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        {hasUnread ? <BellDot className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        
        {hasUnread && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5
                     bg-gradient-to-r from-orange-500 to-red-500
                     rounded-full border-2 border-white dark:border-neutral-900
                     flex items-center justify-center shadow-lg"
          >
            <span className="text-xs font-bold text-white leading-none">
              {displayCount}
            </span>
          </motion.div>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <div ref={panelRef}>
            <NotificationPanel
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              onRemove={handleRemove}
              onMarkAllAsRead={handleMarkAllAsRead}
              onClose={() => setIsOpen(false)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}