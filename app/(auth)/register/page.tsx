'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import PasswordInput from '@/components/ui/PasswordInput'
import SelectField from '@/components/ui/SelectField'
import StepProgress from '@/components/ui/StepProgress'
import PageHeader from '@/components/ui/PageHeader'
import DicasFotosModal from '@/components/ui/DicasFotosModal'
import PhotoSourceSheet from '@/components/ui/PhotoSourceSheet'
import { signUp } from '@/lib/supabase/auth'
import { getCreatorInfo, createStripeAccount } from '@/lib/supabase/creator'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/app-store'
import { useTranslation, type TranslationKey } from '@/lib/i18n'
import { LEGAL_VERSION } from '@/lib/legal/documents'

// Slots that the photo-source sheet (camera/gallery) can fill.
type PhotoTarget =
  | 'profile'
  | 'banner'
  | 'selfie'
  | 'docFront'
  | 'docBack'
  | 'additional-0'
  | 'additional-1'
  | 'additional-2'

// ─── Currency helpers ────────────────────────────────────────────

function formatCurrency(value: string): string {
  const num = value.replace(/\D/g, '')
  if (!num) return ''
  const parsed = parseInt(num, 10) / 100
  return parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

// ─── Phone mask ──────────────────────────────────────────────────

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}

// ─── CPF mask ────────────────────────────────────────────────────

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

// ─── Constants ──────────────────────────────────────────────────

const TOTAL_STEPS = 5

/** Helper: cria options com value fixo e label traduzido */
function opts(t: (k: TranslationKey) => string, items: { value: string; labelKey: TranslationKey }[]) {
  return items.map(({ value, labelKey }) => ({ value, label: t(labelKey) }))
}

function getGenderOptions(t: (k: TranslationKey) => string) {
  return opts(t, [
    { value: 'Masculino', labelKey: 'register.genderMale' },
    { value: 'Feminino', labelKey: 'register.genderFemale' },
    { value: 'Não-binário', labelKey: 'register.genderNonBinary' },
    { value: 'Gênero fluido', labelKey: 'register.genderFluid' },
    { value: 'Prefiro não dizer', labelKey: 'register.genderPreferNotSay' },
  ])
}

function getSexualityOptions(t: (k: TranslationKey) => string) {
  return opts(t, [
    { value: 'Heterossexual', labelKey: 'register.sexHetero' },
    { value: 'Homossexual', labelKey: 'register.sexHomo' },
    { value: 'Bissexual', labelKey: 'register.sexBi' },
    { value: 'Pansexual', labelKey: 'register.sexPan' },
    { value: 'Assexual', labelKey: 'register.sexAce' },
    { value: 'Prefiro não dizer', labelKey: 'register.sexPreferNotSay' },
  ])
}

function getLanguageOptions(t: (k: TranslationKey) => string) {
  return opts(t, [
    { value: 'Português', labelKey: 'register.langPt' },
    { value: 'Inglês', labelKey: 'register.langEn' },
    { value: 'Espanhol', labelKey: 'register.langEs' },
  ])
}

function getEuSouOptions(t: (k: TranslationKey) => string) {
  return opts(t, [
    { value: 'Creator', labelKey: 'register.euSouCreator' },
    { value: 'Influencer', labelKey: 'register.euSouInfluencer' },
    { value: 'Artista', labelKey: 'register.euSouArtist' },
    { value: 'Streamer', labelKey: 'register.euSouStreamer' },
    { value: 'Modelo', labelKey: 'register.euSouModel' },
  ])
}

function getPorOptions(t: (k: TranslationKey) => string) {
  return opts(t, [
    { value: 'conteúdo exclusivo', labelKey: 'register.porExclusiveContent' },
    { value: 'lives interativas', labelKey: 'register.porInteractiveLives' },
    { value: 'videochamadas', labelKey: 'register.porVideoCalls' },
    { value: 'encontros', labelKey: 'register.porMeetings' },
  ])
}

function getMeConsideroOptions(t: (k: TranslationKey) => string) {
  return opts(t, [
    { value: 'divertida', labelKey: 'register.meConsideroFun' },
    { value: 'carismática', labelKey: 'register.meConsideroCharismatic' },
    { value: 'criativa', labelKey: 'register.meConsideroCreative' },
    { value: 'empolgante', labelKey: 'register.meConsideroExciting' },
    { value: 'misteriosa', labelKey: 'register.meConsideroMysterious' },
  ])
}

function getAdoroOptions(t: (k: TranslationKey) => string) {
  return opts(t, [
    { value: 'dançar', labelKey: 'register.adoroDance' },
    { value: 'cozinhar', labelKey: 'register.adoroCook' },
    { value: 'viajar', labelKey: 'register.adoroTravel' },
    { value: 'jogar', labelKey: 'register.adoroGame' },
    { value: 'ler', labelKey: 'register.adoroRead' },
  ])
}

