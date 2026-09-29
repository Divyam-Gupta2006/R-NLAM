/** Map types and colours, kept free of Leaflet so server-rendered pages can import them. */
import type { ParcelStage } from '@/lib/api/types';

export interface ParcelFeature {
  type: 'Feature';
  id: string;
  geometry: GeoJSON.Geometry;
  properties: {
    id: string;
    parcelNumber: string;
    surveyNumber: string;
    villageName: string;
    districtName: string;
    totalAreaHa: number;
    stage: ParcelStage;
    displayOwnerName: string;
    [k: string]: unknown;
  };
}

export interface OverlayLayer {
  name: string;
  color: string;
  data: GeoJSON.FeatureCollection;
  dashed?: boolean;
  /** Popup HTML for a feature of this layer. */
  describe?: (props: Record<string, unknown>) => string;
}

export const STAGE_COLORS: Record<string, string> = {
  IDENTIFIED: '#94a3b8',
  PRELIM_NOTIFIED: '#0ea5e9',
  DECLARED: '#6366f1',
  AWARDED: '#e87722',
  COMPENSATION_PAID: '#16a34a',
  POSSESSION_TAKEN: '#15803d',
  HANDED_OVER: '#0f5132',
  LAPSED: '#be123c',
  WITHDRAWN: '#64748b',
};
