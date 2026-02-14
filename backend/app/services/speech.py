"""
SpeakMate AI - Google Cloud Speech Service

Supports two modes:
1. Chunk-based streaming: accumulate audio chunks per session, transcribe on each chunk
2. Full transcription: single-shot for the final combined audio

The chunk approach sends accumulated audio each time for reliable transcription
(each chunk includes the full WebM/OGG container from the start).
"""
from google.cloud import speech_v1 as speech
from google.cloud import texttospeech_v1 as tts
from typing import Optional, AsyncIterator, Dict
import asyncio
import io
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class SpeechService:
    """Google Cloud Speech-to-Text and Text-to-Speech service."""
    
    def __init__(self):
        self.speech_client = None
        self.tts_client = None
        self._session_buffers: Dict[str, dict] = {}  # session_id -> {audio_bytes, transcriptions}
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize Google Cloud clients."""
        try:
            self.speech_client = speech.SpeechClient()
            self.tts_client = tts.TextToSpeechClient()
            logger.info("Google Cloud Speech/TTS clients initialized")
        except Exception as e:
            logger.warning(f"Could not initialize Google Cloud clients: {e}")
            logger.warning("Speech services will use mock data in development mode.")
    
    def _detect_audio_encoding(self, audio_data: bytes) -> tuple:
        """
        Detect audio encoding from the raw bytes.
        
        Returns:
            (encoding_enum, sample_rate) tuple
        """
        # WebM/Opus files start with 0x1A45DFA3 (EBML header)
        if audio_data[:4] == b'\x1a\x45\xdf\xa3':
            return speech.RecognitionConfig.AudioEncoding.WEBM_OPUS, 48000
        # OGG/Opus files start with "OggS"
        if audio_data[:4] == b'OggS':
            return speech.RecognitionConfig.AudioEncoding.OGG_OPUS, 48000
        # Default: LINEAR16 PCM
        return speech.RecognitionConfig.AudioEncoding.LINEAR16, settings.SPEECH_SAMPLE_RATE

    # ------------------------------------------------------------------
    # Chunk-based transcription (for streaming from frontend)
    # ------------------------------------------------------------------

    async def transcribe_chunk(
        self,
        session_id: str,
        audio_data: bytes,
        is_final: bool = False,
        language_code: str = None,
    ) -> dict:
        """
        Transcribe an audio chunk. The frontend sends accumulated audio
        (each chunk is a valid WebM/OGG container from the start), so we
        can transcribe each one directly.

        For interim chunks (is_final=False): quick transcription for real-time display.
        For final chunk (is_final=True): full transcription with word timestamps.

        Returns:
            dict with {text, is_final, confidence, words}
        """
        if not audio_data or len(audio_data) < 100:
            return {"text": "", "is_final": is_final, "confidence": 0, "words": []}

        if not self.speech_client:
            # Mock response for development
            mock_text = "This is a mock transcription for development."
            return {
                "text": mock_text,
                "is_final": is_final,
                "confidence": 0.95,
                "words": [
                    {"word": w, "start_time": i * 0.3, "end_time": (i + 1) * 0.3}
                    for i, w in enumerate(mock_text.split())
                ],
            }

        language = language_code or settings.SPEECH_LANGUAGE_CODE
        audio_encoding, sample_rate = self._detect_audio_encoding(audio_data)

        config = speech.RecognitionConfig(
            encoding=audio_encoding,
            sample_rate_hertz=sample_rate,
            language_code=language,
            enable_automatic_punctuation=True,
            enable_word_time_offsets=is_final,  # Only get word timestamps on final
            model="latest_long",
            use_enhanced=True,
            enable_spoken_punctuation=True,
        )

        audio = speech.RecognitionAudio(content=audio_data)

        try:
            # Use sync recognize for chunks (they are small enough)
            # For final large audio, use long_running_recognize
            if is_final and len(audio_data) > 900_000:
                response = await self._recognize_long(config, audio)
            else:
                response = await self._recognize_sync(config, audio)

            result = self._join_response(response, is_final)

            if result.get("text"):
                logger.info(
                    f"Transcription {'FINAL' if is_final else 'interim'} "
                    f"[{session_id[:8]}]: {result['text'][:80]}..."
                )
            return result

        except Exception as e:
            err_str = str(e).lower()
            # If sync fails due to audio length, retry with long-running
            if any(k in err_str for k in ["maximum", "too long", "audio length", "exceed"]):
                try:
                    logger.info(f"Retrying with long_running_recognize for session {session_id}")
                    response = await self._recognize_long(config, audio)
                    return self._join_response(response, is_final)
                except Exception as e2:
                    logger.error(f"Long-running transcription also failed: {e2}")

            logger.error(f"Transcription error [{session_id[:8]}]: {e}")
            return {
                "text": "",
                "is_final": is_final,
                "confidence": 0,
                "words": [],
                "error": str(e),
            }

    def cleanup_session(self, session_id: str):
        """Clean up session buffer data."""
        self._session_buffers.pop(session_id, None)

    # ------------------------------------------------------------------
    # Legacy single-shot transcription (kept for backward compatibility)
    # ------------------------------------------------------------------

    async def transcribe_audio(
        self,
        audio_data: bytes,
        is_final: bool = False,
        language_code: str = None,
        encoding: str = None,
    ) -> dict:
        """
        Transcribe audio data to text (single-shot).
        """
        if not self.speech_client:
            return {
                "text": "This is a mock transcription for development.",
                "is_final": is_final,
                "confidence": 0.95,
                "alternatives": [],
                "words": [
                    {"word": w, "start_time": i * 0.3, "end_time": (i + 1) * 0.3}
                    for i, w in enumerate("This is a mock transcription for development.".split())
                ],
            }
        
        language = language_code or settings.SPEECH_LANGUAGE_CODE

        # Determine encoding
        if encoding == "webm_opus":
            audio_encoding = speech.RecognitionConfig.AudioEncoding.WEBM_OPUS
            sample_rate = 48000
        elif encoding == "ogg_opus":
            audio_encoding = speech.RecognitionConfig.AudioEncoding.OGG_OPUS
            sample_rate = 48000
        elif encoding == "linear16":
            audio_encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
            sample_rate = settings.SPEECH_SAMPLE_RATE
        else:
            audio_encoding, sample_rate = self._detect_audio_encoding(audio_data)
        
        config = speech.RecognitionConfig(
            encoding=audio_encoding,
            sample_rate_hertz=sample_rate,
            language_code=language,
            enable_automatic_punctuation=True,
            enable_word_time_offsets=True,
            model="latest_long",
            use_enhanced=True,
            enable_spoken_punctuation=True,
        )
        
        audio = speech.RecognitionAudio(content=audio_data)

        try:
            response = await (
                self._recognize_long(config, audio)
                if len(audio_data) > 900_000
                else self._recognize_sync(config, audio)
            )
            return self._join_response(response, is_final)
            
        except Exception as e:
            err = str(e).lower()
            try:
                if any(k in err for k in ["maximum", "too long", "audio length", "exceed"]):
                    response = await self._recognize_long(config, audio)
                    return self._join_response(response, is_final)
            except Exception:
                pass

            logger.error(f"Transcription error: {e}")
            return {
                "text": "",
                "is_final": is_final,
                "confidence": 0,
                "words": [],
                "error": str(e),
            }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _recognize_sync(self, config, audio):
        return await asyncio.to_thread(
            self.speech_client.recognize, config=config, audio=audio
        )

    async def _recognize_long(self, config, audio):
        operation = await asyncio.to_thread(
            self.speech_client.long_running_recognize, config=config, audio=audio
        )
        return await asyncio.to_thread(operation.result, timeout=180)

    def _join_response(self, response_obj, is_final: bool = True) -> dict:
        """Join multiple STT results into a single transcription dict."""
        if not response_obj.results:
            return {
                "text": "",
                "is_final": is_final,
                "confidence": 0,
                "alternatives": [],
                "words": [],
            }

        transcripts: list = []
        confidences: list = []
        words: list = []
        alternatives: list = []

        for idx, result in enumerate(response_obj.results):
            if not getattr(result, "alternatives", None):
                continue

            alt0 = result.alternatives[0]
            text = (alt0.transcript or "").strip()
            if text:
                transcripts.append(text)

            try:
                conf = float(getattr(alt0, "confidence", 0.0) or 0.0)
                if conf > 0:
                    confidences.append(conf)
            except (TypeError, ValueError):
                pass

            if idx == 0:
                alternatives = [
                    alt.transcript
                    for alt in result.alternatives[1:4]
                    if getattr(alt, "transcript", None)
                ]

            for word in getattr(alt0, "words", []) or []:
                try:
                    words.append({
                        "word": word.word,
                        "start_time": word.start_time.total_seconds(),
                        "end_time": word.end_time.total_seconds(),
                    })
                except Exception:
                    continue

        joined = " ".join(transcripts).strip()
        avg_confidence = (
            round(sum(confidences) / len(confidences), 3) if confidences else 0.0
        )

        return {
            "text": joined,
            "is_final": is_final,
            "confidence": avg_confidence,
            "alternatives": alternatives,
            "words": words,
        }

    # ------------------------------------------------------------------
    # Streaming transcription (legacy)
    # ------------------------------------------------------------------

    async def transcribe_stream(
        self,
        audio_generator: AsyncIterator[bytes],
        language_code: str = None,
    ) -> AsyncIterator[dict]:
        """Stream audio for real-time transcription."""
        if not self.speech_client:
            yield {
                "text": "Streaming transcription mock",
                "is_final": True,
                "confidence": 0.95,
            }
            return
        
        language = language_code or settings.SPEECH_LANGUAGE_CODE
        
        config = speech.StreamingRecognitionConfig(
            config=speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=settings.SPEECH_SAMPLE_RATE,
                language_code=language,
                enable_automatic_punctuation=True,
                model="latest_long",
            ),
            interim_results=True,
            single_utterance=False,
        )
        
        def request_generator():
            yield speech.StreamingRecognizeRequest(streaming_config=config)
        
        try:
            responses = self.speech_client.streaming_recognize(request_generator())
            for response in responses:
                for result in response.results:
                    alternative = result.alternatives[0]
                    yield {
                        "text": alternative.transcript,
                        "is_final": result.is_final,
                        "confidence": alternative.confidence,
                        "stability": result.stability,
                    }
        except Exception as e:
            logger.error(f"Streaming transcription error: {e}")
            yield {"text": "", "is_final": True, "error": str(e)}

    # ------------------------------------------------------------------
    # Text-to-Speech
    # ------------------------------------------------------------------

    async def synthesize_speech(
        self,
        text: str,
        voice_name: str = "en-US-Neural2-D",
        speaking_rate: float = 1.0,
    ) -> bytes:
        """Convert text to speech audio (MP3)."""
        if not self.tts_client:
            return b""
        
        language_code = "-".join(voice_name.split("-")[:2])
        
        synthesis_input = tts.SynthesisInput(text=text)
        voice = tts.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name,
        )
        audio_config = tts.AudioConfig(
            audio_encoding=tts.AudioEncoding.MP3,
            speaking_rate=speaking_rate,
            pitch=0.0,
        )
        
        try:
            response = self.tts_client.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config
            )
            return response.audio_content
        except Exception as e:
            logger.error(f"Speech synthesis error: {e}")
            return b""
    
    def get_available_voices(self, language_code: str = "en-US") -> list:
        """Get list of available voices for a language."""
        if not self.tts_client:
            return [
                {"name": "en-US-Neural2-D", "gender": "MALE"},
                {"name": "en-US-Neural2-F", "gender": "FEMALE"},
            ]
        
        try:
            response = self.tts_client.list_voices(language_code=language_code)
            return [
                {
                    "name": voice.name,
                    "gender": tts.SsmlVoiceGender(voice.ssml_gender).name,
                    "natural_sample_rate": voice.natural_sample_rate_hertz,
                }
                for voice in response.voices
                if "Neural" in voice.name or "Wavenet" in voice.name
            ]
        except Exception as e:
            logger.error(f"Error getting voices: {e}")
            return []


# Global instance
speech_service = SpeechService()
