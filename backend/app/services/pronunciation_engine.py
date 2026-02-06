"""
SpeakMate AI - Pronunciation Analysis Engine (Production)

Two-layer pronunciation assessment:
1. Intelligibility: STT confidence, misrecognition patterns
2. Prosody: Pauses, speaking rate, intonation proxies

Note: Full phoneme-level analysis requires specialized engines.
This provides a "good-enough" assessment using available data.
"""
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import statistics
import logging
import math

logger = logging.getLogger(__name__)


@dataclass
class ProsodyMetrics:
    """Prosody analysis results."""
    speaking_rate_wpm: float
    pause_count: int
    avg_pause_duration_ms: float
    longest_pause_ms: float
    filler_rate: float
    rhythm_score: float  # 0-1


@dataclass
class IntelligibilityMetrics:
    """Intelligibility analysis results."""
    avg_confidence: float
    low_confidence_count: int
    likely_misrecognitions: List[Dict]
    clarity_score: float  # 0-1


class PronunciationAnalyzer:
    """
    Two-layer pronunciation analyzer.
    
    Layer 1: Intelligibility (from STT data)
    - Word confidence scores
    - Misrecognition patterns
    - L1 interference markers
    
    Layer 2: Prosody (from audio features)
    - Speaking rate
    - Pause patterns
    - Rhythm/flow
    """
    
    def __init__(self):
        # L1-specific problem sounds
        self.l1_problem_sounds = {
            'uz': {  # Uzbek speakers
                'th': ['s', 't', 'd', 'z'],  # think -> sink
                'w': ['v'],  # water -> vater
                'h': ['x', ''],  # may drop or over-aspirate
                'ng': ['n'],  # singing -> singin
                'r': ['r'],  # different rhotic
            },
            'ru': {  # Russian speakers
                'th': ['s', 'z', 'f', 'v'],
                'h': ['x', 'g'],
                'w': ['v'],
            }
        }
        
        # Words commonly mispronounced
        self.problem_words = {
            'th_initial': ['the', 'this', 'that', 'think', 'thought', 'through', 'there', 'they', 'them'],
            'th_medial': ['something', 'nothing', 'anything', 'weather', 'whether', 'together'],
            'w_words': ['water', 'weather', 'what', 'when', 'where', 'work', 'world', 'would'],
            'stress_patterns': {
                'develop': 2,  # stress on 2nd syllable
                'interesting': 1,
                'important': 2,
                'comfortable': 1,
                'vegetable': 1,
            }
        }
    
    async def analyze(
        self,
        utterances: List[Dict],
        native_language: str = 'uz'
    ) -> Dict[str, Any]:
        """
        Full pronunciation analysis.
        
        Args:
            utterances: List of {text, word_timestamps, duration_ms}
            native_language: Speaker's L1
        
        Returns:
            Comprehensive pronunciation analysis
        """
        
        # Layer 1: Intelligibility
        intelligibility = self._analyze_intelligibility(utterances, native_language)
        
        # Layer 2: Prosody
        prosody = self._analyze_prosody(utterances)
        
        # Combine scores
        overall_score = self._calculate_overall_score(intelligibility, prosody)
        
        # Generate feedback
        feedback = self._generate_feedback(intelligibility, prosody, native_language)
        
        return {
            'overall_score': overall_score,
            'intelligibility': {
                'score': intelligibility.clarity_score,
                'avg_confidence': intelligibility.avg_confidence,
                'low_confidence_words': intelligibility.low_confidence_count,
                'likely_issues': intelligibility.likely_misrecognitions[:5]
            },
            'prosody': {
                'score': prosody.rhythm_score,
                'speaking_rate_wpm': prosody.speaking_rate_wpm,
                'pause_count': prosody.pause_count,
                'avg_pause_ms': prosody.avg_pause_duration_ms,
                'filler_rate': prosody.filler_rate
            },
            'band_estimate': self._estimate_band(overall_score),
            'feedback': feedback,
            'problem_areas': self._identify_problem_areas(intelligibility, prosody, native_language)
        }
    
    def _analyze_intelligibility(
        self,
        utterances: List[Dict],
        native_language: str
    ) -> IntelligibilityMetrics:
        """Analyze intelligibility from STT confidence."""
        
        all_words = []
        confidences = []
        low_conf_count = 0
        likely_issues = []
        
        for utterance in utterances:
            timestamps = utterance.get('word_timestamps', [])
            
            for word_data in timestamps:
                word = word_data.get('word', '').lower()
                conf = word_data.get('confidence', 0.9)
                
                all_words.append(word)
                confidences.append(conf)
                
                # Flag low confidence
                if conf < 0.7:
                    low_conf_count += 1
                    
                    # Check if it's a known problem word for this L1
                    issue_type = self._identify_pronunciation_issue(word, native_language)
                    if issue_type:
                        likely_issues.append({
                            'word': word,
                            'confidence': conf,
                            'issue_type': issue_type,
                            'suggestion': self._get_pronunciation_tip(issue_type)
                        })
        
        # Calculate metrics
        avg_conf = statistics.mean(confidences) if confidences else 0.9
        
        # Clarity score (normalize confidence to 0-1 scale for IELTS relevance)
        clarity = min(1.0, avg_conf * 1.1)  # Slight boost since STT is harsh
        
        return IntelligibilityMetrics(
            avg_confidence=round(avg_conf, 3),
            low_confidence_count=low_conf_count,
            likely_misrecognitions=likely_issues,
            clarity_score=round(clarity, 2)
        )
    
    def _identify_pronunciation_issue(self, word: str, native_language: str) -> Optional[str]:
        """Identify likely pronunciation issue for a word."""
        
        word = word.lower()
        
        # Check 'th' sounds
        if word in self.problem_words['th_initial'] or word in self.problem_words['th_medial']:
            return 'th_sound'
        
        # Check 'w' sounds
        if word in self.problem_words['w_words']:
            if native_language in ['uz', 'ru']:  # Common w/v confusion
                return 'w_v_confusion'
        
        # Check stress patterns
        if word in self.problem_words['stress_patterns']:
            return 'word_stress'
        
        return None
    
    def _get_pronunciation_tip(self, issue_type: str) -> str:
        """Get pronunciation improvement tip."""
        
        tips = {
            'th_sound': "Place tongue between teeth for 'th' sound",
            'w_v_confusion': "Round lips for 'w', not touching teeth",
            'word_stress': "Practice correct syllable stress",
            'h_sound': "Breathe out gently for 'h' sound",
        }
        
        return tips.get(issue_type, "Practice this sound")
    
    def _analyze_prosody(self, utterances: List[Dict]) -> ProsodyMetrics:
        """Analyze prosodic features."""
        
        total_words = 0
        total_duration_ms = 0
        pauses = []
        filler_count = 0
        word_durations = []
        
        filler_words = {'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically'}
        
        for utterance in utterances:
            text = utterance.get('text', '')
            duration = utterance.get('duration_ms', 0)
            timestamps = utterance.get('word_timestamps', [])
            
            words = text.lower().split()
            total_words += len(words)
            total_duration_ms += duration
            
            # Count fillers
            for word in words:
                if word in filler_words:
                    filler_count += 1
            
            # Analyze pauses from timestamps
            if timestamps:
                for i in range(1, len(timestamps)):
                    prev_end = timestamps[i-1].get('end_ms', 0)
                    curr_start = timestamps[i].get('start_ms', 0)
                    
                    if curr_start and prev_end:
                        gap = curr_start - prev_end
                        if gap > 300:  # Pause > 300ms
                            pauses.append(gap)
                        
                        # Word duration
                        word_dur = timestamps[i].get('end_ms', 0) - timestamps[i].get('start_ms', 0)
                        if word_dur > 0:
                            word_durations.append(word_dur)
        
        # Calculate metrics
        duration_min = total_duration_ms / 60000 if total_duration_ms else 1
        speaking_rate = total_words / duration_min if duration_min > 0 else 0
        
        avg_pause = statistics.mean(pauses) if pauses else 0
        longest_pause = max(pauses) if pauses else 0
        
        filler_rate = filler_count / total_words if total_words > 0 else 0
        
        # Rhythm score (based on word duration variance and pause patterns)
        rhythm_score = self._calculate_rhythm_score(
            speaking_rate, len(pauses), avg_pause, word_durations
        )
        
        return ProsodyMetrics(
            speaking_rate_wpm=round(speaking_rate, 1),
            pause_count=len(pauses),
            avg_pause_duration_ms=round(avg_pause, 0),
            longest_pause_ms=round(longest_pause, 0),
            filler_rate=round(filler_rate, 3),
            rhythm_score=round(rhythm_score, 2)
        )
    
    def _calculate_rhythm_score(
        self,
        speaking_rate: float,
        pause_count: int,
        avg_pause: float,
        word_durations: List[float]
    ) -> float:
        """Calculate rhythm/flow score (0-1)."""
        
        score = 1.0
        
        # Speaking rate penalty (optimal: 120-150 wpm)
        if speaking_rate < 80:
            score -= 0.3  # Too slow
        elif speaking_rate < 100:
            score -= 0.1
        elif speaking_rate > 180:
            score -= 0.2  # Too fast
        elif speaking_rate > 160:
            score -= 0.1
        
        # Pause penalty
        if avg_pause > 2000:
            score -= 0.3  # Very long pauses
        elif avg_pause > 1000:
            score -= 0.15
        elif avg_pause > 500:
            score -= 0.05
        
        # Duration variance (lower is more consistent/rhythmic)
        if word_durations:
            try:
                cv = statistics.stdev(word_durations) / statistics.mean(word_durations)
                if cv > 1.0:
                    score -= 0.2  # Very inconsistent
                elif cv > 0.6:
                    score -= 0.1
            except:
                pass
        
        return max(0.3, min(1.0, score))
    
    def _calculate_overall_score(
        self,
        intelligibility: IntelligibilityMetrics,
        prosody: ProsodyMetrics
    ) -> float:
        """Calculate overall pronunciation score (0-9 scale)."""
        
        # Weight: 60% intelligibility, 40% prosody
        combined = (intelligibility.clarity_score * 0.6 + prosody.rhythm_score * 0.4)
        
        # Map to 0-9 IELTS scale
        # 0.9-1.0 -> 8-9
        # 0.7-0.9 -> 6-8
        # 0.5-0.7 -> 5-6
        # <0.5 -> <5
        
        if combined >= 0.9:
            band = 8.0 + (combined - 0.9) * 10
        elif combined >= 0.7:
            band = 6.0 + (combined - 0.7) * 10
        elif combined >= 0.5:
            band = 5.0 + (combined - 0.5) * 5
        else:
            band = 4.0 + combined * 2
        
        return round(min(9.0, max(4.0, band)), 1)
    
    def _estimate_band(self, overall_score: float) -> float:
        """Round to nearest 0.5 band."""
        return round(overall_score * 2) / 2
    
    def _generate_feedback(
        self,
        intelligibility: IntelligibilityMetrics,
        prosody: ProsodyMetrics,
        native_language: str
    ) -> List[str]:
        """Generate actionable feedback."""
        
        feedback = []
        
        # Intelligibility feedback
        if intelligibility.clarity_score < 0.7:
            feedback.append("Work on clearer pronunciation of individual sounds.")
        
        if intelligibility.likely_misrecognitions:
            issue_types = set(m['issue_type'] for m in intelligibility.likely_misrecognitions)
            if 'th_sound' in issue_types:
                feedback.append("Practice 'th' sounds - place tongue between teeth.")
            if 'w_v_confusion' in issue_types:
                feedback.append("Distinguish 'w' (rounded lips) from 'v' (teeth touch lip).")
        
        # Prosody feedback
        if prosody.speaking_rate_wpm < 100:
            feedback.append("Try to speak a bit faster for more natural flow.")
        elif prosody.speaking_rate_wpm > 160:
            feedback.append("Slow down slightly for better clarity.")
        
        if prosody.avg_pause_duration_ms > 1500:
            feedback.append("Reduce long pauses - practice speaking continuously.")
        
        if prosody.filler_rate > 0.05:
            feedback.append("Reduce filler words (um, uh) - pause silently instead.")
        
        if prosody.rhythm_score < 0.6:
            feedback.append("Work on natural rhythm and intonation patterns.")
        
        return feedback[:4]  # Top 4 feedback items
    
    def _identify_problem_areas(
        self,
        intelligibility: IntelligibilityMetrics,
        prosody: ProsodyMetrics,
        native_language: str
    ) -> List[Dict]:
        """Identify specific problem areas for training."""
        
        problems = []
        
        if intelligibility.low_confidence_count > 3:
            problems.append({
                'area': 'clarity',
                'severity': 'moderate',
                'description': 'Multiple words unclear',
                'drill_type': 'pronunciation_clarity'
            })
        
        if prosody.filler_rate > 0.05:
            problems.append({
                'area': 'fluency',
                'severity': 'minor',
                'description': 'Excessive filler words',
                'drill_type': 'filler_reduction'
            })
        
        if prosody.speaking_rate_wpm < 90:
            problems.append({
                'area': 'rate',
                'severity': 'moderate',
                'description': 'Speaking too slowly',
                'drill_type': 'speed_practice'
            })
        
        # L1-specific issues
        issue_types = [m['issue_type'] for m in intelligibility.likely_misrecognitions]
        if 'th_sound' in issue_types:
            problems.append({
                'area': 'th_sound',
                'severity': 'moderate',
                'description': 'TH pronunciation',
                'drill_type': 'minimal_pairs_th'
            })
        
        return problems


# Global instance
pronunciation_analyzer = PronunciationAnalyzer()
