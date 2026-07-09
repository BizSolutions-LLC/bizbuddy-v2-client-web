'use client';

import axios from 'axios';
import useAuthStore from '@/store/useAuthStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ Unauthorized - Token may be invalid or expired');
      // Optionally: redirect to login or refresh token
      // useAuthStore.getState().logout();
      // window.location.href = '/sign-in';
    }
    return Promise.reject(error);
  }
);

export const notificationApi = {
  // Get notifications (paginated)
  getNotifications: (params = {}) => 
    api.get('/notifications', { params }),

  // Get unread count
  getUnreadCount: () => 
    api.get('/notifications/unread-count'),

  // Mark as seen
  markAsSeen: (id) => 
    api.put(`/notifications/${id}/seen`),

  // Mark all as seen
  markAllAsSeen: () => 
    api.put('/notifications/mark-all-seen'),

  // Delete notification
  deleteNotification: (id) => 
    api.delete(`/notifications/${id}`),

  // Clear all
  clearAll: () => 
    api.delete('/notifications'),

  // Company settings
  getSettings: () => 
    api.get('/company/notification-settings'),

  updateSettings: (settings) => 
    api.put('/company/notification-settings', settings),
};