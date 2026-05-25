export default function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.45), transparent 45%), linear-gradient(180deg, #b6e3ff 0%, #a7d7f7 48%, #c9efb3 100%)",
        color: "#1f2d22",
        fontFamily: '"Nunito", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
        textAlign: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          maxWidth: 540,
          background: "rgba(255, 255, 255, 0.82)",
          border: "3px solid #2f8a4e",
          borderRadius: 24,
          boxShadow: "0 18px 60px rgba(31, 70, 38, 0.25)",
          padding: "32px 28px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "clamp(34px, 6vw, 56px)", color: "#1f6b35" }}>
          Página não encontrada
        </h1>
        <p style={{ margin: "16px 0 0", fontSize: "clamp(16px, 2.2vw, 18px)", lineHeight: 1.6 }}>
          O caminho solicitado não existe. Volte para o menu inicial e tente novamente.
        </p>
      </section>
    </main>
  );
}
