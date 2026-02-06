/**
 * SpeakMate AI - Session Analysis Screen (Stimuler Style)
 * Speaking sessiyasi tugagandan keyin ko'rsatiladigan tahlil
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAnalysisStore, AnalysisData } from '@/stores/analysisStore';
import { api } from '@/services/api';

const { width } = Dimensions.get('window');

// Tab types
type TabType = 'grammar' | 'fluency' | 'vocabulary' | 'pronunciation';

// Mock data - fallback agar backend dan kelmasa
const mockAnalysis: AnalysisData = {
  sessionId: 'mock-session',
  createdAt: new Date(),
  sessionDuration: 180,
  overallBand: 7.5,
  grammar: {
    score: 9.0,
    errors: [
      {
        id: '1',
        type: 'DETERMINER',
        original: "I don't have any idea about this. Do you have a?",
        corrected: "I don't have any idea about this. Do you have one?",
        explanation: "Determiner error, such as incorrect use of 'a', 'an', or 'the'.",
      },
      {
        id: '2',
        type: 'VERB FORM',
        original: "I'm a web developer and right now I am practicing to build my own app.",
        corrected: "I'm a web developer, and right now I am practicing building my own app.",
        explanation: "Verb form error, such as using the wrong verb form (e.g., gerund instead of infinitive).",
      },
    ],
    fillerWords: 0,
  },
  fluency: {
    score: 4.5,
    wordsPerMinute: 106,
    syllablesPerMinute: 124,
    awkwardPauses: 0,
    improvedSpeech: "No, that's not correct. I don't think so.",
    speakingRate: 'slow' as const,
  },
  vocabulary: {
    score: 7.5,
    wordLevels: { A1: 12.1, A2: 30.3, B1: 48.5, B2: 6.1, C1: 1.5, C2: 1.5 },
    uniqueWords: 45,
    totalWords: 120,
    suggestions: [
      {
        id: '1',
        word: 'Insight',
        type: 'noun',
        definition: 'A sight or view of the interior of anything; a deep inspection or view; introspection.',
        original: "I don't have any idea about this.",
        corrected: "I don't have any insight about this.",
      },
      {
        id: '2',
        word: 'Experimenting',
        type: 'verb',
        definition: 'To conduct an experiment.',
        original: "I am practicing to build my own app.",
        corrected: "I am experimenting to build my own app.",
      },
      {
        id: '3',
        word: 'Simply',
        type: 'adverb',
        definition: 'In a simple way or state; without addition; alone.',
        original: "I can say it's just",
        corrected: "I can say it's simply.",
      },
    ],
  },
  pronunciation: {
    score: 8.0,
    wordsToImprove: [
      { word: 'Practicing', ipa: 'pɹæktɪsɪŋ', accuracy: 36 },
      { word: 'Build', ipa: 'bɪld', accuracy: 72 },
      { word: 'This', ipa: 'ðɪs', accuracy: 45 },
      { word: 'Mood', ipa: 'muːd', accuracy: 68 },
    ],
    overallClarity: 75,
    intonation: 68,
  },
};

// Score Circle Component
const ScoreCircle = ({ score, size = 60, color }: { score: number; size?: number; color: string }) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (score / 9) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.circleBackground, { width: size, height: size, borderRadius: size / 2, borderColor: color + '30' }]}>
        <View style={[styles.circleProgress, { 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          borderColor: color,
          borderTopColor: 'transparent',
          borderRightColor: 'transparent',
          transform: [{ rotate: `${(score / 9) * 360}deg` }]
        }]} />
        <Text style={[styles.scoreText, { color, fontSize: size * 0.35 }]}>{score.toFixed(1)}</Text>
      </View>
    </View>
  );
};

// Band Score Gauge
const BandScoreGauge = ({ score }: { score: number }) => {
  const rotation = ((score - 3) / 6) * 180 - 90; // 3-9 range to -90 to 90 degrees
  
  return (
    <View style={styles.gaugeContainer}>
      <View style={styles.gaugeArc}>
        {/* Gauge numbers */}
        <Text style={[styles.gaugeNumber, { left: 10, top: 80 }]}>3.0</Text>
        <Text style={[styles.gaugeNumber, { left: 30, top: 40 }]}>4.0</Text>
        <Text style={[styles.gaugeNumber, { left: 70, top: 15 }]}>5.0</Text>
        <Text style={[styles.gaugeNumber, { left: 120, top: 5 }]}>6.0</Text>
        <Text style={[styles.gaugeNumber, { right: 70, top: 15 }]}>7.0</Text>
        <Text style={[styles.gaugeNumber, { right: 30, top: 40 }]}>8.0</Text>
        <Text style={[styles.gaugeNumber, { right: 10, top: 80 }]}>9.0</Text>
        
        {/* Colored arc */}
        <LinearGradient
          colors={['#ef4444', '#f59e0b', '#22c55e', '#14b8a6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gaugeGradient}
        />
      </View>
      
      {/* Score display */}
      <View style={styles.gaugeScoreContainer}>
        <Text style={styles.gaugeLabel}>Band Score</Text>
        <Text style={styles.gaugeBigScore}>{score.toFixed(1)}</Text>
      </View>
    </View>
  );
};

