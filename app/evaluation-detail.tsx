import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, downloadAndShareAuthenticatedFile } from "@/src/lib/api";

type Detail = {
  id: string;
  displayId?: string;
  display_id?: string;
  subject_name?: string;
  status?: string;
  total_marks?: number;
  maximum_marks?: number;
  percentage?: number;
  created_at?: string;
  completed_at?: string;
  error_message?: string;
  resultJson?: unknown;
};

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "REJECTED", "NEEDS_REVIEW", "CANCELLED", "PERSISTENCE_FAILED"]);

export default function EvaluationDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setError("Missing evaluation ID.");
      setBusy(false);
      return;
    }
    setError("");
    try {
      const response = await apiRequest<{ evaluation?: Detail }>(
        `/api/student/evaluations/${encodeURIComponent(id)}`
      );
      setData(response.evaluation || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load evaluation details.");
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Keep pending evaluations current without making the student pull-to-refresh.
  // Stop polling once the backend reports a terminal state or the screen unmounts.
  useEffect(() => {
    if (!data?.status || TERMINAL_STATUSES.has(data.status)) return;
    const timer = setTimeout(() => { void load(); }, 5000);
    return () => clearTimeout(timer);
  }, [data, load]);

  async function download(kind: "checked-copy" | "report") {
    if (!id) return;
    setError("");
    setDownloading(true);
    try {
      const suffix = kind === "checked-copy" ? "download-checked-copy" : "download-report";
      const filename = `AI-Exam-${kind}-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      await downloadAndShareAuthenticatedFile(
        `/api/student/evaluations/${encodeURIComponent(id)}/${suffix}`,
        filename
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the evaluation PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor="#C7F36B" />}
      >
        <Pressable onPress={() => router.back()}><Text style={s.back}>←  Evaluations</Text></Pressable>
        <Text style={s.kicker}>EVALUATION REPORT</Text>
        <Text style={s.title}>{data?.subject_name || "Evaluation details"}</Text>
        <Text style={s.sub}>Reference: {data?.displayId || data?.display_id || id || "—"}</Text>
        {busy && !data ? <ActivityIndicator color="#C7F36B" size="large" /> : null}
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        {data ? (
          <>
            <View style={s.card}>
              <Text style={s.label}>CURRENT STATUS</Text>
              <Text style={s.status}>{data.status || "UNKNOWN"}</Text>
              {data.status === "COMPLETED" ? (
                <>
                  <Text style={s.score}>{data.total_marks ?? "—"} / {data.maximum_marks ?? "—"}</Text>
                  <Text style={s.sub}>{typeof data.percentage === "number" ? `${data.percentage.toFixed(1)}%` : ""}</Text>
                </>
              ) : (
                <Text style={s.sub}>
                  {data.status && TERMINAL_STATUSES.has(data.status)
                    ? "The server has stopped processing this evaluation."
                    : "Status refreshes automatically about every 5 seconds while processing."}
                </Text>
              )}
              {data.error_message ? <Text style={s.error}>{data.error_message}</Text> : null}
            </View>
            <Pressable style={s.button} onPress={() => void load()}><Text style={s.buttonText}>Refresh status now</Text></Pressable>
            {data.status === "COMPLETED" ? (
              <>
                <Pressable disabled={downloading} style={[s.secondaryButton, downloading && { opacity: 0.65 }]} onPress={() => void download("checked-copy")}>
                  <Text style={s.secondaryButtonText}>{downloading ? "Preparing PDF…" : "Download checked copy PDF"}</Text>
                </Pressable>
                <Pressable disabled={downloading} style={[s.secondaryButton, downloading && { opacity: 0.65 }]} onPress={() => void download("report")}>
                  <Text style={s.secondaryButtonText}>Download detailed report PDF</Text>
                </Pressable>
              </>
            ) : null}
            <Text style={s.note}>PDF downloads use your authenticated session and existing student endpoints. Availability remains subject to server permissions, disclaimer and evaluation status.</Text>
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
  kicker: { color: "#C7F36B", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#F7F8FC", fontSize: 27, fontWeight: "900", marginTop: -8 },
  sub: { color: "#AAB4C7", fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: "#131B2F", borderColor: "#263149", borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 },
  label: { color: "#929DB2", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  status: { color: "#C7F36B", fontSize: 18, fontWeight: "900" },
  score: { color: "#F7F8FC", fontSize: 34, fontWeight: "900" },
  button: { height: 52, borderRadius: 14, backgroundColor: "#C7F36B", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#101827", fontWeight: "900" },
  secondaryButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: "#3A4966", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  secondaryButtonText: { color: "#C7F36B", fontWeight: "800", fontSize: 13 },
  note: { color: "#718098", fontSize: 11, lineHeight: 17 },
  error: { color: "#FFBABA", fontSize: 13 },
});
