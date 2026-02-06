/**
 * SpeakMate AI - Color Constants
 */

const tintColorLight = '#2563eb';
const tintColorDark = '#60a5fa';

export const Colors = {
  light: {
    text: '#1a202c',
    textSecondary: '#4a5568',
    background: '#ffffff',
    backgroundSecondary: '#f7fafc',
    tint: tintColorLight,
    icon: '#4a5568',
    tabIconDefault: '#a0aec0',
    tabIconSelected: tintColorLight,
    border: '#e2e8f0',
    card: '#ffffff',
    success: '#38a169',
    error: '#e53e3e',
    warning: '#d69e2e',
    info: '#3182ce',
  },
  dark: {
    text: '#f7fafc',
    textSecondary: '#a0aec0',
    background: '#1a202c',
    backgroundSecondary: '#2d3748',
    tint: tintColorDark,
    icon: '#a0aec0',
    tabIconDefault: '#718096',
    tabIconSelected: tintColorDark,
    border: '#4a5568',
    card: '#2d3748',
    success: '#48bb78',
    error: '#fc8181',
    warning: '#f6e05e',
    info: '#63b3ed',
  },
  // Brand colors
  brand: {
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    secondary: '#7c3aed',
    accent: '#06b6d4',
  },
  // IELTS band colors
  bands: {
    excellent: '#38a169',  // 8-9
    good: '#3182ce',       // 7-7.5
    competent: '#d69e2e',  // 6-6.5
    modest: '#dd6b20',     // 5-5.5
    limited: '#e53e3e',    // 4-4.5
  },
  // Error category colors
  errors: {
    pronunciation: '#805ad5',
    grammar: '#e53e3e',
    vocabulary: '#dd6b20',
    fluency: '#3182ce',
  },
};

export const getBandColor = (band: number): string => {
  if (band >= 8) return Colors.bands.excellent;
  if (band >= 7) return Colors.bands.good;
  if (band >= 6) return Colors.bands.competent;
  if (band >= 5) return Colors.bands.modest;
  return Colors.bands.limited;
};

export const getCategoryColor = (category: string): string => {
  return Colors.errors[category as keyof typeof Colors.errors] || Colors.light.textSecondary;
};
