'use client';

import React from 'react';
import { Eye, Download, Mail } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function ActionButton({ label, onClick, disabled, loading, icon: Icon, variant = 'default' }) {
  const variants = {
    default: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    view: 'text-blue-600 hover:bg-blue-50 hover:text-blue-800',
    download: 'text-red-600 hover:bg-red-50 hover:text-red-800',
    send: 'text-green-600 hover:bg-green-50 hover:text-green-800',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          aria-label={label}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]}`}
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon className="w-4 h-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {disabled && !loading ? `${label} (unavailable)` : label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function PayslipActionButtons({
  onView,
  onDownload,
  onSend,
  disabled = false,
  sendDisabled = false,
  sendDisabledReason,
  loadingAction = null,
  compact = true,
}) {
  const sendLabel = sendDisabledReason || 'Send payslip via email';

  if (!compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-2">
          <ActionButton label="View payslip" onClick={onView} disabled={disabled} loading={loadingAction === 'view'} icon={Eye} variant="view" />
          <ActionButton label="Download payslip" onClick={onDownload} disabled={disabled} loading={loadingAction === 'download'} icon={Download} variant="download" />
          <ActionButton label={sendLabel} onClick={onSend} disabled={disabled || sendDisabled} loading={loadingAction === 'send'} icon={Mail} variant="send" />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="inline-flex items-center gap-1">
        <ActionButton label="View payslip" onClick={onView} disabled={disabled} loading={loadingAction === 'view'} icon={Eye} variant="view" />
        <ActionButton label="Download payslip" onClick={onDownload} disabled={disabled} loading={loadingAction === 'download'} icon={Download} variant="download" />
        <ActionButton label={sendLabel} onClick={onSend} disabled={disabled || sendDisabled} loading={loadingAction === 'send'} icon={Mail} variant="send" />
      </div>
    </TooltipProvider>
  );
}
