"""
SpeakMate AI - Google Cloud Speech Service
"""
from google.cloud import speech_v1 as speech
from google.cloud import texttospeech_v1 as tts
from typing import Optional, AsyncIterator
import asyncio
import io

from app.core.config import settings


class SpeechService:
    """Google Cloud Speech-to-Text and Text-to-Speech service."""
    
    def __init__(self):
        self.speech_client = None
        self.tts_client = None
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize Google Cloud clients."""
        try:
            self.speech_client = speech.SpeechClient()
            self.tts_client = tts.TextToSpeechClient()
        except Exception as e:
            print(f"Warning: Could not initialize Google Cloud clients: {e}")
            print("Speech services will use mock data in development mode.")
    
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

    async def transcribe_audio(
        self,
        audio_data: bytes,
        is_final: bool = False,
        language_code: str = None,
        encoding: str = None,
    ) -> dict:
        """
        Transcribe audio data to text.
        
        Args:
            audio_data: Raw audio bytes (PCM, WebM/Opus, or OGG/Opus)
            is_final: Whether this is the final chunk
            language_code: Language code (default: en-US)
            encoding: Force encoding type ('linear16', 'webm_opus', 'ogg_opus')
                      If None, auto-detect from bytes.
        
        Returns:
            dict with transcription results
        """
        if not self.speech_client:
            # Mock response for development
            return {
                "text": "This is a mock transcription for development.",
                "is_final": is_final,
                "confidence": 0.95,
                "alternatives": []
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
        
        # Configure recognition
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
            # Perform synchronous recognition for short audio
            response = self.speech_client.recognize(config=config, audio=audio)
            
            if response.results:
                result = response.results[0]
                alternative = result.alternatives[0]
                
                return {
                    "text": alternative.transcript,
                    "is_final": result.is_final if hasattr(result, 'is_final') else is_final,
                    "confidence": alternative.confidence,
                    "alternatives": [
                        alt.transcript for alt in result.alternatives[1:4]
                    ],
                    "words": [
                        {
                            "word": word.word,
                            "start_time": word.start_time.total_seconds(),
                            "end_time": word.end_time.total_seconds()
                        }
                        for word in alternative.words
                    ] if alternative.words else []
                }
            
            return {
                "text": "",
                "is_final": is_final,
                "confidence": 0,
                "alternatives": []
            }
            
        except Exception as e:
            print(f"Transcription error: {e}")
            return {
                "text": "",
                "is_final": is_final,
                "confidence": 0,
                "error": str(e)
            }
    
    async def transcribe_stream(
        self,
        audio_generator: AsyncIterator[bytes],
        language_code: str = None
    ) -> AsyncIterator[dict]:
        """
        Stream audio for real-time transcription.
        
        Args:
            audio_generator: Async generator yielding audio chunks
            language_code: Language code
        
        Yields:
            dict with transcription results
        """
        if not self.speech_client:
            # Mock streaming for development
            yield {
                "text": "Streaming transcription mock",
                "is_final": True,
                "confidence": 0.95
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
            async def get_audio():
                async for chunk in audio_generator:
                    yield speech.StreamingRecognizeRequest(audio_content=chunk)
            # This would need to be properly async in production
            # Simplified for demonstration
        
        # Note: Full streaming implementation would use async properly
        # This is a simplified version
        try:
            responses = self.speech_client.streaming_recognize(request_generator())
            
            for response in responses:
                for result in response.results:
                    alternative = result.alternatives[0]
                    yield {
                        "text": alternative.transcript,
                        "is_final": result.is_final,
                        "confidence": alternative.confidence,
                        "stability": result.stability
                    }
                    
        except Exception as e:
            print(f"Streaming transcription error: {e}")
            yield {
                "text": "",
                "is_final": True,
                "error": str(e)
            }
    
    async def synthesize_speech(
        self,
        text: str,
        voice_name: str = "en-US-Neural2-D",
        speaking_rate: float = 1.0
    ) -> bytes:
        """
        Convert text to speech audio.
        
        Args:
            text: Text to synthesize
            voice_name: Voice name (default: Neural2-D male voice)
            speaking_rate: Speed of speech (0.25 to 4.0)
        
        Returns:
            MP3 audio bytes
        """
        if not self.tts_client:
            # Return empty bytes for development
            return b""
        
        # Parse voice name to get language code
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
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            return response.audio_content
            
        except Exception as e:
            print(f"Speech synthesis error: {e}")
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
                    "natural_sample_rate": voice.natural_sample_rate_hertz
                }
                for voice in response.voices
                if "Neural" in voice.name or "Wavenet" in voice.name
            ]
            
        except Exception as e:
            print(f"Error getting voices: {e}")
            return []


# Global instance
speech_service = SpeechService()
