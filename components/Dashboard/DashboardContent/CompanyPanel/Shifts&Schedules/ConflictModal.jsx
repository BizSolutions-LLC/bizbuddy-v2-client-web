// Simplified Custom Conflict Modal - No New Endpoints Required
import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Users, 
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Plus,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Utility function to convert time to UTC ISO format
const toUtcIso = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m)).toISOString();
};

// Custom Shift Creation Modal Component
const CustomShiftModal = ({ 
  isOpen, 
  onClose, 
  onCreateShift, 
  conflict, 
  creating 
}) => {
  const [shiftForm, setShiftForm] = useState({
    shiftName: '',
    startTime: '',
    endTime: '',
    differentialMultiplier: 1.0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!shiftForm.shiftName.trim()) {
      toast.error("Shift name is required");
      return;
    }
    if (!shiftForm.startTime || !shiftForm.endTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    onCreateShift(conflict, shiftForm);
  };

  const generateShiftName = () => {
    const start = shiftForm.startTime;
    const end = shiftForm.endTime;
    if (start && end) {
      const startFormatted = new Date(`2000-01-01T${start}`).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      const endFormatted = new Date(`2000-01-01T${end}`).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      setShiftForm(prev => ({
        ...prev,
        shiftName: `Custom ${startFormatted} - ${endFormatted}`
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-orange-500" />
            Create Custom Shift
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shiftName">Shift Name</Label>
            <div className="flex gap-2">
              <Input
                id="shiftName"
                value={shiftForm.shiftName}
                onChange={(e) => setShiftForm(prev => ({ ...prev, shiftName: e.target.value }))}
                placeholder="e.g., Custom Evening Shift"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateShiftName}
                disabled={!shiftForm.startTime || !shiftForm.endTime}
              >
                Auto
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={shiftForm.startTime}
                onChange={(e) => setShiftForm(prev => ({ ...prev, startTime: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={shiftForm.endTime}
                onChange={(e) => setShiftForm(prev => ({ ...prev, endTime: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="differentialMultiplier">Pay Multiplier</Label>
            <Input
              id="differentialMultiplier"
              type="number"
              step="0.1"
              min="1.0"
              value={shiftForm.differentialMultiplier}
              onChange={(e) => setShiftForm(prev => ({ ...prev, differentialMultiplier: e.target.value }))}
              placeholder="1.0"
            />
          </div>

          {shiftForm.startTime && shiftForm.endTime && (
            <div className="text-xs text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded">
              {parseInt(shiftForm.endTime.split(':')[0]) < parseInt(shiftForm.startTime.split(':')[0]) && (
                <span className="text-amber-600">⚠️ This shift crosses midnight</span>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating} className="bg-orange-500 hover:bg-orange-600">
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create & Assign
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Main Enhanced Conflict Modal
export default function SimplifiedConflictModal({ 
  isOpen, 
  onClose, 
  conflictData, 
  token, 
  API_URL, 
  onResolved 
}) {
  const [resolvingConflicts, setResolvingConflicts] = useState({});
  const [showCustomShiftModal, setShowCustomShiftModal] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [creatingCustomShift, setCreatingCustomShift] = useState(false);

  if (!conflictData || !conflictData.details) {
    return null;
  }

  const resolveConflict = async (conflictId, resolution, customData = null) => {
    setResolvingConflicts(prev => ({ ...prev, [conflictId]: true }));
    
    try {
      const payload = { resolution };
      if (customData) {
        payload.customShiftId = customData.customShiftId;
      }

      const response = await fetch(`${API_URL}/api/conflicts/${conflictId}/resolve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || `Conflict resolved: ${resolution.replace('_', ' ').toLowerCase()}`);
        
        // Remove resolved conflict from display
        conflictData.details = conflictData.details.filter(c => c.id !== conflictId);
        
        if (conflictData.details.length === 0) {
          onResolved();
        }
      } else {
        toast.error(data.message || "Failed to resolve conflict");
      }
    } catch (error) {
      console.error("Error resolving conflict:", error);
      toast.error("An error occurred while resolving the conflict");
    } finally {
      setResolvingConflicts(prev => ({ ...prev, [conflictId]: false }));
    }
  };

  const createCustomShift = async (conflict, customShiftData) => {
    if (!customShiftData.shiftName.trim()) {
      toast.error("Shift name is required");
      return;
    }

    setCreatingCustomShift(true);
    
    try {
      // Step 1: Create the custom shift using existing API
      const payload = {
        shiftName: customShiftData.shiftName.trim(),
        startTime: toUtcIso(customShiftData.startTime),
        endTime: toUtcIso(customShiftData.endTime),
        differentialMultiplier: parseFloat(customShiftData.differentialMultiplier),
      };

      const shiftResponse = await fetch(`${API_URL}/api/shifts/create`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      const shiftData = await shiftResponse.json();

      if (shiftResponse.status === 201 || shiftResponse.status === 200) {
        // Step 2: Resolve conflict with the new custom shift ID
        // Note: Your backend conflict resolver will need to handle CREATE_CUSTOM resolution
        // and assign the custom shift to the user
        await resolveConflict(conflict.id || conflict.conflictId, 'CREATE_CUSTOM', {
          customShiftId: shiftData.data.id
        });
        
        toast.success(shiftData.message || "Custom shift created and assigned successfully");
        
        setShowCustomShiftModal(false);
        setSelectedConflict(null);
      } else {
        toast.error(shiftData.message || "Failed to create custom shift");
      }
    } catch (error) {
      console.error("Error creating custom shift:", error);
      toast.error("Failed to create custom shift");
    } finally {
      setCreatingCustomShift(false);
    }
  };

  const handleCreateCustomShift = (conflict) => {
    setSelectedConflict(conflict);
    setShowCustomShiftModal(true);
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC',
      });
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0 gap-0 border-2 shadow-xl">
          {/* Orange Accent Bar */}
          <div className="h-1 w-full bg-orange-500" />
          
          {/* Header */}
          <div className="px-5 py-3 border-b bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Schedule Conflicts Detected
                  </DialogTitle>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {conflictData.count} conflicts affecting {conflictData.totalAffectedUsers} employees require resolution
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 max-h-[calc(85vh-120px)]">
            <div className="p-4 space-y-3">
              {conflictData.details.map((conflict, index) => (
                <Card key={index} className="border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
                  <CardContent className="p-0">
                    {/* Employee Header */}
                    <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                            <Users className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {conflict.userEmail || conflict.userDisplayName}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(conflict.assignedDate)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-300">
                          #{index + 1}
                        </Badge>
                      </div>
                    </div>

                    {/* Conflict Details */}
                    <div className="p-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Current Assignment */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">Current</h5>
                          </div>
                          <Card className="border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                            <CardContent className="p-3">
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {conflict.existingShiftName || conflict.conflictingShift?.shiftName}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(conflict.conflictDetails?.existingShift?.start)} - {formatTime(conflict.conflictDetails?.existingShift?.end)}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* New Assignment */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                            <h5 className="text-xs font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide">New</h5>
                          </div>
                          <Card className="border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20">
                            <CardContent className="p-3">
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-orange-900 dark:text-orange-100">
                                  {conflict.newShiftName || conflict.newShift?.shiftName}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-orange-700 dark:text-orange-300">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(conflict.conflictDetails?.newShift?.start)} - {formatTime(conflict.conflictDetails?.newShift?.end)}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <Button 
                          variant="outline"
                          size="sm"
                          disabled={resolvingConflicts[conflict.id || conflict.conflictId]}
                          onClick={() => resolveConflict(conflict.id || conflict.conflictId, 'SKIP_NEW')}
                          className="gap-1.5 text-xs border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                        >
                          {resolvingConflicts[conflict.id || conflict.conflictId] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          Keep Current
                        </Button>
                        
                        <Button 
                          variant="outline"
                          size="sm"
                          disabled={resolvingConflicts[conflict.id || conflict.conflictId]}
                          onClick={() => handleCreateCustomShift(conflict)}
                          className="gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900/20"
                        >
                          <Plus className="h-3 w-3" />
                          Create Custom
                        </Button>

                        <Button 
                          size="sm"
                          disabled={resolvingConflicts[conflict.id || conflict.conflictId]}
                          onClick={() => resolveConflict(conflict.id || conflict.conflictId, 'OVERRIDE_EXISTING')}
                          className="gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          {resolvingConflicts[conflict.id || conflict.conflictId] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          Use New
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-800/50 px-5 py-5 border-t flex justify-between items-center">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Resolve conflicts to ensure proper shift coverage
            </div>
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Shift Creation Modal */}
      <CustomShiftModal
        isOpen={showCustomShiftModal}
        onClose={() => {
          setShowCustomShiftModal(false);
          setSelectedConflict(null);
        }}
        onCreateShift={createCustomShift}
        conflict={selectedConflict}
        creating={creatingCustomShift}
      />
    </>
  );
}