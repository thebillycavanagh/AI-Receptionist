// Browser-native text-to-speech (Web Speech API) — lets the dashboard speak
// an AI-drafted reply out loud so you can hear how it'd sound on a real call,
// without needing Twilio or any TTS API key.
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

// Voice lists load asynchronously in some browsers (notably Chrome) — the
// first call can return an empty array until 'voiceschanged' fires.
function getVoicesAsync() {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices()
    if (existing.length > 0) {
      resolve(existing)
      return
    }
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices())
    }
  })
}

// Picks the most natural-sounding English voice available. Browsers vary
// wildly here: Edge exposes free cloud-backed "Online (Natural)" voices,
// while plain Chrome/Windows only has the old robotic local SAPI voices —
// this just gets the best of whatever's actually available, in order of
// preference, without requiring any paid TTS service.
export async function pickBestVoice() {
  if (!isSpeechSupported()) return null
  const voices = await getVoicesAsync()
  if (voices.length === 0) return null

  const english = voices.filter((v) => v.lang?.startsWith('en'))
  const pool = english.length > 0 ? english : voices

  const natural = pool.find((v) => /natural|online/i.test(v.name))
  if (natural) return natural

  const google = pool.find((v) => /google/i.test(v.name))
  if (google) return google

  return pool[0]
}
