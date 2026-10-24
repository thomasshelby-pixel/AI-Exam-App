import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/src/lib/api";

type Preferences = {
  emailNotificationsEnabled: boolean;
  marketingEmailsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
};
type PreferencesResponse = { preferences?: Partial<Preferences>; success?: boolean };

const DEFAULTS: Preferences = {
  emailNotificationsEnabled: true,
  marketingEmailsEnabled: true,
  inAppNotificationsEnabled: true
};

const OPTIONS: Array<{
  key: keyof Preferences;
  title: string;
  description: string;
}> = [
  {
    key: "inAppNotificationsEnabled",
    title: "In-app notifications",
    description: "Account updates, evaluation changes and important notices inside the app."
  },
  {
    key: "emailNotificationsEnabled",
    title: "Email alerts",
    description: "Important account and service messages sent to your registered email."
  },
  {
    key: "marketingEmailsEnabled",
    title: "Product and promotional emails",
    description: "Optional product announcements, feature news and promotions."
  }
];

export default function NotificationPreferencesScreen() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [busy, setBusy] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof Preferences | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const response = await apiRequest<PreferencesResponse>("/api/student/notification-preferences");
      setPreferences({
        emailNotificationsEnabled: response.preferences?.emailNotificationsEnabled ?? DEFAULTS.emailNotificationsEnabled,
        marketingEmailsEnabled: response.preferences?.marketingEmailsEnabled ?? DEFAULTS.marketingEmailsEnabled,
        inAppNotificationsEnabled: response.preferences?.inAppNotificationsEnabled ?? DEFAULTS.inAppNotificationsEnabled
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notification preferences.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function update(key: keyof Preferences, nextValue: boolean) {
    if (savingKey) return;
    setError("");
    setNotice("");
    setSavingKey(key);
    try {
      const response = await apiRequest<PreferencesResponse>("/api/student/notification-preferences", {
        method: "PUT",
        body: JSON.stringify({ [key]: nextValue })
      });
      const saved = response.preferences;
      if (!saved || typeof saved[key] !== "boolean") {
        throw new Error("The server did not confirm the saved preference. Refresh and check your settings.");
      }
      setPreferences({
        emailNotificationsEnabled: saved.emailNotificationsEnabled ?? preferences.emailNotificationsEnabled,
        marketingEmailsEnabled: saved.marketingEmailsEnabled ?? preferences.marketingEmailsEnabled,
        inAppNotificationsEnabled: saved.inAppNotificationsEnabled ?? preferences.inAppNotificationsEnabled
      });
      setNotice("Notification preference saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save notification preference.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} refreshControl={
        <RefreshControl refreshing={busy} onRefresh={() => { void load(); }} tintColor="#C7F36B" />
      }>
        <Pressable onPress={() => router.back()}><Text style={s.back}>←  Notifications</Text></Pressable>
        <Text style={s.kicker}>YOUR CONTROL</Text>
        <Text style={s.title}>Notification settings</Text>
        <Text style={s.sub}>Your choices are saved by the existing AI-Exam account service and apply across supported channels.</Text>

        {busy && <ActivityIndicator color="#C7F36B" size="large" />}
        {error ? <View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable onPress={() => { void load(); }}><Text style={s.retry}>Reload settings</Text></Pressable></View> : null}
        {notice ? <Text style={s.notice}>{notice}</Text> : null}

        {!busy && !error ? OPTIONS.map((option) => (
          <View key={option.key} style={s.option}>
            <View style={s.optionCopy}>
              <Text style={s.optionTitle}>{option.title}</Text>
              <Text style={s.optionDescription}>{option.description}</Text>
              {savingKey === option.key ? <Text style={s.saving}>Saving to your account…</Text> : null}
            </View>
            <Switch
              value={preferences[option.key]}
              onValueChange={(value) => { void update(option.key, value); }}
              disabled={Boolean(savingKey)}
              trackColor={{ false: "#303B53", true: "#657D39" }}
              thumbColor={preferences[option.key] ? "#C7F36B" : "#AAB4C7"}
              accessibilityLabel={option.title}
            />
          </View>
        )) : null}

        <View style={s.note}>
          <Text style={s.noteTitle}>A quick note</Text>
          <Text style={s.noteText}>These settings control account notification preferences. They do not change your evaluation history, account security alerts required by the service, or your credits.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1020" },
  content: { padding: 22, paddingBottom: 40, gap: 15 },
  back: { color: "#AAB4C7", fontSize: 13, marginBottom: 12 },
  kicker: { color: "#C7F36B", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#F7F8FC", fontSize: 28, fontWeight: "900", marginTop: -7 },
  sub: { color: "#AAB4C7", fontSize: 13, lineHeight: 20 },
  option: { backgroundColor: "#11192A", borderColor: "#202B41", borderWidth: 1, borderRadius: 17, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  optionCopy: { flex: 1, gap: 7 },
  optionTitle: { color: "#F1F4FA", fontSize: 14, fontWeight: "800" },
  optionDescription: { color: "#AAB4C7", fontSize: 12, lineHeight: 18 },
  saving: { color: "#C7F36B", fontSize: 10, fontWeight: "700" },
  note: { backgroundColor: "#172333", borderRadius: 16, padding: 16, gap: 7, marginTop: 5 },
  noteTitle: { color: "#C7F36B", fontSize: 12, fontWeight: "800" },
  noteText: { color: "#AAB4C7", fontSize: 11, lineHeight: 17 },
  errorBox: { backgroundColor: "#321E2B", padding: 15, borderRadius: 14, gap: 10 },
  error: { color: "#FFC2C2", fontSize: 12, lineHeight: 18 },
  retry: { color: "#C7F36B", fontWeight: "800" },
  notice: { color: "#C7F36B", fontSize: 12 }
});
