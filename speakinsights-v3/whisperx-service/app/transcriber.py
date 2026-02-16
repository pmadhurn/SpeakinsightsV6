"""
SpeakInsights v3 — WhisperX Transcriber
Wraps WhisperX model loading and inference with standardized output format.
"""

import logging
import os
import time
from typing import Any, Optional

import numpy as np
import torch
import whisperx

logger = logging.getLogger(__name__)


# Supported languages (WhisperX / Whisper multilingual)
SUPPORTED_LANGUAGES = {
    "en": "English",
    "zh": "Chinese",
    "de": "German",
    "es": "Spanish",
    "ru": "Russian",
    "ko": "Korean",
    "fr": "French",
    "ja": "Japanese",
    "pt": "Portuguese",
    "tr": "Turkish",
    "pl": "Polish",
    "ca": "Catalan",
    "nl": "Dutch",
    "ar": "Arabic",
    "sv": "Swedish",
    "it": "Italian",
    "id": "Indonesian",
    "hi": "Hindi",
    "fi": "Finnish",
    "vi": "Vietnamese",
    "he": "Hebrew",
    "uk": "Ukrainian",
    "el": "Greek",
    "ms": "Malay",
    "cs": "Czech",
    "ro": "Romanian",
    "da": "Danish",
    "hu": "Hungarian",
    "ta": "Tamil",
    "no": "Norwegian",
    "th": "Thai",
    "ur": "Urdu",
    "hr": "Croatian",
    "bg": "Bulgarian",
    "lt": "Lithuanian",
    "la": "Latin",
    "mi": "Maori",
    "ml": "Malayalam",
    "cy": "Welsh",
    "sk": "Slovak",
    "te": "Telugu",
    "fa": "Persian",
    "lv": "Latvian",
    "bn": "Bengali",
    "sr": "Serbian",
    "az": "Azerbaijani",
    "sl": "Slovenian",
    "kn": "Kannada",
    "et": "Estonian",
    "mk": "Macedonian",
    "br": "Breton",
    "eu": "Basque",
    "is": "Icelandic",
    "hy": "Armenian",
    "ne": "Nepali",
    "mn": "Mongolian",
    "bs": "Bosnian",
    "kk": "Kazakh",
    "sq": "Albanian",
    "sw": "Swahili",
    "gl": "Galician",
    "mr": "Marathi",
    "pa": "Panjabi",
    "si": "Sinhala",
    "km": "Khmer",
    "sn": "Shona",
    "yo": "Yoruba",
    "so": "Somali",
    "af": "Afrikaans",
    "oc": "Occitan",
    "ka": "Georgian",
    "be": "Belarusian",
    "tg": "Tajik",
    "sd": "Sindhi",
    "gu": "Gujarati",
    "am": "Amharic",
    "yi": "Yiddish",
    "lo": "Lao",
    "uz": "Uzbek",
    "fo": "Faroese",
    "ht": "Haitian Creole",
    "ps": "Pashto",
    "tk": "Turkmen",
    "nn": "Nynorsk",
    "mt": "Maltese",
    "sa": "Sanskrit",
    "lb": "Luxembourgish",
    "my": "Myanmar",
    "bo": "Tibetan",
    "tl": "Tagalog",
    "mg": "Malagasy",
    "as": "Assamese",
    "tt": "Tatar",
    "haw": "Hawaiian",
    "ln": "Lingala",
    "ha": "Hausa",
    "ba": "Bashkir",
    "jw": "Javanese",
    "su": "Sundanese",
}


