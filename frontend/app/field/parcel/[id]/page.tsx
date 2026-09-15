'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MOCK_PARCELS, Parcel } from '@/lib/mockData';
import { db } from '@/lib/db';
import { useRole } from '@/context/RoleContext';
import { useAudit } from '@/context/AuditContext';
import { Camera, MapPin, Save, WifiOff, CheckCircle2, ShieldCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function FieldParcelSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast, activeRole, currentRoleOption } = useRole();
  const { addAuditLog } = useAudit();

  const parcelId = params.id as string;
  const initialParcel = MOCK_PARCELS.find((p) => p.id === parcelId) || MOCK_PARCELS[0];

  const [lat, setLat] = useState<number>(initialParcel.coordinates[0][0]);
  const [lng, setLng] = useState<number>(initialParcel.coordinates[0][1]);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);

  // Simulate GPS Location Fix
  const handleCaptureGPS = () => {
    setIsCapturingGPS(true);
    setTimeout(() => {
      const fixedLat = initialParcel.coordinates[0][0] + (Math.random() - 0.5) * 0.002;
      const fixedLng = initialParcel.coordinates[0][1] + (Math.random() - 0.5) * 0.002;
      setLat(Number(fixedLat.toFixed(6)));
      setLng(Number(fixedLng.toFixed(6)));
      setIsCapturingGPS(false);
      showToast('GPS Satellite Fix Acquired! Accuracy ±1.2m');
    }, 1200);
  };

  // Simulate Geotagged Camera Capture
  const handleAddPhoto = () => {
    const photoId = `IMG_GEOTAG_${Date.now().toString().slice(-4)}.jpg`;
    setPhotos((prev) => [...prev, photoId]);
    showToast(`Captured geotagged photo: ${photoId}`);
  };

  // Save survey data into Dexie.js IndexedDB!
  const handleSaveOffline = async (e: React.FormEvent) => {
    e.preventDefault();

    const record = {
      id: initialParcel.id,
      project: initialParcel.projectName,
      khasraNo: initialParcel.khasraNo,
      village: initialParcel.village,
      ownerName: initialParcel.ownerName,
      areaHectares: initialParcel.areaHectares,
      landType: initialParcel.landType,
      status: 'SURVEYED' as const,
      lat,
      lng,
      photos,
      notes,
      capturedAt: new Date().toISOString(),
      surveyorId: 'Surveyor_04',
      syncStatus: 'QUEUED' as const,
    };

    // Store in Dexie IndexedDB parcel table
    await db.parcels.put(record);

    // Push into sync queue
    await db.syncQueue.put({
      id: `SYNC-${Date.now()}`,
      parcelId: initialParcel.id,
      action: 'SURVEY_SUBMIT',
      data: record,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    });

    // Write audit event
    addAuditLog(
      'FIELD_OFFLINE_CAPTURE',
      'PARCEL',
      initialParcel.id,
      `Captured ground survey offline for Khasra #${initialParcel.khasraNo} with ${photos.length} geotagged photos`,
      activeRole,
      currentRoleOption.label
    );

    setSavedLocally(true);
    showToast(`Saved Khasra #${initialParcel.khasraNo} survey to browser IndexedDB!`);
    setTimeout(() => {
      router.push('/field/sync');
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/field/assignments" className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Assignments</span>
        </Link>
        <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
          <WifiOff className="w-3.5 h-3.5" />
          <span>IndexedDB Offline Mode</span>
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              Khasra #{initialParcel.khasraNo}
            </span>
            <span className="text-xs text-slate-400">{initialParcel.village}, {initialParcel.taluka}</span>
          </div>
          <h1 className="text-lg font-bold">{initialParcel.projectName}</h1>
          <p className="text-xs text-slate-400">Landowner: <strong>{initialParcel.ownerName}</strong> ({initialParcel.areaHectares} Ha)</p>
        </div>

        <form onSubmit={handleSaveOffline} className="p-6 space-y-5 text-xs">
          {/* GPS Coordinates Capture */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-rose-600" />
                <span>GPS Centroid & Polygon Centroid</span>
              </span>
              <button
                type="button"
                onClick={handleCaptureGPS}
                disabled={isCapturingGPS}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md text-xs shadow-xs"
              >
                {isCapturingGPS ? 'Acquiring Fix...' : 'Acquire GPS Fix'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-800">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase">Latitude</label>
                <input type="text" readOnly value={lat} className="w-full p-2 bg-white border rounded font-mono font-bold" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase">Longitude</label>
                <input type="text" readOnly value={lng} className="w-full p-2 bg-white border rounded font-mono font-bold" />
              </div>
            </div>
          </div>

          {/* Photo Geotagging Simulation */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Geotagged Field Photos ({photos.length})</span>
              </span>
              <button
                type="button"
                onClick={handleAddPhoto}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md text-xs shadow-xs"
              >
                + Snap Geotag Photo
              </button>
            </div>

            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {photos.map((ph, idx) => (
                  <div key={idx} className="p-2 bg-white border rounded text-[10px] font-mono text-slate-700 space-y-1">
                    <div className="w-full h-12 bg-slate-200 rounded flex items-center justify-center text-slate-500">
                      📷 Geotagged
                    </div>
                    <span className="block truncate">{ph}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">No field photos captured yet.</p>
            )}
          </div>

          {/* Ground Surveyor Remarks */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Field Surveyor Inspection Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record boundary physical markers, structures, wells, or encumbrance notes..."
              rows={3}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs shadow-md transition-colors flex items-center justify-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Survey to Dexie.js IndexedDB</span>
          </button>
        </form>
      </div>
    </div>
  );
}
