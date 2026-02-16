"""
SpeakInsights v3 — Sentiment Service
Lightweight real-time sentiment analysis using VADER.
"""

import logging
from typing import Any

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

logger = logging.getLogger(__name__)


class SentimentService:
    """Fast, lightweight sentiment analysis using VADER.

    VADER (Valence Aware Dictionary and sEntiment Reasoner) is loaded
    once on initialisation — no GPU required.
    """

    def __init__(self) -> None:
        self._analyzer = SentimentIntensityAnalyzer()
        logger.info("SentimentService initialised (VADER loaded)")

    @staticmethod
    def _compound_to_label(compound: float) -> str:
        """Map a VADER compound score to a human-readable label.

        Args:
            compound: VADER compound score (-1 to 1).

        Returns:
            'positive', 'negative', or 'neutral'.
        """
        if compound >= 0.05:
            return "positive"
        elif compound <= -0.05:
            return "negative"
        return "neutral"

    def analyze_segment(self, text: str) -> dict[str, Any]:
        """Analyse the sentiment of a single text segment.

        Args:
            text: Text to analyse.

        Returns:
            Dict with score (float -1..1), label (str), compound (float).
        """
        try:
            scores = self._analyzer.polarity_scores(text)
            compound = scores["compound"]
            label = self._compound_to_label(compound)
            return {
                "score": compound,
                "label": label,
                "compound": compound,
                "positive": scores["pos"],
                "negative": scores["neg"],
                "neutral": scores["neu"],
            }
        except Exception as exc:
            logger.error("Sentiment analysis failed: %s", exc, exc_info=True)
            return {
                "score": 0.0,
                "label": "neutral",
                "compound": 0.0,
                "positive": 0.0,
                "negative": 0.0,
                "neutral": 1.0,
            }

    def analyze_segments_batch(self, segments: list[str]) -> list[dict[str, Any]]:
        """Analyse sentiment for a batch of text segments.

        Args:
            segments: List of text strings to analyse.

        Returns:
            List of sentiment result dicts (same structure as analyze_segment).
        """
        results: list[dict[str, Any]] = []
        for text in segments:
            results.append(self.analyze_segment(text))
        logger.debug("Batch analysed %d segments", len(results))
        return results


# Singleton instance
sentiment_service = SentimentService()
