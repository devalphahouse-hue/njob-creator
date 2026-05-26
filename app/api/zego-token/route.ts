import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCipheriv } from 'crypto'

const corsHeaders = {
  'Content-Type': 'application/json',
}

/**
 * Generates a ZegoCloud Token04 — byte-for-byte igual ao da edge function
 * generate-zego-token (que funciona no client). Layout:
 *   [0,0,0,0](4) + expire_be32(4) + iv_len(2) + iv(16) + enc_len(2) + enc(N)
 * IV é uma string de 16 dígitos (ASCII) e a chave AES é o server secret INTEIRO
 * (secret de 32 chars -> AES-256-CBC), não truncado.
 */
function generateToken04(
  appId: number,
  serverSecret: string,
  userId: string,
  effectiveTimeInSeconds = 7200
): string {
  const now = Math.floor(Date.now() / 1000)
  const expire = now + effectiveTimeInSeconds

  const payload = JSON.stringify({
    app_id: appId,
    user_id: userId,
    nonce: (2147483647 * Math.random()) | 0,
    ctime: now,
    expire,
  })

  // IV: string de 16 dígitos (igual ao SDK / edge function)
  let ivStr = Math.random().toString().substring(2, 18)
  if (ivStr.length < 16) ivStr += ivStr.substring(0, 16 - ivStr.length)
  const iv = Buffer.from(ivStr, 'utf8') // 16 bytes ASCII

  // Chave = server secret inteiro. 32 chars -> AES-256, 24 -> 192, senão 128.
  const key = Buffer.from(serverSecret, 'utf8')
  const algo =
    key.length === 32 ? 'aes-256-cbc' : key.length === 24 ? 'aes-192-cbc' : 'aes-128-cbc'

  const cipher = createCipheriv(algo, key, iv)
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])

  const buf = Buffer.alloc(28 + encrypted.length)
  // bytes 0-3: zeros (já zerados pelo alloc)
  buf.writeInt32BE(expire, 4)
  buf.writeUInt16BE(iv.length, 8)
  iv.copy(buf, 10)
  buf.writeUInt16BE(encrypted.length, 26)
  encrypted.copy(buf, 28)

  return '04' + buf.toString('base64')
}

/**
 * Wraps a Token04 into a Kit Token que ZegoUIKitPrebuilt.create() aceita.
 * Formato: token04 + "#" + base64({ appID, userID, userName, roomID }).
 */
function buildKitToken(
  token04: string,
  appId: number,
  roomID: string,
  userID: string,
  userName: string
): string {
  const payload = {
    appID: appId,
    userID,
    userName: encodeURIComponent(userName),
    roomID,
  }
  return token04 + '#' + Buffer.from(JSON.stringify(payload)).toString('base64')
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user via Supabase session
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401, headers: corsHeaders }
      )
    }

    // 2. Parse request body
    const { roomID, userID, userName } = await request.json()
    if (!roomID || !userID) {
      return NextResponse.json(
        { error: 'roomID e userID são obrigatórios' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 3. Verify the authenticated user matches the requested userID
    if (user.id !== userID) {
      return NextResponse.json(
        { error: 'Não autorizado: userID não corresponde' },
        { status: 403, headers: corsHeaders }
      )
    }

    // 3.1. Autorização: roomID pode ser uma videochamada (one_on_one_calls) OU
    // uma live (live_streams). Esta rota é usada pelo creator — em call ele é
    // participante; em live ele é o host (dono).
    const { data: callRow } = await supabase
      .from('one_on_one_calls')
      .select(
        'id, creator_id, user_id, status, paid_at, scheduled_start_time, scheduled_duration_minutes'
      )
      .eq('id', roomID)
      .maybeSingle()

    if (callRow) {
      if (userID !== callRow.user_id && userID !== callRow.creator_id) {
        return NextResponse.json(
          { error: 'Você não participa desta videochamada' },
          { status: 403, headers: corsHeaders }
        )
      }
      if (callRow.status !== 'paid' && callRow.status !== 'confirmed') {
        return NextResponse.json(
          { error: `Videochamada não liberada (status=${callRow.status})` },
          { status: 403, headers: corsHeaders }
        )
      }
      const POST_PAID_WINDOW_MS = 2 * 60 * 60 * 1000
      const LEGACY_GRACE_MS = 5 * 60 * 1000
      const now = Date.now()
      if (callRow.status === 'paid') {
        const paidAt = callRow.paid_at ? new Date(callRow.paid_at).getTime() : NaN
        if (!isFinite(paidAt) || now > paidAt + POST_PAID_WINDOW_MS) {
          return NextResponse.json(
            { error: 'Janela de entrada expirada' },
            { status: 403, headers: corsHeaders }
          )
        }
      } else if (callRow.status === 'confirmed' && callRow.scheduled_start_time) {
        const start = new Date(callRow.scheduled_start_time).getTime()
        const end =
          start + (callRow.scheduled_duration_minutes ?? 30) * 60 * 1000
        if (now > end + LEGACY_GRACE_MS) {
          return NextResponse.json(
            { error: 'Videochamada já encerrada' },
            { status: 403, headers: corsHeaders }
          )
        }
      }
    } else {
      // Live: o creator só pode hostear a própria live.
      const { data: liveRow } = await supabase
        .from('live_streams')
        .select('id, creator_id, status')
        .eq('id', roomID)
        .maybeSingle()

      if (!liveRow) {
        return NextResponse.json(
          { error: 'Sala não encontrada' },
          { status: 403, headers: corsHeaders }
        )
      }
      if (liveRow.creator_id !== userID) {
        return NextResponse.json(
          { error: 'Você não é o host desta live' },
          { status: 403, headers: corsHeaders }
        )
      }
    }

    // 4. Get ZegoCloud credentials from server env
    const appId = Number(process.env.ZEGO_APP_ID)
    const serverSecret = process.env.ZEGO_SERVER_SECRET?.trim()
    if (!appId || !serverSecret) {
      return NextResponse.json(
        { error: 'Credenciais ZegoCloud não configuradas no servidor' },
        { status: 500, headers: corsHeaders }
      )
    }

    // 5. Generate Token04 and wrap into Kit Token
    const token04 = generateToken04(appId, serverSecret, userID)
    const kitToken = buildKitToken(token04, appId, roomID, userID, userName || 'User')

    // 6. Return the Kit Token
    return NextResponse.json(
      { success: true, token: kitToken },
      { headers: corsHeaders }
    )
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500, headers: corsHeaders }
    )
  }
}
