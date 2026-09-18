import { describe, expect, it } from 'bun:test';
import { calculateTSS, formatDuration, generateErgText, generateIctxXml, generateMrcText, generateZwoXml, parseZwoIntervals } from './zwo-core';
import { WorkoutInterval } from '../types/workout';

describe('zwo utils', () => {
  it('generates ZWO XML with escaped name and expected tags', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 600, power_percent_ftp: 95 },
      { type: 'cooldown', duration_seconds: 240, power_percent_ftp: 45 },
    ];

    const xml = generateZwoXml(intervals, 'FTP <Build> & Test');

    expect(xml).toContain('<name>FTP &lt;Build&gt; &amp; Test</name>');
    expect(xml).toContain('<Warmup Duration="300"');
    expect(xml).toContain('<SteadyState Duration="600" Power="0.95"/>');
    expect(xml).toContain('<Cooldown Duration="240"');
  });

  it('parses simple ZWO XML back to interval list', () => {
    const xml = `<workout_file>
  <workout>
    <Warmup Duration="300" PowerLow="0.25" PowerHigh="0.55"/>
    <SteadyState Duration="600" Power="0.95"/>
    <Cooldown Duration="240" PowerLow="0.45" PowerHigh="0.25"/>
  </workout>
</workout_file>`;

    const parsed = parseZwoIntervals(xml);

    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({ type: 'warmup', duration_seconds: 300, power_percent_ftp: 55 });
    expect(parsed[1]).toEqual({ type: 'interval', duration_seconds: 600, power_percent_ftp: 95 });
    expect(parsed[2]).toEqual({ type: 'cooldown', duration_seconds: 240, power_percent_ftp: 45 });
  });

  it('generates MRC text with timeline data in percent mode', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 600, power_percent_ftp: 95 },
    ];

    const mrc = generateMrcText(intervals, 'MRC Test');

    expect(mrc).toContain('[COURSE HEADER]');
    expect(mrc).toContain('MINUTES PERCENT');
    expect(mrc).toContain('0.00 55');
    expect(mrc).toContain('5.00 55');
    expect(mrc).toContain('5.00 95');
    expect(mrc).toContain('15.00 95');
  });

  it('generates ERG text with FTP-based watt targets', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 50 },
      { type: 'interval', duration_seconds: 600, power_percent_ftp: 100 },
    ];

    const erg = generateErgText(intervals, 240, 'ERG Test');

    expect(erg).toContain('[COURSE HEADER]');
    expect(erg).toContain('FTP = 240');
    expect(erg).toContain('0.00\t120');
    expect(erg).toContain('5.00\t120');
    expect(erg).toContain('5.00\t240');
    expect(erg).toContain('15.00\t240');
  });

  it('generates native ICTrainer XML with sequence blocks', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 600, power_percent_ftp: 90 },
      { type: 'cooldown', duration_seconds: 240, power_percent_ftp: 50 },
    ];

    const xml = generateIctxXml(intervals, 'BM2 Test');

    expect(xml).toContain('<icTrainer>');
    expect(xml).toContain('<icTrainerExercise>');
    expect(xml).toContain('<name>BM2 Test</name>');
    expect(xml).toContain('<workoutStruct>ratio;300-55;600-90;240-50</workoutStruct>');
    expect(xml).toContain('<name>WarmUp</name>');
    expect(xml).toContain('<name>Main part</name>');
    expect(xml).toContain('<name>CoolDown</name>');
    expect(xml).toContain('<image>iVBORw0KGgo');
  });

  it('uses provided ICTX preview image when available', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'interval', duration_seconds: 600, power_percent_ftp: 90 },
    ];

    const xml = generateIctxXml(intervals, 'Preview Test', { previewImageBase64: 'CUSTOM_BASE64_IMAGE' });

    expect(xml).toContain('<image>CUSTOM_BASE64_IMAGE</image>');
  });

  it('writes cadence target to ICTX rpm when provided', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'interval', duration_seconds: 300, power_percent_ftp: 88, cadence_rpm_target: 105 },
    ];

    const xml = generateIctxXml(intervals, 'Cadence Target Test');

    expect(xml).toContain('<rpm>105</rpm>');
  });

  it('encodes posture cues in ICTX main sequence names when provided', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 180, power_percent_ftp: 55, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 120, power_percent_ftp: 82, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 60, power_percent_ftp: 92, posture_cue: 'standing' },
      { type: 'recovery', duration_seconds: 90, power_percent_ftp: 55, posture_cue: 'seated' },
      { type: 'cooldown', duration_seconds: 180, power_percent_ftp: 45, posture_cue: 'seated' },
    ];

    const xml = generateIctxXml(intervals, 'Posture Cue Test');

    expect(xml).toContain('<name>Main part 1 - Sit</name>');
    expect(xml).toContain('<name>Main part 2 - Stand</name>');
    expect(xml).toContain('<name>Main part 3 - Sit</name>');
  });

  it('does not encode posture cues when ICTX posture option is disabled', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'interval', duration_seconds: 120, power_percent_ftp: 82, posture_cue: 'seated' },
      { type: 'interval', duration_seconds: 60, power_percent_ftp: 92, posture_cue: 'standing' },
    ];

    const xml = generateIctxXml(intervals, 'Posture Off Test', { includePostureCues: false });

    expect(xml).toContain('<name>Main part</name>');
    expect(xml).not.toContain('· Sit');
    expect(xml).not.toContain('· Stand');
  });

  it('maps goal to ICTX exerciseType automatically', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'interval', duration_seconds: 600, power_percent_ftp: 110 },
    ];

    const vo2Xml = generateIctxXml(intervals, 'VO2 Session', { goal: 'VO2Max' });
    const thresholdXml = generateIctxXml(intervals, 'Threshold Session', { goal: 'Threshold' });
    const recoveryXml = generateIctxXml(intervals, 'Recovery Session', { goal: 'Recovery Ride' });

    expect(vo2Xml).toContain('<exerciseType>VO2MAX</exerciseType>');
    expect(thresholdXml).toContain('<exerciseType>THRESHOLD</exerciseType>');
    expect(recoveryXml).toContain('<exerciseType>RECOVERY</exerciseType>');
  });

  it('parses ICTrainer XML legs back to interval list', () => {
    const ictx = `<?xml version="1.0" ?>
<icTrainer>
  <icTrainerExercise>
    <sequence>
      <name>WarmUp</name>
      <loops>1</loops>
      <leg>
        <level>S</level>
        <levelRatio>60</levelRatio>
        <duration>05:00</duration>
        <rpm>80</rpm>
        <bpm>60</bpm>
        <bpmDefault>true</bpmDefault>
      </leg>
    </sequence>
    <sequence>
      <name>Main part</name>
      <loops>1</loops>
      <leg>
        <level>L</level>
        <levelRatio>90</levelRatio>
        <duration>03:00</duration>
        <rpm>70</rpm>
        <bpm>75</bpm>
        <bpmDefault>false</bpmDefault>
      </leg>
      <leg>
        <level>S</level>
        <levelRatio>60</levelRatio>
        <duration>03:00</duration>
        <rpm>80</rpm>
        <bpm>60</bpm>
        <bpmDefault>false</bpmDefault>
      </leg>
    </sequence>
    <sequence>
      <name>CoolDown</name>
      <loops>1</loops>
      <leg>
        <level>XS</level>
        <levelRatio>50</levelRatio>
        <duration>05:00</duration>
        <rpm>80</rpm>
        <bpm>55</bpm>
        <bpmDefault>true</bpmDefault>
      </leg>
    </sequence>
  </icTrainerExercise>
</icTrainer>`;

    const parsed = parseZwoIntervals(ictx);

    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toEqual({ type: 'warmup', duration_seconds: 300, power_percent_ftp: 60 });
    expect(parsed[1]).toEqual({ type: 'interval', duration_seconds: 180, power_percent_ftp: 90 });
    expect(parsed[2]).toEqual({ type: 'recovery', duration_seconds: 180, power_percent_ftp: 60 });
    expect(parsed[3]).toEqual({ type: 'cooldown', duration_seconds: 300, power_percent_ftp: 50 });
  });

  it('escriu la postura a <position> i la indicacio a <comment>, no al nom', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'interval', duration_seconds: 240, power_percent_ftp: 92, cadence_rpm_target: 65, posture_cue: 'standing' },
      { type: 'recovery', duration_seconds: 120, power_percent_ftp: 55, cadence_rpm_target: 85, posture_cue: 'seated' },
    ];

    const xml = generateIctxXml(intervals, 'Postura Test');

    expect(xml).toContain('<position>standing</position>');
    expect(xml).toContain('<position>sitting</position>');
    expect(xml).toContain('<comment>');
  });

  it('posa el BOM i la declaracio sense encoding, com els .ictx propis d\'icTrainer', () => {
    const xml = generateIctxXml([{ type: 'interval', duration_seconds: 300, power_percent_ftp: 90 }], 'BOM Test');

    expect(xml.charCodeAt(0)).toBe(0xfeff);
    expect(xml).toContain('<?xml version="1.0" ?>');
    expect(xml).not.toContain('encoding=');
  });

  it('posa una indicacio a cada tram encara que l\'entrenament no en porti', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 300, power_percent_ftp: 50 },
      { type: 'interval', duration_seconds: 240, power_percent_ftp: 118, cadence_rpm_target: 62 },
      { type: 'cooldown', duration_seconds: 300, power_percent_ftp: 45 },
    ];

    const xml = generateIctxXml(intervals, 'Cues Test');
    const cues = xml.match(/<comment>[^<]*<\/comment>/g) ?? [];

    // 1 de la capcalera + 3 dels trams
    expect(cues).toHaveLength(4);
    expect(xml).toContain('118% FTP');
    expect(xml).toContain('62 rpm');
  });

  it('fa servir la indicacio escrita al tram quan n\'hi ha', () => {
    const xml = generateIctxXml(
      [{ type: 'interval', duration_seconds: 240, power_percent_ftp: 92, cue: 'Aixeca\'t i ataca' }],
      'Cua Propia Test'
    );

    expect(xml).toContain('<comment>Aixeca&apos;t i ataca</comment>');
  });

  it('usa XXL als trams forts, com el HIIT_01.ictx d\'icTrainer', () => {
    const xml = generateIctxXml([{ type: 'interval', duration_seconds: 30, power_percent_ftp: 135 }], 'XXL Test');

    expect(xml).toContain('<level>XXL</level>');
  });

  it('respecta el nivell del treball a <exerciseLevel>', () => {
    const intervals: WorkoutInterval[] = [{ type: 'interval', duration_seconds: 300, power_percent_ftp: 90 }];

    expect(generateIctxXml(intervals, 'Nivell A', { level: 'Advanced' })).toContain('<exerciseLevel>ADVANCED</exerciseLevel>');
    expect(generateIctxXml(intervals, 'Nivell B', { level: 'Beginner' })).toContain('<exerciseLevel>BEGINNER</exerciseLevel>');
    expect(generateIctxXml(intervals, 'Nivell C')).toContain('<exerciseLevel>INTERMEDIATE</exerciseLevel>');
  });

  it('posa la descripcio llarga i les dades a <description>, amb estil i sense escapar el HTML', () => {
    const xml = generateIctxXml(
      [{ type: 'interval', duration_seconds: 600, power_percent_ftp: 90 }],
      'Descripcio Test',
      { goal: 'Threshold', description: 'Un text amb <b> etiquetes & simbols', ftpWatts: 250 }
    );

    expect(xml).toContain('<description>');
    expect(xml).toContain('<span style="color:#E8ECF1">');
    expect(xml).toContain('color:#FDBA74');
    expect(xml).toContain('<br>');
    expect(xml).toContain('&lt;b&gt; etiquetes &amp; simbols');
  });

  it('computes a non-zero TSS for valid intervals and ftp', () => {
    const intervals: WorkoutInterval[] = [
      { type: 'warmup', duration_seconds: 600, power_percent_ftp: 55 },
      { type: 'interval', duration_seconds: 1800, power_percent_ftp: 90 },
      { type: 'cooldown', duration_seconds: 600, power_percent_ftp: 45 },
    ];

    const tss = calculateTSS(intervals, 250);

    expect(tss).toBeGreaterThan(0);
  });

  it('formats duration correctly', () => {
    expect(formatDuration(600)).toBe('10m');
    expect(formatDuration(605)).toBe('10m 5s');
  });
});
