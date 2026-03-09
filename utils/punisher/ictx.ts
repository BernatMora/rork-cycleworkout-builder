import { Alert, Platform } from 'react-native';
import { PunisherLeg, PunisherWorkout } from './types';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function secsToMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// workoutStruct builder
// workoutStruct = "ratio;{totalSecs}-{ratio1};{secs1}-{ratio2};{secs2}-..."
// ---------------------------------------------------------------------------
export function buildWorkoutStruct(legs: PunisherLeg[]): string {
  const totalSecs = legs.reduce((s, l) => s + l.duration_seconds, 0);
  const parts = legs.map((l) => `${l.levelRatio};${l.duration_seconds}`);
  return [`ratio;${totalSecs}`, ...parts].join('-');
}

// ---------------------------------------------------------------------------
// ICTX XML generator
// ---------------------------------------------------------------------------
export function generateIctxXml(workout: PunisherWorkout, workoutName?: string): string {
  const { legs, params } = workout;
  const name = workoutName ?? workout.name;
  const struct = buildWorkoutStruct(legs);

  const legXml = legs
    .map(
      (l) => `    <leg>
      <duration>${secsToMmSs(l.duration_seconds)}</duration>
      <levelRatio>${l.levelRatio}</levelRatio>
      <rpm>${l.rpm}</rpm>
    </leg>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<workout>
  <name>${escapeXml(name)}</name>
  <ratioExercise>true</ratioExercise>
  <maxLevelRatioDisplay>${params.maxRatio}</maxLevelRatioDisplay>
  <workoutStruct>${struct}</workoutStruct>
  <sequence>
    <loops>1</loops>
${legXml}
  </sequence>
</workout>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// File download (web) / share (native)
// ---------------------------------------------------------------------------
export async function downloadIctxFile(
  xmlContent: string,
  filename: string = 'punisher.ictx',
): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }

    const FileSystem = await import('expo-file-system/legacy');
    const Sharing = await import('expo-sharing');

    const directory = FileSystem.documentDirectory;
    if (!directory) {
      Alert.alert('Download failed', 'Unable to access local storage on this device.');
      return false;
    }

    const uri = `${directory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, xmlContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      Alert.alert('Saved', `Workout saved to: ${uri}`);
      return true;
    }

    await Sharing.shareAsync(uri, {
      UTI: 'public.xml',
      mimeType: 'application/xml',
      dialogTitle: 'Share .ictx workout file',
    });

    return true;
  } catch (error) {
    console.error('[ictx] Failed to export workout file:', error);
    Alert.alert('Download failed', 'Could not export the .ictx file. Please try again.');
    return false;
  }
}
