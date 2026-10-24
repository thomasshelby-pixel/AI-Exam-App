import { useState } from "react";
import { Link, router } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/src/lib/api";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function requestReset() {
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<{ success?: boolean; message?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail })
      });
      setMessage(result.message || "If an account exists with this email, a password reset link will be sent. Check your inbox.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request a password reset. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.content}>
          <Pressable onPress={() => router.back()}><Text style={s.back}>←  Back to sign in</Text></Pressable>
          <View style={s.logo}><Text style={s.logoText}>AI</Text></View>
          <Text style={s.kicker}>ACCOUNT RECOVERY</Text>
          <Text style={s.title}>Reset your password.</Text>
          <Text style={s.sub}>Enter the email address associated with your CA Exam Checker account. If it exists, the server will email a secure reset link that expires in one hour.</Text>
          <Text style={s.label}>EMAIL ADDRESS</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#66738A" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" style={s.input} accessibilityLabel="Email address" />
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
          {message ? <View style={s.successBox}><Text accessibilityRole="summary" style={s.success}>{message}</Text><Text style={s.mailHint}>Check your inbox and spam folder. Open the secure link in the email to complete the reset on the official website.</Text></View> : null}
          <Pressable onPress={requestReset} disabled={busy} style={[s.button, busy && s.disabled]}>
            {busy ? <ActivityIndicator color="#101827" /> : <Text style={s.buttonText}>Send reset link →</Text>}
          </Pressable>
          <Link href="/sign-in" style={s.signIn}>Return to sign in</Link>
          <Text style={s.foot}>For account privacy, the server uses the same confirmation message whether or not the email is registered.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1020" },
  flex: { flex: 1 },
  content: { padding: 24, flex: 1, justifyContent: "center", gap: 14 },
  back: { color: "#AAB4C7", marginBottom: 25, fontSize: 13 },
  logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#C7F36B", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  logoText: { color: "#101827", fontSize: 18, fontWeight: "900" },
  kicker: { color: "#C7F36B", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#F7F8FC", fontSize: 29, fontWeight: "900" },
  sub: { color: "#AAB4C7", fontSize: 13, lineHeight: 20, marginBottom: 9 },
  label: { color: "#AAB4C7", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  input: { height: 54, borderRadius: 13, borderWidth: 1, borderColor: "#2B3650", backgroundColor: "#121A2B", paddingHorizontal: 14, color: "#F7F8FC", fontSize: 14 },
  button: { minHeight: 54, borderRadius: 14, backgroundColor: "#C7F36B", alignItems: "center", justifyContent: "center", marginTop: 6 },
  buttonText: { color: "#101827", fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.65 },
  error: { color: "#FFC2C2", backgroundColor: "#321E2B", padding: 12, borderRadius: 10, fontSize: 12 },
  successBox: { backgroundColor: "#142B28", borderColor: "#2A4B42", borderWidth: 1, padding: 14, borderRadius: 12, gap: 8 },
  success: { color: "#C7F36B", fontSize: 12, lineHeight: 18, fontWeight: "700" },
  mailHint: { color: "#AAB4C7", fontSize: 11, lineHeight: 16 },
  signIn: { color: "#C7F36B", textAlign: "center", fontWeight: "700", fontSize: 12, marginTop: 8 },
  foot: { color: "#718098", fontSize: 10, lineHeight: 16, textAlign: "center", marginTop: 12 }
});
