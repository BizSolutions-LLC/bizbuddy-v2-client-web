"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import useAuthStore from "@/store/useAuthStore";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CalendarIcon,
  CheckCircle, 
  Clock, 
  Calendar,
  ArrowRight, 
  RefreshCw, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight,
  MapPin,
  Building,
  Users,
  Globe,
  Loader2,
  UserCheck,
  ChevronDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CompanyWideSummaryStats = ({ currentMonth }) => {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    
    const fetchCompanyStats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/usershifts/company-stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        
        if (res.ok) {
          setStats(data.data);
        } else {
          toast.error(data.message || "Failed to fetch company stats.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch company stats.");
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyStats();
  }, [token, API_URL, currentMonth]);

  const getDefinition = (type) => {
    switch (type) {
      case 'totalEmployees':
        return "Total number of active employees in your company.";
      case 'withShifts':
        return "Number of employees who have at least one shift scheduled this month.";
      case 'withoutShifts':
        return "Number of employees who have NO shifts scheduled this month. These employees may need schedule assignment.";
      case 'coverage':
        return "Percentage of employees who have scheduled shifts. Higher is better for full team coverage.";
      default:
        return "";
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 cursor-help hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors border border-blue-200 dark:border-blue-900">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-blue-600">Total Employees</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-500">
                  {stats.totalEmployees}
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-sm">{getDefinition('totalEmployees')}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 cursor-help hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors border border-green-200 dark:border-green-900">
              <div className="p-2 rounded-full bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-green-600">With Shifts</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-500">
                  {stats.withShifts}
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-sm">{getDefinition('withShifts')}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 cursor-help hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors border border-red-200 dark:border-red-900">
              <div className="p-2 rounded-full bg-red-500/10">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-red-600">Without Shifts</div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-500">
                  {stats.withoutShifts}
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-sm">{getDefinition('withoutShifts')}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 cursor-help hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors border border-orange-200 dark:border-orange-900">
              <div className="p-2 rounded-full bg-orange-500/10">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-orange-600">Coverage</div>
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-500">
                  {stats.coverage}%
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-sm">{getDefinition('coverage')}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

// Extract naive time (no conversion) - displays time as stored
const formatNaiveTime = (dateString) => {
  try {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (error) {
    return 'Invalid';
  }
};

// Convert shift time to user's local timezone if different
const convertToUserTimezone = (dateString, shiftTimezone, userTimezone) => {
  try {
    if (!dateString || !shiftTimezone || !userTimezone) return null;
    if (shiftTimezone === userTimezone) return null; // Same timezone, no conversion
    
    // Extract naive hours and minutes
    const date = new Date(dateString);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    
    // Create a date object representing this time TODAY in the shift timezone
    const today = new Date();
    const dateStr = format(today, 'yyyy-MM-dd');
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
    const dateTimeStr = `${dateStr}T${timeStr}`;
    
    // Interpret this time as being in the shift timezone
    const shiftTime = fromZonedTime(dateTimeStr, shiftTimezone);
    
    // Convert to user timezone
    const userTime = toZonedTime(shiftTime, userTimezone);
    
    // Format in user timezone
    const localHours = userTime.getHours().toString().padStart(2, '0');
    const localMinutes = userTime.getMinutes().toString().padStart(2, '0');
    
    return `${localHours}:${localMinutes}`;
  } catch (error) {
    console.error('Error converting to user timezone:', error);
    return null;
  }
};

// Timezone utility functions
const getTimezoneAbbreviation = (timezone) => {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(part => part.type === 'timeZoneName');
    return tzPart ? tzPart.value : timezone.split('/').pop();
  } catch (error) {
    return timezone.split('/').pop();
  }
};

const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

const toLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

function hoursBetween(startISO, endISO) {
  try {
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "N/A";
    
    let diff = end - start;
    if (diff < 0) diff += 24 * 60 * 60 * 1000;
    
    return (diff / 36e5).toFixed(2);
  } catch (err) {
    return "N/A";
  }
}

// Timezone Badge Component
function TimezoneBadge({ timezone, compact = false }) {
  const abbr = getTimezoneAbbreviation(timezone);
  
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="text-xs font-mono">
              <Globe className="h-3 w-3 mr-1" />
              {abbr}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <div className="font-medium">{timezone}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Globe className="h-3 w-3" />
      <span className="font-mono">{abbr}</span>
    </div>
  );
}

// Employee Selector Component (keeping existing implementation)
function EmployeeSelector({ employees, selectedEmployee, onSelect, loading }) {
  const groupedEmployees = useMemo(() => {
    const groups = {
      superadmin: [],
      admin: [],
      supervisor: [],
      employee: []
    };

    employees.forEach(emp => {
      const role = emp.role.toLowerCase();
      if (groups[role]) {
        groups[role].push(emp);
      }
    });

    Object.keys(groups).forEach(role => {
      groups[role].sort((a, b) => {
        const nameA = `${a.profile?.firstName || ''} ${a.profile?.lastName || ''}`.trim() || a.email;
        const nameB = `${b.profile?.firstName || ''} ${b.profile?.lastName || ''}`.trim() || b.email;
        return nameA.localeCompare(nameB);
      });
    });

    return groups;
  }, [employees]);

  const selectedName = selectedEmployee 
    ? `${selectedEmployee.profile?.firstName || ''} ${selectedEmployee.profile?.lastName || ''}`.trim() || selectedEmployee.email
    : "Select employee";

  const roleLabels = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    supervisor: 'Supervisor',
    employee: 'Employee'
  };

  const roleColors = {
    superadmin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    supervisor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    employee: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  };

  const roleHeaderColors = {
    superadmin: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
    admin: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    supervisor: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    employee: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
  };

  return (
    <Select
      value={selectedEmployee?.id?.toString() || ""}
      onValueChange={(value) => {
        const employee = employees.find(e => e.id.toString() === value);
        if (employee) onSelect(employee);
      }}
      disabled={loading}
    >
      <SelectTrigger className="w-full h-16 border-2 hover:border-orange-300 dark:hover:border-orange-700 transition-colors">
        <div className="flex items-center justify-between w-full gap-4">
          {selectedEmployee ? (
            <>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="font-semibold text-lg text-gray-900 dark:text-gray-100 truncate w-full">
                  {selectedName}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{selectedEmployee.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedEmployee.hasShifts ? (
                  <Badge className="bg-green-500 hover:bg-green-600 text-white font-medium px-3 py-1">
                    {selectedEmployee.shiftCount} {selectedEmployee.shiftCount === 1 ? 'Shift' : 'Shifts'}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="font-medium px-3 py-1">
                    No Shifts
                  </Badge>
                )}
                
                <Badge className={`${roleColors[selectedEmployee.role.toLowerCase()]} font-medium px-3 py-1 border-0`}>
                  {roleLabels[selectedEmployee.role.toLowerCase()]}
                </Badge>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/20">
                <UserCheck className="h-4 w-4 text-orange-600" />
              </div>
              <span className="font-medium">Select an employee to view their schedule</span>
            </div>
          )}
        </div>
      </SelectTrigger>

      <SelectContent className="max-h-[500px] w-full">
        {Object.entries(groupedEmployees).map(([role, roleEmployees]) => {
          if (roleEmployees.length === 0) return null;
          
          const withShifts = roleEmployees.filter(e => e.hasShifts).length;
          const withoutShifts = roleEmployees.filter(e => !e.hasShifts).length;
          
          return (
            <div key={role} className="mb-1">
              <div className={`px-3 py-2 border-y ${roleHeaderColors[role]} sticky top-0 z-10`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                      {roleLabels[role]}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({roleEmployees.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {withShifts > 0 && (
                      <div className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                        <CheckCircle className="h-3 w-3" />
                        <span>{withShifts}</span>
                      </div>
                    )}
                    {withoutShifts > 0 && (
                      <div className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
                        <Users className="h-3 w-3" />
                        <span>{withoutShifts}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="py-1">
                {roleEmployees.map((employee) => {
                  const fullName = `${employee.profile?.firstName || ''} ${employee.profile?.lastName || ''}`.trim() || employee.email;
                  
                  return (
                    <SelectItem 
                      key={employee.id} 
                      value={employee.id.toString()}
                      className="cursor-pointer py-3 px-3 mx-1 my-0.5 rounded-md"
                    >
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            employee.hasShifts 
                              ? 'bg-green-500' 
                              : 'bg-red-500 animate-pulse'
                          }`} />
                          
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                              {fullName}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {employee.email}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0">
                          {employee.hasShifts ? (
                            <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-xs font-semibold px-2 py-0.5">
                              {employee.shiftCount}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 text-xs font-semibold px-2 py-0.5">
                              0
                            </Badge>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </div>
            </div>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Calendar Component (keeping existing implementation with minor updates)
function ModernCalendar({ 
  selectedDate, 
  onDateSelect, 
  currentMonth, 
  onMonthChange, 
  shiftsByDate,
  loading 
}) {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const prevMonthDays = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const prevDay = new Date(monthStart);
    prevDay.setDate(prevDay.getDate() - (i + 1));
    prevMonthDays.push(prevDay);
  }

  const nextMonthDays = [];
  const totalCells = 42;
  const remainingCells = totalCells - (prevMonthDays.length + calendarDays.length);
  for (let i = 1; i <= remainingCells; i++) {
    const nextDay = new Date(monthEnd);
    nextDay.setDate(nextDay.getDate() + i);
    nextMonthDays.push(nextDay);
  }

  const allDays = [...prevMonthDays, ...calendarDays, ...nextMonthDays];

  const getShiftsForDate = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return shiftsByDate[dateKey] || [];
  };

  const getShiftIndicatorColors = (shifts) => {
    const colors = ['bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500'];
    return shifts.slice(0, 4).map((_, index) => colors[index % colors.length]);
  };

  const navigateMonth = (direction) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    onMonthChange(newMonth);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth(-1)}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth(1)}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800">
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-xs font-medium text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {allDays.map((day, index) => {
            const shifts = getShiftsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const hasShifts = shifts.length > 0;

            const timezones = [...new Set(shifts.map(s => s.shift?.timeZone).filter(Boolean))];
            const hasMultipleTimezones = timezones.length > 1;

            return (
              <TooltipProvider key={index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onDateSelect(day)}
                      className={`
                        relative p-2 h-16 border-r border-b border-gray-200 dark:border-gray-700 
                        last-in-row:border-r-0 transition-all duration-200 group
                        ${!isCurrentMonth 
                          ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600' 
                          : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }
                        ${isSelected 
                          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 ring-2 ring-orange-500 ring-inset' 
                          : ''
                        }
                        ${isTodayDate && isCurrentMonth 
                          ? 'bg-blue-50 dark:bg-blue-900/20' 
                          : ''
                        }
                      `}
                      disabled={loading}
                    >
                      <div className={`
                        text-sm font-medium mb-1
                        ${isSelected 
                          ? 'text-orange-700 dark:text-orange-300' 
                          : isTodayDate && isCurrentMonth
                          ? 'text-blue-700 dark:text-blue-300'
                          : isCurrentMonth 
                          ? 'text-gray-900 dark:text-gray-100' 
                          : 'text-gray-400 dark:text-gray-600'
                        }
                      `}>
                        {day.getDate()}
                      </div>

                      {hasShifts && isCurrentMonth && (
                        <div className="absolute bottom-1 left-1 right-1">
                          {shifts.length <= 3 ? (
                            <div className="flex gap-0.5 justify-center">
                              {getShiftIndicatorColors(shifts).map((color, i) => (
                                <div
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full ${color}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <div className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-1 py-0.5 rounded">
                                {shifts.length}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {isTodayDate && isCurrentMonth && (
                        <div className="absolute top-1 right-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>
                      )}

                      {hasMultipleTimezones && isCurrentMonth && (
                        <div className="absolute top-1 left-1">
                          <Globe className="h-3 w-3 text-orange-500" />
                        </div>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{format(day, 'MMM d, yyyy')}</div>
                      {hasShifts && (
                        <>
                          <div className="mt-1 text-xs">
                            {shifts.length} shift{shifts.length !== 1 ? 's' : ''} scheduled
                          </div>
                          {hasMultipleTimezones && (
                            <div className="mt-1 text-xs flex items-center gap-1 text-orange-400">
                              <Globe className="h-3 w-3" />
                              <span>Multiple timezones</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Shift Card Component with Smart Timezone Handling
function ShiftCard({ shift, index, showLocalTime = false }) {
  const shiftTimezone = shift.shift?.timeZone || 'UTC';
  const userTimezone = getUserTimezone();
  const isDifferentTimezone = shiftTimezone !== userTimezone;

  // Always show shift time in its native timezone (naive)
  const startTime = formatNaiveTime(shift.shift.startTime);
  const endTime = formatNaiveTime(shift.shift.endTime);
  const duration = hoursBetween(shift.shift.startTime, shift.shift.endTime);

  // Only convert if timezones are different AND showLocalTime is enabled
  const localStartTime = showLocalTime && isDifferentTimezone 
    ? convertToUserTimezone(shift.shift.startTime, shiftTimezone, userTimezone)
    : null;
  const localEndTime = showLocalTime && isDifferentTimezone
    ? convertToUserTimezone(shift.shift.endTime, shiftTimezone, userTimezone)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 capitalize">
            {shift.shift.shiftName}
          </h4>
          <TimezoneBadge timezone={shiftTimezone} compact />
        </div>
        <Badge variant="secondary" className="text-xs ml-2">
          {duration}h
        </Badge>
      </div>

      {/* Shift timezone times (always shown) */}
      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-1">
        <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
        <span className="font-mono">{startTime}</span>
        <ArrowRight className="h-3 w-3 mx-2 flex-shrink-0" />
        <span className="font-mono">{endTime}</span>
      </div>

      {/* Local time conversion (only if different timezone) */}
      {showLocalTime && isDifferentTimezone && localStartTime && localEndTime && (
        <div className="flex items-center text-xs text-blue-600 dark:text-blue-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="font-mono">{localStartTime}</span>
          <ArrowRight className="h-3 w-3 mx-2 flex-shrink-0" />
          <span className="font-mono">{localEndTime}</span>
          <Badge variant="outline" className="text-xs ml-2">
            {getTimezoneAbbreviation(userTimezone)}
          </Badge>
        </div>
      )}
    </motion.div>
  );
}

export default function AdminSchedule() {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allShifts, setAllShifts] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [showLocalTime, setShowLocalTime] = useState(true);
  
  const userTimezone = getUserTimezone();

  useEffect(() => {
    if (!token) return;
    
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await fetch(`${API_URL}/api/usershifts/company-employees`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        
        if (res.ok) {
          setEmployees(data.data || []);
          if (data.data?.length > 0) {
            setSelectedEmployee(data.data[0]);
          }
        } else {
          toast.error(data.message || "Failed to fetch employees.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch employees.");
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, [token, API_URL]);

  const fetchEmployeeShifts = useCallback(async (employeeId) => {
    if (!token || !employeeId) return;
    
    setLoadingShifts(true);
    try {
      const res = await fetch(`${API_URL}/api/usershifts/employee/${employeeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (res.ok) {
        setAllShifts(data.data?.shifts || []);
      } else {
        toast.error(data.message || "Failed to fetch employee shifts.");
        setAllShifts([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch employee shifts.");
      setAllShifts([]);
    } finally {
      setLoadingShifts(false);
    }
  }, [token, API_URL]);

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeShifts(selectedEmployee.id);
    }
  }, [selectedEmployee, fetchEmployeeShifts]);

  const shiftsByDate = useMemo(() => {
    const grouped = {};
    allShifts.forEach((shift) => {
      if (!shift.assignedDate) return;
      const dateKey = shift.assignedDate.slice(0, 10);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(shift);
    });
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => new Date(a.shift.startTime) - new Date(b.shift.startTime));
    });
    return grouped;
  }, [allShifts]);

  const shiftsToday = useMemo(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return shiftsByDate[dateKey] || [];
  }, [shiftsByDate, selectedDate]);

  const totalHoursToday = useMemo(() => {
    return shiftsToday.reduce((total, shift) => {
      const hours = parseFloat(hoursBetween(shift.shift.startTime, shift.shift.endTime));
      return total + (isNaN(hours) ? 0 : hours);
    }, 0);
  }, [shiftsToday]);

  const totalHoursThisMonth = useMemo(() => {
    return allShifts
      .filter(shift => {
        if (!shift.assignedDate) return false;
        return isSameMonth(toLocalDate(shift.assignedDate), selectedDate);
      })
      .reduce((total, shift) => {
        const hours = parseFloat(hoursBetween(shift.shift.startTime, shift.shift.endTime));
        return total + (isNaN(hours) ? 0 : hours);
      }, 0);
  }, [allShifts, selectedDate]);

  const uniqueTimezones = useMemo(() => {
    const tzSet = new Set();
    allShifts.forEach(shift => {
      if (shift.shift?.timeZone) {
        tzSet.add(shift.shift.timeZone);
      }
    });
    return Array.from(tzSet);
  }, [allShifts]);

  const hasMultipleTimezones = uniqueTimezones.length > 1;

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    setAllShifts([]);
  };

  if (!token) return null;

  return (
    <TooltipProvider>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <Toaster position="top-center" richColors />
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg">
                  <Users className="h-6 w-6" />
                </div>
                Employee Schedules
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View and manage employee shifts
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={goToToday} className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                Today
              </Button>
              <Button
                onClick={() => selectedEmployee && fetchEmployeeShifts(selectedEmployee.id)}
                variant="outline"
                size="sm"
                disabled={loadingShifts || !selectedEmployee}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loadingShifts ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Employee Selector */}
          <Card className="border-2 border-orange-200 dark:border-orange-900/50 shadow-lg">
            <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/20 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500 text-white">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Select Employee</CardTitle>
                  <CardDescription className="text-xs">
                    Choose an employee to view and manage their schedule
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loadingEmployees ? (
                <Skeleton className="h-16 w-full rounded-lg" />
              ) : (
                <EmployeeSelector
                  employees={employees}
                  selectedEmployee={selectedEmployee}
                  onSelect={handleEmployeeSelect}
                  loading={loadingShifts}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <CompanyWideSummaryStats currentMonth={currentMonth} />
        </motion.div>

        {/* Show content only when employee is selected */}
        {selectedEmployee && (
          <>
            {/* Timezone Info */}
            {hasMultipleTimezones && (
              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
                <Globe className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong>Multiple timezones detected:</strong>{' '}
                      {uniqueTimezones.map((tz, i) => (
                        <span key={tz}>
                          {getTimezoneAbbreviation(tz)}
                          {i < uniqueTimezones.length - 1 && ', '}
                        </span>
                      ))}
                      {' '}| Your timezone: <strong>{getTimezoneAbbreviation(userTimezone)}</strong>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowLocalTime(!showLocalTime)}
                      className="text-xs"
                    >
                      {showLocalTime ? 'Hide' : 'Show'} Local Times
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="h-1 w-full bg-orange-500" />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Shifts on Selected Day
                      </CardTitle>
                      <CalendarIcon className="h-4 w-4 text-orange-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {shiftsToday.length}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {format(selectedDate, 'MMM d, yyyy')}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="h-1 w-full bg-orange-500" />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Hours on Selected Day
                      </CardTitle>
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {totalHoursToday.toFixed(1)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      total hours
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
                  <div className="h-1 w-full bg-orange-500" />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        This Month Total
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {totalHoursThisMonth.toFixed(0)}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      hours scheduled
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="lg:col-span-2"
              >
                <Card className="border-2 shadow-lg">
                  <div className="h-1 w-full bg-orange-500" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-orange-500" />
                      Calendar View
                    </CardTitle>
                    <CardDescription>
                      Click on any date to view shifts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingShifts ? (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                      </div>
                    ) : (
                      <ModernCalendar
                        selectedDate={selectedDate}
                        onDateSelect={setSelectedDate}
                        currentMonth={currentMonth}
                        onMonthChange={setCurrentMonth}
                        shiftsByDate={shiftsByDate}
                        loading={loadingShifts}
                      />
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Day View */}
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card className="border-2 shadow-lg">
                  <div className="h-1 w-full bg-orange-500" />
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-5 w-5 text-orange-500 flex-shrink-0" />
                      <span className="truncate">{format(selectedDate, 'EEEE, MMM d')}</span>
                    </CardTitle>
                    <CardDescription>
                      {format(selectedDate, 'yyyy')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loadingShifts ? (
                      <div className="space-y-3">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    ) : shiftsToday.length > 0 ? (
                      <div className="space-y-3">
                        {shiftsToday.map((shift, index) => (
                          <ShiftCard 
                            key={shift.id} 
                            shift={shift} 
                            index={index}
                            showLocalTime={showLocalTime}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Clock className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                          No shifts scheduled
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(selectedDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Shift Details Table */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-2 shadow-lg">
                <div className="h-1 w-full bg-orange-500" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-orange-500" />
                    Shift Details
                  </CardTitle>
                  <CardDescription>
                    Detailed information for {format(selectedDate, 'MMM d, yyyy')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shift Name</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Timezone</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>End Time</TableHead>
                          {showLocalTime && hasMultipleTimezones && (
                            <TableHead>Local Time</TableHead>
                          )}
                          <TableHead className="text-right">Total Hours</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingShifts ? (
                          Array(3).fill(0).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell colSpan={showLocalTime && hasMultipleTimezones ? 7 : 6}>
                                <Skeleton className="h-8 w-full" />
                              </TableCell>
                            </TableRow>
                          ))
                        ) : shiftsToday.length > 0 ? (
                          <AnimatePresence>
                            {shiftsToday.map((shift, index) => {
                              const shiftTimezone = shift.shift?.timeZone || 'UTC';
                              const isDifferentTz = shiftTimezone !== userTimezone;
                              
                              const startTime = formatNaiveTime(shift.shift.startTime);
                              const endTime = formatNaiveTime(shift.shift.endTime);
                              
                              const localStartTime = isDifferentTz 
                                ? convertToUserTimezone(shift.shift.startTime, shiftTimezone, userTimezone)
                                : null;
                              const localEndTime = isDifferentTz
                                ? convertToUserTimezone(shift.shift.endTime, shiftTimezone, userTimezone)
                                : null;
                              
                              return (
                                <motion.tr
                                  key={shift.id}
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.03 }}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-900/20"
                                >
                                  <TableCell className="font-medium capitalize">
                                    {shift.shift.shiftName}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {format(toLocalDate(shift.assignedDate), 'MMM d, yyyy')}
                                  </TableCell>
                                  <TableCell>
                                    <TimezoneBadge timezone={shiftTimezone} compact />
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {startTime}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {endTime}
                                  </TableCell>
                                  {showLocalTime && hasMultipleTimezones && (
                                    <TableCell className="text-sm">
                                      {isDifferentTz && localStartTime && localEndTime ? (
                                        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                          <MapPin className="h-3 w-3" />
                                          <span className="font-mono">
                                            {localStartTime} - {localEndTime}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">—</span>
                                      )}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-right">
                                    <Badge variant="secondary">
                                      {hoursBetween(shift.shift.startTime, shift.shift.endTime)} hrs
                                    </Badge>
                                  </TableCell>
                                </motion.tr>
                              );
                            })}
                          </AnimatePresence>
                        ) : (
                          <TableRow>
                            <TableCell colSpan={showLocalTime && hasMultipleTimezones ? 7 : 6} className="py-12 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-3">
                                  <Clock className="h-6 w-6 text-gray-400" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  No shifts scheduled
                                </p>
                                <p className="text-xs text-gray-500">
                                  {format(selectedDate, 'MMM d, yyyy')}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}

        {/* Empty state when no employee selected */}
        {!selectedEmployee && !loadingEmployees && (
          <Card className="border-2 shadow-lg">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCheck className="h-8 w-8 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Select an Employee
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose an employee from the dropdown above to view their schedule
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}