# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Ship Android (pilot APK)

Merging to `main` does **not** update installable Android builds. After UI or feature work that should reach pilot farmers, follow [docs/ANDROID-PILOT-RELEASE.md](docs/ANDROID-PILOT-RELEASE.md) (`eas build -p android --profile pilot`, production EAS env vars, version/`versionCode` notes).

## UI text components

New code must import `Text` and `TextInput` from `@/components/ui/Text` and `@/components/ui/TextInput`, never from `react-native`.