function getPessoasQueOptions(t: (k: TranslationKey) => string) {
  return opts(t, [
    { value: 'curtem entretenimento', labelKey: 'register.pessoasEntertainment' },
    { value: 'buscam conexão', labelKey: 'register.pessoasConnection' },
    { value: 'valorizam exclusividade', labelKey: 'register.pessoasExclusivity' },
    { value: 'amam novidades', labelKey: 'register.pessoasNovelty' },
  ])
}

function getDocumentTypeOptions(t: (k: TranslationKey) => string) {
  return opts(t, [
    { value: 'CPF', labelKey: 'register.docCPF' },
    { value: 'Identidade', labelKey: 'register.docID' },
    { value: 'Passaporte', labelKey: 'register.docPassport' },
  ])
}

// ─── Form Data ──────────────────────────────────────────────────

interface FormData {
  // Step 0
  nome: string
  dataNascimento: string
  genero: string
  sexualidade: string
  cep: string
  cidade: string
  idioma: string
  email: string
  senha: string
  // Step 1
  euSou: string
  por: string
  meConsidero: string
  adoro: string
  pessoasQue: string
  // Step 2
  vendeConteudo: boolean
  fazVideochamada: boolean
  valor30min: string
  valor1hora: string
  fazEncontro: boolean
  whatsapp: string
  // Step 3 (handled via refs)
  // Step 4
  documentoTipo: string
  documentoNumero: string
}

const initialFormData: FormData = {
  nome: '', dataNascimento: '', genero: '', sexualidade: '',
  cep: '', cidade: '', idioma: 'Português', email: '', senha: '',
  euSou: '', por: '', meConsidero: '', adoro: '', pessoasQue: '',
  vendeConteudo: false, fazVideochamada: false, valor30min: '', valor1hora: '',
  fazEncontro: false, whatsapp: '',
  documentoTipo: 'CPF', documentoNumero: '',
}

// ─── Helpers ────────────────────────────────────────────────────

function formatCEP(val: string) {
  return val.replace(/\D/g, '').slice(0, 8)
}

async function fetchCidade(cep: string): Promise<string> {
  if (cep.length !== 8) return ''
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    const data = await res.json()
    if (data.erro) return ''
    return data.localidade ?? ''
  } catch {
    return ''
  }
}

