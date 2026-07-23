'use client';
import React, { useState, useEffect } from 'react';
import { toast, Toaster } from 'sonner';
import Reports from './Reports';
import Employee from './Employee';
import EmployeeSheet from './EmployeeSheet';
import Company from './Company';
import CheckSettings from '@/components/Dashboard/DashboardContent/CompanyPanel/Settings/CheckSettings';
import useAuthStore from "@/store/useAuthStore";
import { calculateDeductionValue } from '@/lib/payrollCompute';
import ModalPortal from '@/components/ui/modal-portal';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const Payroll = () => {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('create-paycheck');
  const [saving, setSaving] = useState(false);
  const [unviewedCount, setUnviewedCount] = useState(0);
  const [suggestedCheckNumber, setSuggestedCheckNumber] = useState('');

  // ==================== STATE ====================  
  // Data from API
  const [employees, setEmployees] = useState([]);
  const [earningTypes, setEarningTypes] = useState([]);
  const [deductionTypes, setDeductionTypes] = useState([]);
  
  // Loading & Error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Transfer loading state
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferProgress, setTransferProgress] = useState({
    current: 0,
    total: 0,
    employeeName: '',
    status: '',
  });

  // Track if hours data has been loaded from API
  const [hoursDataLoaded, setHoursDataLoaded] = useState(false);

  // Payroll input data per employee
  const [payrollData, setPayrollData] = useState({});

  // Date range and check number
  const [dateRange, setDateRange] = useState({
    payFrom: '',
    payTo: '',
  });
  const [checkNumber, setCheckNumber] = useState('6366');

  // Hours data from timekeeping API
  const [hoursData, setHoursData] = useState({});

  // Employee Detail Modal
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Pay date
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // View mode: 'card' or 'list'
  const [viewMode, setViewMode] = useState('card');

  // Hours Breakdown Modal
  const [hoursBreakdownEmployee, setHoursBreakdownEmployee] = useState(null);
  const [isHoursBreakdownOpen, setIsHoursBreakdownOpen] = useState(false);
  const [hoursBreakdownData, setHoursBreakdownData] = useState(null);
  const [hoursBreakdownLoading, setHoursBreakdownLoading] = useState(false);

  // ==================== FETCH DATA ====================

  useEffect(() => {
    if (token) {
      fetchSuggestedCheckNumber();
    }
  }, [token]);

  useEffect(() => {
    if (token) { 
      fetchUnviewedReportsCount();
    }
  }, [token]);

  useEffect(() => {
    if (token && activeTab === 'create-paycheck') {
      fetchPayrollData();
    }
  }, [token, activeTab]);

  const fetchSuggestedCheckNumber = async () => {
    try {
      const response = await fetch(`${API_URL}/api/payroll-system/suggested-check-number`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
  
      const result = await response.json();
  
      if (response.ok && result.data) {
        const nextCheck = String(result.data.suggestedCheckNumber ?? '');
        setSuggestedCheckNumber(nextCheck);
        setCheckNumber(nextCheck);
        
        if (result.data.lastCheckStart) {
          toast.info(`Last payroll used checks ${result.data.lastCheckStart}-${parseInt(result.data.lastCheckStart) + result.data.lastEmployeeCount - 1}`);
        }
      }
    } catch (error) {
      console.error('Error fetching suggested check number:', error);
    }
  };

  const fetchUnviewedReportsCount = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/payroll-system/unviewed-reports-count`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      const result = await response.json();
      if (response.ok) {
        setUnviewedCount(result.data.count); 
      }
    } catch (error) {
      console.error('Error fetching unviewed reports count:', error);
    }
  };

  const handlePayrollSaved = () => {
    fetchUnviewedReportsCount(); 
  };


  const fetchPayrollData = async () => {
    if (!token) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/employee-payroll-details/employees-with-details`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch payroll data');
      }

      if (data.success) {
        const { employees: empData, earningTypes: etData, deductionTypes: dtData } = data.data;

        setEmployees(empData);
        setEarningTypes(etData);
        setDeductionTypes(dtData);

        // Initialize payroll data for all employees
        const initialPayrollData = {};
        const initialHoursData = {};

        empData.forEach((emp) => {
          const earnings = {};
          etData.forEach((et) => {
            if (et.calculationType === 'flat') {
              if (et.code === 'salary' && emp.payrollDetails?.payType === 'salary') {
                earnings[et.id] = emp.payrollDetails.payRate?.toString() ?? '';
              } else {
                earnings[et.id] = '';
              }
            } else {
              earnings[et.id] = '';
            }
          });

          const deductions = {};
          dtData.forEach((dt) => {
            deductions[dt.id] = '';
          });

          initialPayrollData[emp.id] = {
            earnings,
            deductions,
          };

          initialHoursData[emp.id] = {
            regularHours: 0,
            overtimeHours: 0,
            isFinalClock: false,
          };
        });

        setPayrollData(initialPayrollData);
        setHoursData(initialHoursData);
        setHoursDataLoaded(false);

        const today = new Date();
        const payTo = new Date(today);
        const payFrom = new Date(today);
        payFrom.setDate(payFrom.getDate() - 13);

        setDateRange({
          payFrom: payFrom.toLocaleDateString('en-CA'),
          payTo: payTo.toLocaleDateString('en-CA'),
        });

        toast.success('Payroll data loaded successfully');
      }
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred';
      toast.error(errorMessage);
      console.error('Error:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ==================== TRANSFER (IMPORT CLOCK HOURS) ====================

  const handleTransfer = async () => {
    if (!dateRange.payFrom || !dateRange.payTo) {
      toast.error('Please select both Pay From and Pay To dates');
      return;
    }

    const fromDate = new Date(dateRange.payFrom);
    const toDate = new Date(dateRange.payTo);

    if (fromDate > toDate) {
      toast.error('Pay From date must be before Pay To date');
      return;
    }

    try {
      setTransferLoading(true);
      setTransferProgress({
        current: 0,
        total: employees.length,
        employeeName: 'Initializing...',
        status: 'fetching',
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      setTransferProgress(prev => ({
        ...prev,
        employeeName: 'Fetching clock hours from server...',
        status: 'fetching',
      }));

      const response = await fetch(
        `${API_URL}/api/payroll-system/import-clock-hours?from=${dateRange.payFrom}&to=${dateRange.payTo}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to import clock hours');
      }

      if (data.success) {
        const { employees: clockData, summary } = data.data;

        const newHoursData = { ...hoursData };
        
        for (let i = 0; i < clockData.length; i++) {
          const empClock = clockData[i];
          
          setTransferProgress({
            current: i + 1,
            total: clockData.length,
            employeeName: empClock.employeeName,
            status: 'processing',
          });

          await new Promise(resolve => setTimeout(resolve, 100));

          newHoursData[empClock.userId] = {
            regularHours: empClock.regularHours || 0,
            overtimeHours: empClock.approvedOvertimeHours || 0,
            isFinalClock: !empClock.hasActiveClockIn,
            totalRawClockedHours: empClock.totalRawClockedHours || 0,
            totalBreakDeductions: empClock.totalBreakDeductions || 0,
            totalScheduledHours: empClock.totalScheduledHours || 0,
            daysWorked: empClock.daysWorked || 0,
            hasActiveClockIn: empClock.hasActiveClockIn || false,
            hasPendingOT: empClock.hasPendingOT || false,
            pendingOTCount: empClock.pendingOTCount || 0,
            tardyMinutes: empClock.tardyMinutes || 0,
            tardyCount: empClock.tardyCount || 0,
            undertimeMinutes: empClock.undertimeMinutes || 0,
            undertimeCount: empClock.undertimeCount || 0,
            unapprovedExtraMinutes: empClock.unapprovedExtraMinutes || 0,
            daysWithNoSchedule: empClock.daysWithNoSchedule || 0,
          };
        }

        setHoursData(newHoursData);
        setHoursDataLoaded(true);

        setTransferProgress(prev => ({
          ...prev,
          status: 'done',
          employeeName: 'Complete!',
        }));

        const successMessage = `Imported ${summary.totalEmployees} employees: ${summary.totalRegularHours} regular hrs, ${summary.totalOvertimeHours} OT hrs`;
        toast.success(successMessage);

        if (summary.employeesWithActiveClockIn > 0) {
          toast.warning(`${summary.employeesWithActiveClockIn} employee(s) still clocked in`);
        }
        if (summary.employeesWithPendingOT > 0) {
          toast.info(`${summary.employeesWithPendingOT} employee(s) have pending OT requests`);
        }
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to import clock hours';
      toast.error(errorMessage);
      console.error('Transfer error:', err);
    } finally {
      await new Promise(resolve => setTimeout(resolve, 500));
      setTransferLoading(false);
      setTransferProgress({
        current: 0,
        total: 0,
        employeeName: '',
        status: '',
      });
    }
  };

  // ==================== HELPER FUNCTIONS ====================

  const parseDecimal = (value) => {
    if (!value || value === '') return 0;
    const parsed = parseFloat(value.toString().replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const round2 = (num) => {
    return Math.round(num * 100) / 100;
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // ==================== CALCULATION FUNCTIONS ====================

  const calculateEarningValue = (employee, earningType, inputValue, hoursInput) => {
    const payRate = parseDecimal(employee.payrollDetails?.payRate);
    const employeeEarningRates = employee.earningRates || {};

    switch (earningType.calculationType) {
      case 'flat':
        return round2(parseDecimal(inputValue));

      case 'hourly':
        const hours = parseDecimal(hoursInput);
        return round2(hours * payRate);

      case 'hourly_ot':
        const otHours = parseDecimal(hoursInput);
        const otMultiplier = earningType.otMultiplier || 1.5;
        return round2(otHours * payRate * otMultiplier);

      case 'custom_rate':
        const units = parseDecimal(hoursInput);
        const customRate = parseDecimal(employeeEarningRates[earningType.id]);
        return round2(units * customRate);

      default:
        return 0;
    }
  };

  const calculateRowValues = (employee) => {
    const empPayroll = payrollData[employee.id] || { earnings: {}, deductions: {} };
    const empHours = hoursData[employee.id] || { regularHours: 0, overtimeHours: 0 };

    let grossEarnings = 0;
    const earningsBreakdown = {};

    earningTypes.forEach((et) => {
      let value = 0;
      const inputValue = empPayroll.earnings[et.id] || '';

      let hoursValue = inputValue;
      if (et.calculationType === 'hourly' && et.code === 'regular_hours') {
        hoursValue = empHours.regularHours?.toString() || inputValue;
      } else if (et.calculationType === 'hourly_ot' && et.code === 'overtime') {
        hoursValue = empHours.overtimeHours?.toString() || inputValue;
      }

      value = calculateEarningValue(employee, et, inputValue, hoursValue);
      earningsBreakdown[et.id] = value;
      grossEarnings += value;
    });

    let totalDeductions = 0;
    const deductionsBreakdown = {};

    deductionTypes.forEach((dt) => {
      const value = calculateDeductionValue(
        dt,
        empPayroll.deductions[dt.id] || '',
        grossEarnings
      );
      deductionsBreakdown[dt.id] = value;
      totalDeductions += value;
    });

    const netPay = round2(grossEarnings - totalDeductions);

    return {
      grossEarnings: round2(grossEarnings),
      totalDeductions: round2(totalDeductions),
      netPay,
      earningsBreakdown,
      deductionsBreakdown,
      isNegative: netPay < 0,
    };
  };

  const calculateTaxes = (employee, grossEarnings) => {
    const taxableGross = grossEarnings;
    
    const ficaRate = 0.062;
    const ficaWageBase = 168600;
    const fica = round2(Math.min(taxableGross, ficaWageBase) * ficaRate);
    
    const medicareRate = 0.0145;
    const medicare = round2(taxableGross * medicareRate);
    
    const sdiRate = 0.011;
    const sdi = round2(taxableGross * sdiRate);
    
    const federalTax = round2(taxableGross * 0.12);
    
    const stateTax = round2(taxableGross * 0.05);
    
    const calSaversRate = employee.payrollDetails?.withCalSavers ? 0.05 : 0;
    const calSavers = round2(taxableGross * calSaversRate);
    
    return {
      fica,
      medicare,
      sdi,
      federalTax,
      stateTax,
      calSavers,
      totalTaxes: round2(fica + medicare + sdi + federalTax + stateTax + calSavers),
    };
  };

  // ==================== EVENT HANDLERS ====================

  const handleEarningChange = (employeeId, earningTypeId, value) => {
    setPayrollData((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        earnings: {
          ...prev[employeeId]?.earnings,
          [earningTypeId]: value,
        },
      },
    }));
  };

  const handleDeductionChange = (employeeId, deductionTypeId, value) => {
    setPayrollData((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        deductions: {
          ...prev[employeeId]?.deductions,
          [deductionTypeId]: value,
        },
      },
    }));
  };

  const openEmployeeDetail = (employee) => {
    setSelectedEmployee(employee);
    setIsDetailModalOpen(true);
  };

  const closeEmployeeDetail = () => {
    setSelectedEmployee(null);
    setIsDetailModalOpen(false);
  };

  const openHoursBreakdown = async (employee) => {
    setHoursBreakdownEmployee(employee);
    setIsHoursBreakdownOpen(true);
    setHoursBreakdownLoading(true);
    setHoursBreakdownData(null);

    try {
      const response = await fetch(
        `${API_URL}/api/payroll-system/import-clock-hours/${employee.id}?from=${dateRange.payFrom}&to=${dateRange.payTo}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch hours breakdown');
      }

      if (data.success) {
        setHoursBreakdownData(data.data);
      }
    } catch (err) {
      console.error('Error fetching hours breakdown:', err);
      toast.error('Failed to load hours breakdown');
    } finally {
      setHoursBreakdownLoading(false);
    }
  };

  const closeHoursBreakdown = () => {
    setHoursBreakdownEmployee(null);
    setIsHoursBreakdownOpen(false);
    setHoursBreakdownData(null);
  };

  const handleGeneratePDF = async () => {
    if (!hoursDataLoaded) {
      toast.error('Please transfer clock hours first before generating PDF report');
      return;
    }
  
    const employeesWithPayRate = employees.filter(
      emp => emp.payrollDetails?.payRate && parseFloat(emp.payrollDetails?.payRate) > 0
    );
  
    const employeesWithoutPayRate = employees.filter(
      emp => !emp.payrollDetails?.payRate || parseFloat(emp.payrollDetails?.payRate) <= 0
    );
  
    if (employeesWithPayRate.length === 0) {
      toast.error('Cannot generate PDF: No employees have pay rates configured');
      return;
    }
  
    if (employeesWithoutPayRate.length > 0) {
      const names = employeesWithoutPayRate.map(emp => emp.name).join(', ');
      toast.warning(
        `⚠️ ${employeesWithoutPayRate.length} employee(s) excluded (no pay rate): ${names}`,
        { duration: 5000 }
      );
    }
  
    try {
      toast.info('Generating PDF report...');
  
      const pdfData = {
        payrollData,
        dateRange: {
          ...dateRange,
          payDate,
        },
        employees: employeesWithPayRate.map(emp => ({
          userId: emp.id,
          employeeName: emp.name,
          position: emp.position,
          payType: emp.payrollDetails?.payType || 'hourly',
        })),
        earningTypes: earningTypes.filter(et => et.enabled !== false),
        deductionTypes: deductionTypes.filter(dt => dt.enabled !== false),
        checkNumber,
        excludedEmployees: employeesWithoutPayRate.map(emp => emp.name),
      };
  
      const response = await fetch(
        `${API_URL}/api/payroll-system/generate-pdf-report`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pdfData),
        }
      );
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate PDF');
      }
  
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payroll-report-${dateRange.payFrom}-${dateRange.payTo}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
  
      toast.success(`PDF generated! Included ${employeesWithPayRate.length} employee(s)`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error(err.message || 'Failed to generate PDF report');
    }
  };

  const handleReset = () => {
    const resetPayrollData = {};
    const resetHoursData = {};

    employees.forEach((emp) => {
      const earnings = {};
      earningTypes.forEach((et) => {
        if (et.calculationType === 'flat' && et.code === 'salary' && emp.payrollDetails?.payType === 'salary') {
          earnings[et.id] = emp.payrollDetails.payRate?.toString() ?? '';
        } else {
          earnings[et.id] = '';
        }
      });

      const deductions = {};
      deductionTypes.forEach((dt) => {
        deductions[dt.id] = '';
      });

      resetPayrollData[emp.id] = { earnings, deductions };
      resetHoursData[emp.id] = {
        regularHours: 0,
        overtimeHours: 0,
        isFinalClock: false,
      };
    });

    setPayrollData(resetPayrollData);
    setHoursData(resetHoursData);
    setHoursDataLoaded(false);
    toast.success('Payroll data reset successfully');
  };

  const handleSavePayroll = async () => {
    // Validate employees with pay rates
    const employeesWithoutPayRate = employees.filter(
      emp => !emp.payrollDetails?.payRate || parseFloat(emp.payrollDetails?.payRate) <= 0
    );
  
    if (employeesWithoutPayRate.length > 0) {
      const names = employeesWithoutPayRate.map(emp => emp.name).join(', ');
      toast.error(`Cannot save: ${employeesWithoutPayRate.length} employee(s) missing pay rate: ${names}`);
      return;
    }
  
    if (!hoursDataLoaded) {
      toast.error('Please transfer clock hours before saving payroll');
      return;
    }
  
    try {
      setSaving(true);
      
      // Calculate all employee data
      const employeesData = employees.map((emp) => {
        const calculated = calculateRowValues(emp);
        const taxes = calculateTaxes(emp, calculated.grossEarnings);
        const netAfterTax = round2(calculated.netPay - taxes.totalTaxes);
        
        return {
          id: emp.id,
          name: emp.name,
          position: emp.position,
          payrollDetails: emp.payrollDetails,
          calculated,
          taxes,
          netPayAfterTaxes: netAfterTax,
        };
      });
  
      // Calculate totals
      const totals = {
        grossEarnings: employeesData.reduce((sum, emp) => sum + emp.calculated.grossEarnings, 0),
        totalTaxes: employeesData.reduce((sum, emp) => sum + emp.taxes.totalTaxes, 0),
        totalDeductions: employeesData.reduce((sum, emp) => sum + emp.calculated.totalDeductions, 0),
        netPay: employeesData.reduce((sum, emp) => sum + emp.netPayAfterTaxes, 0),
      };
  
      // Save to backend
      const response = await fetch(`${API_URL}/api/payroll-system/save-payroll-run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payDate,
          periodStart: dateRange.payFrom,
          periodEnd: dateRange.payTo,
          checkNumberStart: checkNumber,
          employees: employeesData,
          earningTypes: earningTypes.filter(et => et.enabled !== false),
          deductionTypes: deductionTypes.filter(dt => dt.enabled !== false),
          totals,
          hoursData,
        }),
      });
  
      const result = await response.json();
  
      if (!response.ok) {
        throw new Error(result.message || 'Failed to save payroll');
      }
  
      toast.success(`✅ Payroll saved! ${result.data.employeesProcessed} employees processed.`);
      fetchUnviewedReportsCount();
      
    } catch (error) {
      console.error('❌ Error saving payroll:', error);
      toast.error(error.message || 'Failed to save payroll');
    } finally {
      setSaving(false);
    }
  };

  const getEarningInputValue = (employee, earningType) => {
    const empPayroll = payrollData[employee.id] || { earnings: {} };
    const empHours = hoursData[employee.id] || {};

    if (hoursDataLoaded) {
      if (earningType.code === 'regular_hours' && empHours.isFinalClock) {
        return empHours.regularHours?.toString() || '0';
      }
      if (earningType.code === 'overtime' && empHours.isFinalClock) {
        return empHours.overtimeHours?.toString() || '0';
      }
    }

    const stored = empPayroll.earnings[earningType.id];
    return stored === undefined || stored === null ? '' : String(stored);
  };

  const isColumnDisabled = (employee, earningType) => {
    const payType = employee.payrollDetails?.payType;

    if (payType === 'salary') {
      if (['hourly', 'hourly_ot'].includes(earningType.calculationType)) {
        return true;
      }
    }

    if (earningType.code === 'regular_hours' || earningType.code === 'overtime') {
      const empHours = hoursData[employee.id];
      if (hoursDataLoaded && empHours?.isFinalClock) {
        return true;
      }
    }

    return false;
  };

  // ==================== LOADING & ERROR STATES ====================

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-12">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
        <div className="w-16 h-16 border-4 border-orange-600 rounded-full animate-spin border-t-transparent absolute top-0 left-0"></div>
      </div>
      <span className="ml-4 text-gray-600 font-medium">Loading payroll data...</span>
    </div>
  );

  const ErrorMessage = () => (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading payroll data</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={fetchPayrollData}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-500 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ==================== TRANSFER LOADING MODAL ====================

  const TransferLoadingModal = () => {
    if (!transferLoading) return null;

    const progressPercent = transferProgress.total > 0 
      ? Math.round((transferProgress.current / transferProgress.total) * 100) 
      : 0;

    return (
      <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        
        <div className="relative bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900">Importing Clock Hours</h3>
            <p className="text-sm text-gray-500 mt-1">
              {dateRange.payFrom} to {dateRange.payTo}
            </p>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{transferProgress.current} of {transferProgress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              {transferProgress.status === 'done' ? (
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {transferProgress.status === 'fetching' && 'Fetching data...'}
                  {transferProgress.status === 'processing' && 'Processing employee'}
                  {transferProgress.status === 'done' && 'Complete!'}
                </p>
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {transferProgress.employeeName}
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">
            Please wait while we fetch clock hours from the timekeeping system...
          </p>
        </div>
      </div>
      </ModalPortal>
    );
  };

  // ==================== HOURS BREAKDOWN MODAL ====================

  const HoursBreakdownModal = () => {
    if (!isHoursBreakdownOpen || !hoursBreakdownEmployee) return null;

    const employee = hoursBreakdownEmployee;
    const empHours = hoursData[employee.id] || {};

    return (
      <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
        <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeHoursBreakdown}
        ></div>
        
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col my-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 sm:px-6 py-4 rounded-t-xl flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{employee.name} - Hours Breakdown</h3>
                    <p className="text-sm text-blue-100">
                      {dateRange.payFrom} to {dateRange.payTo}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeHoursBreakdown}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b grid grid-cols-2 sm:grid-cols-5 gap-4 flex-shrink-0">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Regular Hours</p>
                <p className="text-lg font-bold text-green-600">{(empHours.regularHours || 0).toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Overtime</p>
                <p className="text-lg font-bold text-orange-600">{(empHours.overtimeHours || 0).toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Days Worked</p>
                <p className="text-lg font-bold text-blue-600">{empHours.daysWorked || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Tardy</p>
                <p className={`text-lg font-bold ${empHours.tardyCount > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                  {empHours.tardyCount || 0}x
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Undertime</p>
                <p className={`text-lg font-bold ${empHours.undertimeCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {empHours.undertimeCount || 0}x
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {hoursBreakdownLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 border-4 border-blue-200 rounded-full border-t-blue-600 animate-spin"></div>
                    <span className="text-gray-600">Loading daily breakdown...</span>
                  </div>
                </div>
              ) : hoursBreakdownData ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Day</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Regular</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">OT</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {hoursBreakdownData.dailyBreakdown && hoursBreakdownData.dailyBreakdown.length > 0 ? (
                          hoursBreakdownData.dailyBreakdown.map((day, index) => (
                            <tr 
                              key={day.date} 
                              className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50/50 transition-colors`}
                            >
                              <td className="px-4 py-3 font-medium text-gray-900">{day.date}</td>
                              <td className="px-4 py-3 text-gray-600">{day.dayOfWeek}</td>
                              <td className="px-4 py-3 text-center font-semibold text-green-600">
                                {day.regularHours?.toFixed(2) || '0.00'} hrs
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-orange-600">
                                {day.approvedOTHours > 0 ? `${day.approvedOTHours.toFixed(2)} hrs` : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {day.status === 'no_log' ? (
                                    <span className="text-xs text-gray-400">No Clock</span>
                                  ) : day.status === 'active' ? (
                                    <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">Active</span>
                                  ) : (
                                    <>
                                      {day.attendance?.isTardy && (
                                        <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded" title={`${day.attendance.tardyMinutes} min late`}>
                                          Tardy {day.attendance.tardyMinutes}m
                                        </span>
                                      )}
                                      {day.attendance?.isUndertime && (
                                        <span className="text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded" title={`${day.attendance.undertimeMinutes} min early`}>
                                          Under {day.attendance.undertimeMinutes}m
                                        </span>
                                      )}
                                      {!day.attendance?.isTardy && !day.attendance?.isUndertime && day.status === 'completed' && (
                                        <span className="text-xs text-green-600">✓ OK</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              No clock data found for this period
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {hoursBreakdownData.summary && (
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <h4 className="text-xs font-semibold text-green-800 uppercase mb-2">Hours Summary</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Regular:</span>
                            <span className="font-semibold text-green-700">{hoursBreakdownData.summary.regularHours?.toFixed(2)} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Approved OT:</span>
                            <span className="font-semibold text-orange-700">{hoursBreakdownData.summary.approvedOvertimeHours?.toFixed(2)} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pending OT:</span>
                            <span className="font-semibold text-yellow-700">{hoursBreakdownData.summary.pendingOvertimeHours?.toFixed(2)} hrs</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h4 className="text-xs font-semibold text-blue-800 uppercase mb-2">Raw Data</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Raw Clocked:</span>
                            <span className="font-semibold">{hoursBreakdownData.summary.totalRawClockedHours?.toFixed(2)} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Scheduled:</span>
                            <span className="font-semibold">{hoursBreakdownData.summary.totalScheduledHours?.toFixed(2)} hrs</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Break Deductions:</span>
                            <span className="font-semibold text-red-600">-{hoursBreakdownData.summary.totalBreakDeductions?.toFixed(2)} hrs</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <h4 className="text-xs font-semibold text-yellow-800 uppercase mb-2">Attendance</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Days Worked:</span>
                            <span className="font-semibold">{hoursBreakdownData.summary.daysWorked}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tardy:</span>
                            <span className={`font-semibold ${hoursBreakdownData.summary.tardyCount > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>
                              {hoursBreakdownData.summary.tardyCount}x ({hoursBreakdownData.summary.tardyMinutes} min)
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Undertime:</span>
                            <span className={`font-semibold ${hoursBreakdownData.summary.undertimeCount > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                              {hoursBreakdownData.summary.undertimeCount}x ({hoursBreakdownData.summary.undertimeMinutes} min)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No data available
                </div>
              )}
            </div>

            <div className="bg-gray-100 px-4 sm:px-6 py-3 rounded-b-xl flex justify-stretch sm:justify-end flex-shrink-0">
              <button
                onClick={closeHoursBreakdown}
                className="w-full sm:w-auto px-6 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
      </div>
      </ModalPortal>
    );
  };

  // ==================== EMPLOYEE DETAIL MODAL ====================

  const EmployeeDetailModal = () => {
    if (!isDetailModalOpen || !selectedEmployee) return null;

    const employee = selectedEmployee;
    const calculated = calculateRowValues(employee);
    const taxes = calculateTaxes(employee, calculated.grossEarnings);
    const isSalary = employee.payrollDetails?.payType === 'salary';

    const employeeIndex = employees.findIndex(e => e.id === employee.id);
    const employeeCheckNumber = parseInt(checkNumber) + employeeIndex;

    const netPayAfterTaxes = round2(calculated.netPay - taxes.totalTaxes);

    return (
        <ModalPortal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeEmployeeDetail}
          ></div>
        
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto my-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 sm:px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold truncate">{employee.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-orange-100">{employee.position || 'No position'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isSalary ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {isSalary ? 'SALARY' : 'HOURLY'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeEmployeeDetail}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors shrink-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Pay Date</label>
                <p className="text-sm font-semibold text-gray-900">{payDate}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Pay From</label>
                <p className="text-sm font-semibold text-gray-900">{dateRange.payFrom}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Pay To</label>
                <p className="text-sm font-semibold text-gray-900">{dateRange.payTo}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Check Number</label>
                <p className="text-sm font-semibold text-gray-900">#{employeeCheckNumber}</p>
              </div>
            </div>

            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {/* EARNINGS */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="text-sm font-bold text-green-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Earnings
                </h4>
                
                <div className="space-y-3">
                  {earningTypes.filter(et => et.enabled !== false).map((et) => {
                    const value = calculated.earningsBreakdown[et.id] || 0;
                    const inputValue = getEarningInputValue(employee, et);
                    const isHoursType = ['hourly', 'hourly_ot'].includes(et.calculationType);
                    
                    return (
                      <div key={et.id} className="flex justify-between items-center">
                        <div>
                          <span className="text-sm text-gray-700">{et.label}</span>
                          {isHoursType && inputValue && parseFloat(inputValue) > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({inputValue} hrs)
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-semibold ${value > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                          {formatCurrency(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 pt-4 border-t border-green-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-green-800">GROSS PAY</span>
                    <span className="text-lg font-bold text-green-700">
                      {formatCurrency(calculated.grossEarnings)}
                    </span>
                  </div>
                </div>
              </div>

              {/* TAXES */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                  </svg>
                  Taxes
                </h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-700">Federal Income Tax</span>
                      <span className="text-xs text-gray-400 ml-1">(Est.)</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">
                      {formatCurrency(taxes.federalTax)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-700">State Income Tax</span>
                      <span className="text-xs text-gray-400 ml-1">(CA)</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">
                      {formatCurrency(taxes.stateTax)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-700">FICA</span>
                      <span className="text-xs text-gray-400 ml-1">(6.2%)</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">
                      {formatCurrency(taxes.fica)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-700">Medicare</span>
                      <span className="text-xs text-gray-400 ml-1">(1.45%)</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">
                      {formatCurrency(taxes.medicare)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-700">SDI</span>
                      <span className="text-xs text-gray-400 ml-1">(1.1%)</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-700">
                      {formatCurrency(taxes.sdi)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-700">CalSavers</span>
                      {employee.payrollDetails?.withCalSavers ? (
                        <span className="text-xs text-green-500 ml-1">(Enrolled)</span>
                      ) : (
                        <span className="text-xs text-gray-400 ml-1">(Not enrolled)</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-blue-700">
                      {formatCurrency(taxes.calSavers)}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-blue-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-blue-800">TOTAL TAXES</span>
                    <span className="text-lg font-bold text-blue-700">
                      {formatCurrency(taxes.totalTaxes)}
                    </span>
                  </div>
                </div>
              </div>

              {/* DEDUCTIONS */}
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <h4 className="text-sm font-bold text-red-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Deductions
                </h4>
                
                <div className="space-y-3">
                  {deductionTypes.filter(dt => dt.enabled !== false).map((dt) => {
                    const value = calculated.deductionsBreakdown[dt.id] || 0;
                    
                    return (
                      <div key={dt.id} className="flex justify-between items-center">
                        <div>
                          <span className="text-sm text-gray-700">{dt.label}</span>
                          <span className={`text-xs ml-1 ${dt.isPreTax ? 'text-green-500' : 'text-gray-400'}`}>
                            ({dt.isPreTax ? 'Pre-Tax' : 'Post-Tax'})
                          </span>
                        </div>
                        <span className={`text-sm font-semibold ${value > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                          {formatCurrency(value)}
                        </span>
                      </div>
                    );
                  })}
                  
                  {deductionTypes.filter(dt => dt.enabled !== false).length === 0 && (
                    <p className="text-sm text-gray-500 italic">No deductions configured</p>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-red-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-red-800">TOTAL DEDUCTIONS</span>
                    <span className="text-lg font-bold text-red-700">
                      {formatCurrency(calculated.totalDeductions)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer: Net Pay Summary */}
            <div className="bg-gray-900 text-white px-4 sm:px-6 py-4 rounded-b-xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="text-center">
                  <p className="text-xs text-gray-400 uppercase">Gross Earnings</p>
                  <p className="text-lg font-bold text-green-400">{formatCurrency(calculated.grossEarnings)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 uppercase">Total Taxes + Deductions</p>
                  <p className="text-lg font-bold text-red-400">
                    - {formatCurrency(taxes.totalTaxes + calculated.totalDeductions)}
                  </p>
                </div>
                <div className="text-center bg-white/10 rounded-lg py-2">
                  <p className="text-xs text-gray-300 uppercase">Net Pay</p>
                  <p className={`text-2xl font-bold ${netPayAfterTaxes < 0 ? 'text-red-400' : 'text-white'}`}>
                    {formatCurrency(netPayAfterTaxes)}
                    {netPayAfterTaxes < 0 && <span className="ml-1">⚠️</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
    );
  };

  // ==================== HOURS TOOLTIP COMPONENT ====================

  const HoursTooltip = ({ empHours, children }) => {
    const [showTooltip, setShowTooltip] = useState(false);

    if (!empHours || !hoursDataLoaded) return children;

    return (
      <div 
        className="relative inline-block"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
        
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
            <div className="bg-gray-900 text-white text-xs rounded-lg py-3 px-4 shadow-xl min-w-[220px]">
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
              
              {/* Header */}
              <div className="font-semibold text-orange-400 mb-2 pb-2 border-b border-gray-700">
                Hours Breakdown
              </div>
              
              {/* Stats Grid */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">📅 Days Worked:</span>
                  <span className="font-medium">{empHours.daysWorked || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">⏰ Scheduled:</span>
                  <span className="font-medium">{(empHours.totalScheduledHours || 0).toFixed(2)} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">🕐 Raw Clocked:</span>
                  <span className="font-medium">{(empHours.totalRawClockedHours || 0).toFixed(2)} hrs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">☕ Break Deductions:</span>
                  <span className="font-medium">{(empHours.totalBreakDeductions || 0).toFixed(2)} hrs</span>
                </div>
              </div>
              
              {/* Attendance Issues */}
              {(empHours.tardyCount > 0 || empHours.undertimeCount > 0 || empHours.daysWithNoSchedule > 0) && (
                <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                  {empHours.tardyCount > 0 && (
                    <div className="flex justify-between text-yellow-400">
                      <span>⚠️ Tardy:</span>
                      <span>{empHours.tardyCount}x ({empHours.tardyMinutes} min)</span>
                    </div>
                  )}
                  {empHours.undertimeCount > 0 && (
                    <div className="flex justify-between text-orange-400">
                      <span>⚠️ Undertime:</span>
                      <span>{empHours.undertimeCount}x ({empHours.undertimeMinutes} min)</span>
                    </div>
                  )}
                  {empHours.daysWithNoSchedule > 0 && (
                    <div className="flex justify-between text-blue-400">
                      <span>📋 No Schedule:</span>
                      <span>{empHours.daysWithNoSchedule} day(s)</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Click hint */}
              <div className="mt-2 pt-2 border-t border-gray-700 text-center text-gray-500 text-[10px]">
                Click ℹ️ for daily breakdown
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== ORIGINAL LIST/TABLE VIEW ====================

  const renderListView = () => {
    const enabledEarningTypes = earningTypes.filter((et) => et.enabled !== false);
    const enabledDeductionTypes = deductionTypes.filter((dt) => dt.enabled !== false);

    return (
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {/* Employee Name - Sticky */}
                  <th className="sticky left-0 z-20 bg-gray-100 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 min-w-[180px]">
                    Employee Name
                  </th>

                  {/* Dynamic Earning Columns */}
                  {enabledEarningTypes.map((et) => (
                    <th
                      key={`earning-${et.id}`}
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[100px]"
                    >
                      <div className="flex flex-col">
                        <span>{et.label}</span>
                        <span className="text-[10px] font-normal text-gray-400 capitalize">
                          ({et.calculationType.replace('_', ' ')})
                        </span>
                      </div>
                    </th>
                  ))}

                  {/* Dynamic Deduction Columns */}
                  {enabledDeductionTypes.map((dt) => (
                    <th
                      key={`deduction-${dt.id}`}
                      className="px-3 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wider bg-red-50 min-w-[100px]"
                    >
                      <div className="flex flex-col">
                        <span>{dt.label}</span>
                        <span className="text-[10px] font-normal text-red-400">
                          ({dt.calculationType === 'percent' ? '% of gross' : 'Fixed $'}
                          {dt.isPreTax ? ' · Pre-Tax' : ''})
                        </span>
                      </div>
                    </th>
                  ))}

                  {/* Calculated Columns */}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider bg-green-50 min-w-[110px]">
                    Gross Pay
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider bg-blue-50 min-w-[110px]">
                    Taxes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wider bg-red-50 min-w-[110px]">
                    Deductions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-100 min-w-[110px]">
                    Net Pay
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee, index) => {
                  const calculated = calculateRowValues(employee);
                  const taxes = calculateTaxes(employee, calculated.grossEarnings);
                  const netAfterTax = round2(calculated.netPay - taxes.totalTaxes);
                  const isSalary = employee.payrollDetails?.payType === 'salary';
                  const empHours = hoursData[employee.id] || {};
                  const hasNoPayRate = !employee.payrollDetails?.payRate || parseFloat(employee.payrollDetails?.payRate) <= 0;

                  return (
                    <tr
                      key={employee.id}
                      className={`
                        ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} 
                        hover:bg-orange-50/30 transition-colors
                        ${hasNoPayRate ? 'bg-red-50/50 border-l-4 border-l-red-400' : ''}
                      `}
                    >
                      {/* Employee Name - Sticky */}
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-3 whitespace-nowrap border-r border-gray-200">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {employee.name}
                            </span>
                            {/* Info icon */}
                            {hoursDataLoaded && (
                              <button
                                onClick={() => openEmployeeDetail(employee)}
                                className="group relative p-1 hover:bg-orange-100 rounded-full transition-colors"
                                title="View payroll details"
                              >
                                <svg 
                                  className="w-4 h-4 text-orange-500 hover:text-orange-600" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    strokeWidth={2} 
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                  />
                                </svg>
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                  View Details
                                </span>
                              </button>
                            )}
                            {hasNoPayRate && (
                              <div className="group relative">
                                <svg 
                                  className="w-4 h-4 text-red-500" 
                                  fill="currentColor" 
                                  viewBox="0 0 20 20"
                                >
                                  <path 
                                    fillRule="evenodd" 
                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                                    clipRule="evenodd" 
                                  />
                                </svg>
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30">
                                  No pay rate configured
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">{employee.position || 'No position'}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                isSalary
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {isSalary ? 'SALARY' : 'HOURLY'}
                            </span>
                            {hasNoPayRate && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 text-red-700">
                                NO RATE
                              </span>
                            )}
                            {empHours.hasActiveClockIn && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-yellow-100 text-yellow-700">
                                ACTIVE
                              </span>
                            )}
                            {empHours.hasPendingOT && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-100 text-orange-700">
                                OT PENDING
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Dynamic Earning Inputs */}
                      {enabledEarningTypes.map((et) => {
                        const isDisabled = isColumnDisabled(employee, et);
                        const inputValue = getEarningInputValue(employee, et);
                        const calculatedValue = calculated.earningsBreakdown[et.id] || 0;
                        const isHoursField = ['hourly', 'hourly_ot', 'custom_rate'].includes(et.calculationType);
                        
                        const isTransferredHours = hoursDataLoaded && 
                          ((et.code === 'regular_hours' && empHours.isFinalClock) ||
                           (et.code === 'overtime' && empHours.isFinalClock));

                        return (
                          <td key={`earning-${et.id}`} className="px-3 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              {isTransferredHours ? (
                                <div className="flex items-center gap-2">
                                  <HoursTooltip empHours={empHours}>
                                    <div className="flex flex-col items-end cursor-default">
                                      <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                        <span className="text-sm font-semibold text-gray-700">
                                          {parseFloat(inputValue || 0).toFixed(2)}
                                        </span>
                                        <span className="text-xs text-gray-500">hrs</span>
                                      </div>
                                      {calculatedValue > 0 && (
                                        <span className="text-[10px] text-green-600 mt-1">
                                          = {formatCurrency(calculatedValue)}
                                        </span>
                                      )}
                                    </div>
                                  </HoursTooltip>
                                  {/* Info icon for hours breakdown */}
                                  {et.code === 'regular_hours' && (
                                    <button
                                      onClick={() => openHoursBreakdown(employee)}
                                      className="group relative p-1 hover:bg-blue-100 rounded-full transition-colors flex-shrink-0"
                                      title="View hours breakdown"
                                    >
                                      <svg 
                                        className="w-4 h-4 text-blue-500 hover:text-blue-600" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path 
                                          strokeLinecap="round" 
                                          strokeLinejoin="round" 
                                          strokeWidth={2} 
                                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                                        />
                                      </svg>
                                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                        Daily Breakdown
                                      </span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={inputValue}
                                      onChange={(e) => handleEarningChange(employee.id, et.id, e.target.value)}
                                      disabled={isDisabled}
                                      placeholder="0.00"
                                      className={`w-20 px-2 py-1 text-sm border rounded text-right focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                                        isDisabled
                                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
                                          : 'border-gray-300'
                                      }`}
                                    />
                                    {isHoursField && inputValue && (
                                      <span className="text-xs text-gray-400">hrs</span>
                                    )}
                                  </div>
                                  {et.calculationType !== 'flat' && calculatedValue > 0 && (
                                    <span className="text-[10px] text-green-600 text-right">
                                      = {formatCurrency(calculatedValue)}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Dynamic Deduction Inputs */}
                      {enabledDeductionTypes.map((dt) => (
                        <td key={`deduction-${dt.id}`} className="px-3 py-3 whitespace-nowrap bg-red-50/30">
                          <input
                            type="text"
                            value={payrollData[employee.id]?.deductions[dt.id] || ''}
                            onChange={(e) => handleDeductionChange(employee.id, dt.id, e.target.value)}
                            placeholder={dt.calculationType === 'percent' ? '0%' : '0.00'}
                            title={dt.calculationType === 'percent' ? 'Enter percentage of gross pay' : 'Enter dollar amount'}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded text-right focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </td>
                      ))}

                      {/* Gross Pay */}
                      <td className="px-4 py-3 whitespace-nowrap bg-green-50">
                        <div className="text-sm font-semibold text-green-700 text-right">
                          {formatCurrency(calculated.grossEarnings)}
                        </div>
                      </td>

                      {/* Taxes */}
                      <td className="px-4 py-3 whitespace-nowrap bg-blue-50">
                        <div className="text-sm font-semibold text-blue-700 text-right">
                          {formatCurrency(taxes.totalTaxes)}
                        </div>
                      </td>

                      {/* Total Deductions */}
                      <td className="px-4 py-3 whitespace-nowrap bg-red-50">
                        <div className="text-sm font-semibold text-red-700 text-right">
                          {formatCurrency(calculated.totalDeductions)}
                        </div>
                      </td>

                      {/* Net Pay */}
                      <td className="px-4 py-3 whitespace-nowrap bg-gray-100">
                        <div
                          className={`text-sm font-bold text-right ${
                            netAfterTax < 0 ? 'text-red-600' : 'text-gray-700'
                          }`}
                        >
                          {formatCurrency(netAfterTax)}
                          {netAfterTax < 0 && <span className="ml-1">⚠️</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Totals Row */}
                {hoursDataLoaded && (
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                    <td className="sticky left-0 z-10 bg-gray-100 px-4 py-3 whitespace-nowrap border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-bold text-gray-700">TOTALS</span>
                        <span className="text-xs text-gray-500">({employees.length} employees)</span>
                      </div>
                    </td>

                    {/* Earning Totals */}
                    {enabledEarningTypes.map((et) => {
                      let totalValue = 0;
                      let totalHours = 0;
                      
                      employees.forEach((emp) => {
                        const empCalc = calculateRowValues(emp);
                        const empHours = hoursData[emp.id] || {};
                        totalValue += empCalc.earningsBreakdown[et.id] || 0;
                        
                        if (et.code === 'regular_hours') {
                          totalHours += empHours.regularHours || 0;
                        } else if (et.code === 'overtime') {
                          totalHours += empHours.overtimeHours || 0;
                        }
                      });

                      const isHoursType = ['hourly', 'hourly_ot'].includes(et.calculationType) && 
                        (et.code === 'regular_hours' || et.code === 'overtime');

                      return (
                        <td key={`total-earning-${et.id}`} className="px-3 py-3 whitespace-nowrap bg-gray-100">
                          <div className="flex flex-col items-end">
                            {isHoursType && totalHours > 0 ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-bold text-gray-700">
                                    {totalHours.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-gray-500">hrs</span>
                                </div>
                                <span className="text-[10px] text-green-600 font-semibold">
                                  = {formatCurrency(totalValue)}
                                </span>
                              </>
                            ) : totalValue > 0 ? (
                              <span className="text-sm font-bold text-gray-700">
                                {formatCurrency(totalValue)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Deduction Totals */}
                    {enabledDeductionTypes.map((dt) => {
                      let totalDeduction = 0;
                      employees.forEach((emp) => {
                        const empCalc = calculateRowValues(emp);
                        totalDeduction += empCalc.deductionsBreakdown[dt.id] || 0;
                      });

                      return (
                        <td key={`total-deduction-${dt.id}`} className="px-3 py-3 whitespace-nowrap bg-red-100/50">
                          <div className="text-sm font-bold text-red-700 text-right">
                            {totalDeduction > 0 ? formatCurrency(totalDeduction) : '—'}
                          </div>
                        </td>
                      );
                    })}

                    {/* Grand Totals */}
                    {(() => {
                      let grandGross = 0;
                      let grandTaxes = 0;
                      let grandDeductions = 0;
                      let grandNet = 0;

                      employees.forEach((emp) => {
                        const empCalc = calculateRowValues(emp);
                        const empTaxes = calculateTaxes(emp, empCalc.grossEarnings);
                        grandGross += empCalc.grossEarnings;
                        grandTaxes += empTaxes.totalTaxes;
                        grandDeductions += empCalc.totalDeductions;
                        grandNet += round2(empCalc.netPay - empTaxes.totalTaxes);
                      });

                      return (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap bg-green-100">
                            <div className="text-sm font-bold text-green-700 text-right">
                              {formatCurrency(grandGross)}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap bg-blue-100">
                            <div className="text-sm font-bold text-blue-700 text-right">
                              {formatCurrency(grandTaxes)}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap bg-red-100">
                            <div className="text-sm font-bold text-red-700 text-right">
                              {formatCurrency(grandDeductions)}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap bg-gray-200">
                            <div className="text-sm font-bold text-gray-700 text-right">
                              {formatCurrency(grandNet)}
                            </div>
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ==================== MODERN CARD-BASED PAYROLL VIEW ====================

  const renderModernPayrollCards = () => {
    const enabledEarningTypes = earningTypes.filter((et) => et.enabled !== false);
    const enabledDeductionTypes = deductionTypes.filter((dt) => dt.enabled !== false);

    // Calculate grand totals
    let grandTotalGross = 0;
    let grandTotalTaxes = 0;
    let grandTotalDeductions = 0;
    let grandTotalNet = 0;

    employees.forEach((emp) => {
      const calc = calculateRowValues(emp);
      const taxes = calculateTaxes(emp, calc.grossEarnings);
      grandTotalGross += calc.grossEarnings;
      grandTotalTaxes += taxes.totalTaxes;
      grandTotalDeductions += calc.totalDeductions;
      grandTotalNet += round2(calc.netPay - taxes.totalTaxes);
    });

    return (
      <div className="space-y-4">
        {employees.map((employee, index) => {
          const calculated = calculateRowValues(employee);
          const taxes = calculateTaxes(employee, calculated.grossEarnings);
          const isSalary = employee.payrollDetails?.payType === 'salary';
          const empHours = hoursData[employee.id] || {};
          const hasNoPayRate = !employee.payrollDetails?.payRate || parseFloat(employee.payrollDetails?.payRate) <= 0;
          const netAfterTax = round2(calculated.netPay - taxes.totalTaxes);
          const employeeCheckNumber = parseInt(checkNumber) + index;

          return (
            <div 
              key={employee.id} 
              className={`bg-white rounded-xl shadow-sm border transition-all hover:shadow-md ${
                hasNoPayRate ? 'border-red-300 bg-red-50/20' : 'border-gray-200'
              }`}
            >
              {/* Employee Header */}
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">{employee.name}</h3>
                        {/* Info icon - opens employee detail modal */}
                        <button
                          onClick={() => openEmployeeDetail(employee)}
                          className="p-1.5 hover:bg-orange-100 rounded-full transition-colors"
                          title="View Details"
                        >
                          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 min-w-0">
                        <span className="text-sm text-gray-600 min-w-0 truncate">{employee.position || 'No position'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                          isSalary ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {isSalary ? 'SALARY' : 'HOURLY'}
                        </span>
                        {hasNoPayRate && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 flex items-center gap-1 shrink-0">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            NO RATE
                          </span>
                        )}
                        {empHours.hasActiveClockIn && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700 shrink-0">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs text-gray-500 uppercase">Check #</p>
                    <p className="text-sm font-bold text-gray-900">#{employeeCheckNumber}</p>
                  </div>
                </div>
              </div>

              {/* Three Column Layout */}
              <div className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* EARNINGS */}
                <div className="bg-green-50 rounded-lg p-3 sm:p-4 border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-xs font-bold text-green-800 uppercase">Earnings</h4>
                  </div>
                  
                  <div className="space-y-2">
                    {enabledEarningTypes.map((et) => {
                      const value = calculated.earningsBreakdown[et.id] || 0;
                      const inputValue = getEarningInputValue(employee, et);
                      const isDisabled = isColumnDisabled(employee, et);
                      const isHoursType = ['hourly', 'hourly_ot'].includes(et.calculationType);
                      const isTransferredHours = hoursDataLoaded && 
                        ((et.code === 'regular_hours' && empHours.isFinalClock) ||
                         (et.code === 'overtime' && empHours.isFinalClock));

                      if (value === 0 && !inputValue) return null;

                      return (
                        <div key={et.id} className="text-xs">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-gray-600 font-medium">{et.label}</span>
                            <span className="text-green-700 font-bold">{formatCurrency(value)}</span>
                          </div>
                          {isTransferredHours ? (
                            <div className="flex items-center gap-1 text-gray-500">
                              <span>{parseFloat(inputValue || 0).toFixed(2)} hrs</span>
                              {/* Info icon for hours breakdown - opens daily breakdown modal */}
                              {et.code === 'regular_hours' && (
                                <button
                                  onClick={() => openHoursBreakdown(employee)}
                                  className="text-blue-500 hover:text-blue-700"
                                  title="View daily breakdown"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ) : isHoursType && (
                            <input
                              type="text"
                              value={inputValue}
                              onChange={(e) => handleEarningChange(employee.id, et.id, e.target.value)}
                              disabled={isDisabled}
                              placeholder="0.00"
                              className="w-full px-2 py-1 text-xs border rounded"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-green-300">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-green-800">GROSS</span>
                      <span className="text-sm font-bold text-green-700">
                        {formatCurrency(calculated.grossEarnings)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TAXES */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                    </svg>
                    <h4 className="text-xs font-bold text-blue-800 uppercase">Taxes</h4>
                  </div>
                  
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Federal</span>
                      <span className="text-blue-700 font-semibold">{formatCurrency(taxes.federalTax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">State (CA)</span>
                      <span className="text-blue-700 font-semibold">{formatCurrency(taxes.stateTax)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">FICA</span>
                      <span className="text-blue-700 font-semibold">{formatCurrency(taxes.fica)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Medicare</span>
                      <span className="text-blue-700 font-semibold">{formatCurrency(taxes.medicare)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">SDI</span>
                      <span className="text-blue-700 font-semibold">{formatCurrency(taxes.sdi)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-blue-300">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-800">TOTAL</span>
                      <span className="text-sm font-bold text-blue-700">
                        {formatCurrency(taxes.totalTaxes)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* DEDUCTIONS */}
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-xs font-bold text-red-800 uppercase">Deductions</h4>
                  </div>
                  
                  <div className="space-y-2">
                    {enabledDeductionTypes.map((dt) => {
                      const value = calculated.deductionsBreakdown[dt.id] || 0;
                      const inputValue = payrollData[employee.id]?.deductions[dt.id] || '';

                      return (
                        <div key={dt.id} className="text-xs">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-gray-600 font-medium">
                              {dt.label}
                              <span className="text-gray-400 font-normal ml-1">
                                ({dt.calculationType === 'percent' ? '%' : '$'})
                              </span>
                            </span>
                            <span className="text-red-700 font-bold">{formatCurrency(value)}</span>
                          </div>
                          <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => handleDeductionChange(employee.id, dt.id, e.target.value)}
                            placeholder={dt.calculationType === 'percent' ? '0%' : '0.00'}
                            className="w-full px-2 py-1 text-xs border rounded"
                          />
                        </div>
                      );
                    })}
                    
                    {enabledDeductionTypes.length === 0 && (
                      <p className="text-xs text-gray-500 italic">No deductions</p>
                    )}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-red-300">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-red-800">TOTAL</span>
                      <span className="text-sm font-bold text-red-700">
                        {formatCurrency(calculated.totalDeductions)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer: Net Pay */}
              <div className="px-3 sm:px-6 py-3 bg-gray-900 rounded-b-xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white">
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                    <div>
                      <p className="text-xs text-gray-400">Gross</p>
                      <p className="text-sm font-bold text-green-400">{formatCurrency(calculated.grossEarnings)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Taxes + Deductions</p>
                      <p className="text-sm font-bold text-red-400">
                        - {formatCurrency(taxes.totalTaxes + calculated.totalDeductions)}
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-gray-400 uppercase">Net Pay</p>
                    <p className={`text-2xl font-bold ${netAfterTax < 0 ? 'text-red-400' : 'text-white'}`}>
                      {formatCurrency(netAfterTax)}
                      {netAfterTax < 0 && <span className="ml-1">⚠️</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Grand Totals Summary */}
        {hoursDataLoaded && (
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl shadow-lg p-4 sm:p-6 text-white mt-6">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-bold">Payroll Totals</h3>
              <span className="text-sm text-gray-400">({employees.length} employees)</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase mb-1">Gross Earnings</p>
                <p className="text-2xl font-bold text-green-400">{formatCurrency(grandTotalGross)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase mb-1">Total Taxes</p>
                <p className="text-2xl font-bold text-blue-400">{formatCurrency(grandTotalTaxes)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 uppercase mb-1">Total Deductions</p>
                <p className="text-2xl font-bold text-red-400">{formatCurrency(grandTotalDeductions)}</p>
              </div>
              <div className="text-center bg-white/10 rounded-lg py-2">
                <p className="text-xs text-gray-300 uppercase mb-1">Net Pay</p>
                <p className="text-2xl font-bold">{formatCurrency(grandTotalNet)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== RENDER CREATE PAYCHECK TAB ====================

  const renderCreatePaycheckTab = () => {
    if (loading) {
      return <LoadingSpinner />;
    }

    if (error) {
      return <ErrorMessage />;
    }

    if (employees.length === 0) {
      return (
        <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-yellow-800 font-medium">No employees found</p>
            <p className="text-sm text-yellow-600 mt-1">Please add employees to your company first.</p>
          </div>
        </div>
      );
    }

    if (earningTypes.length === 0) {
      return (
        <div className="p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-yellow-800 font-medium">No earning types configured</p>
            <p className="text-sm text-yellow-600 mt-1">Please configure earning types in the Company tab first.</p>
          </div>
        </div>
      );
    }

    return (
      <>
        <Toaster position="top-center" richColors />
        <TransferLoadingModal />
        <EmployeeDetailModal />
        <HoursBreakdownModal />

        {/* Data Status Notice */}
        <div className="px-4 sm:px-6 pt-4">
          <div className={`border rounded-lg p-3 flex items-start gap-2 ${
            hoursDataLoaded 
              ? 'bg-green-50 border-green-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <svg className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
              hoursDataLoaded ? 'text-green-500' : 'text-blue-500'
            }`} fill="currentColor" viewBox="0 0 20 20">
              {hoursDataLoaded ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              )}
            </svg>
            <div>
              <p className={`text-sm ${hoursDataLoaded ? 'text-green-800' : 'text-blue-800'}`}>
                {hoursDataLoaded ? (
                  <>
                    <span className="font-medium">✓ Clock hours imported successfully!</span>
                    {' '}Hours data has been loaded from the timekeeping system.
                  </>
                ) : (
                  <>
                    <span className="font-medium">Note:</span> Click the <strong>Transfer</strong> button to import clock hours 
                    from the timekeeping system for the selected pay period.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Warning Alert for Employees Without Pay Rates */}
        {(() => {
          const employeesWithoutPayRate = employees.filter(
            emp => !emp.payrollDetails?.payRate || parseFloat(emp.payrollDetails?.payRate) <= 0
          );
          
          if (employeesWithoutPayRate.length === 0) return null;
          
          return (
            <div className="px-4 sm:px-6 pt-2">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <svg className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-red-800">
                    <span className="font-medium">⚠️ {employeesWithoutPayRate.length} employee(s) missing pay rate:</span>
                    {' '}
                    <span className="text-red-600">
                      {employeesWithoutPayRate.map(emp => emp.name).join(', ')}
                    </span>
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Please configure their pay rate in the Employee tab before processing payroll.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Controls Section */}
        <div className="p-3 sm:p-6 bg-gradient-to-br from-gray-50 to-white border-b min-w-0">
          <div className="max-w-7xl mx-auto min-w-0">
            {/* Top Row: Period Controls */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4 mb-4">
              {/* Date Inputs - Compact 3-column */}
              <div className="sm:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Pay Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Period Start
                  </label>
                  <input
                    type="date"
                    value={dateRange.payFrom}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, payFrom: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Period End
                  </label>
                  <input
                    type="date"
                    value={dateRange.payTo}
                    onChange={(e) => setDateRange((prev) => ({ ...prev, payTo: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Check Number Input */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Check # Start
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={checkNumber}
                    onChange={(e) => setCheckNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                    placeholder="6389"
                  />
                  {suggestedCheckNumber && suggestedCheckNumber !== checkNumber && (
                    <div className="absolute -bottom-5 left-0 text-xs text-green-600">
                      💡 Suggested: {suggestedCheckNumber}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Row: Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: Status & Info */}
              <div className="flex items-center gap-3 min-w-0">
                {hoursDataLoaded ? (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-700 font-medium">Hours Loaded</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Click Transfer to import hours</span>
                  </div>
                )}
              </div>

              {/* Right: Action Buttons */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto min-w-0">
                {/* Auto-Detect */}
                <button
                  onClick={() => {
                    const today = new Date();
                    const day = today.getDate();
                    
                    let payFrom, payTo, payDateCalc;
                    
                    if (day >= 1 && day <= 5) {
                      payFrom = new Date(today.getFullYear(), today.getMonth() - 1, 16);
                      payTo = new Date(today.getFullYear(), today.getMonth(), 0);
                      payDateCalc = new Date(today.getFullYear(), today.getMonth(), 5);
                    } else if (day >= 6 && day <= 20) {
                      payFrom = new Date(today.getFullYear(), today.getMonth(), 1);
                      payTo = new Date(today.getFullYear(), today.getMonth(), 15);
                      payDateCalc = new Date(today.getFullYear(), today.getMonth(), 20);
                    } else {
                      payFrom = new Date(today.getFullYear(), today.getMonth(), 16);
                      payTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                      payDateCalc = new Date(today.getFullYear(), today.getMonth() + 1, 5);
                    }
                    
                    setDateRange({
                      payFrom: payFrom.toLocaleDateString('en-CA'),
                      payTo: payTo.toLocaleDateString('en-CA'),
                    });
                    setPayDate(payDateCalc.toISOString().split('T')[0]);
                    
                    toast.success(`Period set: ${payFrom.toLocaleDateString()} - ${payTo.toLocaleDateString()}`);
                  }}
                  className="min-w-0 justify-center px-2 sm:px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5 sm:gap-2"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Auto-Detect
                </button>

                {/* Transfer */}
                <button
                  onClick={handleTransfer}
                  disabled={transferLoading || !dateRange.payFrom || !dateRange.payTo}
                  className={`min-w-0 justify-center px-2 sm:px-5 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 sm:gap-2 ${
                    transferLoading || !dateRange.payFrom || !dateRange.payTo
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-orange-600 text-white hover:bg-orange-700 shadow-sm hover:shadow-md'
                  }`}
                >
                  {transferLoading ? (
                    <>
                      <div className="w-4 h-4 shrink-0 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Transfer
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="hidden sm:block w-px h-8 bg-gray-300"></div>

                {/* View Toggle */}
                <div className="col-span-2 sm:col-span-1 flex items-center justify-center sm:justify-start bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === 'card'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === 'list'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payroll View - Card or List */}
        <div className="p-3 sm:p-6 min-w-0">
          {viewMode === 'card' ? renderModernPayrollCards() : renderListView()}
        </div>

        {/* Action Buttons */}
        <div className="p-3 sm:p-6 bg-gray-50 border-t min-w-0">
          <div className="flex flex-col sm:flex-row sm:justify-end w-full gap-3 sm:gap-4">
            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-8 py-3 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 transition-colors duration-200"
            >
              RESET
            </button>
            <button
              onClick={handleSavePayroll}
              disabled={saving || !hoursDataLoaded}
              className={`w-full sm:w-auto px-8 py-3 font-medium rounded-md transition-colors duration-200 ${
                saving || !hoursDataLoaded
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              {saving ? 'SAVING...' : 'SAVE PAYROLL'}
            </button>
          </div>
        </div>
      </>
    );
  };

  // ==================== TAB NAVIGATION ====================

  const tabs = [
    { id: 'create-paycheck', label: 'Create Paycheck' },
    { id: 'employee-sheet', label: 'Employee Sheet', beta: true },
    { id: 'reports', label: 'Reports', beta: true, badge: unviewedCount },
    { id: 'employee', label: 'Employee' },
    { id: 'company', label: 'Company' },
    { id: 'check-printing', label: 'Check Printing' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'create-paycheck':
        return renderCreatePaycheckTab();
      case 'employee-sheet':
        return <EmployeeSheet />;
      case 'reports':
        return <Reports />;
      case 'employee':
        return <Employee />;
      case 'company':
        return <Company />;
      case 'check-printing':
        return <CheckSettings />;
      default:
        return renderCreatePaycheckTab();
    }
  };

  return (
    <div className="p-0 sm:p-4 lg:p-6 min-w-0">
      <div className="bg-white rounded-lg shadow-md min-w-0">
        {/* Header with Tabs */}
        <div className="border-b min-w-0">
          <div className="px-3 sm:px-6 pt-4 sm:pt-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Payroll Management</h1>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white border-b overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <nav className="flex gap-0 px-2 sm:px-6 w-max min-w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'reports') {
                    setUnviewedCount(0);
                  }
                }}
                className={`
                  relative px-3 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0
                  ${activeTab === tab.id
                    ? 'text-orange-600 border-orange-600'
                    : 'text-gray-600 border-transparent hover:text-gray-800'
                  }
                `}
              >
                <span className="inline-flex items-center gap-1.5">
                  {tab.label}
                  {tab.beta && (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        activeTab === tab.id
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-violet-100 text-violet-700'
                      }`}
                    >
                      Beta
                    </span>
                  )}
                </span>

                {/* Notification Badge */}
                {tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Payroll;