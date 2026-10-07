// 一张简化的小票，用作主屏幕图标和浏览器标签页图标
export function IconArt() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#1d7f55",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 96,
          height: 120,
          background: "#ffffff",
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          padding: "18px 16px",
          gap: 12,
        }}
      >
        <div style={{ height: 8, width: 64, background: "#1d7f55", borderRadius: 4 }} />
        <div style={{ height: 6, width: 52, background: "#b9c9bf", borderRadius: 3 }} />
        <div style={{ height: 6, width: 58, background: "#b9c9bf", borderRadius: 3 }} />
        <div style={{ height: 6, width: 44, background: "#b9c9bf", borderRadius: 3 }} />
        <div style={{ height: 8, width: 64, background: "#1d211b", borderRadius: 4, marginTop: 4 }} />
      </div>
    </div>
  );
}
