"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { Building2, MapPin, Phone, CheckCircle2, XCircle } from "lucide-react";
import type { Branch } from "@/types";

const GOOGLE_MAPS_KEY = "AIzaSyDqD1Z03FoLnIGJTbpAgRvjcchrR-NiICk";
const DEFAULT_CENTER = { lat: -6.2088, lng: 106.8456 };
const MAP_STYLES = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
];

interface BranchesMapProps {
  branches: Branch[];
  focusBranchId?: string | null;
  onEdit?: (branch: Branch) => void;
}

export function BranchesMap({ branches, focusBranchId, onEdit }: BranchesMapProps) {
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: ["places"],
  });

  const branchesWithCoords = useMemo(
    () => branches.filter((b) => {
      const br = b as Branch & { latitude?: number | null; longitude?: number | null };
      return br.latitude != null && br.longitude != null;
    }),
    [branches],
  );

  const center = useMemo(() => {
    if (branchesWithCoords.length === 0) return DEFAULT_CENTER;
    const br = branchesWithCoords[0] as Branch & { latitude: number; longitude: number };
    return { lat: br.latitude, lng: br.longitude };
  }, [branchesWithCoords]);

  // Pan to focused branch
  useEffect(() => {
    if (!focusBranchId || !mapRef.current) return;
    const branch = branchesWithCoords.find((b) => b.id === focusBranchId) as (Branch & { latitude: number; longitude: number }) | undefined;
    if (!branch) return;
    mapRef.current.panTo({ lat: branch.latitude, lng: branch.longitude });
    mapRef.current.setZoom(16);
    setSelectedBranch(branches.find((b) => b.id === focusBranchId) ?? null);
  }, [focusBranchId, branchesWithCoords, branches]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    // Fit bounds to show all markers
    if (branchesWithCoords.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      branchesWithCoords.forEach((b) => {
        const br = b as Branch & { latitude: number; longitude: number };
        bounds.extend({ lat: br.latitude, lng: br.longitude });
      });
      map.fitBounds(bounds, 50);
    }
  }, [branchesWithCoords]);

  const onMapClick = useCallback(() => setSelectedBranch(null), []);

  if (!isLoaded) {
    return (
      <div className="w-full h-[300px] lg:h-[calc(100vh-220px)] rounded-xl bg-muted/30 border border-border/40 flex items-center justify-center animate-pulse">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-5 h-5" />
          <span className="text-sm">Memuat peta...</span>
        </div>
      </div>
    );
  }

  if (branchesWithCoords.length === 0) {
    return (
      <div className="w-full h-[200px] lg:h-[calc(100vh-220px)] rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-border/40 flex flex-col items-center justify-center gap-2">
        <MapPin className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Belum ada lokasi koordinat</p>
        <p className="text-xs text-muted-foreground/60">Tambahkan latitude & longitude saat edit cabang</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[300px] lg:h-[calc(100vh-220px)] rounded-xl overflow-hidden border border-border/40 shadow-sm">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={12}
        onClick={onMapClick}
        onLoad={onMapLoad}
        options={{
          styles: MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {branchesWithCoords.map((branch) => {
          const br = branch as Branch & { latitude: number; longitude: number };
          const isFocused = focusBranchId === branch.id;
          return (
            <Marker
              key={branch.id}
              position={{ lat: br.latitude, lng: br.longitude }}
              title={branch.name}
              onClick={() => setSelectedBranch(branch)}
              animation={isFocused ? google.maps.Animation.BOUNCE : undefined}
              icon={{
                path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
                fillColor: isFocused ? "#f59e0b" : branch.isActive ? "#0891b2" : "#9ca3af",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
                scale: isFocused ? 2 : 1.5,
                anchor: new google.maps.Point(12, 22),
              }}
            />
          );
        })}

        {selectedBranch && (() => {
          const br = selectedBranch as Branch & { latitude: number; longitude: number };
          if (!br.latitude || !br.longitude) return null;
          return (
            <InfoWindow
              position={{ lat: br.latitude, lng: br.longitude }}
              onCloseClick={() => setSelectedBranch(null)}
            >
              <div className="p-1 min-w-[180px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Building2 className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span className="font-semibold text-sm text-gray-900">{selectedBranch.name}</span>
                </div>
                {selectedBranch.address && (
                  <p className="text-xs text-gray-500 flex items-start gap-1.5 mb-1">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                    {selectedBranch.address}
                  </p>
                )}
                {selectedBranch.phone && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-1">
                    <Phone className="w-3 h-3 shrink-0" />
                    {selectedBranch.phone}
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-1.5">
                  {selectedBranch.isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" /> Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400">
                      <XCircle className="w-3 h-3" /> Nonaktif
                    </span>
                  )}
                </div>
                {onEdit && (
                  <button
                    type="button"
                    className="mt-2 text-[11px] text-cyan-600 hover:text-cyan-700 font-medium"
                    onClick={() => { onEdit(selectedBranch); setSelectedBranch(null); }}
                  >
                    Edit Cabang →
                  </button>
                )}
              </div>
            </InfoWindow>
          );
        })()}
      </GoogleMap>
    </div>
  );
}
