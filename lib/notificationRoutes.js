export const NOTIFICATION_ROUTES = {
  MISSED_CLOCK_IN: '/dashboard/employee/punch',
  MISSED_CLOCK_OUT: '/dashboard/employee/punch',
  CLOCK_OUT_WARNING: '/dashboard/employee/punch',
  AUTO_CLOCK_OUT: '/dashboard/employee/punch-logs',
  DAILY_CLOCK_IN_REPORT: '/dashboard/company/punch-logs',
  DAILY_CLOCK_OUT_REPORT: '/dashboard/company/punch-logs',
  LEAVE_REQUEST_SUBMITTED: '/dashboard/company/leave-requests',
  LEAVE_REQUEST_APPROVED: '/dashboard/employee/leave-logs',
  LEAVE_REQUEST_REJECTED: '/dashboard/employee/leave-logs',
  OVERTIME_REQUEST_SUBMITTED: '/dashboard/company/overtime-requests',
  OVERTIME_REQUEST_APPROVED: '/dashboard/employee/overtime',
  OVERTIME_REQUEST_REJECTED: '/dashboard/employee/overtime',
  CONTEST_REQUEST_SUBMITTED: '/dashboard/company/contest-requests',
  CONTEST_REQUEST_APPROVED: '/dashboard/employee/contest-time-logs',
  CONTEST_REQUEST_REJECTED: '/dashboard/employee/contest-time-logs',
  SCHEDULE_ASSIGNED: '/dashboard/employee/schedule',
  SCHEDULE_REPLACED: '/dashboard/employee/schedule',
  SCHEDULE_UPDATED: '/dashboard/employee/schedule',
  SCHEDULE_ASSIGNED_MANAGEMENT: '/dashboard/company/employee-schedules',
  PAYSLIP_GENERATED: '/dashboard/employee/payslip',
  CUTOFF_PERIOD_LOCKED: '/dashboard/company/cutoff-periods',
  CUTOFF_PROCESSED: '/dashboard/company/cutoff-periods',
  DELETION_REQUEST_SUBMITTED: '/dashboard/company/employee-deletion',
  DELETION_REQUEST_APPROVED: '/dashboard/company/employee-deletion',
  PASSWORD_RESET_SUCCESS: '/dashboard/user/settings',
};

const DEFAULT_ROUTE = '/dashboard/notifications';

export function getNotificationRoute(notificationCode) {
  return NOTIFICATION_ROUTES[notificationCode] || DEFAULT_ROUTE;
}
