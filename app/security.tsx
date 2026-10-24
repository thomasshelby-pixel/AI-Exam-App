import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, apiRequest, saveDeviceTrustToken, saveSessionToken } from "@/src/lib/api";

type Session = { id: string; device_id?: string; device_name?: string; ip_address?: string; status?: string; created_at?: string; last_activity_at?: string; expires_at?: string };
type MfaStatus = { role?: string; mfaMandatory?: boolean; mfaEnabled?: boolean; mfaVerified?: boolean; authenticatorsCount?: number; recoveryCodesRemaining?: number; recoveryCodesTotal?: number };
type Setup = { secretKey?: string; secret?: string; manualEntryKey?: string; formattedKey?: string; otpauthUri?: string; otpauthUrl?: string; qrDataUrl?: string; qrCodeDataUrl?: string; qrCode?: string; accountEmail?: string };
type TrustedDevice = { deviceId?: string; device_id?: string; deviceName?: string; device_name?: string; trustedAt?: string; trusted_at?: string; expiresAt?: string; expires_at?: string };
function fmt(v?: string) { return v && !Number.isNaN(Date.parse(v)) ? new Date(v).toLocaleString() : "—"; }

export default function SecurityScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [trusted, setTrusted] = useState<TrustedDevice[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [otp, setOtp] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [recoveryLeft, setRecoveryLeft] = useState<number | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (initial = false) => {
    if (initial) setBusy(true);
    setError("");
    try {
      const [sessionData, mfaData, trustData] = await Promise.all([
        apiRequest<{ sessions?: Session[]; activeCount?: number; maxAllowed?: number }>("/api/auth/active-sessions"),
        apiRequest<MfaStatus>("/api/auth/mfa/status"),
        apiRequest<{ trustedDevices?: TrustedDevice[] }>("/api/auth/mfa/trusted-devices").catch(() => ({ trustedDevices: [] })),
      ]);
      setSessions(sessionData.sessions || []);
      setMfa(mfaData);
      setTrusted(trustData.trustedDevices || []);
      setRecoveryLeft(typeof mfaData.recoveryCodesRemaining === "number" ? mfaData.recoveryCodesRemaining : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load account security.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { void load(true); }, [load]);

  async function action(key: string, call: () => Promise<any>, success: string) {
    setSaving(key); setError(""); setNotice(""); setCodes([]);
    try { const res = await call(); setNotice(res?.message || success); await load(false); return res; }
    catch (e) { setError(e instanceof Error ? e.message : "Security action failed."); return null; }
    finally { setSaving(""); }
  }
  async function changePassword() {
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
      setError("Enter your current password, a new password of at least 8 characters, and matching confirmation."); return;
    }
    await action("password", () => apiRequest("/api/auth/change-password", {
      method: "POST", body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    }), "Password changed.");
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  }
  async function beginMfa() {
    const res = await action("setup", () => apiRequest<{ totpSetup?: Setup }>("/api/auth/mfa/setup"), "Authenticator setup loaded.");
    if (res?.totpSetup) { setSetup(res.totpSetup); setOtp(""); }
  }
  async function verifyMfa() {
    if (!/^\d{6}$/.test(otp.trim())) { setError("Enter the current 6-digit authenticator code."); return; }
    const res = await action("enroll", () => apiRequest<{ recoveryCodes?: string[]; message?: string; token?: string; trustToken?: string }>("/api/auth/mfa/enroll/verify", {
      method: "POST", body: JSON.stringify({ secretKey: setup?.secretKey || setup?.secret || setup?.manualEntryKey, otpCode: otp.trim() })
    }), "Two-factor authentication enabled.");
    if (res?.token) await saveSessionToken(res.token);
    if (res?.trustToken) await saveDeviceTrustToken(res.trustToken);
    if (res?.recoveryCodes?.length) { setCodes(res.recoveryCodes); setNotice("MFA enabled. Save these one-time recovery codes now; they will not be shown again."); }
    setSetup(null); setOtp("");
  }
  async function disableMfa() {
    const res = await action("disable", () => apiRequest<{ success?: boolean }>("/api/auth/mfa/disable", { method: "POST", body: JSON.stringify({}) }), "MFA disabled by server.");
    if (res?.success) await saveDeviceTrustToken(null);
  }
  async function generateRecoveryCodes() {
    const res = await action("recovery", () => apiRequest<{ recoveryCodes?: string[]; message?: string }>("/api/auth/mfa/recovery-codes/regenerate", { method: "POST" }), "Recovery codes regenerated.");
    if (res?.recoveryCodes?.length) setCodes(res.recoveryCodes);
  }

  return <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={busy && sessions.length > 0} onRefresh={() => { void load(true); }} tintColor="#C7F36B" />}>
      <Pressable onPress={() => router.back()}><Text style={s.back}>←  Dashboard</Text></Pressable>
      <Text style={s.kicker}>ACCOUNT PROTECTION</Text>
      <Text style={s.title}>Security & devices</Text>
      <Text style={s.sub}>These controls use the existing security APIs. Session revocation, MFA state and device trust are confirmed by the server.</Text>
      {busy && !mfa ? <ActivityIndicator color="#C7F36B" size="large" /> : null}
      {error ? <View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable onPress={() => { void load(true); }}><Text style={s.link}>Retry</Text></Pressable></View> : null}
      {notice ? <Text style={s.notice}>{notice}</Text> : null}

      <View style={s.card}>
        <Text style={s.cardTitle}>Active sessions</Text>
        <Text style={s.help}>The app sends a persistent installation identifier to the existing session controls. The server decides whether a login exceeds its allowed device count.</Text>
        <View style={s.stats}><Text style={s.big}>{sessions.length}</Text><Text style={s.help}>active session(s)</Text><Text style={s.help}> · limit {mfa?.role === "STUDENT" ? "set by server" : "—"}</Text></View>
        {sessions.map((session) => <View key={session.id} style={s.rowCard}>
          <Text style={s.itemTitle}>{session.device_name || "Registered device"}</Text>
          <Text style={s.help}>Last active: {fmt(session.last_activity_at)}</Text>
          <Text style={s.help}>Created: {fmt(session.created_at)} · Expires: {fmt(session.expires_at)}</Text>
          {session.ip_address ? <Text style={s.help}>IP recorded by server: {session.ip_address}</Text> : null}
        </View>)}
        <Pressable disabled={!!saving || sessions.length < 2} onPress={() => { void action("sessions", () => apiRequest("/api/auth/sessions/revoke-others", { method: "POST", body: JSON.stringify({}) }), "Other sessions revoked."); }} style={[s.button, (saving || sessions.length < 2) && s.disabled]}>
          <Text style={s.buttonText}>{saving === "sessions" ? "Revoking…" : "Sign out other devices"}</Text>
        </Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Two-factor authentication</Text>
        <View style={[s.statusPill, mfa?.mfaEnabled ? s.statusGood : s.statusNeutral]}><Text style={s.statusText}>{mfa?.mfaEnabled ? "✓  Authenticator protection is ON" : "Authenticator protection is OFF"}</Text></View>
        {mfa?.mfaMandatory ? <Text style={s.help}>The server marks MFA as mandatory for this role. The app cannot disable a mandatory server policy.</Text> : null}
        <Text style={s.help}>MFA status comes from /api/auth/mfa/status. Setup secrets are shown only when the server returns them.</Text>
        {!mfa?.mfaEnabled ? <Pressable disabled={!!saving} onPress={() => { void beginMfa(); }} style={[s.button, saving && s.disabled]}><Text style={s.buttonText}>{saving === "setup" ? "Loading setup…" : "Set up authenticator app"}</Text></Pressable> : <>
          <Text style={s.help}>Authenticators: {mfa?.authenticatorsCount ?? 0} · Recovery codes left: {recoveryLeft ?? mfa?.recoveryCodesRemaining ?? "—"}</Text>
          <Pressable disabled={!!saving} onPress={() => { void generateRecoveryCodes(); }} style={[s.secondary, saving && s.disabled]}><Text style={s.secondaryText}>{saving === "recovery" ? "Generating…" : "Regenerate one-time recovery codes"}</Text></Pressable>
          <Pressable disabled={!!saving || !!mfa?.mfaMandatory} onPress={() => Alert.alert("Disable authenticator MFA?", "This removes authenticator protection and invalidates the account recovery codes. Only continue if you understand the security impact.", [{ text: "Cancel", style: "cancel" }, { text: "Disable MFA", style: "destructive", onPress: () => { void disableMfa(); } }])} style={[s.dangerButton, (!!saving || !!mfa?.mfaMandatory) && s.disabled]}><Text style={s.dangerText}>{saving === "disable" ? "Disabling…" : "Disable MFA (student accounts only)"}</Text></Pressable>
        </>}
        {setup ? <View style={s.setupBox}>
          <Text style={s.itemTitle}>1. Add this account to your authenticator</Text>
          <Text style={s.help}>Use your authenticator’s manual-entry option with the setup key returned by the server. Keep it private; do not send it to anyone.</Text>
          <Text selectable style={s.secret}>{setup.formattedKey || setup.secretKey || setup.secret || setup.manualEntryKey || "Secret key was not exposed in this response. Contact support rather than guessing it."}</Text>
          {setup.otpauthUri || setup.otpauthUrl ? <Text selectable style={s.help}>Authenticator URI: {setup.otpauthUri || setup.otpauthUrl}</Text> : null}
          {setup.qrDataUrl || setup.qrCodeDataUrl || setup.qrCode ? <Text style={s.help}>A QR setup image is available from the server. This screen currently shows the manual-entry key.</Text> : null}
          {setup.qrDataUrl || setup.qrCodeDataUrl ? <Image source={{ uri: setup.qrDataUrl || setup.qrCodeDataUrl }} style={s.qr} resizeMode="contain" accessibilityLabel="Authenticator enrollment QR code" /> : null}
          <Text style={s.itemTitle}>2. Verify your authenticator</Text>
          <TextInput value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" maxLength={6} style={s.input} placeholder="6-digit code" placeholderTextColor="#718098" />
          <Pressable disabled={!!saving} onPress={() => { void verifyMfa(); }} style={[s.button, saving && s.disabled]}><Text style={s.buttonText}>{saving === "enroll" ? "Verifying…" : "Verify & enable MFA"}</Text></Pressable>
          <Pressable onPress={() => { setSetup(null); setOtp(""); }}><Text style={s.link}>Cancel setup</Text></Pressable>
        </View> : null}
        {codes.length ? <View style={s.setupBox}><Text style={s.itemTitle}>Save these recovery codes securely</Text><Text style={s.help}>Each code is one-time use. They are only displayed in this response.</Text>{codes.map((code) => <Text selectable key={code} style={s.recoveryCode}>{code}</Text>)}</View> : null}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Trusted devices</Text>
        <Text style={s.help}>Trusted-device credentials are maintained by the server. Native HTTP-only cookie trust may not behave exactly like browser trust; review the list below and revoke anything unfamiliar.</Text>
        {trusted.map((device, i) => <View key={device.deviceId || device.device_id || String(i)} style={s.rowCard}>
          <Text style={s.itemTitle}>{device.deviceName || device.device_name || "Trusted device"}</Text>
          <Text style={s.help}>Trusted: {fmt(device.trustedAt || device.trusted_at)} · Expires: {fmt(device.expiresAt || device.expires_at)}</Text>
          <Pressable disabled={!!saving} onPress={() => { const id = device.deviceId || device.device_id; if (id) void action("trust-" + id, () => apiRequest("/api/auth/mfa/trusted-devices/revoke", { method: "POST", body: JSON.stringify({ deviceId: id }) }), "Device trust revoked."); }} style={s.secondary}><Text style={s.secondaryText}>Revoke this device trust</Text></Pressable>
        </View>)}
        <Pressable disabled={!!saving || trusted.length === 0} onPress={() => { void action("trust-all", () => apiRequest("/api/auth/mfa/trusted-devices/revoke-all", { method: "POST", body: JSON.stringify({}) }), "All trusted devices revoked."); }} style={[s.dangerButton, (saving || !trusted.length) && s.disabled]}><Text style={s.dangerText}>Revoke all trusted devices</Text></Pressable>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Change password</Text>
        <Text style={s.help}>Your current password is checked on the server. This form does not change credentials locally.</Text>
        <TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry style={s.input} placeholder="Current password" placeholderTextColor="#718098" autoCapitalize="none" />
        <TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry style={s.input} placeholder="New password (8+ characters)" placeholderTextColor="#718098" autoCapitalize="none" />
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry style={s.input} placeholder="Confirm new password" placeholderTextColor="#718098" autoCapitalize="none" />
        <Pressable disabled={!!saving} onPress={() => { void changePassword(); }} style={[s.button, saving && s.disabled]}><Text style={s.buttonText}>{saving === "password" ? "Updating…" : "Change password"}</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#0B1020"},content:{padding:22,paddingBottom:44,gap:15},back:{color:"#AAB4C7",fontSize:13,marginBottom:8},
  kicker:{color:"#C7F36B",fontSize:10,fontWeight:"900",letterSpacing:1.5},title:{color:"#F7F8FC",fontSize:28,fontWeight:"900"},sub:{color:"#AAB4C7",fontSize:12,lineHeight:19},
  card:{backgroundColor:"#11192A",borderColor:"#202B41",borderWidth:1,borderRadius:18,padding:16,gap:11},cardTitle:{color:"#F1F4FA",fontSize:16,fontWeight:"900"},
  help:{color:"#9BA8BE",fontSize:11,lineHeight:17},stats:{flexDirection:"row",alignItems:"center",gap:5},big:{color:"#C7F36B",fontSize:28,fontWeight:"900"},
  rowCard:{borderWidth:1,borderColor:"#2B3650",backgroundColor:"#0D1424",borderRadius:12,padding:12,gap:5},itemTitle:{color:"#F1F4FA",fontSize:12,fontWeight:"800"},
  statusPill:{padding:10,borderRadius:10},statusGood:{backgroundColor:"#092A29",borderColor:"#0E756E",borderWidth:1},statusNeutral:{backgroundColor:"#1A2639",borderColor:"#32425C",borderWidth:1},statusText:{color:"#C7F36B",fontSize:11,fontWeight:"900"},
  input:{height:48,borderRadius:12,borderWidth:1,borderColor:"#34425D",backgroundColor:"#0B1020",paddingHorizontal:13,color:"#F7F8FC",fontSize:13},button:{minHeight:49,borderRadius:12,backgroundColor:"#C7F36B",alignItems:"center",justifyContent:"center",padding:12},buttonText:{color:"#101827",fontWeight:"900",fontSize:12},
  secondary:{minHeight:42,borderRadius:11,borderColor:"#34425D",borderWidth:1,alignItems:"center",justifyContent:"center",padding:10},secondaryText:{color:"#B7F36B",fontWeight:"800",fontSize:11},
  dangerButton:{minHeight:42,borderRadius:11,borderColor:"#8A354A",borderWidth:1,alignItems:"center",justifyContent:"center",padding:10},dangerText:{color:"#FFB8B8",fontWeight:"800",fontSize:11},
  setupBox:{backgroundColor:"#172333",borderRadius:13,padding:12,gap:10},secret:{color:"#FDE68A",fontSize:14,fontWeight:"900",letterSpacing:1.2},qr:{width:220,height:220,alignSelf:"center",backgroundColor:"#FFFFFF",borderRadius:12,padding:8},recoveryCode:{color:"#C7F36B",fontFamily:"monospace",fontSize:14,paddingVertical:2},
  notice:{color:"#C7F36B",fontSize:12,lineHeight:18},link:{color:"#60A5FA",fontWeight:"800",fontSize:12},errorBox:{backgroundColor:"#321E2B",padding:14,borderRadius:12,gap:8},error:{color:"#FFC2C2",fontSize:12,lineHeight:18},disabled:{opacity:0.45}
});
