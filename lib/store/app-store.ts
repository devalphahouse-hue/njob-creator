import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CreatorData, LoginData } from '@/lib/types/database'
import type { Locale } from '@/lib/i18n'

// ─────────────────────────────────────────────────────────────────
// App Store — replaces Flutter's FFAppState
// ─────────────────────────────────────────────────────────────────

interface AppState {
  // Creator profile (loaded after login)
  creator: CreatorData | null

  // Login form state (persisted for "remember me")
  login: LoginData

  // Guest mode — user browsing without an account
  isGuest: boolean

  // i18n — persisted
  locale: Locale

  // Actions
  setCreator: (data: CreatorData) => void
  clearCreator: () => void
  setLogin: (data: Partial<LoginData>) => void
  clearLogin: () => void
  setGuest: (value: boolean) => void
  setLocale: (locale: Locale) => void
}

const defaultLogin: LoginData = {
  email: '',
  password: '',
  remember: false,
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      creator: null,
      login: defaultLogin,
      isGuest: false,
      locale: 'pt',

      setCreator: (data) => set({ creator: data }),
      clearCreator: () => set({ creator: null }),

      setLogin: (data) =>
        set((state) => ({ login: { ...state.login, ...data } })),
      clearLogin: () => set({ login: defaultLogin }),
      setGuest: (value) => set({ isGuest: value }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'njob-app-state',
      // Always persist locale; persist login only if remember is checked
      partialize: (state) => ({
        locale: state.locale,
        ...(state.login.remember
          ? { login: { email: state.login.email, password: '', remember: true } }
          : {}),
      }),
    }
  )
)

// ─── Selector helpers ──────────────────────────────────────────────

export const useCreator = () => useAppStore((s) => s.creator)
export const useLogin = () => useAppStore((s) => s.login)
export const useIsGuest = () => useAppStore((s) => s.isGuest)
export const useLocale = () => useAppStore((s) => s.locale)
