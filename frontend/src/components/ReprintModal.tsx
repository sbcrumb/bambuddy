import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Printer, Loader2, AlertTriangle, Check, Circle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { Card, CardContent } from './Card';
import { Button } from './Button';

interface ReprintModalProps {
  archiveId: number;
  archiveName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReprintModal({ archiveId, archiveName, onClose, onSuccess }: ReprintModalProps) {
  const queryClient = useQueryClient();
  const [selectedPrinter, setSelectedPrinter] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { data: printers, isLoading: loadingPrinters } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters,
  });

  // Fetch filament requirements from the archived 3MF
  const { data: filamentReqs } = useQuery({
    queryKey: ['archive-filaments', archiveId],
    queryFn: () => api.getArchiveFilamentRequirements(archiveId),
  });

  // Fetch printer status when a printer is selected
  const { data: printerStatus } = useQuery({
    queryKey: ['printer-status', selectedPrinter],
    queryFn: () => api.getPrinterStatus(selectedPrinter!),
    enabled: !!selectedPrinter,
  });

  const reprintMutation = useMutation({
    mutationFn: () => {
      if (!selectedPrinter) throw new Error('No printer selected');
      return api.reprintArchive(archiveId, selectedPrinter);
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const activePrinters = printers?.filter((p) => p.is_active) || [];

  // Helper to normalize color format (API returns "RRGGBBAA", 3MF uses "#RRGGBB")
  const normalizeColor = (color: string | null | undefined): string => {
    if (!color) return '#808080';
    // Remove alpha channel if present (8-char hex to 6-char)
    const hex = color.replace('#', '').substring(0, 6);
    return `#${hex}`;
  };

  // Helper to format slot label for display
  const formatSlotLabel = (amsId: number, trayId: number, isHt: boolean, isExternal: boolean): string => {
    if (isExternal) return 'External';
    const letter = String.fromCharCode(65 + (amsId >= 128 ? amsId - 128 : amsId)); // A, B, C, D
    if (isHt) return `HT-${letter}`;
    return `AMS-${letter} Slot ${trayId + 1}`;
  };

  // Build a list of all loaded filaments from printer's AMS/HT/External with location info
  const loadedFilaments = useMemo(() => {
    const filaments: Array<{
      type: string;
      color: string;
      amsId: number;
      trayId: number;
      isHt: boolean;
      isExternal: boolean;
      label: string;
    }> = [];

    // Add filaments from all AMS units (regular and HT)
    printerStatus?.ams?.forEach((amsUnit) => {
      const isHt = amsUnit.tray.length === 1; // AMS-HT has single tray
      amsUnit.tray.forEach((tray) => {
        if (tray.tray_type) {
          filaments.push({
            type: tray.tray_type,
            color: normalizeColor(tray.tray_color),
            amsId: amsUnit.id,
            trayId: tray.id,
            isHt,
            isExternal: false,
            label: formatSlotLabel(amsUnit.id, tray.id, isHt, false),
          });
        }
      });
    });

    // Add external spool if loaded
    if (printerStatus?.vt_tray?.tray_type) {
      filaments.push({
        type: printerStatus.vt_tray.tray_type,
        color: normalizeColor(printerStatus.vt_tray.tray_color),
        amsId: -1,
        trayId: 0,
        isHt: false,
        isExternal: true,
        label: 'External',
      });
    }

    return filaments;
  }, [printerStatus]);

  // Compare required filaments with loaded filaments
  // Match by filament TYPE (not slot), since the printer dynamically maps slots
  const filamentComparison = useMemo(() => {
    if (!filamentReqs?.filaments || filamentReqs.filaments.length === 0) return [];

    // Helper to normalize color for comparison (case-insensitive, strip #)
    const normalizeColorForCompare = (color: string | undefined): string => {
      if (!color) return '';
      return color.replace('#', '').toLowerCase().substring(0, 6); // Strip alpha
    };

    // Helper to check if two colors are similar (within threshold)
    const colorsAreSimilar = (color1: string | undefined, color2: string | undefined, threshold = 40): boolean => {
      const hex1 = normalizeColorForCompare(color1);
      const hex2 = normalizeColorForCompare(color2);
      if (!hex1 || !hex2 || hex1.length < 6 || hex2.length < 6) return false;

      const r1 = parseInt(hex1.substring(0, 2), 16);
      const g1 = parseInt(hex1.substring(2, 4), 16);
      const b1 = parseInt(hex1.substring(4, 6), 16);
      const r2 = parseInt(hex2.substring(0, 2), 16);
      const g2 = parseInt(hex2.substring(2, 4), 16);
      const b2 = parseInt(hex2.substring(4, 6), 16);

      // Check if each RGB component is within threshold
      return Math.abs(r1 - r2) <= threshold &&
             Math.abs(g1 - g2) <= threshold &&
             Math.abs(b1 - b2) <= threshold;
    };

    return filamentReqs.filaments.map((req) => {
      // Find a loaded filament that matches by TYPE (printer will auto-map the slot)
      // Priority: exact color match > similar color match > type-only match
      const exactMatch = loadedFilaments.find(
        (f) => f.type?.toUpperCase() === req.type?.toUpperCase() &&
               normalizeColorForCompare(f.color) === normalizeColorForCompare(req.color)
      );
      const similarMatch = !exactMatch && loadedFilaments.find(
        (f) => f.type?.toUpperCase() === req.type?.toUpperCase() &&
               colorsAreSimilar(f.color, req.color)
      );
      const typeOnlyMatch = !exactMatch && !similarMatch && loadedFilaments.find(
        (f) => f.type?.toUpperCase() === req.type?.toUpperCase()
      );
      const loaded = exactMatch || similarMatch || typeOnlyMatch || undefined;

      const hasFilament = !!loaded;
      const typeMatch = hasFilament;
      const colorMatch = !!exactMatch || !!similarMatch;

      // Status: match (type+color or similar), type_only (type ok, color very different), mismatch (type not found)
      let status: 'match' | 'type_only' | 'mismatch' | 'empty';
      if (exactMatch || similarMatch) {
        status = 'match';
      } else if (typeOnlyMatch) {
        status = 'type_only';
      } else {
        status = 'mismatch';
      }

      return {
        ...req,
        loaded,
        hasFilament,
        typeMatch,
        colorMatch,
        status,
      };
    });
  }, [filamentReqs, loadedFilaments]);

  const hasTypeMismatch = filamentComparison.some((f) => f.status === 'mismatch');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8">
      <Card className="w-full max-w-md">
        <CardContent>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Re-print</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-sm text-bambu-gray mb-4">
            Send <span className="text-white">{archiveName}</span> to a printer
          </p>

          {/* Printer selection */}
          {loadingPrinters ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-bambu-green animate-spin" />
            </div>
          ) : activePrinters.length === 0 ? (
            <div className="text-center py-8 text-bambu-gray">
              No active printers available
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              {activePrinters.map((printer) => (
                <button
                  key={printer.id}
                  onClick={() => setSelectedPrinter(printer.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedPrinter === printer.id
                      ? 'border-bambu-green bg-bambu-green/10'
                      : 'border-bambu-dark-tertiary bg-bambu-dark hover:border-bambu-gray'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      selectedPrinter === printer.id
                        ? 'bg-bambu-green/20'
                        : 'bg-bambu-dark-tertiary'
                    }`}
                  >
                    <Printer
                      className={`w-5 h-5 ${
                        selectedPrinter === printer.id
                          ? 'text-bambu-green'
                          : 'text-bambu-gray'
                      }`}
                    />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">{printer.name}</p>
                    <p className="text-xs text-bambu-gray">
                      {printer.model || 'Unknown model'} • {printer.ip_address}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Filament comparison - show when printer selected and has filament requirements */}
          {selectedPrinter && filamentComparison.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-bambu-gray">Filament Check</span>
                <button
                  onClick={async () => {
                    if (!selectedPrinter) return;
                    setIsRefreshing(true);
                    try {
                      // Request fresh data from printer via MQTT pushall command
                      await api.refreshPrinterStatus(selectedPrinter);
                      // Wait a moment for printer to respond, then refetch
                      await new Promise((r) => setTimeout(r, 500));
                      await queryClient.refetchQueries({ queryKey: ['printer-status', selectedPrinter] });
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-bambu-gray/30 hover:border-bambu-gray hover:bg-bambu-dark-tertiary transition-colors text-bambu-gray hover:text-white"
                  title="Re-read AMS status from printer"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Re-read</span>
                </button>
                {hasTypeMismatch ? (
                  <span className="text-xs text-orange-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Type not found
                  </span>
                ) : filamentComparison.some((f) => f.status === 'type_only') ? (
                  <span className="text-xs text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Color mismatch
                  </span>
                ) : (
                  <span className="text-xs text-bambu-green flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Ready
                  </span>
                )}
              </div>
              <div className="bg-bambu-dark rounded-lg p-3 space-y-2 text-xs">
                {filamentComparison.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid items-center gap-2"
                    style={{ gridTemplateColumns: '16px 1fr auto 16px 1fr 16px' }}
                  >
                    {/* Required color */}
                    <span title={`Required: ${item.color}`}>
                      <Circle
                        className="w-3 h-3 flex-shrink-0"
                        fill={item.color}
                        stroke={item.color}
                      />
                    </span>
                    {/* Required type + grams */}
                    <span className="text-white truncate">
                      {item.type} <span className="text-bambu-gray">({item.used_grams}g)</span>
                    </span>
                    {/* Arrow */}
                    <span className="text-bambu-gray">→</span>
                    {/* Loaded color */}
                    {item.loaded ? (
                      <span title={`Loaded: ${item.loaded.color}`}>
                        <Circle
                          className="w-3 h-3 flex-shrink-0"
                          fill={item.loaded.color}
                          stroke={item.loaded.color}
                        />
                      </span>
                    ) : (
                      <span />
                    )}
                    {/* Loaded type + slot */}
                    <span className={
                      item.status === 'match' ? 'text-bambu-green' :
                      item.status === 'type_only' ? 'text-yellow-400' :
                      'text-orange-400'
                    }>
                      {item.loaded ? (
                        <>{item.loaded.type} <span className="text-bambu-gray">({item.loaded.label})</span></>
                      ) : (
                        'Not loaded'
                      )}
                    </span>
                    {/* Status icon */}
                    {item.status === 'match' ? (
                      <Check className="w-3 h-3 text-bambu-green" />
                    ) : item.status === 'type_only' ? (
                      <span title="Same type, different color">
                        <AlertTriangle className="w-3 h-3 text-yellow-400" />
                      </span>
                    ) : (
                      <span title="Filament type not loaded">
                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {hasTypeMismatch && (
                <p className="text-xs text-orange-400 mt-2">
                  Required filament type not found in printer.
                </p>
              )}
            </div>
          )}

          {/* Error message */}
          {reprintMutation.isError && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-400">
              {(reprintMutation.error as Error).message || 'Failed to start print'}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={() => reprintMutation.mutate()}
              disabled={!selectedPrinter || reprintMutation.isPending}
              className="flex-1"
            >
              {reprintMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Print
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
