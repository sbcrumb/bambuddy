import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { PrinterStatus, AMSUnit } from '../../api/client';
import { Loader2 } from 'lucide-react';

interface AMSSectionDualProps {
  printerId: number;
  status: PrinterStatus | null | undefined;
  nozzleCount: number;
}

function hexToRgb(hex: string | null): string {
  if (!hex) return 'rgb(128, 128, 128)';
  const cleanHex = hex.replace('#', '').substring(0, 6);
  const r = parseInt(cleanHex.substring(0, 2), 16) || 128;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 128;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 128;
  return `rgb(${r}, ${g}, ${b})`;
}

function isLightColor(hex: string | null): boolean {
  if (!hex) return false;
  const cleanHex = hex.replace('#', '').substring(0, 6);
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

// Single humidity icon that fills based on level
// <25% = empty (dry/good)
// <40% = half filled
// >=40% = full (wet/bad)
function HumidityIcon({ humidity }: { humidity: number }) {
  const getIconSrc = (): string => {
    if (humidity < 25) return '/icons/humidity-empty.svg';
    if (humidity < 40) return '/icons/humidity-half.svg';
    return '/icons/humidity-full.svg';
  };

  return (
    <img
      src={getIconSrc()}
      alt=""
      className="w-2.5 h-[14px]"
    />
  );
}

interface AMSPanelContentProps {
  units: AMSUnit[];
  side: 'left' | 'right';
  isPrinting: boolean;
  selectedAmsIndex: number;
  onSelectAms: (index: number) => void;
  selectedTray: number | null;
  onSelectTray: (trayId: number | null) => void;
}

// Panel content - NO wiring, just slots and info
function AMSPanelContent({
  units,
  side,
  isPrinting,
  selectedAmsIndex,
  onSelectAms,
  selectedTray,
  onSelectTray,
}: AMSPanelContentProps) {
  const selectedUnit = units[selectedAmsIndex];
  const slotPrefix = side === 'left' ? 'A' : 'B';

  return (
    <div className="flex-1 min-w-0">
      {/* AMS Tab Selectors */}
      <div className="flex gap-1.5 mb-2.5 p-1.5 bg-white dark:bg-bambu-dark rounded-lg">
        {units.map((unit, index) => (
          <button
            key={unit.id}
            onClick={() => onSelectAms(index)}
            className={`flex items-center p-1.5 rounded border-2 transition-colors ${
              selectedAmsIndex === index
                ? 'border-bambu-green bg-bambu-dark-secondary'
                : 'bg-bambu-dark border-transparent hover:border-bambu-gray'
            }`}
          >
            <div className="flex gap-0.5">
              {unit.tray.map((tray) => (
                <div
                  key={tray.id}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: tray.tray_color ? hexToRgb(tray.tray_color) : '#808080',
                  }}
                />
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* AMS Content */}
      {selectedUnit && (
        <div className="bg-white dark:bg-bambu-dark-secondary rounded-[10px] p-2.5">
          {/* AMS Header - Humidity & Temp - Centered */}
          <div className="flex items-center justify-center gap-4 text-xs text-bambu-gray mb-2.5">
            {selectedUnit.humidity !== null && (
              <span className="flex items-center gap-1.5">
                <HumidityIcon humidity={selectedUnit.humidity} />
                {selectedUnit.humidity} %
              </span>
            )}
            {selectedUnit.temp !== null && (
              <span className="flex items-center gap-1.5">
                <img src="/icons/temperature.svg" alt="" className="w-3.5 icon-theme" />
                {selectedUnit.temp}°C
              </span>
            )}
          </div>

          {/* Slot Labels */}
          <div className="flex justify-center gap-2 mb-1.5">
            {selectedUnit.tray.map((tray, index) => (
              <div
                key={tray.id}
                className="w-14 flex items-center justify-center gap-0.5 text-[10px] text-bambu-gray px-1.5 py-[3px] bg-bambu-dark rounded-full border border-bambu-dark-tertiary"
              >
                {slotPrefix}{index + 1}
                <img src="/icons/reload.svg" alt="" className="w-2.5 h-2.5 icon-theme" />
              </div>
            ))}
          </div>

          {/* AMS Slots - NO wiring here */}
          <div className="flex justify-center gap-2">
            {selectedUnit.tray.map((tray) => {
              const globalTrayId = selectedUnit.id * 4 + tray.id;
              const isSelected = selectedTray === globalTrayId;
              const isEmpty = !tray.tray_type || tray.tray_type === '' || tray.tray_type === 'NONE';
              const isLight = isLightColor(tray.tray_color);

              return (
                <button
                  key={tray.id}
                  onClick={() => !isEmpty && onSelectTray(isSelected ? null : globalTrayId)}
                  disabled={isEmpty || isPrinting}
                  className={`w-14 h-[80px] rounded-md border-2 overflow-hidden transition-all bg-bambu-dark ${
                    isSelected
                      ? 'border-[#d4a84b]'
                      : 'border-bambu-dark-tertiary hover:border-bambu-gray'
                  } ${isEmpty ? 'opacity-50' : ''} disabled:cursor-not-allowed`}
                >
                  <div
                    className="w-full h-full flex flex-col items-center justify-end pb-[5px]"
                    style={{
                      backgroundColor: isEmpty ? undefined : hexToRgb(tray.tray_color),
                    }}
                  >
                    <span
                      className={`text-[11px] font-semibold mb-1 ${
                        isLight ? 'text-gray-800' : 'text-white'
                      } ${isLight ? '' : 'drop-shadow-sm'}`}
                    >
                      {isEmpty ? '--' : tray.tray_type}
                    </span>
                    {!isEmpty && (
                      <img
                        src="/icons/eye.svg"
                        alt=""
                        className={`w-3.5 h-3.5 ${isLight ? '' : 'invert'}`}
                        style={{ opacity: 0.8 }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No AMS message */}
      {units.length === 0 && (
        <div className="bg-bambu-dark-secondary rounded-[10px] p-6 text-center text-bambu-gray text-sm">
          No AMS connected to {side} nozzle
        </div>
      )}
    </div>
  );
}

// Unified wiring layer - draws ALL wiring in one place
interface WiringLayerProps {
  isDualNozzle: boolean;
}

function WiringLayer({ isDualNozzle }: WiringLayerProps) {
  if (!isDualNozzle) return null;

  // All measurements relative to this container
  // Container spans full width between panels
  // Left panel wiring: slots → hub → down → right → down to extruder
  // Right panel wiring: slots → hub → down → left → down to extruder

  return (
    <div className="relative w-full" style={{ height: '120px' }}>
      {/* SVG for all wiring - single coordinate system */}
      {/* Slots are w-14 (56px) with gap-2 (8px), 4 slots = 248px total, centered in each ~300px panel */}
      {/* Left panel center ~150, slots start at 150 - 124 = 26 */}
      {/* Slot centers: 26+28=54, 54+64=118, 118+64=182, 182+64=246 */}
      {/* Right panel center ~450, slots start at 450 - 124 = 326 */}
      {/* Slot centers: 326+28=354, 354+64=418, 418+64=482, 482+64=546 */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 600 120"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Left panel wiring */}
        {/* Vertical lines from 4 slots */}
        <line x1="54" y1="0" x2="54" y2="14" stroke="#909090" strokeWidth="2" />
        <line x1="118" y1="0" x2="118" y2="14" stroke="#909090" strokeWidth="2" />
        <line x1="182" y1="0" x2="182" y2="14" stroke="#909090" strokeWidth="2" />
        <line x1="246" y1="0" x2="246" y2="14" stroke="#909090" strokeWidth="2" />

        {/* Horizontal bar connecting left slots */}
        <line x1="54" y1="14" x2="246" y2="14" stroke="#909090" strokeWidth="2" />

        {/* Left hub */}
        <rect x="136" y="8" width="28" height="14" rx="2" fill="#c0c0c0" stroke="#909090" strokeWidth="1" />

        {/* Vertical from left hub down */}
        <line x1="150" y1="22" x2="150" y2="36" stroke="#909090" strokeWidth="2" />

        {/* Horizontal from left hub toward center */}
        <line x1="150" y1="36" x2="288" y2="36" stroke="#909090" strokeWidth="2" />

        {/* Vertical down to left extruder inlet */}
        <line x1="288" y1="36" x2="288" y2="85" stroke="#909090" strokeWidth="2" />

        {/* Right panel wiring */}
        {/* Vertical lines from 4 slots */}
        <line x1="354" y1="0" x2="354" y2="14" stroke="#909090" strokeWidth="2" />
        <line x1="418" y1="0" x2="418" y2="14" stroke="#909090" strokeWidth="2" />
        <line x1="482" y1="0" x2="482" y2="14" stroke="#909090" strokeWidth="2" />
        <line x1="546" y1="0" x2="546" y2="14" stroke="#909090" strokeWidth="2" />

        {/* Horizontal bar connecting right slots */}
        <line x1="354" y1="14" x2="546" y2="14" stroke="#909090" strokeWidth="2" />

        {/* Right hub */}
        <rect x="436" y="8" width="28" height="14" rx="2" fill="#c0c0c0" stroke="#909090" strokeWidth="1" />

        {/* Vertical from right hub down */}
        <line x1="450" y1="22" x2="450" y2="36" stroke="#909090" strokeWidth="2" />

        {/* Horizontal from right hub toward center */}
        <line x1="312" y1="36" x2="450" y2="36" stroke="#909090" strokeWidth="2" />

        {/* Vertical down to right extruder inlet */}
        <line x1="312" y1="36" x2="312" y2="85" stroke="#909090" strokeWidth="2" />
      </svg>

      {/* Extruder image - positioned at bottom center */}
      <img
        src="/icons/extruder-left-right.png"
        alt="Extruder"
        className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[50px]"
      />
    </div>
  );
}

export function AMSSectionDual({ printerId, status, nozzleCount }: AMSSectionDualProps) {
  const isConnected = status?.connected ?? false;
  const isPrinting = status?.state === 'RUNNING';
  const isDualNozzle = nozzleCount > 1;
  const amsUnits: AMSUnit[] = status?.ams ?? [];

  const leftUnits = isDualNozzle ? amsUnits.filter((_, i) => i % 2 === 0) : amsUnits;
  const rightUnits = isDualNozzle ? amsUnits.filter((_, i) => i % 2 === 1) : [];

  const [leftAmsIndex, setLeftAmsIndex] = useState(0);
  const [rightAmsIndex, setRightAmsIndex] = useState(0);
  const [selectedTray, setSelectedTray] = useState<number | null>(null);

  const loadMutation = useMutation({
    mutationFn: (trayId: number) => api.amsLoadFilament(printerId, trayId),
  });

  const unloadMutation = useMutation({
    mutationFn: () => api.amsUnloadFilament(printerId),
  });

  const handleLoad = () => {
    if (selectedTray !== null) {
      loadMutation.mutate(selectedTray);
    }
  };

  const handleUnload = () => {
    unloadMutation.mutate();
  };

  const isLoading = loadMutation.isPending || unloadMutation.isPending;

  return (
    <div className="bg-bambu-dark-tertiary rounded-[10px] p-3">
      {/* Dual Panel Layout - just the panels, no wiring */}
      <div className="flex gap-5">
        <AMSPanelContent
          units={leftUnits}
          side="left"
          isPrinting={isPrinting}
          selectedAmsIndex={leftAmsIndex}
          onSelectAms={setLeftAmsIndex}
          selectedTray={selectedTray}
          onSelectTray={setSelectedTray}
        />

        {isDualNozzle && (
          <AMSPanelContent
            units={rightUnits}
            side="right"
            isPrinting={isPrinting}
            selectedAmsIndex={rightAmsIndex}
            onSelectAms={setRightAmsIndex}
            selectedTray={selectedTray}
            onSelectTray={setSelectedTray}
          />
        )}
      </div>

      {/* Unified Wiring Layer - ALL wiring drawn here */}
      <WiringLayer isDualNozzle={isDualNozzle} />

      {/* Action Buttons Row - aligned with extruder */}
      <div className="flex items-start -mt-[50px]">
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-lg bg-bambu-dark-secondary hover:bg-bambu-dark border border-bambu-dark-tertiary flex items-center justify-center">
            <img src="/icons/ams-settings.svg" alt="Settings" className="w-5 icon-theme" />
          </button>
          <button className="px-[18px] py-2.5 rounded-lg bg-bambu-dark-secondary hover:bg-bambu-dark border border-bambu-dark-tertiary text-sm text-bambu-gray flex items-center gap-1.5">
            Auto-refill
          </button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button
            onClick={handleUnload}
            disabled={!isConnected || isPrinting || isLoading}
            className="px-7 py-2.5 rounded-lg bg-bambu-dark hover:bg-bambu-dark-secondary text-sm text-bambu-gray disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {unloadMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Unload'
            )}
          </button>
          <button
            onClick={handleLoad}
            disabled={!isConnected || isPrinting || selectedTray === null || isLoading}
            className="px-7 py-2.5 rounded-lg bg-bambu-dark hover:bg-bambu-dark-secondary text-sm text-bambu-gray disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Load'
            )}
          </button>
        </div>
      </div>

      {/* Error messages */}
      {(loadMutation.error || unloadMutation.error) && (
        <p className="mt-2 text-sm text-red-500 text-center">
          {(loadMutation.error || unloadMutation.error)?.message}
        </p>
      )}
    </div>
  );
}
