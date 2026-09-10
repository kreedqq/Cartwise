export const MAINTENANCE_ART_SRC = "/maintenance-pause-4k.jpg";
export const MAINTENANCE_ART_WIDTH = 3840;
export const MAINTENANCE_ART_HEIGHT = 2160;
export const MAINTENANCE_ART_AR = MAINTENANCE_ART_WIDTH / MAINTENANCE_ART_HEIGHT;

export const MAINTENANCE_MOBILE_ART_SRC = "/maintenance-pause-mobile.jpg";
export const MAINTENANCE_MOBILE_ART_WIDTH = 576;
export const MAINTENANCE_MOBILE_ART_HEIGHT = 1024;
export const MAINTENANCE_MOBILE_ART_AR = MAINTENANCE_MOBILE_ART_WIDTH / MAINTENANCE_MOBILE_ART_HEIGHT;
export const MAINTENANCE_MOBILE_MAX_WIDTH = 768;

export interface MaintenanceArtLayout {
  src: string;
  ambienceSrc: string;
  backgroundSize: string;
  backgroundPosition: string;
  useAmbience: boolean;
  visibleWidthFraction: number;
  visibleHeightFraction: number;
  mode: "contain" | "mobile";
}

export function maintenanceArtLayout(viewportWidth: number, viewportHeight: number): MaintenanceArtLayout {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);

  if (width < MAINTENANCE_MOBILE_MAX_WIDTH) {
    const drawnHeight = width / MAINTENANCE_MOBILE_ART_AR;
    return {
      src: MAINTENANCE_MOBILE_ART_SRC,
      ambienceSrc: MAINTENANCE_MOBILE_ART_SRC,
      backgroundSize: "100% auto",
      backgroundPosition: "center center",
      useAmbience: drawnHeight < height - 4,
      visibleWidthFraction: 1,
      visibleHeightFraction: 1,
      mode: "mobile",
    };
  }

  const viewportAr = width / height;
  const fitToHeight = viewportAr > MAINTENANCE_ART_AR;
  const drawnWidth = fitToHeight ? height * MAINTENANCE_ART_AR : width;
  const drawnHeight = drawnWidth / MAINTENANCE_ART_AR;

  return {
    src: MAINTENANCE_ART_SRC,
    ambienceSrc: "/maintenance-pause.jpg",
    backgroundSize: fitToHeight ? "auto 100%" : "100% auto",
    backgroundPosition: "center center",
    useAmbience: drawnWidth < width - 4 || drawnHeight < height - 4,
    visibleWidthFraction: 1,
    visibleHeightFraction: 1,
    mode: "contain",
  };
}
