import React from 'react';

const OrangeLoadingSpinner = ({ size = 24, className = "" }) => {
  return (
    <div className={`inline-block relative ${className}`} style={{ zIndex: 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-spin"
        style={{ display: 'block' }}
      >
        {/* Main dots with different opacities for the spinning effect */}
        <circle cx="12" cy="3" r="2" fill="#f97316" opacity="1" />
        <circle cx="16.5" cy="5.5" r="1.5" fill="#f97316" opacity="0.875" />
        <circle cx="19.5" cy="10.5" r="1" fill="#f97316" opacity="0.75" />
        <circle cx="16.5" cy="18.5" r="1.5" fill="#f97316" opacity="0.625" />
        <circle cx="12" cy="21" r="2" fill="#f97316" opacity="0.5" />
        <circle cx="7.5" cy="18.5" r="1.5" fill="#f97316" opacity="0.375" />
        <circle cx="4.5" cy="13.5" r="1" fill="#f97316" opacity="0.25" />
        <circle cx="7.5" cy="5.5" r="1.5" fill="#f97316" opacity="0.125" />
      </svg>
    </div>
  );
};

// Alternative CSS-only version with better z-index handling
const OrangeSpinnerCSS = ({ size = 24, className = "" }) => {
  const spinnerStyle = {
    width: size,
    height: size,
    position: 'relative',
    display: 'inline-block',
    zIndex: 10
  };

  const dotStyle = (delay) => ({
    position: 'absolute',
    width: '3px',
    height: '3px',
    backgroundColor: '#f97316', // Orange-500
    borderRadius: '50%',
    animation: `spin 1.2s linear infinite`,
    animationDelay: delay,
    zIndex: 11
  });

  return (
    <div className={`orange-spinner ${className}`} style={spinnerStyle}>
      <style jsx>{`
        @keyframes spin {
          0%, 20% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
        .dot-1 { top: 0; left: 50%; transform: translateX(-50%); animation-delay: 0s; }
        .dot-2 { top: 15%; right: 15%; animation-delay: 0.15s; }
        .dot-3 { top: 50%; right: 0; transform: translateY(-50%); animation-delay: 0.3s; }
        .dot-4 { bottom: 15%; right: 15%; animation-delay: 0.45s; }
        .dot-5 { bottom: 0; left: 50%; transform: translateX(-50%); animation-delay: 0.6s; }
        .dot-6 { bottom: 15%; left: 15%; animation-delay: 0.75s; }
        .dot-7 { top: 50%; left: 0; transform: translateY(-50%); animation-delay: 0.9s; }
        .dot-8 { top: 15%; left: 15%; animation-delay: 1.05s; }
      `}</style>
      <div className="dot-1" style={{...dotStyle('0s'), top: 0, left: '50%', transform: 'translateX(-50%)'}}></div>
      <div className="dot-2" style={{...dotStyle('0.15s'), top: '15%', right: '15%'}}></div>
      <div className="dot-3" style={{...dotStyle('0.3s'), top: '50%', right: 0, transform: 'translateY(-50%)'}}></div>
      <div className="dot-4" style={{...dotStyle('0.45s'), bottom: '15%', right: '15%'}}></div>
      <div className="dot-5" style={{...dotStyle('0.6s'), bottom: 0, left: '50%', transform: 'translateX(-50%)'}}></div>
      <div className="dot-6" style={{...dotStyle('0.75s'), bottom: '15%', left: '15%'}}></div>
      <div className="dot-7" style={{...dotStyle('0.9s'), top: '50%', left: 0, transform: 'translateY(-50%)'}}></div>
      <div className="dot-8" style={{...dotStyle('1.05s'), top: '15%', left: '15%'}}></div>
    </div>
  );
};

// Usage examples
const LoadingSpinnerExamples = () => {
  return (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Orange Loading Spinners</h3>
        
        {/* Small spinner */}
        <div className="flex items-center gap-4">
          <OrangeLoadingSpinner size={16} />
          <span>Small (16px)</span>
        </div>
        
        {/* Medium spinner */}
        <div className="flex items-center gap-4">
          <OrangeLoadingSpinner size={24} />
          <span>Medium (24px)</span>
        </div>
        
        {/* Large spinner */}
        <div className="flex items-center gap-4">
          <OrangeLoadingSpinner size={32} />
          <span>Large (32px)</span>
        </div>
        
        {/* In button context */}
        <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md flex items-center gap-2">
          <OrangeLoadingSpinner size={16} />
          Submitting...
        </button>
      </div>
    </div>
  );
};

export { OrangeLoadingSpinner, OrangeSpinnerCSS, LoadingSpinnerExamples };
export default OrangeLoadingSpinner;