import Sidebar from '@/components/ui/Sidebar'
import Navbar from '@/components/ui/Navbar'
import MobileAppBar from '@/components/ui/MobileAppBar'
import CreatorLoader from '@/components/CreatorLoader'
import CreatorPresenceShell from '@/components/CreatorPresenceShell'
import PullToRefresh from '@/components/ui/PullToRefresh'
import StripeGateProvider from '@/components/stripe/StripeGateProvider'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <CreatorLoader />
      <CreatorPresenceShell />
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile: top bar + drawer (hamburger) */}
        <MobileAppBar />
        {/* Mobile bottom nav (fixed) */}
        <Navbar />

        <main className="flex-1 min-h-0 flex flex-col">
          <PullToRefresh className="flex-1 p-6 pb-20 md:pb-6">
            <StripeGateProvider>
              {children}
            </StripeGateProvider>
          </PullToRefresh>
        </main>
      </div>
    </div>
  )
}