// Tab Button
const TabButton = ({ 
  label, 
  score, 
  isActive, 
  color, 
  onPress 
}: { 
  label: string; 
  score: number; 
  isActive: boolean; 
  color: string;
  onPress: () => void;
}) => (
  <TouchableOpacity 
    style={[styles.tabButton, isActive && { backgroundColor: color }]} 
    onPress={onPress}
  >
    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
    <View style={[styles.tabScoreCircle, { borderColor: isActive ? '#fff' : color }]}>
      <Text style={[styles.tabScore, { color: isActive ? '#fff' : color }]}>{score.toFixed(1)}</Text>
    </View>
  </TouchableOpacity>
);

// Error Card Component
const ErrorCard = ({ error }: { error: typeof mockAnalysis.grammar.errors[0] }) => (
  <View style={styles.errorCard}>
    <View style={styles.errorHeader}>
      <Text style={styles.errorType}>{error.type}</Text>
      <TouchableOpacity>
        <Ionicons name="checkmark-circle-outline" size={24} color="#6b7280" />
      </TouchableOpacity>
    </View>
    
    <View style={styles.errorContent}>
      <View style={styles.errorRow}>
        <View style={styles.errorIcon}>
          <Ionicons name="close-circle" size={20} color="#ef4444" />
        </View>
        <Text style={styles.errorText}>
          {error.original.split(' ').map((word, i) => (
            <Text key={i} style={error.corrected.includes(word) ? {} : styles.errorHighlight}>
              {word}{' '}
            </Text>
          ))}
        </Text>
      </View>
      
      <View style={styles.errorDivider} />
      
      <View style={styles.errorRow}>
        <View style={styles.errorIcon}>
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
        </View>
        <Text style={styles.correctedText}>{error.corrected}</Text>
      </View>
    </View>
    
    <Text style={styles.errorExplanation}>{error.explanation}</Text>
    
    <View style={styles.feedbackRow}>
      <Text style={styles.feedbackLabel}>Was this correct?</Text>
      <View style={styles.feedbackButtons}>
        <TouchableOpacity style={styles.feedbackBtn}>
          <Ionicons name="thumbs-up-outline" size={20} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.feedbackBtn}>
          <Ionicons name="thumbs-down-outline" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

