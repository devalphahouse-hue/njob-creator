export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Layout-canvas mínimo: cada página de onboarding controla a própria largura/
  // centralização (stripe-setup usa split full-bleed; subscription se auto-centra).
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {children}
    </div>
  )
}
