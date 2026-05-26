'use client'

// O ZegoCloud UIKit só vem em en/zh. Traduzimos os textos visíveis via
// MutationObserver (troca o textContent de nós-folha que batem no dicionário).
// Usado em todas as salas (videochamada e live, host e espectador).

export const ZEGO_TRANSLATIONS: Record<string, Record<string, string>> = {
  pt: {
    // Live — host
    'Go Live': 'Iniciar Live',
    'Start': 'Iniciar',
    'Start Live': 'Iniciar Live',
    'End': 'Finalizar',
    'End Live': 'Finalizar Live',
    'Stop': 'Finalizar',
    'Stop broadcast': 'Finalizar transmissão',
    'Are you sure to stop broadcasting?': 'Tem certeza que deseja finalizar a transmissão?',
    'Are you sure to stop the live?': 'Tem certeza que deseja finalizar a live?',
    // Live — espectador
    'The Live has not started yet': 'A live ainda não começou',
    'The live has not started yet': 'A live ainda não começou',
    'Waiting for the host to start': 'Aguardando o apresentador iniciar',
    'The Live has ended': 'A live foi encerrada',
    'The live has ended': 'A live foi encerrada',
    'No host is online': 'O apresentador não está online',
    // Sair / sala
    'Leave': 'Sair',
    'Leave the room': 'Sair da sala',
    'Leave Room': 'Sair da sala',
    'Are you sure to leave the room?': 'Tem certeza que deseja sair da sala?',
    'The host has left the room': 'O apresentador saiu da sala',
    'You are the host': 'Você é o apresentador',
    'No one else is here': 'Ninguém mais está aqui',
    'The call has ended': 'A chamada foi encerrada',
    // Botões comuns
    'Cancel': 'Cancelar',
    'Confirm': 'Confirmar',
    'OK': 'OK',
    'Done': 'Concluído',
    'Retry': 'Tentar novamente',
    // Dispositivos / status
    'Settings': 'Configurações',
    'Camera': 'Câmera',
    'Microphone': 'Microfone',
    'Speaker': 'Alto-falante',
    'Members': 'Participantes',
    'Member': 'Participante',
    'Host': 'Apresentador',
    'Audience': 'Espectador',
    'Connecting': 'Conectando',
    'Connecting...': 'Conectando...',
    'Reconnecting': 'Reconectando',
    'Reconnecting...': 'Reconectando...',
    'Disconnected': 'Desconectado',
  },
  es: {
    'Go Live': 'Iniciar Live',
    'Start': 'Iniciar',
    'Start Live': 'Iniciar Live',
    'End': 'Finalizar',
    'End Live': 'Finalizar Live',
    'Stop': 'Finalizar',
    'Stop broadcast': 'Finalizar transmisión',
    'Are you sure to stop broadcasting?': '¿Seguro que deseas finalizar la transmisión?',
    'The Live has not started yet': 'La transmisión aún no ha comenzado',
    'The live has not started yet': 'La transmisión aún no ha comenzado',
    'The Live has ended': 'La transmisión ha finalizado',
    'Leave': 'Salir',
    'Leave the room': 'Salir de la sala',
    'Leave Room': 'Salir de la sala',
    'Are you sure to leave the room?': '¿Seguro que deseas salir de la sala?',
    'The host has left the room': 'El presentador salió de la sala',
    'You are the host': 'Eres el presentador',
    'No one else is here': 'No hay nadie más aquí',
    'Cancel': 'Cancelar',
    'Confirm': 'Confirmar',
    'OK': 'OK',
    'Settings': 'Configuración',
    'Camera': 'Cámara',
    'Microphone': 'Micrófono',
    'Speaker': 'Altavoz',
    'Members': 'Participantes',
    'Host': 'Presentador',
    'Audience': 'Espectador',
    'Connecting': 'Conectando',
    'Reconnecting': 'Reconectando',
  },
}

/**
 * Observa o container do ZegoCloud e traduz os textos para o locale dado.
 * Retorna uma função de cleanup (desliga o observer). Para locale sem
 * dicionário (ex: 'en'), não faz nada.
 */
export function observeZegoTranslation(
  container: HTMLElement,
  locale: string,
  isLiveRef?: { current: boolean },
): () => void {
  const dict = ZEGO_TRANSLATIONS[locale]
  if (!dict) return () => {}

  const goLiveLabel = dict['Go Live'] ?? 'Go Live' // "Iniciar Live"
  const endLabel = dict['End'] ?? 'End' // "Finalizar"

  const translateNode = () => {
    const els = container.querySelectorAll(
      'button, [role="button"], div, span, p, h1, h2, h3, label',
    )
    els.forEach((el) => {
      if (el.children.length > 0) return // só nós-folha
      const text = el.textContent?.trim()
      if (!text) return
      // Botão "Go Live": o SDK mantém o mesmo rótulo ao vivo (só muda a cor pra
      // vermelho). Marcamos o elemento e, enquanto isLiveRef estiver true,
      // trocamos o rótulo pra "Finalizar".
      if (text === 'Go Live' || el.hasAttribute('data-zego-golive')) {
        if (!el.hasAttribute('data-zego-golive')) {
          el.setAttribute('data-zego-golive', '1') // guard: evita loop com attributes:true
        }
        const label = isLiveRef?.current ? endLabel : goLiveLabel
        if (el.textContent !== label) el.textContent = label
        return
      }
      if (dict[text]) el.textContent = dict[text]
    })
  }

  const observer = new MutationObserver(translateNode)
  // attributes:true para reagir à troca de cor do botão "Go Live" (live on/off).
  observer.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  })
  translateNode()

  return () => observer.disconnect()
}