// ─── Component ──────────────────────────────────────────────────

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const setCreator = useAppStore((s) => s.setCreator)

  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [loading, setLoading] = useState(false)
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [cepLoading, setCepLoading] = useState(false)
  // Controla exibição do modal de e-mail já cadastrado
  const [showEmailExistsModal, setShowEmailExistsModal] = useState(false)

  // Which image picker the photo-source sheet is targeting.
  const [photoTarget, setPhotoTarget] = useState<PhotoTarget | null>(null)

  // File state — armazena os arquivos selecionados para que sobrevivam à troca de step
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [additionalFiles, setAdditionalFiles] = useState<(File | null)[]>([null, null, null])
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [docFrontFile, setDocFrontFile] = useState<File | null>(null)
  const [docBackFile, setDocBackFile] = useState<File | null>(null)

  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [additionalPreviews, setAdditionalPreviews] = useState<(string | null)[]>([null, null, null])
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [docFrontPreview, setDocFrontPreview] = useState<string | null>(null)
  const [docBackPreview, setDocBackPreview] = useState<string | null>(null)
  const [dicasModalOpen, setDicasModalOpen] = useState(false)

  const update = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next })
  }

  // ─── CEP lookup ───────────────────────────────────────────────

  const handleCepBlur = async () => {
    if (formData.cep.length !== 8) return
    setCepLoading(true)
    const cidade = await fetchCidade(formData.cep)
    if (cidade) update('cidade', cidade)
    else toast.error(t('register.zipNotFound'))
    setCepLoading(false)
  }

  // ─── Image previews ───────────────────────────────────────────

  const handleProfileImg = (file: File) => {
    setProfileFile(file)
    setProfilePreview(URL.createObjectURL(file))
  }

  const handleAdditionalImg = (index: number, file: File) => {
    setAdditionalFiles((prev) => prev.map((f, i) => (i === index ? file : f)))
    setAdditionalPreviews((prev) => prev.map((p, i) => (i === index ? URL.createObjectURL(file) : p)))
  }

  const handleBannerImg = (file: File) => {
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  const handleSelfieImg = (file: File) => {
    setSelfieFile(file)
    setSelfiePreview(URL.createObjectURL(file))
  }

  const handleDocFrontImg = (file: File) => {
    setDocFrontFile(file)
    setDocFrontPreview(URL.createObjectURL(file))
  }

  const handleDocBackImg = (file: File) => {
    setDocBackFile(file)
    setDocBackPreview(URL.createObjectURL(file))
  }

  // Routes the picked file from the photo-source sheet to the right slot.
  const handlePickPhoto = (files: File[]) => {
    const file = files[0]
    if (!file || photoTarget === null) return
    switch (photoTarget) {
      case 'profile': handleProfileImg(file); break
      case 'banner': handleBannerImg(file); break
      case 'selfie': handleSelfieImg(file); break
      case 'docFront': handleDocFrontImg(file); break
      case 'docBack': handleDocBackImg(file); break
      case 'additional-0': handleAdditionalImg(0, file); break
      case 'additional-1': handleAdditionalImg(1, file); break
      case 'additional-2': handleAdditionalImg(2, file); break
    }
  }

  // Front camera makes sense for the selfie and the main profile photo.
  const sheetCapture = photoTarget === 'selfie' || photoTarget === 'profile' ? 'user' : 'environment'

  // ─── Step validation ──────────────────────────────────────────

  const validateStep = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (step === 0) {
      if (!formData.nome) newErrors.nome = t('register.nameRequired')
      if (!formData.dataNascimento) newErrors.dataNascimento = t('register.dateRequired')
      if (!formData.genero) newErrors.genero = t('register.genderRequired')
      if (!formData.sexualidade) newErrors.sexualidade = t('register.sexualityRequired')
      if (!formData.cep) newErrors.cep = t('register.zipRequired')
      else if (formData.cep.replace(/\D/g, '').length !== 8) newErrors.cep = t('register.zipNotFound')
      if (!formData.cidade) newErrors.cidade = t('register.cityRequired')
      if (!formData.email) newErrors.email = t('auth.emailRequired')
      if (!formData.senha) newErrors.senha = t('auth.passwordRequired')
      else if (formData.senha.length < 12) newErrors.senha = t('register.passwordMinLength')
      else if (!/[a-z]/.test(formData.senha)) newErrors.senha = t('register.passwordNeedLowercase')
      else if (!/[A-Z]/.test(formData.senha)) newErrors.senha = t('register.passwordNeedUppercase')
      else if (!/[0-9]/.test(formData.senha)) newErrors.senha = t('register.passwordNeedNumber')
    }

    if (step === 2) {
      if (formData.fazVideochamada) {
        const v30 = parseCurrency(formData.valor30min)
        const v1h = parseCurrency(formData.valor1hora)
        if (v30 <= 0) newErrors.valor30min = t('register.minValue')
        if (v1h <= 0) newErrors.valor1hora = t('register.minValue')
      }
    }

    if (step === 3) {
      if (!profileFile) {
        toast.error(t('register.photoRequired'))
        return false
      }
    }

    if (step === 4) {
      if (!formData.documentoNumero) newErrors.documentoNumero = t('register.documentRequired')
      if (!selfieFile) {
        toast.error(t('register.selfieRequired'))
        return false
      }
      if (!docFrontFile) {
        toast.error(t('register.docFrontRequired'))
        return false
      }
      if (!docBackFile) {
        toast.error(t('register.docBackRequired'))
        return false
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = async () => {
    if (!validateStep()) return

    // No step 0, verifica se o email já existe antes de avançar
    if (step === 0) {
      setLoading(true)
      try {
        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('check_email_exists', {
          email_input: formData.email.toLowerCase(),
        })

        if (error) {
          // RPC indisponível: registramos no console mas NÃO bloqueamos o
          // cadastro — o signUp final do supabase rejeita e-mail duplicado
          // de qualquer jeito (com mensagem traduzida no catch do submit).
          console.error('[register] check_email_exists falhou:', error.message)
        } else if (data === true) {
          setErrors((prev) => ({ ...prev, email: t('auth.emailAlreadyRegistered') }))
          // Exibe o modal amigável além do erro inline
          setShowEmailExistsModal(true)
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('[register] check_email_exists exception:', err)
      }
      setLoading(false)
    }

    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  }

  const prevStep = () => setStep((s) => Math.max(s - 1, 0))

  // ─── Mapear gênero do form para o enum do banco ─────────────────

  const mapGenderToEnum = (genero: string): 'Homem' | 'Mulher' | 'Não binário' | null => {
    if (genero === 'Masculino') return 'Homem'
    if (genero === 'Feminino') return 'Mulher'
    if (genero) return 'Não binário'
    return null
  }

  const calcAge = (dataNascimento: string): number => {
    if (!dataNascimento) return 0
    const birth = new Date(dataNascimento)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  // ─── Criar perfil e dados no banco após signUp ─────────────────

  const createProfileData = async (supabase: ReturnType<typeof createClient>, userId: string) => {
    // 1) Inserir/atualizar na tabela profiles (upsert para evitar conflito
    //    caso um trigger já tenha criado o registro automaticamente)
    const nowIso = new Date().toISOString()
    // Username = nome normalizado + sufixo de 6 chars do user.id. Dois creators
    // com nomes id\u00eanticos n\u00e3o colidem no UNIQUE de profiles.username.
    const baseSlug = formData.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const usernameSlug = baseSlug ? `${baseSlug}-${userId.slice(0, 6)}` : userId.slice(0, 12)
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: formData.nome,
      username: usernameSlug,
      role: 'creator' as const,
      is_active: true,
      date_birth: formData.dataNascimento || null,
      whatsapp: formData.whatsapp || null,
      terms_accepted_at: nowIso,
      terms_version: LEGAL_VERSION,
      privacy_accepted_at: nowIso,
      privacy_version: LEGAL_VERSION,
    }, { onConflict: 'id' })

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError)
      throw new Error('Erro ao criar perfil: ' + profileError.message)
    }

    // 2) Inserir na tabela creator_description (dados do step 1)
    if (formData.euSou || formData.cidade) {
      const { error: descError } = await supabase.from('creator_description').insert({
        profile_id: userId,
        cidade: formData.cidade,
        eu_sou: formData.euSou || '',
        por: formData.por || '',
        me_considero: formData.meConsidero || '',
        adoro: formData.adoro || '',
        pessoas_que: formData.pessoasQue || '',
        idade: calcAge(formData.dataNascimento),
        date_birth: formData.dataNascimento || null,
        gender: mapGenderToEnum(formData.genero),
      })

      if (descError) {
        console.error('Erro ao criar descrição:', descError)
      }
    }

    // 3) Inserir na tabela profile_settings (dados do step 2 — interações)
    const { error: settingsError } = await supabase.from('profile_settings').insert({
      profile_id: userId,
      sell_packs: formData.vendeConteudo,
      sell_calls: formData.fazVideochamada,
      face_to_face_meeting: formData.fazEncontro,
      call_per_30_min: parseCurrency(formData.valor30min),
      call_per_1_hr: parseCurrency(formData.valor1hora),
    })

    if (settingsError) {
      console.error('Erro ao criar configurações de interação:', settingsError)
    }
  }

  // ─── Upload de imagens e salvar referências ─────────────────────

  const uploadImagesAndSave = async (supabase: ReturnType<typeof createClient>, userId: string) => {
    const ts = Date.now()
    const bucket = 'images'
    const prefix = 'profiles'

    // Foto de perfil (lê do estado, não da ref)
    if (profileFile) {
      const path = `${prefix}/${userId}/${ts}-profile-${profileFile.name}`
      const { error } = await supabase.storage.from(bucket).upload(path, profileFile, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        // Salvar como avatar no perfil
        await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', userId)
        // Salvar na tabela profile_images
        await supabase.from('profile_images').insert({
          profile_id: userId,
          image_url: urlData.publicUrl,
          highlight_image_url: true,
          index: 0,
        })
      }
    }

    // Fotos adicionais (lê do estado, não das refs)
    for (let i = 0; i < additionalFiles.length; i++) {
      const file = additionalFiles[i]
      if (file) {
        const path = `${prefix}/${userId}/${ts}-additional-${i}-${file.name}`
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
        if (!error) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
          await supabase.from('profile_images').insert({
            profile_id: userId,
            image_url: urlData.publicUrl,
            highlight_image_url: false,
            index: i + 1,
          })
        }
      }
    }

    // Banner (lê do estado, não da ref)
    if (bannerFile) {
      const path = `${prefix}/${userId}/${ts}-banner-${bannerFile.name}`
      await supabase.storage.from(bucket).upload(path, bannerFile, { upsert: true })
    }

    // Selfie de verificação
    if (selfieFile) {
      const path = `documents/${userId}/${ts}-selfie-${selfieFile.name}`
      await supabase.storage.from(bucket).upload(path, selfieFile, { upsert: true })
    }

    // Documento — Frente e Verso + salvar na tabela profile_documents
    let docFrontUrl = ''
    let docBackUrl = ''

    if (docFrontFile) {
      const path = `documents/${userId}/${ts}-doc-front-${docFrontFile.name}`
      const { error } = await supabase.storage.from(bucket).upload(path, docFrontFile, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        docFrontUrl = urlData.publicUrl
      }
    }

    if (docBackFile) {
      const path = `documents/${userId}/${ts}-doc-back-${docBackFile.name}`
      const { error } = await supabase.storage.from(bucket).upload(path, docBackFile, { upsert: true })
      if (!error) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
        docBackUrl = urlData.publicUrl
      }
    }

    // Salvar registro do documento (CPF/RG) na tabela profile_documents
    if (docFrontUrl && docBackUrl) {
      const { error: docError } = await supabase.from('profile_documents').insert({
        profile_id: userId,
        type: formData.documentoTipo,
        number: formData.documentoNumero || null,
        front_image_url: docFrontUrl,
        back_image_url: docBackUrl,
      })
      if (docError) {
        console.error('Erro ao salvar documento:', docError)
      }
    }
  }

  // ─── Final submission ──────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validateStep()) return

    if (!legalAccepted) {
      toast.error('Você precisa aceitar os Termos de Uso e a Política de Privacidade.')
      return
    }

    setLoading(true)

    await signUp(formData.email, formData.senha, formData.nome, {
      onSuccess: async () => {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) {
            toast.error(t('auth.errorAfterRegister'))
            setLoading(false)
            return
          }

          // Criar perfil e descrição no banco
          await createProfileData(supabase, user.id)

          // Upload de imagens e salvar referências
          await uploadImagesAndSave(supabase, user.id)

          // Limpar estado de guest (cookie + store)
          document.cookie = 'njob-guest=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
          useAppStore.getState().setGuest(false)

          const info = await getCreatorInfo(supabase)
          if (info) setCreator(info)

          // Create Stripe connected account and redirect to onboarding
          const stripeResult = await createStripeAccount(supabase)
          if ('completed' in stripeResult) {
            router.push('/home')
          } else if ('verifying' in stripeResult) {
            router.push('/stripe-setup')
          } else if ('url' in stripeResult) {
            router.push(`/stripe-setup?url=${encodeURIComponent(stripeResult.url)}`)
          } else {
            toast.error(`Erro ao criar conta Stripe: ${stripeResult.error}`)
            router.push('/stripe-setup')
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : t('auth.errorFinishRegister')
          toast.error(msg)
          setLoading(false)
        }
      },
      onEmailAlreadyInUse: () => {
        setStep(0)
        setErrors((prev) => ({ ...prev, email: t('auth.emailAlreadyRegistered') }))
        // Exibe o modal amigável além do erro inline
        setShowEmailExistsModal(true)
        setLoading(false)
      },
      onWeakPassword: () => {
        toast.error(t('auth.weakPassword'))
        setStep(0)
        setLoading(false)
      },
      onError: (msg) => {
        toast.error(msg)
        setLoading(false)
      },
    })
  }

  // ─── Render helpers ───────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 0:
        return <Step0 formData={formData} errors={errors} update={update} cepLoading={cepLoading} onCepBlur={handleCepBlur} formatCEP={formatCEP} t={t} />
      case 1:
        return <Step1 formData={formData} update={update} onSkip={() => setStep(2)} t={t} />
      case 2:
        return <Step2 formData={formData} update={update} errors={errors} t={t} />
      case 3:
        return (
          <Step3
            profilePreview={profilePreview}
            additionalPreviews={additionalPreviews}
            bannerPreview={bannerPreview}
            requestPhoto={setPhotoTarget}
            onOpenDicas={() => setDicasModalOpen(true)}
            t={t}
          />
        )
      case 4:
        return (
          <Step4
            formData={formData}
            errors={errors}
            update={update}
            selfiePreview={selfiePreview}
            docFrontPreview={docFrontPreview}
            docBackPreview={docBackPreview}
            requestPhoto={setPhotoTarget}
            t={t}
          />
        )
      default:
        return null
    }
  }

  const stepTitles = [
    t('register.stepPersonalData'),
    t('register.stepDescription'),
    t('register.stepInteractions'),
    t('register.stepPhotos'),
    t('register.stepDocument'),
  ]

  return (
    <>
    <div className="flex flex-col">
      {step === 0 && (
        <div className="flex justify-center mb-4">
          <Image
            src="/njob-logo.png"
            alt="NJob"
            width={140}
            height={56}
            className="object-contain"
            priority
          />
        </div>
      )}
      <PageHeader
        title={stepTitles[step]}
        showBack={step > 0}
        onBack={prevStep}
      />

      <div className="mt-6">
        <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />
      </div>

      <form onSubmit={step === TOTAL_STEPS - 1 ? handleSubmit : async (e) => { e.preventDefault(); await nextStep() }}>
        <div className="flex flex-col gap-4">
          {renderStep()}
        </div>

        <div className="flex flex-col gap-3 mt-6">
          {step === TOTAL_STEPS - 1 && (
            <label className="flex items-start gap-2 text-sm text-[var(--color-muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={legalAccepted}
                onChange={(e) => setLegalAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 accent-[var(--color-primary)]"
              />
              <span>
                Li e concordo com os{' '}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-[var(--color-primary)] underline underline-offset-2"
                >
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-[var(--color-primary)] underline underline-offset-2"
                >
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>
          )}

          {step < TOTAL_STEPS - 1 ? (
            <Button type="submit" variant="primary" size="lg" fullWidth loading={step === 0 && loading}>
              {t('register.nextStep')}
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={!legalAccepted}
            >
              {t('common.confirm')}
            </Button>
          )}

          {step === 0 && (
            <p className="text-center text-sm text-[var(--color-muted)]">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link
                href="/login"
                className="font-medium text-[var(--color-primary)] transition-opacity hover:opacity-70"
              >
                {t('auth.doLogin')}
              </Link>
            </p>
          )}
        </div>
      </form>
    </div>
    {dicasModalOpen && <DicasFotosModal onClose={() => setDicasModalOpen(false)} />}

    <PhotoSourceSheet
      open={photoTarget !== null}
      onClose={() => setPhotoTarget(null)}
      onPick={handlePickPhoto}
      capture={sheetCapture}
    />

    {/* Modal: e-mail já cadastrado */}
    {showEmailExistsModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="creator-email-exists-title"
      >
        <div
          className="w-full max-w-sm rounded-2xl p-6 flex flex-col items-center gap-4"
          style={{
            background: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}
        >
          {/* Ícone de alerta de e-mail */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--color-primary)' }}
              aria-hidden="true"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          {/* Título */}
          <h2
            id="creator-email-exists-title"
            className="text-lg font-bold text-center leading-tight"
            style={{ color: 'var(--color-foreground)' }}
          >
            {t('auth.emailExistsModal.title')}
          </h2>

          {/* Mensagem */}
          <p
            className="text-sm text-center leading-relaxed"
            style={{ color: 'var(--color-muted)' }}
          >
            {t('auth.emailExistsModal.message')}
          </p>

          {/* Ações */}
          <div className="flex flex-col gap-3 w-full mt-1">
            {/* Botão primário: ir para login */}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full h-11 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98]"
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                boxShadow: '0 0 20px color-mix(in srgb, var(--color-primary) 35%, transparent)',
              }}
            >
              {t('auth.emailExistsModal.goToLogin')}
            </button>

            {/* Botão secundário: fechar e tentar outro e-mail */}
            <button
              type="button"
              onClick={() => setShowEmailExistsModal(false)}
              className="w-full h-11 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98]"
              style={{
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
                background: 'transparent',
              }}
            >
              {t('auth.emailExistsModal.tryOtherEmail')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ─── Tipo helper para t ──────────────────────────────────────
type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string

// ─── Step 0 — Dados pessoais ───────────────────────────────────

function Step0({
  formData, errors, update, cepLoading, onCepBlur, formatCEP, t,
}: {
  formData: FormData
  errors: Partial<Record<keyof FormData, string>>
  update: (field: keyof FormData, value: string | boolean) => void
  cepLoading: boolean
  onCepBlur: () => void
  formatCEP: (v: string) => string
  t: TFn
}) {
  return (
    <>
      <Input
        label={t('register.fullName')}
        placeholder={t('register.fullNamePlaceholder')}
        value={formData.nome}
        onChange={(e) => update('nome', e.target.value)}
        error={errors.nome}
        required
      />
      <Input
        label={t('register.birthDate')}
        type="date"
        value={formData.dataNascimento}
        onChange={(e) => update('dataNascimento', e.target.value)}
        error={errors.dataNascimento}
        required
      />
      <SelectField
        label={t('register.gender')}
        options={getGenderOptions(t)}
        value={formData.genero}
        onChange={(e) => update('genero', e.target.value)}
        error={errors.genero}
        placeholder={t('common.select')}
        required
      />
      <SelectField
        label={t('register.sexuality')}
        options={getSexualityOptions(t)}
        value={formData.sexualidade}
        onChange={(e) => update('sexualidade', e.target.value)}
        error={errors.sexualidade}
        placeholder={t('common.select')}
        required
      />
      <Input
        label={t('register.zipCode')}
        placeholder={t('register.zipCodePlaceholder')}
        value={formData.cep}
        onChange={(e) => update('cep', formatCEP(e.target.value))}
        onBlur={onCepBlur}
        error={errors.cep}
        inputMode="numeric"
        hint={cepLoading ? t('register.searchingCity') : undefined}
        required
      />
      <Input
        label={t('register.city')}
        placeholder={t('register.cityPlaceholder')}
        value={formData.cidade}
        onChange={(e) => update('cidade', e.target.value)}
        error={errors.cidade}
        readOnly={cepLoading}
        required
      />
      <SelectField
        label={t('register.language')}
        options={getLanguageOptions(t)}
        value={formData.idioma}
        onChange={(e) => update('idioma', e.target.value)}
        required
      />
      <Input
        label={t('auth.email')}
        type="email"
        placeholder={t('auth.emailPlaceholder')}
        value={formData.email}
        onChange={(e) => update('email', e.target.value)}
        error={errors.email}
        autoComplete="email"
        required
      />
      <PasswordInput
        label={t('auth.password')}
        placeholder={t('register.passwordPlaceholder')}
        hint={t('register.passwordRequirements')}
        value={formData.senha}
        onChange={(e) => update('senha', e.target.value)}
        error={errors.senha}
        autoComplete="new-password"
        required
      />
    </>
  )
}

// ─── Step 1 — Descrição ───────────────────────────────────────

function Step1({
  formData, update, onSkip, t,
}: {
  formData: FormData
  update: (field: keyof FormData, value: string | boolean) => void
  onSkip: () => void
  t: TFn
}) {
  return (
    <>
      <p className="text-sm mb-2 text-[var(--color-muted)]">
        {t('register.completePhrase')}
      </p>
      <div className="rounded-xl p-4 text-sm space-y-3 bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-foreground)]">
        <p>
          {t('register.iAm')}{' '}
          <span className="font-medium text-[var(--color-primary)]">
            {formData.nome || t('register.yourName')}
          </span>
          , {t('register.liveIn')}{' '}
          <span className="font-medium text-[var(--color-primary)]">
            {formData.cidade || t('register.yourCity')}
          </span>{' '}
          {t('register.andIAm')}{' '}
          <span className="text-[var(--color-primary)]">{formData.euSou || '___'}</span>{' '}
          {t('register.for')}{' '}
          <span className="text-[var(--color-primary)]">{formData.por || '___'}</span>.{' '}
          {t('register.iConsiderMyself')}{' '}
          <span className="text-[var(--color-primary)]">{formData.meConsidero || '___'}</span>,{' '}
          <span className="text-[var(--color-primary)]">{formData.pessoasQue || '___'}</span>{' '}
          {t('register.whoLoves')}{' '}
          <span className="text-[var(--color-primary)]">{formData.adoro || '___'}</span>.
        </p>
      </div>

      <SelectField
        label={t('register.selectLabelIAm')}
        options={getEuSouOptions(t)}
        value={formData.euSou}
        onChange={(e) => update('euSou', e.target.value)}
        placeholder={t('common.select')}
      />
      <SelectField
        label={t('register.selectLabelFor')}
        options={getPorOptions(t)}
        value={formData.por}
        onChange={(e) => update('por', e.target.value)}
        placeholder={t('common.select')}
      />
      <SelectField
        label={t('register.selectLabelIConsider')}
        options={getMeConsideroOptions(t)}
        value={formData.meConsidero}
        onChange={(e) => update('meConsidero', e.target.value)}
        placeholder={t('common.select')}
      />
      <SelectField
        label={t('register.selectLabelWhoLoves')}
        options={getAdoroOptions(t)}
        value={formData.adoro}
        onChange={(e) => update('adoro', e.target.value)}
        placeholder={t('common.select')}
      />
      <SelectField
        label={t('register.selectLabelPeopleWho')}
        options={getPessoasQueOptions(t)}
        value={formData.pessoasQue}
        onChange={(e) => update('pessoasQue', e.target.value)}
        placeholder={t('common.select')}
      />

      <button
        type="button"
        onClick={onSkip}
        className="text-sm font-medium text-center text-[var(--color-muted)] transition-opacity hover:opacity-70"
      >
        {t('register.skipStep')}
      </button>
    </>
  )
}

// ─── Step 2 — Interações ──────────────────────────────────────

function Step2({
  formData, update, errors, t,
}: {
  formData: FormData
  update: (field: keyof FormData, value: string | boolean) => void
  errors: Partial<Record<keyof FormData, string>>
  t: TFn
}) {
  return (
    <>
      <p className="text-sm mb-2 text-[var(--color-muted)]">
        {t('register.defineOffers')}
      </p>

      <ToggleRow
        label={t('register.sellsContent')}
        checked={formData.vendeConteudo}
        onChange={(v) => update('vendeConteudo', v)}
      />

      <ToggleRow
        label={t('register.doesVideoCall')}
        checked={formData.fazVideochamada}
        onChange={(v) => update('fazVideochamada', v)}
      />

      {formData.fazVideochamada && (
        <>
          <Input
            label={t('register.value30min')}
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={formData.valor30min ? `R$ ${formData.valor30min}` : ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/^R\$\s?/, '')
              update('valor30min', formatCurrency(raw))
            }}
            error={errors.valor30min}
          />
          <Input
            label={t('register.value1hour')}
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={formData.valor1hora ? `R$ ${formData.valor1hora}` : ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/^R\$\s?/, '')
              update('valor1hora', formatCurrency(raw))
            }}
            error={errors.valor1hora}
          />
        </>
      )}

      <ToggleRow
        label={t('register.doesMeeting')}
        checked={formData.fazEncontro}
        onChange={(v) => update('fazEncontro', v)}
      />

      {formData.fazEncontro && (
        <Input
          label="WhatsApp"
          placeholder="(11) 9 9999-9999"
          value={formData.whatsapp}
          onChange={(e) => update('whatsapp', formatPhone(e.target.value))}
          inputMode="numeric"
          maxLength={16}
        />
      )}
    </>
  )
}

