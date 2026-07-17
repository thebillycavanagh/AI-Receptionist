import { useState } from 'react'
import { isSpeechSupported, stopSpeaking, pickBestVoice } from '../lib/tts'

// Speaks `text` aloud via the browser's built-in text-to-speech, so an admin
// can hear how a drafted reply would sound on a real call before ever
// wiring up Twilio. No API key, no network request — runs entirely client-side.
export default function PlayReplyButton({ text }) {
  const [speaking, setSpeaking] = useState(false)

  if (!isSpeechSupported() || !text) return null

  async function handleClick() {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = await pickBestVoice()
    if (voice) utterance.voice = voice
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  return (
    <button type="button" onClick={handleClick} className="btn-secondary text-xs">
      {speaking ? '■ Stop' : '▶ Play'}
    </button>
  )
}
