import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Shell HTML del lloc. Vercel serveix aquest fitxer tal qual, i aqui es on
 * van les etiquetes que llegeixen WhatsApp, X, Reddit... quan algu enganxa
 * l'enllac: sense elles la targeta surt com una URL pelada.
 *
 * Aquest fitxer NOMES s'executa en exportar per web (estatic): no arriba mai
 * al bundle de l'app, aixi que res del que hi hagi aqui afecta iOS/Android.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ca">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>Cycle Plan Builder — crea i baixa entrenaments per a icTrainer</title>

        <meta
          name="description"
          content="Genera entrenaments de ciclisme indoor (30-90 min, tots els objectius), mira'ls en grafica i baixa'ls en .ictx per a icTrainer, o en .zwo/.mrc/.erg. Gratis i sense registre."
        />

        {/* Etiquetes de previsualitzacio en compartir l'enllac */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Cycle Plan Builder — entrenaments per a icTrainer" />
        <meta
          property="og:description"
          content="Crea un entrenament de ciclisme indoor en un toc i baixa'l en .ictx per a icTrainer (tambe .zwo/.mrc/.erg). Gratis i sense registre."
        />
        <meta property="og:locale" content="ca_ES" />
        <meta property="og:locale:alternate" content="es_ES" />
        <meta property="og:locale:alternate" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Cycle Plan Builder — entrenaments per a icTrainer" />
        <meta
          name="twitter:description"
          content="Crea un entrenament de ciclisme indoor en un toc i baixa'l en .ictx per a icTrainer."
        />
        <meta name="theme-color" content="#0B1120" />

        {/*
          React Native Web: cal aquest reset perque l'app ocupa tota la pantalla.
          Ve del propi expo-router (no inventar-lo).
        */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