// Vocabulary Card Component
const VocabularyCard = ({ item }: { item: typeof mockAnalysis.vocabulary.suggestions[0] }) => (
  <View style={styles.vocabCard}>
    <View style={styles.vocabHeader}>
      <View>
        <Text style={styles.vocabWord}>{item.word}</Text>
        <Text style={styles.vocabType}>{item.type}</Text>
      </View>
      <TouchableOpacity>
        <Ionicons name="bookmark-outline" size={24} color="#6b7280" />
      </TouchableOpacity>
    </View>
    
    <Text style={styles.vocabDefinition}>{item.definition}</Text>
    
    <TouchableOpacity style={styles.audioButton}>
      <Ionicons name="volume-high" size={20} color="#fff" />
    </TouchableOpacity>
    
    <View style={styles.vocabDivider} />
    
    <Text style={styles.useItHere}>Use it here:</Text>
    
    <View style={styles.errorRow}>
      <View style={[styles.errorIcon, { backgroundColor: '#ef4444' }]}>
        <Ionicons name="close" size={14} color="#fff" />
      </View>
      <Text style={styles.errorText}>{item.original}</Text>
    </View>
    
    <View style={[styles.errorRow, styles.correctedRow]}>
      <View style={[styles.errorIcon, { backgroundColor: '#22c55e' }]}>
        <Ionicons name="checkmark" size={14} color="#fff" />
      </View>
      <Text style={styles.correctedText}>{item.corrected}</Text>
    </View>
  </View>
);

// Word Level Chart
const WordLevelChart = ({ levels }: { levels: typeof mockAnalysis.vocabulary.wordLevels }) => {
  const maxValue = Math.max(...Object.values(levels));
  
  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Your Word Difficulty Level:</Text>
      <View style={styles.chartBars}>
        {Object.entries(levels).map(([level, value]) => (
          <View key={level} style={styles.chartBar}>
            <Text style={styles.chartValue}>{value}%</Text>
            <View style={styles.barContainer}>
              <View style={[styles.bar, { height: `${(value / maxValue) * 100}%` }]} />
            </View>
            <Text style={styles.chartLabel}>{level}</Text>
          </View>
        ))}
      </View>
      <View style={styles.tipContainer}>
        <Text style={styles.tipText}>TIP: Learn more B2/C1/C2 Words to Increase your Score</Text>
      </View>
    </View>
  );
};

