"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import useAuthStore from "@/store/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function PayslipPage() {
  const { token } = useAuthStore();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchPayslips();
    }
  }, [token]);

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/payroll-system/my-payslips`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await response.json();

      if (response.ok) {
        setPayslips(result.data.payslips || []);
      } else {
        toast.error(result.message || 'Failed to fetch payslips');
      }
    } catch (error) {
      console.error('Error fetching payslips:', error);
      toast.error('Failed to load payslips');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPayslip = async (payrollRunId) => {
    try {
      toast.info('Generating payslip PDF...');
  
      const response = await fetch(
        `${API_URL}/api/payroll-system/my-payslip/${payrollRunId}`,
        {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
  
      if (!response.ok) throw new Error('Failed to generate payslip');
  
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'payslip.pdf';
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) filename = match[1].replace(/['"]/g, '');
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
  
  const handleViewPayslip = async (payrollRunId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/payroll-system/my-payslip/${payrollRunId}`,
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

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-3 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 sm:mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 sm:p-3 rounded-xl bg-orange-500/10 shrink-0">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Payslips</h1>
                <p className="text-sm sm:text-base text-gray-600">View and download your payslip history</p>
              </div>
            </div>
          </motion.div>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
                <span className="text-gray-600">Loading payslips...</span>
              </div>
            </div>
          ) : payslips.length === 0 ? (
            /* Empty State */
            <Card className="border-2 border-orange-200">
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-orange-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">No Payslips Yet</h3>
                <p className="text-gray-600">Your payslips will appear here once payroll is processed.</p>
              </CardContent>
            </Card>
          ) : (
            /* Payslips List */
            <div className="space-y-4">
              {payslips.map((payslip, index) => (
                <motion.div
                  key={payslip.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="border border-gray-200 hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        {/* Left: Period & Check Info */}
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="h-6 w-6 text-orange-600" />
                          </div>
                          
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <h3 className="font-bold text-lg text-gray-900">
                                {new Date(payslip.periodStart).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                              </h3>
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-200 text-xs">
                                Paid
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 sm:gap-4 text-sm text-gray-600 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 shrink-0" />
                                <span>
                                  {new Date(payslip.periodStart).toLocaleDateString()} - {new Date(payslip.periodEnd).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Check #</span>
                                <span className="font-semibold text-orange-600">{payslip.checkNumber}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Middle: Financial Summary */}
                        <div className="hidden md:flex items-center gap-8">
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Gross Pay</p>
                            <p className="font-semibold text-gray-900">{formatCurrency(payslip.grossPay)}</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Taxes</p>
                            <p className="font-semibold text-blue-600">-{formatCurrency(payslip.taxes)}</p>
                          </div>
                          
                          {payslip.deductions > 0 && (
                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">Deductions</p>
                              <p className="font-semibold text-red-600">-{formatCurrency(payslip.deductions)}</p>
                            </div>
                          )}
                          
                          <div className="text-center">
                            <p className="text-xs text-gray-500 mb-1">Net Pay</p>
                            <p className="font-bold text-xl text-orange-600">{formatCurrency(payslip.netPay)}</p>
                          </div>
                        </div>

                        {/* Right: Action Buttons */}
                        <div className="flex items-center gap-2 sm:flex-shrink-0">
                          <button
                            onClick={() => handleViewPayslip(payslip.payrollRunId)}
                            className="flex-1 sm:flex-initial justify-center px-4 sm:px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            View
                          </button>
                          
                          <button
                            onClick={() => handleDownloadPayslip(payslip.payrollRunId)}
                            className="flex-1 sm:flex-initial justify-center px-4 sm:px-5 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </button>
                        </div>
                      </div>

                      {/* Mobile: Financial Summary */}
                      <div className="md:hidden mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Gross Pay</p>
                          <p className="font-semibold text-gray-900">{formatCurrency(payslip.grossPay)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Taxes</p>
                          <p className="font-semibold text-blue-600">-{formatCurrency(payslip.taxes)}</p>
                        </div>
                        {payslip.deductions > 0 && (
                          <div>
                            <p className="text-xs text-gray-500">Deductions</p>
                            <p className="font-semibold text-red-600">-{formatCurrency(payslip.deductions)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500">Net Pay</p>
                          <p className="font-bold text-lg text-orange-600">{formatCurrency(payslip.netPay)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}