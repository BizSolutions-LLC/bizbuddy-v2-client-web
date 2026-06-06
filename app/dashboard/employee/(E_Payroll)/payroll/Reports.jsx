'use client';
import React, { useState } from 'react';
import { toast, Toaster } from 'sonner';
import useAuthStore from "@/store/useAuthStore";
import MockPayrollBanner from "@/components/common/MockPayrollBanner";
import { isMockPayrollId, withMockPayrollReports } from "@/lib/mockPayrollData";
import * as XLSX from 'xlsx';

const Reports = () => {
  const { token } = useAuthStore();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const [activeReportTab, setActiveReportTab] = useState('payroll-detail');
  const [filters, setFilters] = useState({
    from: '01-01',
    to: '12-31',
    year: '2025',
    sortBy: 'Pay Date',
  });
  const [payrollReports, setPayrollReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);


  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const exportToExcel = () => {
    if (payrollReports.length === 0) {
      toast.error("No data available to export");
      return;
    }
  
    try {
      const workbook = XLSX.utils.book_new();
  
      const summaryData = payrollReports.map(report => ({
        'Pay Date': new Date(report.payDate).toLocaleDateString(),
        'Period Start': new Date(report.periodStart).toLocaleDateString(),
        'Period End': new Date(report.periodEnd).toLocaleDateString(),
        'Employees': report.employeeCount,
        'Gross Pay': report.totalGross,
        'Taxes': report.totalTaxes,
        'Deductions': report.totalDeductions,
        'Net Pay': report.totalNet,
      }));
  
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      
      summarySheet['!cols'] = [
        { wch: 12 },  // Pay Date
        { wch: 12 },  // Period Start
        { wch: 12 },  // Period End
        { wch: 10 },  // Employees
        { wch: 12 },  // Gross Pay
        { wch: 12 },  // Taxes
        { wch: 12 },  // Deductions
        { wch: 12 },  // Net Pay
      ];
  
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Payroll Summary");
  
      const employeeData = [];
  
      payrollReports.forEach(report => {
        report.employees.forEach(emp => {
          employeeData.push({
            'Pay Date': new Date(report.payDate).toLocaleDateString(),
            'Period': `${new Date(report.periodStart).toLocaleDateString()} - ${new Date(report.periodEnd).toLocaleDateString()}`,
            'Employee Name': emp.employeeName,
            'Position': emp.position || 'N/A',
            'Pay Type': emp.payType?.toUpperCase() || 'N/A',
            'Check Number': emp.checkNumber,
            'Gross Pay': emp.grossPay || 0,
            'Federal Tax': emp.taxes?.federalTax || 0,
            'State Tax': emp.taxes?.stateTax || 0,
            'FICA': emp.taxes?.fica || 0,
            'Medicare': emp.taxes?.medicare || 0,
            'SDI': emp.taxes?.sdi || 0,
            'CalSavers': emp.taxes?.calSavers || 0,
            'Total Taxes': emp.totalTaxes || 0,
            'Deductions': emp.totalDeductions || 0,
            'Net Pay': emp.netPay || 0,
          });
        });
      });
  
      const detailSheet = XLSX.utils.json_to_sheet(employeeData);
  
      detailSheet['!cols'] = [
        { wch: 12 },  // Pay Date
        { wch: 25 },  // Period
        { wch: 20 },  // Employee Name
        { wch: 18 },  // Position
        { wch: 10 },  // Pay Type
        { wch: 12 },  // Check Number
        { wch: 12 },  // Gross Pay
        { wch: 12 },  // Federal Tax
        { wch: 12 },  // State Tax
        { wch: 12 },  // FICA
        { wch: 12 },  // Medicare
        { wch: 12 },  // SDI
        { wch: 12 },  // CalSavers
        { wch: 12 },  // Total Taxes
        { wch: 12 },  // Deductions
        { wch: 12 },  // Net Pay
      ];
  
      XLSX.utils.book_append_sheet(workbook, detailSheet, "Employee Details");
  
      const filename = `Payroll_Report_${filters.year}_${filters.from}_to_${filters.to}.xlsx`;
      XLSX.writeFile(workbook, filename);
  
      toast.success(`Excel file generated with ${employeeData.length} employee records!`);
  
    } catch (error) {
      console.error('Error generating Excel:', error);
      toast.error('Failed to generate Excel file');
    }
  };

  const handleViewPayslip = async (payrollRunId, employeeId) => {
    if (isMockPayrollId(payrollRunId)) {
      toast.info("PDF preview is not available for demo payroll runs.");
      return;
    }
    try {
      const response = await fetch(
        `${API_URL}/api/payroll-system/generate-payslip-pdf/${payrollRunId}/${employeeId}`, // ✅ Admin route with employeeId
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
  
      if (!response.ok) throw new Error('Failed to generate payslip');
  
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
      
    } catch (error) {
      console.error('Error viewing payslip:', error);
      toast.error('Failed to view payslip');
    }
  };

  const handleDownloadPayslip = async (payrollRunId, employeeId) => {
    if (isMockPayrollId(payrollRunId)) {
      toast.info("PDF download is not available for demo payroll runs.");
      return;
    }
    try {
      toast.info('Generating payslip PDF...');
  
      const response = await fetch(
        `${API_URL}/api/payroll-system/generate-payslip-pdf/${payrollRunId}/${employeeId}`, // ✅ Admin route with employeeId
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
  
      if (!response.ok) {
        throw new Error('Failed to generate payslip');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'payslip.pdf';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
  
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename; 
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
  
      toast.success('Payslip downloaded!');
    } catch (error) {
      console.error('Error downloading payslip:', error);
      toast.error('Failed to download payslip');
    }
  };

  const handlePrintCheck = async (payrollRunId, employeeId) => {
    if (isMockPayrollId(payrollRunId)) {
      toast.info("Check printing is not available for demo payroll runs.");
      return;
    }
    try {
      toast.info('Generating check for printing...');
  
      const response = await fetch(
        `${API_URL}/api/payroll-system/generate-check-pdf/${payrollRunId}/${employeeId}`,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
  
      if (!response.ok) throw new Error('Failed to generate check');
  
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'check.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) filename = match[1].replace(/['"]/g, '');
      }
  
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Open in new window for printing
      const printWindow = window.open(url, '_blank');
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
      
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success('Check ready for printing!');
    } catch (error) {
      console.error('Error generating check:', error);
      toast.error('Failed to generate check');
    }
  };

  const fetchPayrollReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/payroll-system/payroll-reports?from=${filters.from}&to=${filters.to}&year=${filters.year}&sortBy=${filters.sortBy}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        const apiReports = result.data.reports || [];
        const merged = withMockPayrollReports(apiReports);
        setPayrollReports(merged);
        setUsingMockData(apiReports.length === 0 && merged.length > 0);
      } else {
        toast.error(result.message || 'Failed to fetch reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const PayrollDetailModal = () => {
    if (!isDetailModalOpen || !selectedReport) return null;
    
    if (!selectedReport.employees || selectedReport.employees.length === 0) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <p className="text-gray-600">No employee data available</p>
            <button
              onClick={() => setIsDetailModalOpen(false)}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded"
            >
              Close
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto">
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsDetailModalOpen(false)}
        ></div>
        
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-4 my-8 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-4 rounded-t-xl flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Payroll Run Details</h3>
                <p className="text-sm text-orange-100 mt-1">
                  Period: {new Date(selectedReport.periodStart).toLocaleDateString()} - {new Date(selectedReport.periodEnd).toLocaleDateString()}
                </p>
                <p className="text-sm text-orange-100">
                  Pay Date: {new Date(selectedReport.payDate).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
  
          {/* Summary */}
          <div className="bg-gray-50 px-6 py-4 border-b grid grid-cols-4 gap-4 flex-shrink-0">
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Employees</p>
              <p className="text-lg font-bold text-gray-900">{selectedReport.employeeCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Gross Pay</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(selectedReport.totalGross)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Total Taxes</p>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(selectedReport.totalTaxes)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase">Net Pay</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(selectedReport.totalNet)}</p>
            </div>
          </div>
  
          {/* Employee List */}
          <div className="flex-1 overflow-y-auto p-6">
            <h4 className="text-sm font-bold text-gray-700 uppercase mb-4">Employee Breakdown</h4>
            
            <div className="space-y-4">
              {selectedReport.employees.map((emp, index) => (
                <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h5 className="font-semibold text-gray-900">{emp.employeeName || 'Employee'}</h5>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{emp.position || 'No position'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            emp.payType === 'salary' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {emp.payType?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Check #{emp.checkNumber}</p>
                        <p className="text-lg font-bold text-orange-600">{formatCurrency(emp.netPay || 0)}</p>
                      </div>
                      {/* PDF Button */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewPayslip(selectedReport.id, emp.employeeId)}
                          disabled={selectedReport.isMock}
                          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={selectedReport.isMock ? "Not available for demo data" : "View PDF Payslip"}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={() => handleDownloadPayslip(selectedReport.id, emp.employeeId)}
                          disabled={selectedReport.isMock}
                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={selectedReport.isMock ? "Not available for demo data" : "Download PDF Payslip"}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handlePrintCheck(selectedReport.id, emp.employeeId)}
                          disabled={selectedReport.isMock}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={selectedReport.isMock ? "Not available for demo data" : "Print Check"}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-green-50 rounded p-2">
                      <p className="text-xs text-gray-600 mb-1">Gross Pay</p>
                      <p className="font-semibold text-green-700">{formatCurrency(emp.grossPay || 0)}</p>
                    </div>
                    <div className="bg-blue-50 rounded p-2">
                      <p className="text-xs text-gray-600 mb-1">Taxes</p>
                      <p className="font-semibold text-blue-700">{formatCurrency(emp.taxes?.totalTaxes || 0)}</p>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <p className="text-xs text-gray-600 mb-1">Deductions</p>
                      <p className="font-semibold text-red-700">{formatCurrency(emp.totalDeductions || 0)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
  
          {/* Footer */}
          <div className="bg-gray-100 px-6 py-3 rounded-b-xl flex justify-end flex-shrink-0">
            <button
              onClick={() => setIsDetailModalOpen(false)}
              className="px-6 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const reportTabs = [
    { id: 'payroll-detail', label: 'Payroll Detail', enabled: true },
    { id: '941-tax', label: '941 Tax Liability', enabled: false },
    { id: 'de-9c', label: 'DE-9C', enabled: false },
  ];

  // Render Payroll Detail Tab
  const renderPayrollDetailTab = () => (
    <div>
      <PayrollDetailModal />
      {/* Filters Section */}
      <div className="p-6 bg-gray-50 border-b">
        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
            <input
              type="text"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="01-01"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
            <input
              type="text"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="12-31"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {Array.from({ length: new Date().getFullYear() - 2024 }, (_, i) => 2025 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option>Pay Date</option>
              <option>Amount</option>
            </select>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex justify-end gap-3">
          <button
            onClick={fetchPayrollReports}
            disabled={loading}
            className="px-8 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? 'LOADING...' : 'VIEW'}
          </button>

          <button
            onClick={exportToExcel}
            disabled={payrollReports.length === 0}
            className="px-8 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            EXPORT EXCEL
          </button>
        </div>
      </div>

      <div className="px-6 pt-4">
        <MockPayrollBanner showingMock={usingMockData} />
      </div>

      {/* Reports List or Empty State */}
      {payrollReports.length === 0 && !loading ? (
        <div className="p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="bg-orange-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Payroll Reports Found</h3>
            <p className="text-gray-600">Click "VIEW" to load reports or create a payroll first.</p>
          </div>
        </div>
      ) : (
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Pay Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Period</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b">Employees</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b">Gross Pay</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b">Taxes</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b">Deductions</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 border-b">Net Pay</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payrollReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {new Date(report.payDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-b">
                      {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">{report.employeeCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">{formatCurrency(report.totalGross)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">{formatCurrency(report.totalTaxes)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-b">{formatCurrency(report.totalDeductions)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right border-b">{formatCurrency(report.totalNet)}</td>
                    <td className="px-4 py-3 text-center border-b">
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setIsDetailModalOpen(true);
                        }}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ... other tab render functions remain the same ...

  const renderReportTabContent = () => {
    switch (activeReportTab) {
      case 'payroll-detail':
        return renderPayrollDetailTab();
      default:
        return renderPayrollDetailTab();
    }
  };

  return (
    <>
    <Toaster position="top-center" richColors />
    <div>
      <div className="bg-gray-50 border-b">
        <div className="px-6 pt-4">
          <nav className="flex space-x-2">
            {reportTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.enabled && setActiveReportTab(tab.id)}
                disabled={!tab.enabled}
                className={`
                  px-6 py-2 text-sm font-medium rounded-t-lg transition-colors
                  ${activeReportTab === tab.id
                    ? 'bg-orange-500 text-white'
                    : tab.enabled 
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                {tab.label}
                {!tab.enabled}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {renderReportTabContent()}
    </div>
    </>
  );
};

export default Reports;