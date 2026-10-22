import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, ApiError, saveSessionToken } from "@/src/lib/api";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    if (!process.env.EXPO_PUBLIC_API_BASE_URL?.trim()) {
      setError("App setup is incomplete: the existing AI-Exam API base URL has not been configured.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<{
        token?: string;
        mfaRequired?: boolean;
        mfaSessionToken?: string;
        message?: string;
        error?: string;
        user?: { id: string; email: string; fullName: string; role: string; status: string };
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, portalScope: "STUDENT" })
      });
      if (result.mfaRequired) {
        if (result.mfaSessionToken) { router.push({ pathname: "/mfa-verify", params: { token: result.mfaSessionToken, message: result.message || "Enter the 6-digit authenticator code." } }); return; }
        setError(result.message || "Additional verification is required, but the server did not return a verification session.");
        return;
      }
      if (!result.token || !result.user) throw new Error("The server response did not include a valid session.");
      if (result.user.role !== "STUDENT") throw new Error("The mobile app currently supports student accounts only. Please use the appropriate web portal.");
      await saveSessionToken(result.token);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Unable to sign in right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.content}>
          <Link href="/" style={styles.back}>←  Back</Link>
          <View style={styles.logo}><Text style={styles.logoText}>AI</Text></View>
          <Text style={styles.title}>Welcome back.</Text>
          <Text style={styles.subtitle}>Sign in with your existing CA Exam Checker account.</Text>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#66738A" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={styles.input} accessibilityLabel="Email address" />
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor="#66738A" secureTextEntry autoComplete="password" style={styles.input} accessibilityLabel="Password" />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable onPress={signIn} disabled={busy} style={[styles.button, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#101827" /> : <Text style={styles.buttonText}>Sign in securely  →</Text>}
          </Pressable>
          <Link href="/register" style={styles.register}>New to CA Exam Checker? Create a student account</Link>
          <Text style={styles.security}>Your password is not stored locally. Authentication is handled by the existing server.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1020" },
  flex: { flex: 1 },
  content: { padding: 24, flex: 1, justifyContent: "center" },
  back: { color: "#AAB4C7", marginBottom: 36, fontSize: 14 },
  logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#C7F36B", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  logoText: { color: "#101827", fontSize: 18, fontWeight: "900" },
  title: { color: "#F7F8FC", fontSize: 32, fontWeight: "900", letterSpacing: -0.8 },
  subtitle: { color: "#AAB4C7", fontSize: 14, lineHeight: 21, marginTop: 9, marginBottom: 30 },
  label: { color: "#AAB4C7", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderColor: "#2B3650", backgroundColor: "#121A2B", color: "#F7F8FC", borderRadius: 14, paddingHorizontal: 15, height: 54, fontSize: 15 },
  error: { color: "#FF9D9D", fontSize: 12, lineHeight: 18, marginTop: 12 },
  button: { marginTop: 22, minHeight: 54, borderRadius: 15, backgroundColor: "#C7F36B", alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.7 },
  buttonText: { color: "#101827", fontWeight: "800", fontSize: 15 },
  register: { color: "#C7F36B", fontSize: 12, fontWeight: "800", marginTop: 18, textAlign: "center" },
  security: { color: "#748199", fontSize: 11, lineHeight: 17, marginTop: 18 }
});
