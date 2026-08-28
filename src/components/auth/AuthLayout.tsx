import type { ReactNode } from "react";

const BRAND_ART = "/peptix-brand.jpg";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-black">
      <div
        className="pointer-events-none fixed inset-0 h-[100dvh] w-screen bg-black bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${BRAND_ART})` }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center overflow-y-auto px-4 py-6 lg:justify-end lg:pr-[5vw]">
        <div className="flex w-full max-w-[360px] flex-col rounded-[12px] border border-[rgba(255,255,255,0.10)] bg-[rgba(8,8,8,0.88)] px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-[14px] sm:min-h-[500px] sm:w-[360px]">
          {children}
        </div>
      </div>
    </div>
  );
}
