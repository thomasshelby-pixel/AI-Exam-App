import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.setOptions({ duration: 650, fade: true });

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorScreen}>
      <StatusBar style="light" />
      <Text style={styles.errorEyebrow}>CA EXAM CHECKER AI</Text>
      <Text style={styles.errorTitle}>The app hit a startup error</Text>
      <Text style={styles.errorDescription}>
        The app caught a screen error instead of closing. Share this message with support.
      </Text>
      <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
        <Text selectable style={styles.errorMessage}>{error?.message || "Unknown JavaScript error"}</Text>
        {!!error?.stack && <Text selectable style={styles.errorStack}>{error.stack}</Text>}
      </ScrollView>
      <Pressable accessibilityRole="button" onPress={() => { void retry(); }} style={styles.retryButton}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#071126" },
          animation: "fade"
        }}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: "#071126",
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 28,
    gap: 14
  },
  errorEyebrow: { color: "#78B9FF", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  errorTitle: { color: "#F7F8FC", fontSize: 26, lineHeight: 32, fontWeight: "900" },
  errorDescription: { color: "#AAB4C7", fontSize: 14, lineHeight: 21 },
  errorBox: {
    flex: 1,
    minHeight: 120,
    backgroundColor: "#131B2F",
    borderColor: "#39445B",
    borderWidth: 1,
    borderRadius: 14
  },
  errorBoxContent: { padding: 14, gap: 10 },
  errorMessage: { color: "#FFE3A8", fontSize: 13, lineHeight: 19 },
  errorStack: { color: "#AAB4C7", fontSize: 10, lineHeight: 15 },
  retryButton: {
    backgroundColor: "#78B9FF",
    borderRadius: 14,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center"
  },
  retryText: { color: "#071126", fontSize: 15, fontWeight: "800" }
});
