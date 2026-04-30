import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 30%, #F0FF80 0%, #C5E830 60%, #7FA51E 100%)",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            color: "#1A2A0A",
            fontSize: 90,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            lineHeight: 1,
          }}
        >
          FM
        </div>
      </div>
    ),
    { ...size },
  );
}
