import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, downloadAndShareAuthenticatedFile } from "@/src/lib/api";

type RecheckRequest = { id?: string; request_type?: string; requestType?: string; question_number?: string; questionNumber?: string; reason?: string; status?: string; created_at?: string; createdAt?: string };

type MarkingComponentView = { componentId?: string; componentType?: string; expectedRequirement?: string; studentEvidence?: string; assessment?: string; marksAvailable?: number; marksAwarded?: number; marksDeducted?: number; deductionReason?: string; supportingProvision?: string; idealAnswer?: string; whatWasMissing?: string };
type QuestionFeedback = { questionNumber?: string; subQuestion?: string; topic?: string; maximumMarks?: number; marksAwarded?: number; marksLost?: number; status?: string; detailedFeedback?: string; reasonForDeduction?: string; missingRequirements?: string[]; applicableProvisions?: string[]; markingComponents?: MarkingComponentView[]; structuredEvidence?: { markingComponents?: MarkingComponentView[]; overallReason?: string }; stepMarkingBreakdown?: Array<{ step?: string; marksAwarded?: number; maximumMarks?: number; remarks?: string }> };
type ModeBreakdown = { totalMarks?: number; maximumMarks?: number; percentage?: number; grade?: string; displayName?: string; philosophy?: string };
type EvaluationReportData = { overallSummary?: string; strengths?: string[]; weaknesses?: string[]; recommendations?: string[]; questions?: QuestionFeedback[]; topicPerformance?: Array<{ topic?: string; marksObtained?: number; maximumMarks?: number; percentage?: number; status?: string }>; presentationAnalysis?: { score?: number; feedback?: string; workingNotesQuality?: string; handwritingLegibility?: string }; accuracyAnalysis?: { calculationAccuracy?: string; provisionsAccuracy?: string; methodologyCorrectness?: string }; evaluationStandardDisclaimer?: string; modeBreakdown?: { standard?: ModeBreakdown; strict?: ModeBreakdown; moderate?: ModeBreakdown }; scoreCalculationAudit?: Array<{ questionNumber?: string; maxMarks?: number; awardedMarks?: number; deductions?: number; componentsCount?: number }>; checkingMode?: string };

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
  raw_result_json?: string;
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
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [comparisonQuestion, setComparisonQuestion] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"standard" | "strict" | "moderate">("standard");

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
  const report = useMemo<EvaluationReportData | null>(() => {
    const raw = data?.resultJson ?? data?.raw_result_json;
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        const parsed: unknown = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed as EvaluationReportData : null;
      } catch { return null; }
    }
    return typeof raw === "object" ? raw as EvaluationReportData : null;
  }, [data?.resultJson, data?.raw_result_json]);
  const selectedModeData = report?.modeBreakdown?.[selectedMode];


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
                  <Text style={s.score}>{selectedModeData?.totalMarks ?? data.total_marks ?? "—"} / {selectedModeData?.maximumMarks ?? data.maximum_marks ?? "—"}</Text>
                  <Text style={s.sub}>{typeof (selectedModeData?.percentage ?? data.percentage) === "number" ? `${Number(selectedModeData?.percentage ?? data.percentage).toFixed(1)}%` : ""}{selectedModeData?.grade ? ` · ${selectedModeData.grade}` : ""}</Text>
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
            {data.status === "COMPLETED" && report?.modeBreakdown ? (
              <View style={s.reportCard}>
                <Text style={s.reportHeading}>Checking mode comparison</Text>
                <Text style={s.note}>These are the score variants returned by the evaluator for this completed report.</Text>
                <View style={s.modeRow}>
                  {(["standard", "strict", "moderate"] as const).filter((m) => !!report.modeBreakdown?.[m]).map((m) => (
                    <Pressable key={m} onPress={() => setSelectedMode(m)} style={[s.modeChip, selectedMode === m && s.modeChipActive]}>
                      <Text style={[s.modeChipText, selectedMode === m && s.modeChipTextActive]}>{report.modeBreakdown?.[m]?.displayName || m}</Text>
                    </Pressable>
                  ))}
                </View>
                {selectedModeData?.philosophy ? <Text style={s.body}>{selectedModeData.philosophy}</Text> : null}
              </View>
            ) : null}
            {data.status === "COMPLETED" && report ? (
              <View style={s.reportCard}>
                <Text style={s.reportHeading}>Evaluation feedback</Text>
                {report.overallSummary ? <Text style={s.body}>{report.overallSummary}</Text> : null}
                <View style={s.summaryColumns}>
                  <View style={s.summaryBlock}>
                    <Text style={s.reportSubheading}>Strengths</Text>
                    {(report.strengths || []).length ? report.strengths?.map((v, i) => <Text key={String(i) + v} style={s.reportBullet}>• {v}</Text>) : <Text style={s.note}>No strengths list was returned.</Text>}
                  </View>
                  <View style={s.summaryBlock}>
                    <Text style={s.reportSubheading}>Areas to improve</Text>
                    {(report.weaknesses || []).length ? report.weaknesses?.map((v, i) => <Text key={String(i) + v} style={s.reportBullet}>• {v}</Text>) : <Text style={s.note}>No weaknesses list was returned.</Text>}
                  </View>
                </View>
                {report.recommendations?.length ? <View style={s.summaryBlock}><Text style={s.reportSubheading}>Recommended next steps</Text>{report.recommendations.map((v, i) => <Text key={String(i) + v} style={s.reportBullet}>• {v}</Text>)}</View> : null}
                {report.topicPerformance?.length ? <View style={s.summaryBlock}>
                  <Text style={s.reportSubheading}>Topic performance</Text>
                  {report.topicPerformance.map((t, i) => <View key={String(i) + (t.topic || "topic")} style={s.topicRow}>
                    <View style={s.topicText}><Text style={s.topicName}>{t.topic || "Topic"}</Text><Text style={s.note}>{t.marksObtained ?? "—"} / {t.maximumMarks ?? "—"} · {t.status || "—"}</Text></View>
                    <Text style={s.topicPercent}>{typeof t.percentage === "number" ? t.percentage.toFixed(1) + "%" : "—"}</Text>
                  </View>)}
                </View> : null}
                {report.presentationAnalysis || report.accuracyAnalysis ? <View style={s.summaryBlock}>
                  <Text style={s.reportSubheading}>Presentation & technical analysis</Text>
                  {report.presentationAnalysis?.feedback ? <Text style={s.body}>Presentation: {report.presentationAnalysis.feedback}</Text> : null}
                  {report.presentationAnalysis?.workingNotesQuality ? <Text style={s.note}>Working notes: {report.presentationAnalysis.workingNotesQuality}</Text> : null}
                  {report.presentationAnalysis?.handwritingLegibility ? <Text style={s.note}>Legibility: {report.presentationAnalysis.handwritingLegibility}</Text> : null}
                  {report.accuracyAnalysis?.calculationAccuracy ? <Text style={s.body}>Calculations: {report.accuracyAnalysis.calculationAccuracy}</Text> : null}
                  {report.accuracyAnalysis?.provisionsAccuracy ? <Text style={s.body}>Provisions: {report.accuracyAnalysis.provisionsAccuracy}</Text> : null}
                  {report.accuracyAnalysis?.methodologyCorrectness ? <Text style={s.body}>Methodology: {report.accuracyAnalysis.methodologyCorrectness}</Text> : null}
                </View> : null}
                <Text style={s.reportSubheading}>Question-wise feedback ({report.questions?.length ?? 0})</Text>
                {report.questions?.length ? report.questions.map((q, i) => {
                  const key = String(i) + ":" + (q.questionNumber || "Q" + (i + 1));
                  const components = q.markingComponents || q.structuredEvidence?.markingComponents || [];
                  const open = expandedQuestion === key;
                  const comparing = comparisonQuestion === key;
                  return <View key={key} style={s.questionCard}>
                    <Pressable onPress={() => setExpandedQuestion(open ? null : key)} style={s.questionHeader}>
                      <View style={s.questionHeadingCopy}>
                        <Text style={s.questionTitle}>Q{q.questionNumber || i + 1}{q.subQuestion ? " (" + q.subQuestion + ")" : ""}{q.topic ? " · " + q.topic : ""}</Text>
                        <Text style={s.note}>{q.marksAwarded ?? 0} / {q.maximumMarks ?? 0} · Lost {q.marksLost ?? Math.max(0, (q.maximumMarks || 0) - (q.marksAwarded || 0))} · {(q.status || "not rated").replaceAll("_", " ")}</Text>
                      </View>
                      <Text style={s.link}>{open ? "Hide" : "Details"}</Text>
                    </Pressable>
                    {open ? <View style={s.questionDetail}>
                      {q.detailedFeedback ? <Text style={s.body}>{q.detailedFeedback}</Text> : null}
                      {q.reasonForDeduction ? <Text style={s.note}>Deduction reason: {q.reasonForDeduction}</Text> : null}
                      {q.structuredEvidence?.overallReason ? <Text style={s.note}>Structured marking: {q.structuredEvidence.overallReason}</Text> : null}
                      {q.missingRequirements?.length ? <View><Text style={s.reportSubheading}>Missing requirements</Text>{q.missingRequirements.map((v, j) => <Text key={String(j) + v} style={s.reportBullet}>• {v}</Text>)}</View> : null}
                      {q.applicableProvisions?.length ? <Text style={s.note}>Applicable provisions / standards: {q.applicableProvisions.join(", ")}</Text> : null}
                      {q.stepMarkingBreakdown?.length ? <View><Text style={s.reportSubheading}>Step marks</Text>{q.stepMarkingBreakdown.map((step, j) => <View key={String(j) + (step.step || "")} style={s.markingComponent}>
                        <Text style={s.reportSubheading}>{step.step || "Step " + (j + 1)} · {step.marksAwarded ?? 0} / {step.maximumMarks ?? 0}</Text>
                        {step.remarks ? <Text style={s.note}>{step.remarks}</Text> : null}
                      </View>)}</View> : null}
                      <Pressable onPress={() => setComparisonQuestion(comparing ? null : key)} style={s.secondaryButton}>
                        <Text style={s.secondaryButtonText}>{comparing ? "Hide stepwise comparison" : "Compare marking requirements & my evidence"}</Text>
                      </Pressable>
                      {comparing ? components.length ? components.map((component, j) => <View key={component.componentId || String(j)} style={s.markingComponent}>
                        <View style={s.componentHeader}><Text style={s.reportSubheading}>{component.componentType || "Step " + (j + 1)}</Text><Text style={s.componentMarks}>{component.marksAwarded ?? 0} / {component.marksAvailable ?? 0}</Text></View>
                        <Text style={s.componentLabel}>Expected requirement</Text><Text style={s.body}>{component.expectedRequirement || component.idealAnswer || "No requirement text was included in the report."}</Text>
                        <Text style={s.componentLabel}>Evidence from your answer</Text><Text style={s.body}>{component.studentEvidence || "No specific student evidence was included in the report."}</Text>
                        {component.deductionReason || component.whatWasMissing ? <Text style={s.note}>Why marks changed: {component.deductionReason || component.whatWasMissing}</Text> : null}
                        {component.supportingProvision ? <Text style={s.note}>Reference: {component.supportingProvision}</Text> : null}
                      </View>) : <Text style={s.note}>This question report did not include structured marking components. The step marks and examiner feedback above are the available details.</Text> : null}
                    </View> : null}
                  </View>;
                }) : <Text style={s.note}>The server did not return question-level feedback for this evaluation.</Text>}
                {report.scoreCalculationAudit?.length ? <View style={s.summaryBlock}>
                  <Text style={s.reportSubheading}>Score calculation audit</Text>
                  {report.scoreCalculationAudit.map((item, i) => <Text key={String(i) + (item.questionNumber || "")} style={s.note}>Q{item.questionNumber || i + 1}: {item.awardedMarks ?? "—"} / {item.maxMarks ?? "—"} · deductions {item.deductions ?? "—"} · {item.componentsCount ?? 0} components</Text>)}
                </View> : null}
                {report.evaluationStandardDisclaimer ? <Text style={s.disclaimer}>{report.evaluationStandardDisclaimer}</Text> : null}
              </View>
            ) : null}
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
  reportCard: { backgroundColor: "#11192A", borderColor: "#263149", borderWidth: 1, borderRadius: 16, padding: 15, gap: 12 },
  reportHeading: { color: "#F1F4FA", fontSize: 17, fontWeight: "900" },
  reportSubheading: { color: "#C7F36B", fontSize: 12, fontWeight: "900" },
  summaryColumns: { flexDirection: "column", gap: 10 },
  summaryBlock: { backgroundColor: "#0D1424", borderColor: "#263149", borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  reportBullet: { color: "#D8E0ED", fontSize: 11, lineHeight: 17 },
  body: { color: "#D8E0ED", fontSize: 12, lineHeight: 19 },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  modeChip: { borderWidth: 1, borderColor: "#34425D", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  modeChipActive: { backgroundColor: "#172B4D", borderColor: "#3B82F6" },
  modeChipText: { color: "#AAB4C7", fontSize: 10, fontWeight: "800" },
  modeChipTextActive: { color: "#93C5FD" },
  topicRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: "#27354C", paddingVertical: 7 },
  topicText: { flex: 1, gap: 3 },
  topicName: { color: "#F1F4FA", fontSize: 11, fontWeight: "800" },
  topicPercent: { color: "#C7F36B", fontSize: 12, fontWeight: "900" },
  questionCard: { borderWidth: 1, borderColor: "#2B3650", borderRadius: 12, padding: 12, gap: 9 },
  questionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  questionHeadingCopy: { flex: 1, gap: 4 },
  questionTitle: { color: "#F1F4FA", fontSize: 12, fontWeight: "900" },
  questionDetail: { gap: 9 },
  markingComponent: { backgroundColor: "#0D1424", borderWidth: 1, borderColor: "#27354C", borderRadius: 10, padding: 11, gap: 6 },
  componentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7 },
  componentMarks: { color: "#C7F36B", fontSize: 11, fontWeight: "900" },
  componentLabel: { color: "#93C5FD", fontSize: 10, fontWeight: "900" },
  disclaimer: { color: "#8290A8", fontSize: 10, lineHeight: 15 },
  error: { color: "#FFBABA", fontSize: 13 },
});
