import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(180deg, rgba(255,242,219,1) 0%, rgba(232,188,145,1) 100%)",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#8d2d11",
            borderRadius: 96,
            color: "white",
            display: "flex",
            fontSize: 180,
            fontWeight: 700,
            height: 360,
            justifyContent: "center",
            width: 360,
          }}
        >
          S
        </div>
      </div>
    ),
    size,
  );
}
