'use client';
import React from 'react';

const ViewPaychecksModal = ({ isOpen, onClose, paychecks }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-orange-600 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">View Paychecks</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 w-16">
                      {/* Checkbox column */}
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Pay Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paychecks.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                        No paychecks generated yet. Process payroll to create paychecks.
                      </td>
                    </tr>
                  ) : (
                    paychecks.map((paycheck) => (
                      <tr key={paycheck.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {paycheck.payDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {paycheck.employeeName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 transition-colors duration-200"
              >
                Close
              </button>
              {paychecks.length > 0 && (
                <>
                  <button
                    onClick={() => alert('Print selected paychecks')}
                    className="px-6 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors duration-200"
                  >
                    Print Selected
                  </button>
                  <button
                    onClick={() => alert('Download selected paychecks')}
                    className="px-6 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 transition-colors duration-200"
                  >
                    Download
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewPaychecksModal;