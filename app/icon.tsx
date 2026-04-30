import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
        }}
      >
        <div
          style={{
            color: "#1A2A0A",
            fontSize: 96,
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
