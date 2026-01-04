import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, AlertTriangle, Printer, Eye, EyeOff, Info, ChevronDown } from 'lucide-react';
import { virtualPrinterApi } from '../api/client';
import { Card, CardContent, CardHeader } from './Card';
import { Button } from './Button';
import { useToast } from '../contexts/ToastContext';

export function VirtualPrinterSettings() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [localEnabled, setLocalEnabled] = useState(false);
  const [localAccessCode, setLocalAccessCode] = useState('');
  const [localMode, setLocalMode] = useState<'immediate' | 'queue'>('immediate');
  const [localModel, setLocalModel] = useState('BL-P001');
  const [showAccessCode, setShowAccessCode] = useState(false);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['virtual-printer-settings'],
    queryFn: virtualPrinterApi.getSettings,
    refetchInterval: 10000, // Refresh every 10 seconds for status updates
  });

  // Fetch available models
  const { data: modelsData } = useQuery({
    queryKey: ['virtual-printer-models'],
    queryFn: virtualPrinterApi.getModels,
  });

  // Initialize local state from settings
  useEffect(() => {
    if (settings) {
      setLocalEnabled(settings.enabled);
      setLocalMode(settings.mode);
      setLocalModel(settings.model);
    }
  }, [settings]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { enabled?: boolean; access_code?: string; mode?: 'immediate' | 'queue'; model?: string }) =>
      virtualPrinterApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtual-printer-settings'] });
      showToast('Virtual printer settings updated');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update settings', 'error');
      // Revert local state on error
      if (settings) {
        setLocalEnabled(settings.enabled);
        setLocalMode(settings.mode);
        setLocalModel(settings.model);
      }
    },
  });

  const handleToggleEnabled = () => {
    const newEnabled = !localEnabled;

    // If enabling, must have access code
    if (newEnabled && !localAccessCode && !settings?.access_code_set) {
      showToast('Please set an access code first', 'error');
      return;
    }

    setLocalEnabled(newEnabled);
    updateMutation.mutate({
      enabled: newEnabled,
      access_code: localAccessCode || undefined,
      mode: localMode,
    });
  };

  const handleAccessCodeChange = () => {
    if (!localAccessCode) {
      showToast('Access code cannot be empty', 'error');
      return;
    }

    if (localAccessCode.length !== 8) {
      showToast('Access code must be exactly 8 characters', 'error');
      return;
    }

    updateMutation.mutate({
      access_code: localAccessCode,
    });
    setLocalAccessCode(''); // Clear after saving
  };

  const handleModeChange = (mode: 'immediate' | 'queue') => {
    setLocalMode(mode);
    updateMutation.mutate({ mode });
  };

  const handleModelChange = (model: string) => {
    setLocalModel(model);
    updateMutation.mutate({ model });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-bambu-green" />
        </CardContent>
      </Card>
    );
  }

  const status = settings?.status;
  const isRunning = status?.running || false;

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Left Column - Settings */}
      <div className="space-y-6 lg:w-[480px] lg:flex-shrink-0">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-bambu-green" />
              <h2 className="text-lg font-semibold text-white">Virtual Printer</h2>
            </div>
            {status && (
              <div className={`flex items-center gap-2 text-sm ${isRunning ? 'text-green-400' : 'text-bambu-gray'}`}>
                <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                {isRunning ? 'Running' : 'Stopped'}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-bambu-gray">
            Enable a virtual printer that appears in Bambu Studio and OrcaSlicer. Files sent to this printer
            will be archived directly without printing.
          </p>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between py-3 border-t border-bambu-dark-tertiary">
            <div>
              <div className="text-white font-medium">Enable Virtual Printer</div>
              <div className="text-sm text-bambu-gray">
                {isRunning ? 'Visible as "Bambuddy" in slicer discovery' : 'Not visible to slicers'}
              </div>
            </div>
            <button
              onClick={handleToggleEnabled}
              disabled={updateMutation.isPending}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                localEnabled ? 'bg-bambu-green' : 'bg-bambu-dark-tertiary'
              } ${updateMutation.isPending ? 'opacity-50' : ''}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  localEnabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {/* Printer Model */}
          <div className="py-3 border-t border-bambu-dark-tertiary">
            <div className="text-white font-medium mb-2">Printer Model</div>
            <div className="text-sm text-bambu-gray mb-3">
              Select which printer model to emulate.
            </div>
            <div className="relative">
              <select
                value={localModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={updateMutation.isPending || isRunning}
                className="w-full bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-md px-3 py-2 text-white appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed pr-10"
              >
                {modelsData?.models && Object.entries(modelsData.models).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name} ({code})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bambu-gray pointer-events-none" />
            </div>
            {isRunning && (
              <p className="text-xs text-yellow-400 mt-2">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Disable the virtual printer to change the model
              </p>
            )}
          </div>

          {/* Access Code */}
          <div className="py-3 border-t border-bambu-dark-tertiary">
            <div className="text-white font-medium mb-2">Access Code</div>
            <div className="text-sm text-bambu-gray mb-3">
              {settings?.access_code_set ? (
                <span className="flex items-center gap-1 text-green-400">
                  <Check className="w-4 h-4" />
                  Access code is set
                </span>
              ) : (
                <span className="flex items-center gap-1 text-yellow-400">
                  <AlertTriangle className="w-4 h-4" />
                  No access code set - required to enable
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showAccessCode ? 'text' : 'password'}
                  value={localAccessCode}
                  onChange={(e) => setLocalAccessCode(e.target.value)}
                  placeholder={settings?.access_code_set ? 'Enter new code to change' : 'Enter 8-char code'}
                  maxLength={8}
                  className="w-full bg-bambu-dark-secondary border border-bambu-dark-tertiary rounded-md px-3 py-2 text-white placeholder-bambu-gray pr-10 font-mono"
                />
                <button
                  onClick={() => setShowAccessCode(!showAccessCode)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-bambu-gray hover:text-white"
                >
                  {showAccessCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                onClick={handleAccessCodeChange}
                disabled={!localAccessCode || updateMutation.isPending}
                variant="primary"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-bambu-gray mt-2">
              Must be exactly 8 characters. Used by slicers to authenticate.
              {localAccessCode && (
                <span className={localAccessCode.length === 8 ? 'text-green-400' : 'text-yellow-400'}>
                  {' '}({localAccessCode.length}/8)
                </span>
              )}
            </p>
          </div>

          {/* Archive Mode */}
          <div className="py-3 border-t border-bambu-dark-tertiary">
            <div className="text-white font-medium mb-2">Archive Mode</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleModeChange('immediate')}
                disabled={updateMutation.isPending}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  localMode === 'immediate'
                    ? 'border-bambu-green bg-bambu-green/10'
                    : 'border-bambu-dark-tertiary hover:border-bambu-gray'
                }`}
              >
                <div className="text-white font-medium">Immediate</div>
                <div className="text-xs text-bambu-gray">Archive files as soon as they are uploaded</div>
              </button>
              <button
                onClick={() => handleModeChange('queue')}
                disabled={updateMutation.isPending}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  localMode === 'queue'
                    ? 'border-bambu-green bg-bambu-green/10'
                    : 'border-bambu-dark-tertiary hover:border-bambu-gray'
                }`}
              >
                <div className="text-white font-medium">Queue for Review</div>
                <div className="text-xs text-bambu-gray">Review and tag files before archiving</div>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Right Column - Info & Status */}
      <div className="space-y-6 lg:w-[480px] lg:flex-shrink-0">
        {/* Info Card */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-bambu-gray">
                <p className="mb-2">
                  <strong className="text-white">How it works:</strong>
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Enable the virtual printer and set an access code</li>
                  <li>In Bambu Studio or OrcaSlicer, go to "Add Printer"</li>
                  <li>The "Bambuddy" printer should appear in the discovery list</li>
                  <li>Connect using the access code you set</li>
                  <li>When you "print" to Bambuddy, the 3MF file is archived instead</li>
                </ol>
                <p className="mt-3 text-yellow-400/80">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Required ports: 2021 (SSDP), 8883 (MQTT), 990 (FTP)
                </p>
                <div className="mt-2 text-xs text-bambu-gray space-y-1">
                  <p>Port 990 requires root or iptables redirect:</p>
                  <code className="block bg-bambu-dark-tertiary px-2 py-1 rounded text-[10px]">
                    sudo iptables -t nat -A PREROUTING -p tcp --dport 990 -j REDIRECT --to-port 9990
                  </code>
                  <code className="block bg-bambu-dark-tertiary px-2 py-1 rounded text-[10px]">
                    sudo iptables -t nat -A OUTPUT -o lo -p tcp --dport 990 -j REDIRECT --to-port 9990
                  </code>
                </div>
                <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
                  <strong className="text-blue-400">Docker users:</strong>{' '}
                  <span className="text-bambu-gray">
                    Host network mode is required for SSDP discovery.{' '}
                    <a
                      href="https://wiki.bambuddy.cool/features/virtual-printer/#docker-configuration"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      See Docker configuration guide →
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Details (when running) */}
        {status && isRunning && (
          <Card>
            <CardHeader>
              <h3 className="text-md font-semibold text-white">Status Details</h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-bambu-gray">Printer Name</div>
                  <div className="text-white">{status.name}</div>
                </div>
                <div>
                  <div className="text-bambu-gray">Model</div>
                  <div className="text-white">{status.model_name || status.model}</div>
                </div>
                <div>
                  <div className="text-bambu-gray">Serial Number</div>
                  <div className="text-white font-mono">{status.serial}</div>
                </div>
                <div>
                  <div className="text-bambu-gray">Mode</div>
                  <div className="text-white capitalize">{status.mode}</div>
                </div>
                <div>
                  <div className="text-bambu-gray">Pending Files</div>
                  <div className="text-white">{status.pending_files}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