function ToggleRow({
  label, checked, onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)]">
      <span className="text-sm font-medium text-[var(--color-foreground)]">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

// ─── Step 3 — Fotos ────────────────────────────────────────────

function Step3({
  profilePreview, additionalPreviews, bannerPreview,
  requestPhoto, onOpenDicas, t,
}: {
  profilePreview: string | null
  additionalPreviews: (string | null)[]
  bannerPreview: string | null
  requestPhoto: (target: PhotoTarget) => void
  onOpenDicas?: () => void
  t: TFn
}) {
  return (
    <>
      <p className="text-sm mb-2 text-[var(--color-muted)]">
        {t('register.addPhotosDesc')}
        {onOpenDicas && (
          <button type="button" onClick={onOpenDicas} className="ml-1 underline text-[var(--color-primary)]">{t('register.viewPhotoTips')}</button>
        )}
      </p>

      {/* Profile photo */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[var(--color-foreground)]">
          {t('register.profilePhoto')} <span className="text-[var(--color-primary)]">*</span>
        </label>
        <ImageUploadBox
          preview={profilePreview}
          onClick={() => requestPhoto('profile')}
          label={t('register.mainPhoto')}
        />
      </div>

      {/* Additional photos */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[var(--color-foreground)]">
          {t('register.additionalPhotos')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {additionalPreviews.map((preview, i) => (
            <div key={i}>
              <ImageUploadBox
                preview={preview}
                onClick={() => requestPhoto(`additional-${i}` as PhotoTarget)}
                label={`Foto ${i + 2}`}
                compact
              />
            </div>
          ))}
        </div>
      </div>

      {/* Banner photo */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[var(--color-foreground)]">
          {t('register.coverPhoto')}
        </label>
        <ImageUploadBox
          preview={bannerPreview}
          onClick={() => requestPhoto('banner')}
          label={t('register.coverPhoto')}
          banner
        />
      </div>

      {onOpenDicas && (
        <button type="button" onClick={onOpenDicas} className="rounded-xl p-3 text-xs w-full text-left bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-primary)]">
          {t('register.photoTipsBtn')}
        </button>
      )}
    </>
  )
}

function ImageUploadBox({
  preview, onClick, label, compact = false, banner = false,
}: {
  preview: string | null
  onClick: () => void
  label: string
  compact?: boolean
  banner?: boolean
}) {
  const height = banner ? 'h-32' : compact ? 'h-24' : 'h-40'

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        `w-full ${height} rounded-xl flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80`,
        preview ? 'bg-transparent border-2 border-dashed border-[var(--color-primary)]' : 'bg-[var(--color-surface)] border-2 border-dashed border-[var(--color-border)]',
      ].join(' ')}
    >
      {preview ? (
        <img src={preview} alt={label} className="w-full h-full object-cover rounded-xl" />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-[var(--color-muted)]">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          {!compact && (
            <span className="text-xs text-[var(--color-muted)]">
              {label}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ─── Step 4 — Documento ───────────────────────────────────────

function Step4({
  formData, errors, update,
  selfiePreview, docFrontPreview, docBackPreview,
  requestPhoto, t,
}: {
  formData: FormData
  errors: Partial<Record<keyof FormData, string>>
  update: (field: keyof FormData, value: string | boolean) => void
  selfiePreview: string | null
  docFrontPreview: string | null
  docBackPreview: string | null
  requestPhoto: (target: PhotoTarget) => void
  t: TFn
}) {
  const placeholder = formData.documentoTipo === 'Passaporte' ? 'AA1234567' : '000.000.000-00'

  return (
    <>
      <SelectField
        label={t('register.documentType')}
        options={getDocumentTypeOptions(t)}
        value={formData.documentoTipo}
        onChange={(e) => {
          update('documentoTipo', e.target.value)
          update('documentoNumero', '')
        }}
        required
      />
      <Input
        label={formData.documentoTipo}
        placeholder={placeholder}
        value={formData.documentoNumero}
        onChange={(e) => {
          const val = formData.documentoTipo === 'CPF'
            ? formatCPF(e.target.value)
            : e.target.value
          update('documentoNumero', val)
        }}
        inputMode={formData.documentoTipo === 'CPF' ? 'numeric' : undefined}
        maxLength={formData.documentoTipo === 'CPF' ? 14 : undefined}
        error={errors.documentoNumero}
        required
      />

      {/* Foto de perfil (selfie) */}
      <div className="flex flex-col gap-2 mt-4">
        <label className="text-sm font-medium text-[var(--color-foreground)]">
          {t('register.selfiePhoto')} <span className="text-[var(--color-primary)]">*</span>
        </label>
        <p className="text-xs text-[var(--color-muted)]">
          {t('register.selfiePhotoDesc')}
        </p>
        <ImageUploadBox
          preview={selfiePreview}
          onClick={() => requestPhoto('selfie')}
          label={t('register.selfiePhoto')}
        />
      </div>

      {/* Fotos do documento (frente e verso) */}
      <div className="flex flex-col gap-2 mt-4">
        <label className="text-sm font-medium text-[var(--color-foreground)]">
          {t('register.docPhotoFront')} / {t('register.docPhotoBack')} <span className="text-[var(--color-primary)]">*</span>
        </label>
        <p className="text-xs text-[var(--color-muted)]">
          {t('register.docPhotosDesc')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              {t('register.docPhotoFront')}
            </span>
            <ImageUploadBox
              preview={docFrontPreview}
              onClick={() => requestPhoto('docFront')}
              label={t('register.docPhotoFront')}
              compact
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              {t('register.docPhotoBack')}
            </span>
            <ImageUploadBox
              preview={docBackPreview}
              onClick={() => requestPhoto('docBack')}
              label={t('register.docPhotoBack')}
              compact
            />
          </div>
        </div>
      </div>
    </>
  )
}
