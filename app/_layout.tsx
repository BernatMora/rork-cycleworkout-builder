import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const appendHeadLink = (
      rel: string,
      href: string,
      attributes?: Record<string, string>
    ) => {
      const selectorParts = [`link[rel="${rel}"]`];
      if (attributes?.sizes) {
        selectorParts.push(`[sizes="${attributes.sizes}"]`);
      }
      const existing = document.head.querySelector(selectorParts.join(''));
      if (existing) {
        existing.setAttribute('href', href);
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            existing.setAttribute(key, value);
          });
        }
        return;
      }

      const link = document.createElement('link');
      link.setAttribute('rel', rel);
      link.setAttribute('href', href);
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          link.setAttribute(key, value);
        });
      }
      document.head.appendChild(link);
    };

    appendHeadLink('manifest', '/manifest.webmanifest');
    appendHeadLink('icon', '/favicon.png?v=3', { type: 'image/png', sizes: '32x32' });
    appendHeadLink('shortcut icon', '/favicon.ico?v=3');
    appendHeadLink('apple-touch-icon', '/apple-touch-icon.png?v=3');

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', '#0B1020');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[PWA] Service worker registration failed:', error);
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <StatusBar style="light" />
        <RootLayoutNav />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
