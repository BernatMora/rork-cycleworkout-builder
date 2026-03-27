import { Alert, Platform } from 'react-native';
export {
  generateZwoXml,
  generateIctxXml,
  generateMrcText,
  generateErgText,
  calculateTSS,
  formatDuration,
  getZoneColor,
  getZoneName,
  getHrRangeFromPower,
  getRpeFromPower,
  parseZwoIntervals,
} from './zwo-core';

export async function downloadZwoFile(xmlContent: string, filename: string = 'workout.zwo'): Promise<boolean> {
  try {
    const hasExtension = /\.[a-z0-9]+$/i.test(filename);
    const normalizedFilename = hasExtension ? filename : `${filename}.ictx`;

    if (Platform.OS === 'web') {
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = normalizedFilename;
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

    const uri = `${directory}${normalizedFilename}`;
    await FileSystem.writeAsStringAsync(uri, xmlContent, { encoding: FileSystem.EncodingType.UTF8 });

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      Alert.alert('Saved', `Workout saved to: ${uri}`);
      return true;
    }

    await Sharing.shareAsync(uri, {
      UTI: 'public.data',
      mimeType: 'application/octet-stream',
      dialogTitle: 'Share workout file',
    });

    return true;
  } catch (error) {
    console.error('[zwo] Failed to export workout file:', error);
    Alert.alert('Download failed', 'Could not export the workout file. Please try again.');
    return false;
  }
}

