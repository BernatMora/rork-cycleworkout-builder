# Welcome to your Rork app

## Project info

This is a native cross-platform mobile app created with [Rork](https://rork.com)

**Platform**: Native iOS & Android app, exportable to web
**Framework**: Expo Router + React Native

## How can I edit this code?

There are several ways of editing your native mobile application.

### **Use Rork**

Simply visit [rork.com](https://rork.com) and prompt to build your app with AI.

Changes made via Rork will be committed automatically to this GitHub repo.

Whenever you make a change in your local code editor and push it to GitHub, it will be also reflected in Rork.

### **Use your preferred code editor**

If you want to work locally using your own code editor, you can clone this repo and push changes. Pushed changes will also be reflected in Rork.

If you are new to coding and unsure which editor to use, we recommend Cursor. If you're familiar with terminals, try Claude Code.

The only requirement is having Node.js & Bun installed - [install Node.js with nvm](https://github.com/nvm-sh/nvm) and [install Bun](https://bun.sh/docs/installation)

Follow these steps:

```bash
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
bun i

# Step 4: Start the instant web preview of your Rork app in your browser, with auto-reloading of your changes
bun run start-web

# Step 5: Start iOS preview
# Option A (recommended):
bun run start  # then press "i" in the terminal to open iOS Simulator
# Option B (if supported by your environment):
bun run start -- --ios
```

### **Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

## What technologies are used for this project?

This project is built with the most popular native mobile cross-platform technical stack:

- **React Native** - Cross-platform native mobile development framework created by Meta and used for Instagram, Airbnb, and lots of top apps in the App Store
- **Expo** - Extension of React Native + platform used by Discord, Shopify, Coinbase, Telsa, Starlink, Eightsleep, and more
- **Expo Router** - File-based routing system for React Native with support for web, server functions and SSR
- **TypeScript** - Type-safe JavaScript
- **React Query** - Server state management
- **Lucide React Native** - Beautiful icons

## How can I test my app?

### **On your phone (Recommended)**

1. **iOS**: Download the [Rork app from the App Store](https://apps.apple.com/app/rork) or [Expo Go](https://apps.apple.com/app/expo-go/id982107779)
2. **Android**: Download the [Expo Go app from Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
3. Run `bun run start` and scan the QR code from your development server

### **In your browser**

Run `bun start-web` to test in a web browser. Note: The browser preview is great for quick testing, but some native features may not be available.

### **iOS Simulator / Android Emulator**

You can test Rork apps in Expo Go or Rork iOS app. You don't need XCode or Android Studio for most features.

**When do you need Custom Development Builds?**

- Native authentication (Face ID, Touch ID, Apple Sign In)
- In-app purchases and subscriptions
- Push notifications
- Custom native modules

Learn more: [Expo Custom Development Builds Guide](https://docs.expo.dev/develop/development-builds/introduction/)

If you have XCode (iOS) or Android Studio installed:

```bash
# iOS Simulator
bun run start -- --ios

# Android Emulator
bun run start -- --android
```

## How can I deploy this project?

### **Publish to App Store (iOS)**

1. **Install EAS CLI**:

   ```bash
   bun i -g @expo/eas-cli
   ```

2. **Configure your project**:

   ```bash
   eas build:configure
   ```

3. **Build for iOS**:

   ```bash
   eas build --platform ios
   ```

4. **Submit to App Store**:

   ```bash
   eas submit --platform ios
   ```

For detailed instructions, visit [Expo's App Store deployment guide](https://docs.expo.dev/submit/ios/).

### **Publish to Google Play (Android)**

1. **Build for Android**:

   ```bash
   eas build --platform android
   ```

2. **Submit to Google Play**:

   ```bash
   eas submit --platform android
   ```

For detailed instructions, visit [Expo's Google Play deployment guide](https://docs.expo.dev/submit/android/).

### **Publish as a Website**

Your React Native app can also run on the web:

1. **Build for web (static export)**:

   ```bash
   bun run build:web
   ```

2. **Deploy to Vercel (recommended)**:

   ```bash
   # First time only: login
   npx vercel login

   # Deploy production
   bun run deploy:vercel
   ```

3. **Automatic deploys with GitHub**:

- Import this repository in Vercel
- Build command: `npx expo export --platform web`
- Output directory: `dist`

Alternative web deployment options (same static folder):

- **Netlify**: build command `npx expo export --platform web`, publish directory `dist`
- **Cloudflare Pages**: build command `npx expo export --platform web`, output directory `dist`

## App Features

This template includes:

- **Cross-platform compatibility** - Works on iOS, Android, and Web
- **File-based routing** with Expo Router
- **Tab navigation** with customizable tabs
- **Modal screens** for overlays and dialogs
- **TypeScript support** for better development experience
- **Async storage** for local data persistence
- **Vector icons** with Lucide React Native

## Adaptive Game Ride (New MVP)

This project now includes a new experimental training engine at [utils/adaptive-game.ts](utils/adaptive-game.ts) that introduces a game-like adaptive workout flow.

### What makes it different

- **Branching phases**: each workout is split into 3-5 phases and each phase is assigned a lane:
  - **safe**: controlled progression
  - **aggressive**: higher-intensity push
- **Readiness-driven decisions** based on previous session stress and execution quality:
  - previous RPE
  - completion rate
  - heart-rate drift
  - cadence stability
- **Player profiles**:
  - `Explorer` (more conservative)
  - `Crusher` (more aggressive)
  - `Technician` (balanced)
- **Weekly Boss Workout** generated from your top weakness area:
  - VO2 Repeatability
  - Threshold Durability
  - Sprint Repeatability
  - Cadence Control

### Core APIs

- `generateAdaptiveGameSession(input)`
- `generateWeeklyBossWorkout(input)`
- `getAdaptiveGameReadinessScore(signals)`
- `pickWeeklyBossFocus(weaknessScores)`

### Quality checks

Unit tests for the new system are in [utils/adaptive-game.test.ts](utils/adaptive-game.test.ts).

## Advanced Training Modes

This project also includes an advanced workout transformation layer in [utils/advanced-modes.ts](utils/advanced-modes.ts), integrated in the main planner UI (`Advanced Training Mode`).

### Modes included

- **Race Simulator**: simulates race rhythm (openings, settles, attacks, finish) with selectable profile:
  - `TT`
  - `Crits`
  - `Gran Fondo`
- **Spin Class (v2)**: dedicated indoor class engine with selectable class personalities:
  - `Rhythm`
  - `Climb`
  - `Power`
  - `Recovery Flow`
  - Includes weekly 3:1 progression (week 4 deload), BPM/cadence ladders, seated/standing transitions, and per-session micro-objectives.
- **Cadence Intelligence**: injects low/normal/high cadence blocks (`75/90/105 rpm`) and writes cadence targets to ICTX export.
- **Heat/Stress Safe**: auto-softens peaks and increases recovery density when fatigue signals are high.
- **Micro-dose**: compresses quality into a smaller effective dose while keeping exact session duration.
- **Skills Day**: lower-intensity technique session with cadence control drills.
- **Block Periodization**: 3:1 logic with a consolidation week every 4th week, and selectable focus:
  - `VO2`
  - `Threshold`

### How to use in the app

- Open the planner screen.
- Choose a value in `Advanced Training Mode`.
- If applicable, set `Race Profile` (Race Simulator), `Spin Style` (Spin Class), or `Block Focus` (Block Periodization).
- Generate the plan.

### Validation

- Engine tests: [utils/advanced-modes.test.ts](utils/advanced-modes.test.ts)
- Cadence export test (ICTX `<rpm>`): [utils/zwo.test.ts](utils/zwo.test.ts)

## Release Notes

### Template (English)

```markdown
### YYYY-MM-DD

- Added:
   -
- Changed:
   -
- Fixed:
   -
- Tests:
  - `bun test` -> X pass / Y fail
```

### Plantilla (Català)

```markdown
### YYYY-MM-DD

- Afegit:
   -
- Canviat:
   -
- Corregit:
   -
- Tests:
  - `bun test` -> X pass / Y fail
```

### 2026-03-04

- Added **Adaptive Game Ride** engine and planner integration, including readiness states and weekly boss generation.
- Added **Advanced Training Modes** with seven transformations:
  - Race Simulator
  - Spin Class
  - Cadence Intelligence
  - Heat/Stress Safe
  - Micro-dose
  - Skills Day
  - Block Periodization
- Added cadence targets in workout intervals (`cadence_rpm_target`) and wired them to:
  - Preview table rendering in [components/WorkoutPreview.tsx](components/WorkoutPreview.tsx)
  - ICTX export `<rpm>` generation in [utils/zwo-core.ts](utils/zwo-core.ts)
- Added/updated tests for new behavior:
  - [utils/adaptive-game.test.ts](utils/adaptive-game.test.ts)
  - [utils/advanced-modes.test.ts](utils/advanced-modes.test.ts)
  - [utils/zwo.test.ts](utils/zwo.test.ts)
- Current validation status: `bun test` passing (`31 pass`, `0 fail`).

## Project Structure

```text
├── app/                    # App screens (Expo Router)
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── _layout.tsx    # Tab layout configuration
│   │   └── index.tsx      # Home tab screen
│   ├── _layout.tsx        # Root layout
│   ├── modal.tsx          # Modal screen example
│   └── +not-found.tsx     # 404 screen
├── assets/                # Static assets
│   └── images/           # App icons and images
├── constants/            # App constants and configuration
├── app.json             # Expo configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Custom Development Builds

For advanced native features, you'll need to create a Custom Development Build instead of using Expo Go.

### **When do you need a Custom Development Build?**

- **Native Authentication**: Face ID, Touch ID, Apple Sign In, Google Sign In
- **In-App Purchases**: App Store and Google Play subscriptions
- **Advanced Native Features**: Third-party SDKs, platform-specifc features (e.g. Widgets on iOS)
- **Background Processing**: Background tasks, location tracking

### **Creating a Custom Development Build**

```bash
# Install EAS CLI
bun i -g @expo/eas-cli

# Configure your project for development builds
eas build:configure

# Create a development build for your device
eas build --profile development --platform ios
eas build --profile development --platform android

# Install the development build on your device and start developing
bun start --dev-client
```

**Learn more:**

- [Development Builds Introduction](https://docs.expo.dev/develop/development-builds/introduction/)
- [Creating Development Builds](https://docs.expo.dev/develop/development-builds/create-a-build/)
- [Installing Development Builds](https://docs.expo.dev/develop/development-builds/installation/)

## Advanced Features

### **Add a Database**

Integrate with backend services:

- **Supabase** - PostgreSQL database with real-time features
- **Firebase** - Google's mobile development platform
- **Custom API** - Connect to your own backend

### **Add Authentication**

Implement user authentication:

**Basic Authentication (works in Expo Go):**

- **Expo AuthSession** - OAuth providers (Google, Facebook, Apple) - [Guide](https://docs.expo.dev/guides/authentication/)
- **Supabase Auth** - Email/password and social login - [Integration Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- **Firebase Auth** - Comprehensive authentication solution - [Setup Guide](https://docs.expo.dev/guides/using-firebase/)

**Native Authentication (requires Custom Development Build):**

- **Apple Sign In** - Native Apple authentication - [Implementation Guide](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)
- **Google Sign In** - Native Google authentication - [Setup Guide](https://docs.expo.dev/guides/google-authentication/)

### **Add Push Notifications**

Send notifications to your users:

- **Expo Notifications** - Cross-platform push notifications
- **Firebase Cloud Messaging** - Advanced notification features

### **Add Payments**

Monetize your app:

**Web & Credit Card Payments (works in Expo Go):**

- **Stripe** - Credit card payments and subscriptions - [Expo + Stripe Guide](https://docs.expo.dev/guides/using-stripe/)
- **PayPal** - PayPal payments integration - [Setup Guide](https://developer.paypal.com/docs/checkout/mobile/react-native/)

**Native In-App Purchases (requires Custom Development Build):**

- **RevenueCat** - Cross-platform in-app purchases and subscriptions - [Expo Integration Guide](https://www.revenuecat.com/docs/expo)
- **Expo In-App Purchases** - Direct App Store/Google Play integration - [Implementation Guide](https://docs.expo.dev/versions/latest/sdk/in-app-purchases/)

**Paywall Optimization:**

- **Superwall** - Paywall A/B testing and optimization - [React Native SDK](https://docs.superwall.com/docs/react-native)
- **Adapty** - Mobile subscription analytics and paywalls - [Expo Integration](https://docs.adapty.io/docs/expo)

## I want to use a custom domain - is that possible?

For web deployments, you can use custom domains with:

- **EAS Hosting** - Custom domains available on paid plans
- **Netlify** - Free custom domain support
- **Vercel** - Custom domains with automatic SSL

For mobile apps, you'll configure your app's deep linking scheme in `app.json`.

## Troubleshooting

### **App not loading on device?**

1. Make sure your phone and computer are on the same WiFi network
2. Try using tunnel mode: `bun start -- --tunnel`
3. Check if your firewall is blocking the connection

### **Build failing?**

1. Clear your cache: `bunx expo start --clear`
2. Delete `node_modules` and reinstall: `rm -rf node_modules && bun install`
3. Check [Expo's troubleshooting guide](https://docs.expo.dev/troubleshooting/build-errors/)

### **Need help with native features?**

- Check [Expo's documentation](https://docs.expo.dev/) for native APIs
- Browse [React Native's documentation](https://reactnative.dev/docs/getting-started) for core components
- Visit [Rork's FAQ](https://rork.com/faq) for platform-specific questions

## About Rork

Rork builds fully native mobile apps using React Native and Expo - the same technology stack used by Discord, Shopify, Coinbase, Instagram, and nearly 30% of the top 100 apps on the App Store.

Your Rork app is production-ready and can be published to both the App Store and Google Play Store. You can also export your app to run on the web, making it truly cross-platform.


