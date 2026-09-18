import { afterEach, describe, expect, it } from 'bun:test';
import { detectBrowserLanguage } from './workout-options';

/** Simula el navegador canviant globalThis.navigator. */
function ambNavegador(lang: string | null) {
  if (lang === null) {
    // @ts-expect-error - volem provar el cas "sense navegador"
    delete (globalThis as any).navigator;
    return;
  }
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: lang, languages: [lang] },
    configurable: true,
    writable: true,
  });
}

describe('detectBrowserLanguage', () => {
  afterEach(() => {
    ambNavegador('en-US');
  });

  it('reconeix els tres idiomes de l\'app', () => {
    ambNavegador('ca-ES');
    expect(detectBrowserLanguage()).toBe('ca');
    ambNavegador('es-ES');
    expect(detectBrowserLanguage()).toBe('es');
    ambNavegador('en-GB');
    expect(detectBrowserLanguage()).toBe('en');
  });

  it('cau al catala amb un idioma que no te traduit', () => {
    ambNavegador('de-DE');
    expect(detectBrowserLanguage()).toBe('ca');
    ambNavegador('fr-FR');
    expect(detectBrowserLanguage()).toBe('ca');
  });

  it('cau al catala si no hi ha navegador (app nativa)', () => {
    ambNavegador(null);
    expect(detectBrowserLanguage()).toBe('ca');
  });

  it('mira la llista d\'idiomes preferits, no nomes el primer', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { language: 'de-DE', languages: ['de-DE', 'ca-ES', 'en-GB'] },
      configurable: true,
      writable: true,
    });
    expect(detectBrowserLanguage()).toBe('ca');
  });
});
