// Browser-native text-to-speech (Web Speech API) — lets the dashboard speak
// an AI-drafted reply out loud so you can hear how it'd sound on a real call,
// without needing Twilio or any TTS API key.
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}
