import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, downloadAndShareAuthenticatedFile } from "@/src/lib/api";

type RecheckRequest = { id?: string; request_type?: string; requestType?: string; question_number?: string; questionNumber?: string; reason?: string; status?: string; created_at?: string; createdAt?: string };

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
  const [rechecks, setRechecks] = useState<RecheckRequest[]>([]);
  const [recheckType, setRecheckType] = useState<"SPECIFIC_QUESTION" | "COMPLETE_PAPER">("SPECIFIC_QUESTION");
  const [questionNumber, setQuestionNumber] = useState("");
  const [recheckReason, setRecheckReason] = useState("");
  const [rechecking, setRechecking] = useState(false);
  const [recheckNotice, setRecheckNotice] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setError("Missing evaluation ID.");
      setBusy(false);
      return;
    }
    setError("");
    try {
      const [response, recheckResponse] = await Promise.all([
        apiRequest<{ evaluation?: Detail }>(`/api/student/evaluations/${encodeURIComponent(id)}`),
        apiRequest<{ requests?: RecheckRequest[] }>(`/api/student/evaluations/${encodeURIComponent(id)}/recheck`).catch(() => ({ requests: [] as RecheckRequest[] })),
      ]);
      setData(response.evaluation || null);
      setRechecks(recheckResponse.requests || []);
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
    if (!data?.status || TERMINAL_STATUSES.has(data.status.toUpperCase())) return;
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

  async function submitRecheck() {
    if (!id) return;
    if (recheckType === "SPECIFIC_QUESTION" && !questionNumber.trim()) {
      setError("Enter the question number you want reviewed.");
      return;
    }
    if (recheckReason.trim().length < 10) {
      setError("Explain the reason for review in at least 10 characters.");
      return;
    }
    setRechecking(true); setError(""); setRecheckNotice("");
    try {
      const result = await apiRequest<{ success?: boolean; message?: string }>(`/api/student/evaluations/${encodeURIComponent(id)}/recheck`, {
        method: "POST",
        body: JSON.stringify({
          requestType: recheckType,
          questionNumber: recheckType === "COMPLETE_PAPER" ? "ALL" : questionNumber.trim(),
          reason: recheckReason.trim(),
          studentNotes: recheckReason.trim(),
        }),
      });
      if (result.success === false) throw new Error(result.message || "The server did not accept the review request.");
      setRecheckNotice(result.message || "Review request submitted. No evaluation credits were deducted.");
      setQuestionNumber(""); setRecheckReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit recheck request.");
    } finally { setRechecking(false); }
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
                  {data.status && TERMINAL_STATUSES.has(data.status.toUpperCase())
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
            {data.status === "COMPLETED" ? (
              <View style={s.recheckCard}>
                <Text style={s.cardTitle}>Request a recheck</Text>
                <Text style={s.note}>Ask for a question-specific review or a review of the full paper. The server checks ownership, completed status and duplicate pending requests; no credits are deducted for a request.</Text>
                <View style={s.recheckOptions}>
                  <Pressable onPress={() => setRecheckType("SPECIFIC_QUESTION")} style={[s.recheckOption, recheckType === "SPECIFIC_QUESTION" && s.recheckSelected]}><Text style={[s.recheckOptionText, recheckType === "SPECIFIC_QUESTION" && s.recheckSelectedText]}>Specific question</Text></Pressable>
                  <Pressable onPress={() => setRecheckType("COMPLETE_PAPER")} style={[s.recheckOption, recheckType === "COMPLETE_PAPER" && s.recheckSelected]}><Text style={[s.recheckOptionText, recheckType === "COMPLETE_PAPER" && s.recheckSelectedText]}>Complete paper</Text></Pressable>
                </View>
                {recheckType === "SPECIFIC_QUESTION" ? <TextInput value={questionNumber} onChangeText={setQuestionNumber} style={s.recheckInput} placeholder="Question number (e.g. 3(b))" placeholderTextColor="#718098" /> : null}
                <TextInput value={recheckReason} onChangeText={setRecheckReason} style={[s.recheckInput, s.recheckMultiline]} multiline textAlignVertical="top" maxLength={500} placeholder="Explain what you think should be reviewed (10–500 characters)." placeholderTextColor="#718098" />
                {recheckNotice ? <Text style={s.recheckSuccess}>{recheckNotice}</Text> : null}
                <Pressable disabled={rechecking} onPress={() => { void submitRecheck(); }} style={[s.button, rechecking && { opacity: 0.6 }]}><Text style={s.buttonText}>{rechecking ? "Submitting…" : "Submit recheck request"}</Text></Pressable>
                {rechecks.length ? <View style={s.recheckHistory}><Text style={s.cardTitle}>Request history</Text>{rechecks.map((request, i) => <View key={request.id || String(i)} style={s.recheckItem}><Text style={s.recheckOptionText}>{request.request_type || request.requestType || "Review"} · {request.question_number || request.questionNumber || "ALL"}</Text><Text style={s.note}>Status: {request.status || "—"} · {request.created_at || request.createdAt ? new Date(request.created_at || request.createdAt || "").toLocaleDateString() : "Date unavailable"}</Text>{request.reason ? <Text style={s.note}>{request.reason}</Text> : null}</View>)}</View> : null}
              </View>
            ) : null}
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
  recheckCard: { backgroundColor: "#11192A", borderColor: "#263149", borderWidth: 1, borderRadius: 16, padding: 15, gap: 11 },
  cardTitle: { color: "#F1F4FA", fontSize: 14, fontWeight: "900" },
  recheckOptions: { flexDirection: "row", gap: 8 },
  recheckOption: { flex: 1, borderWidth: 1, borderColor: "#34425D", borderRadius: 10, padding: 10, alignItems: "center" },
  recheckSelected: { backgroundColor: "#172B4D", borderColor: "#3B82F6" },
  recheckOptionText: { color: "#AAB4C7", fontSize: 11, fontWeight: "800" },
  recheckSelectedText: { color: "#93C5FD" },
  recheckInput: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: "#34425D", backgroundColor: "#0B1020", paddingHorizontal: 12, paddingVertical: 10, color: "#F7F8FC", fontSize: 12 },
  recheckMultiline: { minHeight: 100, paddingTop: 12 },
  recheckSuccess: { color: "#C7F36B", fontSize: 11, lineHeight: 17 },
  recheckHistory: { gap: 8, borderTopWidth: 1, borderTopColor: "#27354C", paddingTop: 10 },
  recheckItem: { borderRadius: 10, backgroundColor: "#0D1424", padding: 10, gap: 5 },
  error: { color: "#FFBABA", fontSize: 13 },
});