class WhisperXTranscriber:
    """Wraps WhisperX model loading and inference."""

    def __init__(self):
        self.model = None
        self.model_size: str = ""
        self.device: str = "cpu"
        self.compute_type: str = "int8"
        self.batch_size: int = 4
        self._alignment_models: dict = {}  # Cache alignment models by language
        self._model_loaded: bool = False

    def load_model(
        self,
        model_size: str = "small",
        device: str = "cpu",
        compute_type: str = "int8",
        batch_size: int = 4,
    ) -> None:
        """
        Load the WhisperX model.
        
        Args:
            model_size: Whisper model size (tiny, base, small, medium, large-v3)
            device: 'cpu' or 'cuda'
            compute_type: 'int8' (CPU), 'float16' (GPU), 'float32'
            batch_size: Batch size for inference
        """
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.batch_size = batch_size

        logger.info(
            f"Loading WhisperX model: size={model_size}, device={device}, "
            f"compute_type={compute_type}, batch_size={batch_size}"
        )

        start_time = time.time()

        try:
            self.model = whisperx.load_model(
                model_size,
                device=device,
                compute_type=compute_type,
                language=None,  # Auto-detect
            )
            self._model_loaded = True
            elapsed = time.time() - start_time
            logger.info(f"WhisperX model loaded successfully in {elapsed:.2f}s")
        except torch.cuda.OutOfMemoryError:
            logger.error(
                "CUDA out of memory! Try a smaller model or reduce batch_size."
            )
            raise
        except Exception as e:
            logger.error(f"Failed to load WhisperX model: {e}")
            raise

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded."""
        return self._model_loaded and self.model is not None

    def _get_alignment_model(self, language: str):
        """Get or load alignment model for a language (cached)."""
        if language not in self._alignment_models:
            logger.info(f"Loading alignment model for language: {language}")
            try:
                model_a, metadata = whisperx.load_align_model(
                    language_code=language, device=self.device
                )
                self._alignment_models[language] = (model_a, metadata)
            except Exception as e:
                logger.warning(
                    f"Could not load alignment model for '{language}': {e}. "
                    "Word-level timestamps will not be available."
                )
                return None, None
        return self._alignment_models[language]

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        batch_size: Optional[int] = None,
    ) -> dict:
        """
        Transcribe audio file using WhisperX.
        
        Args:
            audio_path: Path to audio file
            language: Language code or None for auto-detect
            batch_size: Override default batch size
            
        Returns:
            Raw WhisperX transcription result
        """
        if not self.is_loaded:
            raise RuntimeError("Model not loaded. Call load_model() first.")

        bs = batch_size or self.batch_size

        logger.info(
            f"Transcribing: {audio_path} (language={language or 'auto'}, batch_size={bs})"
        )
        start_time = time.time()

        # Load audio
        audio = whisperx.load_audio(audio_path)

        # Transcribe
        result = self.model.transcribe(
            audio, batch_size=bs, language=language if language and language != "auto" else None
        )

        elapsed = time.time() - start_time
        num_segments = len(result.get("segments", []))
        detected_lang = result.get("language", language or "unknown")

        logger.info(
            f"Transcription complete: {num_segments} segments, "
            f"language={detected_lang}, time={elapsed:.2f}s"
        )

        return result, audio

    def align(
        self,
        result: dict,
        audio: np.ndarray,
        language: str,
    ) -> dict:
        """
        Align transcription result for word-level timestamps.
        
        Args:
            result: Raw transcription result from transcribe()
            audio: Loaded audio numpy array
            language: Detected or specified language code
            
        Returns:
            Aligned result with word-level timestamps
        """
        model_a, metadata = self._get_alignment_model(language)

        if model_a is None:
            logger.warning("Alignment model not available, returning unaligned result.")
            return result

        logger.info(f"Aligning transcription for language: {language}")
        start_time = time.time()

        try:
            aligned = whisperx.align(
                result["segments"],
                model_a,
                metadata,
                audio,
                self.device,
                return_char_alignments=False,
            )
            elapsed = time.time() - start_time
            logger.info(f"Alignment complete in {elapsed:.2f}s")
            return aligned
        except Exception as e:
            logger.warning(f"Alignment failed: {e}. Returning unaligned result.")
            return result

    def format_result(
        self,
        raw_result: dict,
        detected_language: str,
        timestamp_offset: float = 0.0,
    ) -> dict:
        """
        Format WhisperX result into standardized output.
        
        Args:
            raw_result: Aligned (or unaligned) transcription result
            detected_language: Language code
            timestamp_offset: Offset to add to all timestamps (seconds)
            
        Returns:
            Standardized output dict with segments and metadata
        """
        segments = []

        for idx, seg in enumerate(raw_result.get("segments", [])):
            start = round((seg.get("start", 0.0) + timestamp_offset), 3)
            end = round((seg.get("end", 0.0) + timestamp_offset), 3)
            text = seg.get("text", "").strip()
            confidence = seg.get("score", None)

            # Format word-level timestamps
            words = []
            for w in seg.get("words", []):
                word_entry = {
                    "word": w.get("word", ""),
                    "start": round((w.get("start", 0.0) + timestamp_offset), 3)
                    if w.get("start") is not None
                    else None,
                    "end": round((w.get("end", 0.0) + timestamp_offset), 3)
                    if w.get("end") is not None
                    else None,
                    "confidence": round(w.get("score", 0.0), 4)
                    if w.get("score") is not None
                    else None,
                }
                words.append(word_entry)

            segment = {
                "index": idx,
                "start": start,
                "end": end,
                "text": text,
                "confidence": round(confidence, 4) if confidence is not None else None,
                "words": words,
                "language": detected_language,
            }
            segments.append(segment)

        return {
            "segments": segments,
            "detected_language": detected_language,
        }