// Main Component
export default function AnalysisScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('grammar');
  const params = useLocalSearchParams<{ sessionId: string }>();
  
  // Store hooks
  const { analysis, isLoading, isFastAnalysisReady, isDeepAnalysisReady, loadAnalysis, error } = useAnalysisStore();
  
  // Load analysis data on mount
  useEffect(() => {
    if (params.sessionId) {
      loadAnalysis(params.sessionId);
    }
  }, [params.sessionId]);
  
  // Use store data or fallback to mock
  const data = analysis || mockAnalysis;
  
  const tabColors = {
    grammar: '#22c55e',
    fluency: '#f59e0b',
    vocabulary: '#22c55e',
    pronunciation: '#22c55e',
  };
  
  // Helper function to get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 7) return '#22c55e';
    if (score >= 5.5) return '#f59e0b';
    return '#ef4444';
  };
  
  // Generate feedback message based on scores
  const getFeedbackMessage = () => {
    const lowest = Math.min(
      data.grammar.score,
      data.fluency.score,
      data.vocabulary.score,
      data.pronunciation.score
    );
    
    if (lowest === data.fluency.score) {
      return data.fluency.score >= 5 
        ? 'Your Fluency score is good!' 
        : 'Work on your Fluency to improve!';
    }
    if (lowest === data.grammar.score) {
      return data.grammar.score >= 5 
        ? 'Your Grammar is solid!' 
        : 'Focus on Grammar improvements!';
    }
    if (lowest === data.vocabulary.score) {
      return data.vocabulary.score >= 5 
        ? 'Good vocabulary usage!' 
        : 'Expand your vocabulary!';
    }
    return data.pronunciation.score >= 5 
      ? 'Clear pronunciation!' 
      : 'Practice pronunciation!';
  };

  // Share results
  const handleShare = async () => {
    try {
      await Share.share({
        message: `I scored Band ${data.overallBand.toFixed(1)} in my IELTS speaking practice on SpeakMate AI! 🎯\n\nGrammar: ${data.grammar.score.toFixed(1)}\nFluency: ${data.fluency.score.toFixed(1)}\nVocabulary: ${data.vocabulary.score.toFixed(1)}\nPronunciation: ${data.pronunciation.score.toFixed(1)}`,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  // Request PDF report
  const handleRequestPdf = async () => {
    try {
      const result = await api.requestPdfGeneration(params.sessionId!);
      Alert.alert(
        'PDF Report',
        'Your detailed PDF report is being generated. It will be available shortly.',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to generate PDF report');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Analyzing your speech...</Text>
        <Text style={styles.loadingSubText}>This may take a few seconds</Text>
      </View>
    );
  }

  // Error state
  if (error && !analysis) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Ionicons name="alert-circle" size={64} color="#ef4444" />
        <Text style={styles.loadingText}>Unable to load analysis</Text>
        <Text style={styles.loadingSubText}>{error}</Text>
        <TouchableOpacity 
          style={[styles.pdfButton, { marginTop: 20, paddingHorizontal: 32 }]}
          onPress={() => params.sessionId && loadAnalysis(params.sessionId)}
        >
          <Text style={styles.pdfButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.practiceButton, { marginTop: 12, paddingHorizontal: 32 }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.practiceButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderGrammarTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Grammatical Errors</Text>
          <Text style={styles.statValue}>{data.grammar.errors.length}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Filler Words</Text>
          <Text style={styles.statValue}>{data.grammar.fillerWords}</Text>
        </View>
      </View>
      
      <Text style={styles.improvementText}>
        <Text style={styles.underline}>Correcting these</Text> can increase your score by{' '}
        <Text style={styles.highlightGreen}>a lot!</Text>
      </Text>
      
      {data.grammar.errors.length === 0 ? (
        <View style={styles.noErrorsCard}>
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
          <Text style={styles.noErrorsText}>Great job! No grammar errors detected.</Text>
        </View>
      ) : (
        data.grammar.errors.map((error, index) => (
          <View key={error.id}>
            <Text style={styles.errorNumber}>Error #{index + 1}</Text>
            <ErrorCard error={error} />
          </View>
        ))
      )}
      
      <View style={styles.fillerSection}>
        <Text style={styles.fillerTitle}>
          Filler Words: <Text style={styles.highlightGreen}>{data.grammar.fillerWords} times</Text>
        </Text>
        {data.grammar.fillerWords === 0 ? (
          <Text style={styles.fillerCongrats}>Congratulations, you did not use any filler words!</Text>
        ) : (
          <Text style={styles.fillerCongrats}>Try to reduce filler words like "um", "uh", "like"</Text>
        )}
      </View>
    </View>
  );

  const renderFluencyTab = () => {
    const getSpeakingRateText = () => {
      const wpm = data.fluency.wordsPerMinute;
      if (wpm < 100) return { text: 'was slow', color: '#f59e0b' };
      if (wpm > 160) return { text: 'was fast', color: '#ef4444' };
      return { text: 'is good', color: '#22c55e' };
    };
    const rateInfo = getSpeakingRateText();
    
    return (
      <View style={styles.tabContent}>
        <Text style={styles.improvementText}>
          Use Improved Speech to Increase Your Score by{' '}
          <Text style={styles.highlightGreen}>up to 1.0 band:</Text>
        </Text>
        
        <View style={styles.speechToggle}>
          <TouchableOpacity style={styles.speechToggleBtn}>
            <Text style={styles.speechToggleBtnText}>Your Speech</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.speechToggleBtn, styles.speechToggleBtnActive]}>
            <Text style={[styles.speechToggleBtnText, styles.speechToggleBtnTextActive]}>Improved Speech</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.speechCard}>
          <Text style={styles.speechText}>
            {data.fluency.improvedSpeech || 'Your speech will be shown here after analysis.'}
          </Text>
          {data.fluency.awkwardPauses === 0 ? (
            <Text style={styles.noPauseText}>Great! No Awkward Pauses Here</Text>
          ) : (
            <Text style={[styles.noPauseText, { color: '#f59e0b' }]}>
              {data.fluency.awkwardPauses} awkward pause(s) detected
            </Text>
          )}
          
          <TouchableOpacity style={styles.listenButton}>
            <Ionicons name="play-circle" size={24} color="#fff" />
            <Text style={styles.listenButtonText}>Listen to Improved Speech</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.speedSection}>
          <Text style={styles.speedTitle}>
            Your speed of speaking{' '}
            <Text style={{ color: rateInfo.color }}>{rateInfo.text}:</Text>
          </Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Words per minute</Text>
              <Text style={styles.statValueLarge}>{data.fluency.wordsPerMinute}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Syllables per minute</Text>
              <Text style={styles.statValueLarge}>{data.fluency.syllablesPerMinute}</Text>
            </View>
          </View>
          
          <Text style={styles.tipText}>
            Ideal speaking rate: 120-160 words per minute
          </Text>
        </View>
      </View>
    );
  };

  const renderVocabularyTab = () => (
    <View style={styles.tabContent}>
      <WordLevelChart levels={data.vocabulary.wordLevels} />
      
      {data.vocabulary.suggestions.length > 0 ? (
        <>
          <Text style={styles.improvementText}>
            These <Text style={styles.underline}>{data.vocabulary.suggestions.length} words</Text> could increase your score by{' '}
            <Text style={styles.highlightGreen}>0.5 band:</Text>
          </Text>
          
          {data.vocabulary.suggestions.map((item, index) => (
            <View key={item.id}>
              <Text style={styles.errorNumber}>Word #{index + 1}</Text>
              <VocabularyCard item={item} />
            </View>
          ))}
        </>
      ) : (
        <View style={styles.noErrorsCard}>
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
          <Text style={styles.noErrorsText}>Excellent vocabulary usage!</Text>
        </View>
      )}
      
      {data.vocabulary.uniqueWords > 0 && (
        <View style={styles.vocabStatsCard}>
          <Text style={styles.vocabStatsTitle}>Vocabulary Statistics</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total Words</Text>
              <Text style={styles.statValue}>{data.vocabulary.totalWords}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Unique Words</Text>
              <Text style={styles.statValue}>{data.vocabulary.uniqueWords}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const renderPronunciationTab = () => (
    <View style={styles.tabContent}>
      {data.pronunciation.wordsToImprove.length > 0 ? (
        <>
          <Text style={styles.improvementText}>
            Practice <Text style={styles.underline}>{data.pronunciation.wordsToImprove.length} words</Text> to improve{' '}
            <Text style={styles.highlightGreen}>+0.5 band:</Text>
          </Text>
          
          {data.pronunciation.wordsToImprove.map((item, index) => (
            <View key={index}>
              <Text style={styles.errorNumber}>Word #{index + 1}</Text>
              <View style={styles.pronCard}>
                <View style={styles.pronHeader}>
                  <View>
                    <Text style={styles.pronWord}>{item.word}</Text>
                    <Text style={styles.pronIpa}>{item.ipa || '/.../'}</Text>
                  </View>
                  <Text style={[styles.pronAccuracy, { color: item.accuracy > 50 ? '#22c55e' : '#ef4444' }]}>
                    {Math.round(item.accuracy)}%
                  </Text>
                </View>
                
                <View style={styles.waveformContainer}>
                  <View style={styles.waveformItem}>
                    <View style={styles.waveformAvatar}>
                      <Ionicons name="person" size={16} color="#22c55e" />
                    </View>
                    <Text style={styles.waveformLabelIdeal}>Ideal</Text>
                    <View style={styles.waveformBars}>
                      {[...Array(8)].map((_, i) => (
                        <View key={i} style={[styles.waveformBar, { height: 15 + Math.sin(i * 0.8) * 10 }]} />
                      ))}
                    </View>
                  </View>
                  <View style={styles.waveformItem}>
                    <View style={[styles.waveformAvatar, { backgroundColor: '#374151' }]}>
                      <Text style={styles.waveformLabel}>You</Text>
                    </View>
                    <View style={styles.waveformBars}>
                      {[...Array(8)].map((_, i) => (
                        <View key={i} style={[styles.waveformBar, styles.waveformBarUser, { height: 10 + Math.random() * 15 }]} />
                      ))}
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity style={styles.micButton}>
                  <Ionicons name="mic" size={24} color="#6b7280" />
                  <Text style={styles.micButtonText}>Practice</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      ) : (
        <View style={styles.noErrorsCard}>
          <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
          <Text style={styles.noErrorsText}>Excellent pronunciation! Keep it up!</Text>
        </View>
      )}
      
      {(data.pronunciation.overallClarity > 0 || data.pronunciation.intonation > 0) && (
        <View style={styles.pronStatsCard}>
          <Text style={styles.pronStatsTitle}>Overall Pronunciation</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Clarity</Text>
              <Text style={[styles.statValue, { color: getScoreColor(data.pronunciation.overallClarity / 10) }]}>
                {data.pronunciation.overallClarity}%
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Intonation</Text>
              <Text style={[styles.statValue, { color: getScoreColor(data.pronunciation.intonation / 10) }]}>
                {data.pronunciation.intonation}%
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Speaking Analysis</Text>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Analysis Status Banner */}
        {!isDeepAnalysisReady && isFastAnalysisReady && (
          <View style={styles.analysisBanner}>
            <ActivityIndicator size="small" color="#22c55e" />
            <Text style={styles.analysisBannerText}>Deep analysis in progress...</Text>
          </View>
        )}
        
        {/* Band Score Gauge */}
        <BandScoreGauge score={data.overallBand} />
        
        <Text style={styles.feedbackMessage}>
          {getFeedbackMessage()} <Text style={styles.underline}>See Details.</Text>
        </Text>
        
        {/* Recording Button */}
        <TouchableOpacity style={styles.recordingButton}>
          <Ionicons name="headset" size={20} color="#6b7280" />
          <Text style={styles.recordingButtonText}>Your Recording</Text>
        </TouchableOpacity>
        
        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContentContainer}
        >
          <TabButton 
            label="Grammar" 
            score={data.grammar.score} 
            isActive={activeTab === 'grammar'}
            color={getScoreColor(data.grammar.score)}
            onPress={() => setActiveTab('grammar')}
          />
          <TabButton 
            label="Fluency" 
            score={data.fluency.score} 
            isActive={activeTab === 'fluency'}
            color={getScoreColor(data.fluency.score)}
            onPress={() => setActiveTab('fluency')}
          />
          <TabButton 
            label="Vocabulary" 
            score={data.vocabulary.score} 
            isActive={activeTab === 'vocabulary'}
            color={getScoreColor(data.vocabulary.score)}
            onPress={() => setActiveTab('vocabulary')}
          />
          <TabButton 
            label="Pronunciation" 
            score={data.pronunciation.score} 
            isActive={activeTab === 'pronunciation'}
            color={getScoreColor(data.pronunciation.score)}
            onPress={() => setActiveTab('pronunciation')}
          />
        </ScrollView>
        
        {/* Tab Content */}
        {activeTab === 'grammar' && renderGrammarTab()}
        {activeTab === 'fluency' && renderFluencyTab()}
        {activeTab === 'vocabulary' && renderVocabularyTab()}
        {activeTab === 'pronunciation' && renderPronunciationTab()}
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.pdfButton} onPress={handleRequestPdf}>
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={styles.pdfButtonText}>Get PDF Report</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.practiceButton} 
            onPress={() => router.replace('/(tabs)/practice')}
          >
            <Ionicons name="mic" size={20} color="#22c55e" />
            <Text style={styles.practiceButtonText}>Practice Again</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  
  // Gauge Styles
  gaugeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  gaugeArc: {
    width: width - 60,
    height: 120,
    position: 'relative',
  },
  gaugeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 12,
    borderRadius: 6,
  },
  gaugeNumber: {
    position: 'absolute',
    color: '#9ca3af',
    fontSize: 12,
  },
  gaugeScoreContainer: {
    alignItems: 'center',
    marginTop: -30,
  },
  gaugeLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  gaugeBigScore: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  
  feedbackMessage: {
    color: '#22c55e',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  
  recordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  recordingButtonText: {
    color: '#9ca3af',
    marginLeft: 8,
  },
  
  // Tabs
  tabsContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    marginRight: 10,
  },
  tabLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabScoreCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabScore: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Tab Content
  tabContent: {
    paddingHorizontal: 16,
  },
  
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 8,
  },
  statValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  statValueLarge: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  
  improvementText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  highlightGreen: {
    color: '#22c55e',
  },
  highlightOrange: {
    color: '#f59e0b',
  },
  
  // Error Card
  errorNumber: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 8,
  },
  errorCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorType: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  errorContent: {
    marginBottom: 12,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  correctedRow: {
    backgroundColor: '#22c55e20',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  errorIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
    lineHeight: 22,
  },
  errorHighlight: {
    color: '#ef4444',
  },
  correctedText: {
    color: '#22c55e',
    fontSize: 14,
    flex: 1,
    lineHeight: 22,
  },
  errorDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#374151',
    marginLeft: 10,
    marginVertical: 4,
  },
  errorExplanation: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 12,
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackLabel: {
    color: '#6b7280',
    fontSize: 13,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackBtn: {
    padding: 4,
  },
  
  // Filler Section
  fillerSection: {
    marginTop: 20,
  },
  fillerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  fillerCongrats: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  
  // Fluency
  speechToggle: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 25,
    padding: 4,
    marginBottom: 16,
  },
  speechToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
  },
  speechToggleBtnActive: {
    backgroundColor: '#374151',
  },
  speechToggleBtnText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  speechToggleBtnTextActive: {
    color: '#fff',
  },
  speechCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  speechText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  noPauseText: {
    color: '#22c55e',
    fontSize: 14,
    marginBottom: 16,
  },
  listenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
    paddingVertical: 12,
    borderRadius: 25,
  },
  listenButtonText: {
    color: '#fff',
    marginLeft: 8,
  },
  speedSection: {
    marginTop: 20,
  },
  speedTitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  
  // Vocabulary
  chartContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  chartTitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 10,
  },
  chartBar: {
    alignItems: 'center',
  },
  chartValue: {
    color: '#fff',
    fontSize: 10,
    marginBottom: 4,
  },
  barContainer: {
    width: 30,
    height: 80,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  chartLabel: {
    color: '#6366f1',
    fontSize: 12,
    marginTop: 8,
  },
  tipContainer: {
    backgroundColor: '#374151',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  tipText: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
  },
  
  // Vocab Card
  vocabCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  vocabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vocabWord: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  vocabType: {
    color: '#9ca3af',
    fontSize: 14,
  },
  vocabDefinition: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 22,
    marginVertical: 12,
  },
  audioButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  vocabDivider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 12,
  },
  useItHere: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 12,
  },
  
  // Pronunciation
  pronCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  pronWord: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  pronIpa: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  pronAccuracy: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  waveformContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  waveformItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveformAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    marginRight: 8,
  },
  waveformLabel: {
    color: '#fff',
    fontSize: 12,
    marginRight: 8,
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  waveformBar: {
    width: 4,
    backgroundColor: '#22c55e',
    borderRadius: 2,
  },
  waveformBarUser: {
    backgroundColor: '#f59e0b',
  },
  micButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Score Circle
  circleBackground: {
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleProgress: {
    position: 'absolute',
    borderWidth: 4,
  },
  scoreText: {
    fontWeight: 'bold',
  },
  
  // Loading
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  loadingSubText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  
  // Analysis Banner
  analysisBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 20,
    marginBottom: 10,
    gap: 8,
  },
  analysisBannerText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  
  // No Errors Card
  noErrorsCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  noErrorsText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
  },
  
  // Vocab Stats
  vocabStatsCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  vocabStatsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  
  // Pronunciation Stats
  pronStatsCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  pronStatsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  pronHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  waveformLabelIdeal: {
    color: '#22c55e',
    fontSize: 10,
    marginRight: 4,
  },
  micButtonText: {
    color: '#6b7280',
    fontSize: 10,
    marginTop: 2,
  },
  
  // Action Buttons
  actionButtons: {
    padding: 16,
    gap: 12,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  pdfButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  practiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  practiceButtonText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Tabs
  tabsContentContainer: {
    paddingRight: 16,
  },
  
  bottomPadding: {
    height: 40,
  },
});
