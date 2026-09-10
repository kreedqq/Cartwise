export const MAINTENANCE_ART_SRC = "/maintenance-pause-4k.jpg";
export const MAINTENANCE_ART_WIDTH = 3840;
export const MAINTENANCE_ART_HEIGHT = 2160;
export const MAINTENANCE_ART_AR = MAINTENANCE_ART_WIDTH / MAINTENANCE_ART_HEIGHT;

export const MAINTENANCE_MOBILE_ART_SRC = "/maintenance-pause-mobile.jpg";
export const MAINTENANCE_MOBILE_ART_WIDTH = 576;
export const MAINTENANCE_MOBILE_ART_HEIGHT = 1024;
export const MAINTENANCE_MOBILE_ART_AR = MAINTENANCE_MOBILE_ART_WIDTH / MAINTENANCE_MOBILE_ART_HEIGHT;
export const MAINTENANCE_MOBILE_MAX_WIDTH = 768;

const COVER_MIN_VISIBLE = 0.85;
const WIDTH_ZOOM = 1;

export interface MaintenanceArtLayout {
  src: string;
  ambienceSrc: string;
  backgroundSize: string;
  backgroundPosition: string;
  useAmbience: boolean;
  visibleWidthFraction: number;
  visibleHeightFraction: number;
  mode: "cover" | "width" | "mobile";
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

  const coverScale = Math.max(width / MAINTENANCE_ART_WIDTH, height / MAINTENANCE_ART_HEIGHT);
  const coverVisibleWidth = width / (MAINTENANCE_ART_WIDTH * coverScale);
  const coverVisibleHeight = height / (MAINTENANCE_ART_HEIGHT * coverScale);

  if (coverVisibleWidth >= COVER_MIN_VISIBLE && coverVisibleHeight >= COVER_MIN_VISIBLE) {
    return {
      src: MAINTENANCE_ART_SRC,
      ambienceSrc: "/maintenance-pause.jpg",
      backgroundSize: "cover",
      backgroundPosition: width / height >= 2 ? "center 42%" : "center 46%",
      useAmbience: false,
      visibleWidthFraction: coverVisibleWidth,
      visibleHeightFraction: coverVisibleHeight,
      mode: "cover",
    };
  }

  const zoom = WIDTH_ZOOM;
  const drawnWidth = width * zoom;
  const drawnHeight = drawnWidth / MAINTENANCE_ART_AR;
  const viewportAr = width / height;

  return {
    src: MAINTENANCE_ART_SRC,
    ambienceSrc: "/maintenance-pause.jpg",
    backgroundSize: `${zoom * 100}% auto`,
    backgroundPosition: viewportAr < 0.55 ? "center 38%" : "center 42%",
    useAmbience: drawnHeight < height - 4,
    visibleWidthFraction: Math.min(1, width / drawnWidth),
    visibleHeightFraction: Math.min(1, height / drawnHeight),
    mode: "width",
  };
}
