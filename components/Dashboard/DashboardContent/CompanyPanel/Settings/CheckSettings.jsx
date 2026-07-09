'use client';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import useAuthStore from "@/store/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const MOCK_DATA = {
  payDate: 'Dec 20, 2025',
  amountWords: 'ONE THOUSAND THIRTY SEVEN AND 19/100',
  amountNumber: '1,037.19',
  payeeName: 'JOHN DOE',
  payeeAddress: '123 Main Street, San Francisco, CA 94105',
};

// Font size ranges for different fields
const FONT_SIZE_RANGES = {
  date: { min: 8, max: 14, default: 10 },
  amountWords: { min: 8, max: 14, default: 10 },
  amountNumber: { min: 10, max: 18, default: 14 },
  payeeName: { min: 9, max: 14, default: 11 },
  payeeAddress: { min: 7, max: 12, default: 9 },
};

const CheckSettings = () => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [positions, setPositions] = useState({
    date: { x: 480, y: 95, fontSize: 10 },
    amountWords: { x: 90, y: 135, fontSize: 10 },
    amountNumber: { x: 455, y: 133, fontSize: 14 },
    payeeName: { x: 90, y: 170, fontSize: 11 },
    payeeAddress: { x: 90, y: 185, fontSize: 9 },
  });

  useEffect(() => {
    fetchTemplates();
    fetchCurrentSettings();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/company-settings/check-templates`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok) {
        setTemplates(result.data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchCurrentSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/company-settings/check-settings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok) {
        setSelectedTemplate(result.data.checkTemplate);
        setPositions(result.data.checkPositions);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateKey) => {
    setSelectedTemplate(templateKey);
    if (templates[templateKey]) {
      setPositions(templates[templateKey].positions);
      toast.info(`Loaded ${templates[templateKey].name} template`);
    }
  };

  const handlePositionChange = (field, axis, value) => {
    setPositions(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [axis]: parseInt(value) || 0,
      },
    }));
  };

  const handleFontSizeChange = (field, value) => {
    setPositions(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        fontSize: parseInt(value) || FONT_SIZE_RANGES[field].default,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_URL}/api/company-settings/check-settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkTemplate: selectedTemplate,
          checkPositions: positions,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        toast.success('Check settings saved successfully!');
      } else {
        toast.error(result.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const defaultTemplate = templates['default'];
    if (defaultTemplate) {
      setPositions(defaultTemplate.positions);
      setSelectedTemplate('default');
      toast.info('Reset to default positions');
    }
  };

  const generateTestPDF = async () => {
    try {
      setGeneratingPDF(true);
      toast.info('Generating test check PDF...');
      const response = await fetch(`${API_URL}/api/company-settings/check-test-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          positions,
          mockData: MOCK_DATA,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate test PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      
      toast.success('Test PDF generated!');
    } catch (error) {
      console.error('Error generating test PDF:', error);
      toast.error('Failed to generate test PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading check settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Check Printing Setup</h2>
          <p className="text-sm text-gray-600 mt-1">
            Adjust positions, font sizes, and preview changes in real-time
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={generateTestPDF}
            disabled={generatingPDF}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {generatingPDF ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Generate Test PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Split View */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* LEFT: Controls */}
        <div className="space-y-6">
          {/* Template Selection */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Template</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(templates).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => handleTemplateChange(key)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedTemplate === key
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-medium text-sm text-gray-800">{template.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Position & Font Size Adjustments */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Fine-tune Settings</h3>
              <button
                onClick={handleReset}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Reset to Default
              </button>
            </div>
            <div className="space-y-6">
              {Object.entries(positions).map(([field, coords]) => (
                <div key={field} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="font-semibold text-gray-800 mb-4 capitalize text-base flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  
                  {/* X Position Slider */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">X Position (Horizontal)</label>
                      <span className="text-sm font-mono font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                        {coords.x}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="595"
                      value={coords.x}
                      onChange={(e) => handlePositionChange(field, 'x', e.target.value)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-orange"
                    />
                  </div>

                  {/* Y Position Slider */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">Y Position (Vertical)</label>
                      <span className="text-sm font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {coords.y}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="300"
                      value={coords.y}
                      onChange={(e) => handlePositionChange(field, 'y', e.target.value)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-blue"
                    />
                  </div>

                  {/* Font Size Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-600">Font Size</label>
                      <span className="text-sm font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                        {coords.fontSize || FONT_SIZE_RANGES[field].default}pt
                      </span>
                    </div>
                    <input
                      type="range"
                      min={FONT_SIZE_RANGES[field].min}
                      max={FONT_SIZE_RANGES[field].max}
                      value={coords.fontSize || FONT_SIZE_RANGES[field].default}
                      onChange={(e) => handleFontSizeChange(field, e.target.value)}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-green"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-6 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* RIGHT: Live Preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Live Preview</h3>
              <span className="text-xs text-gray-500 bg-green-100 px-2 py-1 rounded flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            </div>
            
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50">
              <LiveCheckPreview positions={positions} mockData={MOCK_DATA} />
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 text-sm mb-2">💡 Preview Tips:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Drag sliders to adjust position and size</li>
                <li>• Changes appear instantly in preview</li>
                <li>• Click "Generate Test PDF" for exact output</li>
                <li>• Print test on plain paper before using check stock</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">🔧 Calibration Workflow:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Select a template or start with default positions</li>
          <li>Use sliders to adjust X/Y positions and font sizes</li>
          <li>Watch the live preview update in real-time</li>
          <li>Click "Generate Test PDF" to create a sample check</li>
          <li>Print the test PDF on plain paper</li>
          <li>Overlay it on your actual check stock to verify alignment</li>
          <li>Fine-tune settings as needed and repeat</li>
          <li>Click "Save Settings" when satisfied</li>
        </ol>
      </div>

      {/* Custom Slider Styles */}
      <style jsx>{`
        .slider-orange::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #ea580c;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider-orange::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #ea580c;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: none;
        }
        .slider-blue::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #2563eb;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider-blue::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #2563eb;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: none;
        }
        .slider-green::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #16a34a;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .slider-green::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #16a34a;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: none;
        }
      `}</style>
    </div>
  );
};

// Live Preview Component
const LiveCheckPreview = ({ positions, mockData }) => {
  const scale = 0.7;
  const width = 595 * scale;
  const height = 400 * scale;

  return (
    <div 
      className="relative bg-white"
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        margin: '0 auto',
      }}
    >
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="gray" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Date */}
      <div
        className="absolute font-mono"
        style={{
          left: `${positions.date.x * scale}px`,
          top: `${positions.date.y * scale}px`,
          fontSize: `${(positions.date.fontSize || 10) * scale}px`,
        }}
      >
        {mockData.payDate}
      </div>

      {/* Amount Words */}
      <div
        className="absolute font-bold"
        style={{
          left: `${positions.amountWords.x * scale}px`,
          top: `${positions.amountWords.y * scale}px`,
          fontSize: `${(positions.amountWords.fontSize || 10) * scale}px`,
          maxWidth: `${350 * scale}px`,
        }}
      >
        {mockData.amountWords}
      </div>

      {/* Amount Number */}
      <div
        className="absolute font-bold border-2 border-gray-400 px-2 py-1 bg-white"
        style={{
          left: `${positions.amountNumber.x * scale}px`,
          top: `${positions.amountNumber.y * scale}px`,
          fontSize: `${(positions.amountNumber.fontSize || 14) * scale}px`,
        }}
      >
        {mockData.amountNumber}
      </div>

      {/* Payee Name */}
      <div
        className="absolute font-bold"
        style={{
          left: `${positions.payeeName.x * scale}px`,
          top: `${positions.payeeName.y * scale}px`,
          fontSize: `${(positions.payeeName.fontSize || 11) * scale}px`,
        }}
      >
        {mockData.payeeName}
      </div>

      {/* Payee Address */}
      <div
        className="absolute"
        style={{
          left: `${positions.payeeAddress.x * scale}px`,
          top: `${positions.payeeAddress.y * scale}px`,
          fontSize: `${(positions.payeeAddress.fontSize || 9) * scale}px`,
        }}
      >
        {mockData.payeeAddress}
      </div>

      {/* Position Indicators (Red Dots) */}
      {Object.entries(positions).map(([key, pos]) => (
        <div
          key={key}
          className="absolute w-2 h-2 bg-red-500 rounded-full opacity-50"
          style={{
            left: `${pos.x * scale - 4}px`,
            top: `${pos.y * scale - 4}px`,
          }}
          title={`${key}: (${pos.x}, ${pos.y})`}
        />
      ))}
    </div>
  );
};

export default CheckSettings;