import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, apiRequest, clearSession } from "@/src/lib/api";

type VerificationMethod = "PASSWORD" | "EMAIL_OTP" | "EMAIL_CONFIRMATION";
type VerificationOptions = {
  email?: string;
  maskedEmail?: string;
  requiresEmailOtp?: boolean;
  verificationMethod?: VerificationMethod;
};
type DeleteResponse = { success?: boolean; message?: string; status?: "DELETED" | "DELETING" };

export default function DeleteAccountScreen() {
  const [options, setOptions] = useState<VerificationOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [complete, setComplete] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");

  const loadOptions = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const response = await apiRequest<VerificationOptions>("/api/student/delete-account/options");
      setOptions(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load account deletion requirements.");
      if (e instanceof ApiError && e.status === 401 && /session|log in again|account not found/i.test(e.message)) {
        router.replace("/sign-in");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOptions(); }, [loadOptions]);

  const method = options?.verificationMethod ?? "PASSWORD";

  async function sendOtp() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await apiRequest<{ success?: boolean; message?: string; maskedEmail?: string; cooldownSeconds?: number }>(
        "/api/student/delete-account/send-otp",
        { method: "POST", body: JSON.stringify({}) }
      );
      if (result.success === false) throw new Error(result.message || "The server did not send a verification code.");
      setOtpSent(true);
      setOtpVerified(false);
      setNotice(result.message || `A verification code was requested for ${result.maskedEmail || options?.maskedEmail || "your registered email"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setNotice("");
    if (!/^\d{6}$/.test(emailOtp.trim())) {
      setError("Enter the 6-digit code sent to your registered email.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<{ success?: boolean; message?: string }>("/api/student/delete-account/verify-otp", {
        method: "POST",
        body: JSON.stringify({ emailOtp: emailOtp.trim() })
      });
      if (result.success !== true) throw new Error(result.message || "The server did not confirm email verification.");
      setOtpVerified(true);
      setNotice(result.message || "Email verified. You can now continue with the final deletion confirmation.");
    } catch (e) {
      setOtpVerified(false);
      setError(e instanceof Error ? e.message : "Could not verify the email code.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setError("");
    setNotice("");
    if (confirmationText !== "DELETE") {
      setError('Type DELETE exactly to confirm permanent account deletion.');
      return;
    }
    if (method === "PASSWORD" && !currentPassword) {
      setError("Enter your current password to verify your identity.");
      return;
    }
    if (method === "EMAIL_CONFIRMATION" && !emailConfirmation.trim()) {
      setError("Enter your registered email address to confirm account ownership.");
      return;
    }
    if (method === "EMAIL_OTP" && !otpVerified) {
      setError("Verify the email code before continuing.");
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, string> = { confirmationText: "DELETE" };
      if (method === "PASSWORD") body.currentPassword = currentPassword;
      if (method === "EMAIL_CONFIRMATION") body.emailConfirmation = emailConfirmation.trim();
      if (method === "EMAIL_OTP") body.emailOtp = emailOtp.trim();

      const result = await apiRequest<DeleteResponse>("/api/student/delete-account", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (!result.success) throw new Error(result.message || "The server did not confirm account deletion.");
      await clearSession();
      setCompletionMessage(result.message || (result.status === "DELETING" ? "Your account deletion was accepted and cleanup is in progress." : "Your account deletion was completed."));
      setComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account deletion could not be completed.");
      if (e instanceof ApiError && e.status === 401 && /session expired|session has been logged out|invalid token|user account not found/i.test(e.message)) {
        router.replace("/sign-in");
      }
    } finally {
      setBusy(false);
    }
  }

  if (complete) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.complete}>
          <Text style={s.kicker}>ACCOUNT REQUEST</Text>
          <Text style={s.completeTitle}>Request received</Text>
          <Text style={s.sub}>{completionMessage}</Text>
          <Text style={s.noteText}>You have been signed out on this device. If the server is still completing deletion, do not try to create a duplicate account to bypass the process.</Text>
          <Pressable style={s.button} onPress={() => router.replace("/")}>
            <Text style={s.buttonText}>Return to welcome screen</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>←  Student profile</Text></Pressable>
        <Text style={s.kicker}>DANGER ZONE</Text>
        <Text style={s.title}>Delete account</Text>
        <Text style={s.sub}>This permanently deletes your student account and associated student data. Payment records required for statutory audit may be retained in anonymized form. This cannot be undone.</Text>

        {loading ? <ActivityIndicator color="#C7F36B" size="large" /> : null}
        {error ? <View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable onPress={() => { void loadOptions(); }}><Text style={s.retry}>Reload requirements</Text></Pressable></View> : null}
        {notice ? <Text style={s.notice}>{notice}</Text> : null}

        {options && !loading ? (
          <>
            <View style={s.methodCard}>
              <Text style={s.methodTitle}>Identity verification</Text>
              {method === "PASSWORD" ? (
                <>
                  <Text style={s.methodDescription}>Enter the current password for this account. An incorrect password will not delete your session.</Text>
                  <Text style={s.label}>CURRENT PASSWORD</Text>
                  <TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" style={s.input} placeholder="Current password" placeholderTextColor="#66738A" />
                </>
              ) : method === "EMAIL_OTP" ? (
                <>
                  <Text style={s.methodDescription}>A fresh one-time code is required. It will be sent only to your registered email {options.maskedEmail || "address"}.</Text>
                  <Pressable disabled={busy} onPress={() => { void sendOtp(); }} style={[s.secondaryButton, busy && s.disabled]}>
                    <Text style={s.secondaryButtonText}>{otpSent ? "Resend email code" : "Send email verification code"}</Text>
                  </Pressable>
                  {otpSent ? (
                    <>
                      <Text style={s.label}>6-DIGIT EMAIL CODE</Text>
                      <TextInput value={emailOtp} onChangeText={(v) => { setEmailOtp(v.replace(/\D/g, "").slice(0, 6)); setOtpVerified(false); }} keyboardType="number-pad" maxLength={6} style={s.input} placeholder="000000" placeholderTextColor="#66738A" />
                      <Pressable disabled={busy || otpVerified} onPress={() => { void verifyOtp(); }} style={[s.secondaryButton, (busy || otpVerified) && s.disabled]}>
                        <Text style={s.secondaryButtonText}>{otpVerified ? "Email verified ✓" : "Verify email code"}</Text>
                      </Pressable>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={s.methodDescription}>Confirm the exact registered email address to verify account ownership.</Text>
                  <Text style={s.label}>REGISTERED EMAIL</Text>
                  <TextInput value={emailConfirmation} onChangeText={setEmailConfirmation} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={s.input} placeholder="Enter your registered email" placeholderTextColor="#66738A" />
                </>
              )}
            </View>

            <View style={s.confirmCard}>
              <Text style={s.confirmTitle}>Final confirmation</Text>
              <Text style={s.methodDescription}>To prevent accidental deletion, type DELETE in capital letters below. Do not continue unless you intend to permanently delete this account.</Text>
              <Text style={s.label}>TYPE DELETE TO CONFIRM</Text>
              <TextInput value={confirmationText} onChangeText={(v) => setConfirmationText(v.toUpperCase().slice(0, 6))} autoCapitalize="characters" autoCorrect={false} style={s.input} placeholder="DELETE" placeholderTextColor="#66738A" />
              <Pressable disabled={busy || loading || confirmationText !== "DELETE"} onPress={() => { void deleteAccount(); }} style={[s.deleteButton, (busy || loading || confirmationText !== "DELETE") && s.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.deleteButtonText}>Permanently delete account</Text>}
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1020" },
  content: { padding: 22, paddingBottom: 40, gap: 15 },
  back: { color: "#AAB4C7", fontSize: 13, marginBottom: 12 },
  kicker: { color: "#F08C8C", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "#F7F8FC", fontSize: 29, fontWeight: "900", marginTop: -7 },
  sub: { color: "#AAB4C7", fontSize: 13, lineHeight: 20 },
  methodCard: { backgroundColor: "#11192A", borderColor: "#303B53", borderWidth: 1, borderRadius: 17, padding: 17, gap: 11 },
  methodTitle: { color: "#F1F4FA", fontSize: 15, fontWeight: "900" },
  methodDescription: { color: "#AAB4C7", fontSize: 12, lineHeight: 18 },
  label: { color: "#929DB2", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 4 },
  input: { height: 51, borderRadius: 13, borderWidth: 1, borderColor: "#3A465F", backgroundColor: "#0C1322", paddingHorizontal: 14, color: "#F7F8FC", fontSize: 14 },
  secondaryButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: "#3A4966", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  secondaryButtonText: { color: "#C7F36B", fontSize: 12, fontWeight: "800" },
  confirmCard: { backgroundColor: "#2B1823", borderColor: "#5A2C3B", borderWidth: 1, borderRadius: 17, padding: 17, gap: 11 },
  confirmTitle: { color: "#FFB8B8", fontSize: 15, fontWeight: "900" },
  deleteButton: { minHeight: 52, borderRadius: 13, backgroundColor: "#B6384F", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, marginTop: 5 },
  deleteButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  disabled: { opacity: 0.5 },
  errorBox: { backgroundColor: "#321E2B", padding: 15, borderRadius: 14, gap: 10 },
  error: { color: "#FFC2C2", fontSize: 12, lineHeight: 18 },
  retry: { color: "#C7F36B", fontWeight: "800" },
  notice: { color: "#C7F36B", fontSize: 12, lineHeight: 18 },
  complete: { flex: 1, padding: 25, justifyContent: "center", gap: 15 },
  completeTitle: { color: "#F7F8FC", fontSize: 29, fontWeight: "900" },
  noteText: { color: "#AAB4C7", fontSize: 12, lineHeight: 19, marginTop: 5 },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: "#C7F36B", alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginTop: 10 },
  buttonText: { color: "#101827", fontWeight: "900" }
});
