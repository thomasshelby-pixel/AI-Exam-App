import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/src/lib/api";

type ReadValue = boolean | number | string | null | undefined;
type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  created_at?: string;
  read?: ReadValue;
  is_read?: ReadValue;
};
type NotificationResponse = { notifications?: NotificationItem[]; unreadCount?: number };

function isRead(item: NotificationItem) {
  return item.read === true || Number(item.read) === 1 || item.is_read === true || Number(item.is_read) === 1;
}
function formatDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date unavailable";
  return new Date(value).toLocaleString();
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busy, setBusy] = useState(true);
  const [marking, setMarking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setBusy(true);
    setError("");
    try {
      const response = await apiRequest<NotificationResponse>("/api/student/notifications");
      setItems(Array.isArray(response.notifications) ? response.notifications : []);
      setUnreadCount(Number(response.unreadCount) || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications.");
    } finally {
      if (!silent) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(true); }, 30000);
    return () => clearInterval(timer);
  }, [load]);

  async function markOne(item: NotificationItem) {
    if (isRead(item) || marking) return;
    setError("");
    setNotice("");
    setMarking(item.id);
    try {
      await apiRequest("/api/student/notifications/" + encodeURIComponent(item.id) + "/read", { method: "PUT" });
      setNotice("Notification marked as read.");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save notification read status.");
    } finally {
      setMarking("");
    }
  }

  async function markAll() {
    if (unreadCount === 0 || marking) return;
    setError("");
    setNotice("");
    setMarking("all");
    try {
      await apiRequest("/api/student/notifications/read-all", { method: "PUT" });
      setNotice("All notifications marked as read.");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark all notifications as read.");
    } finally {
      setMarking("");
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={busy && items.length > 0} onRefresh={() => { void load(); }} tintColor="#C7F36B" />}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>←  Dashboard</Text></Pressable>
        <View style={s.header}>
          <View style={s.titleGroup}>
            <Text style={s.kicker}>YOUR ACCOUNT</Text>
            <Text style={s.title}>Notifications</Text>
            <Text style={s.sub}>{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</Text>
          </View>
          <Pressable accessibilityRole="button" disabled={!unreadCount || Boolean(marking)} onPress={() => { void markAll(); }} style={[s.markAll, (!unreadCount || Boolean(marking)) && s.disabled]}>
            <Text style={s.markAllText}>{marking === "all" ? "Saving…" : "Mark all read"}</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push("/notification-preferences")} style={s.settingsLink}>
          <Text style={s.settingsIcon}>⚙</Text><Text style={s.settingsText}>Notification preferences</Text><Text style={s.settingsArrow}>›</Text>
        </Pressable>
        {busy && !items.length ? <ActivityIndicator color="#C7F36B" size="large" /> : null}
        {error ? <View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable onPress={() => { void load(); }}><Text style={s.retry}>Try again</Text></Pressable></View> : null}
        {notice ? <Text style={s.notice}>{notice}</Text> : null}
        {!busy && !error && !items.length ? <View style={s.empty}><Text style={s.emptyTitle}>You’re all caught up</Text><Text style={s.sub}>Important account updates will appear here.</Text></View> : null}
        {items.map((item) => {
          const read = isRead(item);
          return (
            <Pressable key={item.id} disabled={!read && Boolean(marking)} onPress={() => { void markOne(item); }} style={[s.card, !read && s.unreadCard]}>
              <View style={s.cardHead}>
                <Text style={s.itemTitle}>{item.title || "CA Exam Checker update"}</Text>
                {!read ? <View style={s.unreadDot} /> : <Text style={s.readLabel}>READ</Text>}
              </View>
              <Text style={s.message}>{item.message || "Open the website for more details if needed."}</Text>
              <View style={s.meta}>
                <Text style={s.type}>{String(item.type || "UPDATE").replaceAll("_", " ").toUpperCase()}</Text>
                <Text style={s.date}>{formatDate(item.created_at)}</Text>
              </View>
              {!read ? <Text style={s.markPrompt}>{marking === item.id ? "Saving read status…" : "Tap to mark as read"}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1020" },
  content: { padding: 22, paddingBottom: 40, gap: 15 },
  back: { color: "#AAB4C7", fontSize: 13, marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titleGroup: { flex: 1, gap: 7 },
  kicker: { color: "#C7F36B", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#F7F8FC", fontSize: 28, fontWeight: "900" },
  sub: { color: "#AAB4C7", fontSize: 13, lineHeight: 20 },
  markAll: { borderWidth: 1, borderColor: "#3A4966", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  markAllText: { color: "#C7F36B", fontSize: 11, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  settingsLink: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13, backgroundColor: "#11192A", borderColor: "#202B41", borderWidth: 1, borderRadius: 13 },
  settingsIcon: { color: "#C7F36B", fontSize: 17 },
  settingsText: { flex: 1, color: "#AAB4C7", fontSize: 12, fontWeight: "700" },
  settingsArrow: { color: "#718098", fontSize: 22 },
  card: { backgroundColor: "#11192A", borderColor: "#202B41", borderWidth: 1, borderRadius: 17, padding: 16, gap: 11 },
  unreadCard: { borderColor: "#8EA94D", backgroundColor: "#131F2C" },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  itemTitle: { flex: 1, color: "#F1F4FA", fontSize: 15, lineHeight: 21, fontWeight: "800" },
  unreadDot: { width: 9, height: 9, marginTop: 5, borderRadius: 5, backgroundColor: "#C7F36B" },
  readLabel: { color: "#718098", fontSize: 9, fontWeight: "800" },
  message: { color: "#AAB4C7", fontSize: 13, lineHeight: 20 },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  type: { color: "#C7F36B", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  date: { color: "#718098", fontSize: 10 },
  markPrompt: { color: "#8EA94D", fontSize: 10, fontWeight: "700" },
  notice: { color: "#C7F36B", fontSize: 12 },
  empty: { padding: 24, backgroundColor: "#11192A", borderRadius: 18, gap: 8 },
  emptyTitle: { color: "#F1F4FA", fontSize: 17, fontWeight: "800" },
  errorBox: { backgroundColor: "#321E2B", padding: 15, borderRadius: 14, gap: 10 },
  error: { color: "#FFC2C2" },
  retry: { color: "#C7F36B", fontWeight: "800" }
});
