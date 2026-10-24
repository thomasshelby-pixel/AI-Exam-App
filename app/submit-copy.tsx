import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, apiRequest } from "@/src/lib/api";

type Level = "FOUNDATION" | "INTERMEDIATE" | "FINAL";
type Group = "GROUP_1" | "GROUP_2" | "ALL";
type MaterialType = "MTP" | "PYQ" | "MODEL_TEST_PAPER";
type Mode = "standard" | "strict" | "lenient";
type Paper = { key: string; name: string; number: number; group?: "GROUP_1" | "GROUP_2"; level: Level };
type Attempt = { id?: string; caLevel?: string; attemptLabel?: string; attemptCode?: string; active?: boolean; isActive?: boolean; sequenceOrder?: number };
type StudentProfile = {
  caLevel?: string;
  ca_level?: string;
  icaiRegistrationNumber?: string;
  icai_registration_number?: string;
};
type ProfileResponse = { profile?: StudentProfile | null };
type MeResponse = { user?: { hasPermanentFreeAccess?: boolean } | null; profile?: StudentProfile | null };
type MaterialCheckResponse = {
  available?: boolean;
  material?: { question_paper_title?: string; attempt?: string } | null;
  availableAttempts?: string[];
  message?: string;
  error?: string;
};
type PickedFile = { uri: string; name: string; mimeType?: string | null; size?: number | null };

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const LEVELS: Level[] = ["FOUNDATION", "INTERMEDIATE", "FINAL"];
const MATERIALS: { value: MaterialType; label: string }[] = [
  { value: "MTP", label: "MTP (Mock Test Paper)" },
  { value: "PYQ", label: "PYQ (Past Year Question Paper)" },
  { value: "MODEL_TEST_PAPER", label: "Model Test Paper" },
];
const PAPERS: Paper[] = [
  { key: "foundation_accounting", name: "Accounting", number: 1, level: "FOUNDATION" },
  { key: "foundation_business_law", name: "Business Laws", number: 2, level: "FOUNDATION" },
  { key: "foundation_quantitative_aptitude", name: "Quantitative Aptitude", number: 3, level: "FOUNDATION" },
  { key: "foundation_business_economics", name: "Business Economics", number: 4, level: "FOUNDATION" },
  { key: "inter_advanced_accounting", name: "Advanced Accounting", number: 1, group: "GROUP_1", level: "INTERMEDIATE" },
  { key: "inter_corporate_law", name: "Corporate and Other Laws", number: 2, group: "GROUP_1", level: "INTERMEDIATE" },
  { key: "inter_taxation", name: "Taxation (Income Tax & GST)", number: 3, group: "GROUP_1", level: "INTERMEDIATE" },
  { key: "inter_costing", name: "Cost and Management Accounting", number: 4, group: "GROUP_2", level: "INTERMEDIATE" },
  { key: "inter_auditing", name: "Auditing and Ethics", number: 5, group: "GROUP_2", level: "INTERMEDIATE" },
  { key: "inter_fm_sm", name: "Financial Management and Strategic Management", number: 6, group: "GROUP_2", level: "INTERMEDIATE" },
  { key: "final_fr", name: "Financial Reporting", number: 1, group: "GROUP_1", level: "FINAL" },
  { key: "final_afm", name: "Advanced Financial Management", number: 2, group: "GROUP_1", level: "FINAL" },
  { key: "final_advanced_auditing", name: "Advanced Auditing, Assurance and Professional Ethics", number: 3, group: "GROUP_1", level: "FINAL" },
  { key: "final_direct_tax", name: "Direct Tax Laws & International Taxation", number: 4, group: "GROUP_2", level: "FINAL" },
  { key: "final_indirect_tax", name: "Indirect Tax Laws", number: 5, group: "GROUP_2", level: "FINAL" },
  { key: "final_ibs", name: "Integrated Business Solutions (Multidisciplinary Case Study)", number: 6, group: "GROUP_2", level: "FINAL" },
];
const GROUPS: { value: Group; label: string }[] = [
  { value: "GROUP_1", label: "Group 1" },
  { value: "GROUP_2", label: "Group 2" },
  { value: "ALL", label: "All Papers" },
];
const MODES: { value: Mode; label: string }[] = [
  { value: "standard", label: "ICAI Standard" },
  { value: "strict", label: "Strict" },
  { value: "lenient", label: "Lenient" },
];

function normalizeLevel(value: unknown): Level | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return LEVELS.includes(normalized as Level) ? normalized as Level : null;
}
function levelLabel(level: Level) {
  return level === "FOUNDATION" ? "CA Foundation" : level === "INTERMEDIATE" ? "CA Intermediate" : "CA Final";
}
function materialLabel(value: MaterialType) {
  return MATERIALS.find((x) => x.value === value)?.label || value;
}

export default function SubmitCopyScreen() {
  const [level, setLevel] = useState<Level>("INTERMEDIATE");
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseLoadError, setCourseLoadError] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [hasPermanentAccess, setHasPermanentAccess] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group>("GROUP_1");
  const [subjectKey, setSubjectKey] = useState("inter_advanced_accounting");
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
  const [materialType, setMaterialType] = useState<MaterialType>("MTP");
  const [mtpSeries, setMtpSeries] = useState<"1" | "2">("1");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attempt, setAttempt] = useState("");
  const [attemptLoading, setAttemptLoading] = useState(true);
  const [checkingMode, setCheckingMode] = useState<Mode>("standard");
  const [materialStatus, setMaterialStatus] = useState<"idle" | "checking" | "available" | "unavailable" | "error">("idle");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialMessage, setMaterialMessage] = useState("");
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showCreditsLink, setShowCreditsLink] = useState(false);

  const loadCurrentProfile = useCallback(async () => {
    setCourseLoading(true);
    setCourseLoadError("");
    try {
      const [profileResponse, me] = await Promise.all([
        apiRequest<ProfileResponse>("/api/student/profile"),
        apiRequest<MeResponse>("/api/auth/me").catch(() => null),
      ]);
      const profile = profileResponse.profile || me?.profile || {};
      const current = normalizeLevel(profile.caLevel || profile.ca_level);
      if (!current) throw new Error("Your current CA course is missing from your saved student profile. Open Profile & Settings and complete it first.");
      setLevel(current);
      setSelectedGroup(current === "FOUNDATION" ? "ALL" : "GROUP_1");
      setRegistrationNumber(profile.icaiRegistrationNumber || profile.icai_registration_number || "");
      setHasPermanentAccess(Boolean(me?.user?.hasPermanentFreeAccess));
      setSubjectKey((old) => {
        const valid = PAPERS.find((paper) => paper.key === old && paper.level === current);
        return valid?.key || PAPERS.find((paper) => paper.level === current)?.key || "";
      });
    } catch (e) {
      setCourseLoadError(e instanceof Error ? e.message : "Could not verify your saved CA course.");
    } finally {
      setCourseLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadCurrentProfile(); }, [loadCurrentProfile]));

  const availablePapers = useMemo(() => PAPERS.filter((paper) =>
    paper.level === level && (level === "FOUNDATION" || selectedGroup === "ALL" || paper.group === selectedGroup)
  ), [level, selectedGroup]);
  const selectedPaper = PAPERS.find((paper) => paper.key === subjectKey && paper.level === level) || availablePapers[0];

  useEffect(() => {
    if (!availablePapers.length) return;
    if (!availablePapers.some((paper) => paper.key === subjectKey)) setSubjectKey(availablePapers[0].key);
  }, [availablePapers, subjectKey]);

  useEffect(() => {
    if (!courseLoading && !courseLoadError && level && !attemptLoading) return;
  }, [courseLoading, courseLoadError, level, attemptLoading]);

  useEffect(() => {
    if (courseLoading || courseLoadError || !level) return;
    let active = true;
    setAttemptLoading(true);
    setMaterialStatus("idle");
    apiRequest<{ attempts?: Attempt[] }>("/api/public/attempts?level=" + encodeURIComponent(level))
      .then((response) => {
        if (!active) return;
        const all = Array.isArray(response.attempts) ? response.attempts : [];
        const enabled = all.filter((item) => item.active !== false && item.isActive !== false);
        const list = enabled.length ? enabled : all;
        setAttempts(list);
        setAttempt((current) => {
          if (list.some((item) => item.attemptLabel === current)) return current;
          const websiteDefault = list.find((item) => String(item.attemptLabel || "").toUpperCase() === "MAY 2026");
          return websiteDefault?.attemptLabel || list[list.length - 1]?.attemptLabel || "";
        });
      })
      .catch((e) => {
        if (active) {
          setAttempts([]);
          setAttempt("");
          setMaterialStatus("error");
          setMaterialMessage(e instanceof Error ? e.message : "Could not load official exam attempts.");
        }
      })
      .finally(() => { if (active) setAttemptLoading(false); });
    return () => { active = false; };
  }, [level, courseLoading, courseLoadError]);

  useEffect(() => {
    if (courseLoading || courseLoadError || !level || !subjectKey || !attempt || attemptLoading) return;
    let active = true;
    setMaterialStatus("checking");
    setMaterialMessage("");
    setMaterialTitle("");
    const path = "/api/public/materials-check?level=" + encodeURIComponent(level)
      + "&subjectKey=" + encodeURIComponent(subjectKey)
      + "&attempt=" + encodeURIComponent(attempt)
      + "&materialType=" + encodeURIComponent(materialType)
      + (materialType === "MTP" ? "&mtpSeries=" + encodeURIComponent(mtpSeries) : "");
    apiRequest<MaterialCheckResponse>(path)
      .then((response) => {
        if (!active) return;
        if (response.available && response.material) {
          setMaterialStatus("available");
          setMaterialTitle(response.material.question_paper_title || "Verified official reference material");
          setMaterialMessage("ICAI Suggested Answers & Marking Scheme Loaded");
        } else {
          setMaterialStatus("unavailable");
          setMaterialMessage(response.message || response.error || "No approved suggested answer and marking scheme is available for this paper and attempt yet.");
        }
      })
      .catch((e) => {
        if (!active) return;
        setMaterialStatus("error");
        setMaterialMessage(e instanceof Error ? e.message : "Could not verify reference material with the server.");
      });
    return () => { active = false; };
  }, [courseLoading, courseLoadError, level, subjectKey, attempt, attemptLoading, materialType, mtpSeries]);

  async function chooseFile() {
    setError("");
    setMessage("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      if (typeof file.size === "number" && file.size > MAX_UPLOAD_BYTES) {
        setError("File exceeds the current 30 MB app limit. Please compress the PDF or choose a smaller file.");
        return;
      }
      setPicked({ uri: file.uri, name: file.name, mimeType: file.mimeType, size: file.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the file picker.");
    }
  }

  async function submit() {
    setError("");
    setMessage("");
    setShowCreditsLink(false);
    if (courseLoading) { setError("Please wait while we verify your saved CA course."); return; }
    if (courseLoadError) { setError("Your CA course could not be verified. Open your student profile and try again."); return; }
    if (!availablePapers.length || !selectedPaper) { setError("Select a valid subject and paper for your saved CA course."); return; }
    if (attemptLoading || !attempt) { setError("Wait for the official exam attempt list to load, then select your target attempt."); return; }
    if (materialStatus !== "available") {
      setError(materialStatus === "checking" ? "Please wait while the server checks the suggested answer and marking scheme." : "The server has not confirmed approved reference material for this selection. Select another available attempt or paper.");
      return;
    }
    if (!picked) { setError("Choose your handwritten answer sheet as a PDF or image first."); return; }
    if (!acknowledged) { setError("Please read and acknowledge the evaluation disclaimer before submitting."); return; }
    if (materialType === "MTP" && !["1", "2"].includes(mtpSeries)) { setError("Choose MTP Series 1 or 2."); return; }

    setBusy(true);
    try {
      const disclaimer = await apiRequest<{ acknowledged?: boolean; currentVersion?: string }>("/api/student/disclaimer/status");
      if (!disclaimer.currentVersion) throw new Error("The server did not return the current disclaimer version.");
      if (!disclaimer.acknowledged) {
        await apiRequest("/api/student/disclaimer/acknowledge", {
          method: "POST",
          body: JSON.stringify({ version: disclaimer.currentVersion }),
        });
      }

      const encoded = await FileSystem.readAsStringAsync(picked.uri, { encoding: FileSystem.EncodingType.Base64 });
      const estimatedBytes = Math.ceil(encoded.length * 3 / 4);
      if (estimatedBytes > MAX_UPLOAD_BYTES) {
        setPicked(null);
        throw new Error("The selected file exceeds the current 30 MB app limit after reading. Choose a smaller PDF or image.");
      }
      const body: Record<string, unknown> = {
        studentName: "",
        icaiRegistrationNumber: registrationNumber || "N/A",
        level,
        materialType,
        subjectKey: selectedPaper.key,
        subjectName: selectedPaper.name,
        attempt,
        checkingMode,
        fileBase64: encoded,
        mimeType: picked.mimeType || (picked.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
        filename: picked.name,
        evaluationSource: "PUBLIC",
        examType: "CA",
      };
      if (materialType === "MTP") body.mtpSeries = Number(mtpSeries);
      if (selectedGroup !== "ALL") body.modelGroup = selectedGroup;

      const response = await apiRequest<{ success?: boolean; evaluationId?: string; id?: string; message?: string }>("/api/student/evaluate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (response.success === false) throw new Error(response.message || "The server did not accept the evaluation.");
      setMessage(response.message || "Submission accepted by the server. Your evaluation status will appear in Evaluations.");
      setPicked(null);
      router.replace("/evaluations");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Submission failed. No success has been assumed.";
      setError(errorMessage);
      if (e instanceof ApiError && e.status === 402) setShowCreditsLink(true);
    } finally {
      setBusy(false);
    }
  }

  const maxBytes = picked?.size ?? 0;
  const ready = !courseLoading && !courseLoadError && !attemptLoading && !!attempt && materialStatus === "available";
  const accessLabel = hasPermanentAccess ? "Permanent Access Active" : "Account access is checked securely on submission";

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={s.back}>←  Dashboard</Text></Pressable>
        <Text style={s.kicker}>ANSWER-SHEET CHECKER</Text>
        <Text style={s.title}>Paper specification</Text>
        <Text style={s.sub}>Choose the paper, official reference material and attempt. The server checks eligibility and applies its authoritative marking engine.</Text>

        <View style={s.panel}>
          <Text style={s.sectionTitle}>▱  1. PAPER SPECIFICATION</Text>
          <Text style={s.label}>EXAMINATION TYPE</Text>
          <View style={s.examRow}>
            <View style={[s.examCard, s.examSelected]}>
              <Text style={s.examTitle}>CA</Text>
              <Text style={s.examDesc}>Chartered Accountancy</Text>
              <Text style={s.availableTag}>✓  Available</Text>
            </View>
            <View style={[s.examCard, s.examLocked]}>
              <Text style={s.examTitleMuted}>CS</Text>
              <Text style={s.examDesc}>Company Secretary</Text>
              <Text style={s.lockTag}>▣  Coming Soon</Text>
            </View>
            <View style={[s.examCard, s.examLocked]}>
              <Text style={s.examTitleMuted}>CMA</Text>
              <Text style={s.examDesc}>Cost & Management</Text>
              <Text style={s.lockTag}>▣  Coming Soon</Text>
            </View>
          </View>

          <Text style={s.label}>CA EXAMINATION LEVEL</Text>
          <Text style={s.help}>{courseLoading ? "Checking your saved course…" : (courseLoadError || ("Your account is set to " + levelLabel(level) + ". Select another course only from Edit Profile."))}</Text>
          <View style={s.levelRow}>
            {LEVELS.map((value) => (
              <Pressable key={value} onPress={() => { if (value !== level) setMessage("Your account is set to " + levelLabel(level) + ". Change the course from Edit Profile before evaluating another level."); }} style={[s.option, level === value && s.optionActive]}>
                <Text style={[s.optionText, level === value && s.optionTextActive]}>{value === "INTERMEDIATE" ? "Inter" : value === "FOUNDATION" ? "Foundation" : "Final"}</Text>
              </Pressable>
            ))}
          </View>
          {courseLoadError ? <Pressable style={s.linkButton} onPress={() => router.push("/profile")}><Text style={s.linkText}>Open Edit Profile</Text></Pressable> : null}
          <Text style={s.label}>GROUP</Text>
          {level === "FOUNDATION" ? (
            <View style={[s.option, s.optionActive]}><Text style={[s.optionText, s.optionTextActive]}>All Papers</Text></View>
          ) : (
            <View style={s.levelRow}>
              {GROUPS.map((item) => (
                <Pressable key={item.value} onPress={() => { setSelectedGroup(item.value); setSubjectMenuOpen(false); }} style={[s.option, selectedGroup === item.value && s.optionActive]}>
                  <Text style={[s.optionText, selectedGroup === item.value && s.optionTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={s.label}>SUBJECT & PAPER</Text>
          <Pressable disabled={!availablePapers.length} onPress={() => setSubjectMenuOpen((open) => !open)} style={s.selector}>
            <Text style={s.selectorText} numberOfLines={2}>{selectedPaper ? "Paper " + selectedPaper.number + ": " + selectedPaper.name : "Select paper"}</Text>
            <Text style={s.chevron}>{subjectMenuOpen ? "⌃" : "⌄"}</Text>
          </Pressable>
          {subjectMenuOpen ? (
            <View style={s.menu}>
              {availablePapers.map((paper) => (
                <Pressable key={paper.key} onPress={() => { setSubjectKey(paper.key); setSubjectMenuOpen(false); }} style={[s.menuItem, selectedPaper?.key === paper.key && s.menuItemSelected]}>
                  <Text style={[s.menuText, selectedPaper?.key === paper.key && s.menuTextSelected]}>Paper {paper.number}: {paper.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={s.label}>PAPER TYPE</Text>
          <View style={s.materialRow}>
            {MATERIALS.map((item) => (
              <Pressable key={item.value} onPress={() => setMaterialType(item.value)} style={[s.materialOption, materialType === item.value && s.materialActive]}>
                <Text style={[s.materialText, materialType === item.value && s.materialTextActive]}>{item.value === "MODEL_TEST_PAPER" ? "Model Test" : item.value}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.help}>{materialLabel(materialType)}</Text>

          {materialType === "MTP" ? (
            <>
              <Text style={s.label}>MTP SERIES</Text>
              <View style={s.levelRow}>
                {(["1", "2"] as const).map((value) => (
                  <Pressable key={value} onPress={() => setMtpSeries(value)} style={[s.option, mtpSeries === value && s.optionActive]}>
                    <Text style={[s.optionText, mtpSeries === value && s.optionTextActive]}>Series {value} (Official)</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={s.label}>TARGET ATTEMPT</Text>
          {attemptLoading ? <ActivityIndicator color="#3B82F6" /> : attempts.length ? (
            <View style={s.attempts}>
              {attempts.map((item, index) => (
                <Pressable key={item.id || item.attemptCode || item.attemptLabel || index} onPress={() => setAttempt(item.attemptLabel || "")} style={[s.attemptOption, attempt === item.attemptLabel && s.attemptActive]}>
                  <Text style={[s.attemptText, attempt === item.attemptLabel && s.attemptTextActive]}>{item.attemptLabel || item.displayName || "Attempt"}</Text>
                </Pressable>
              ))}
            </View>
          ) : <Text style={s.warning}>Official attempts could not be loaded. Use Try again below after checking your connection.</Text>}

          <Text style={s.label}>EVALUATOR STRICTNESS</Text>
          <View style={s.selector}>
            <Text style={s.selectorText}>{MODES.find((item) => item.value === checkingMode)?.label || "ICAI Standard"}</Text>
          </View>
          <View style={s.modeRow}>
            {MODES.map((item) => (
              <Pressable key={item.value} onPress={() => setCheckingMode(item.value)} style={[s.modeOption, checkingMode === item.value && s.modeActive]}>
                <Text style={[s.modeText, checkingMode === item.value && s.modeTextActive]}>{item.label}</Text>
                <Text style={s.modeHelp}>{item.value === "standard" ? "Balanced & realistic" : item.value === "strict" ? "Hard examiner-style" : "Learning-focused"}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[s.materialStatus, materialStatus === "available" ? s.materialStatusGood : materialStatus === "unavailable" || materialStatus === "error" ? s.materialStatusBad : s.materialStatusChecking]}>
            <Text style={s.statusIcon}>{materialStatus === "available" ? "✓" : materialStatus === "checking" ? "◌" : "!"}</Text>
            <View style={s.statusContent}>
              <Text style={[s.statusTitle, materialStatus === "available" ? s.goodText : materialStatus === "unavailable" || materialStatus === "error" ? s.badText : s.checkText]}>
                {materialStatus === "available" ? "ICAI Suggested Answers & Marking Scheme Loaded" : materialStatus === "checking" ? "Checking official reference material…" : materialStatus === "unavailable" ? "Reference material not available" : materialStatus === "error" ? "Could not verify reference material" : "Waiting for paper selection"}
              </Text>
              {materialTitle ? <Text style={s.statusDescription}>{materialTitle}</Text> : null}
              {materialMessage && materialStatus !== "available" ? <Text style={s.statusDescription}>{materialMessage}</Text> : null}
            </View>
          </View>
          {!attemptLoading && !attempts.length ? <Pressable style={s.linkButton} onPress={() => { setAttemptLoading(true); apiRequest<{ attempts?: Attempt[] }>("/api/public/attempts?level=" + encodeURIComponent(level)).then((r) => { const list = r.attempts || []; setAttempts(list); setAttempt(list.find((x) => x.attemptLabel === "May 2026")?.attemptLabel || list[list.length - 1]?.attemptLabel || ""); setMaterialStatus("idle"); }).catch((e) => setMaterialMessage(e instanceof Error ? e.message : "Could not load attempts.")).finally(() => setAttemptLoading(false)); }}><Text style={s.linkText}>Retry attempt list</Text></Pressable> : null}
        </View>

        <View style={s.panel}>
          <Text style={s.sectionTitle}>⇧  2. ANSWER-SHEET UPLOAD</Text>
          {hasPermanentAccess ? <View style={s.permanentInline}><Text style={s.permanentInlineText}>✓  {accessLabel} · unlimited eligible evaluations</Text></View> : <Text style={s.help}>{accessLabel}</Text>}
          <Pressable onPress={() => { void chooseFile(); }} style={s.file}>
            <Text style={s.fileIcon}>⇧</Text>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={s.fileTitle}>{picked ? picked.name : "Choose answer-sheet PDF or image"}</Text>
              <Text style={s.fileSub}>{picked ? ((maxBytes / 1024 / 1024).toFixed(2) + " MB selected") : "PDF or image · maximum 30 MB"}</Text>
            </View>
            <Text style={s.choose}>{picked ? "Change" : "Browse"}</Text>
          </Pressable>
          <Text style={s.help}>The app limit is 30 MB to keep the base64 request within the current server JSON body limit. Larger files need a separate upload-transport change.</Text>

          <Pressable onPress={() => setAcknowledged((value) => !value)} style={s.ackRow}>
            <View style={[s.checkbox, acknowledged && s.checkboxOn]}>{acknowledged ? <Text style={s.checkmark}>✓</Text> : null}</View>
            <Text style={s.ackText}>I understand that evaluation is based on the official reference material available on the platform and is subject to the displayed evaluation disclaimer.</Text>
          </Pressable>

          {error ? <View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{error}</Text>{showCreditsLink ? <Pressable style={s.linkButton} onPress={() => router.push("/credits")}><Text style={s.linkText}>View credits and purchase in the app</Text></Pressable> : null}</View> : null}
          {message ? <Text style={s.success}>{message}</Text> : null}
          <Pressable disabled={busy || !ready} onPress={() => { void submit(); }} style={[s.submit, (busy || !ready) && s.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.submitText}>Check answer sheet  →</Text>}
          </Pressable>
          <Text style={s.foot}>Reference availability, permanent access, credit balances and evaluation results are controlled by the server.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1020" },
  content: { padding: 16, paddingBottom: 42, gap: 14 },
  back: { color: "#AAB4C7", fontSize: 13, paddingVertical: 4 },
  kicker: { color: "#60A5FA", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "#F7F8FC", fontSize: 28, fontWeight: "900", marginTop: -8 },
  sub: { color: "#AAB4C7", fontSize: 12, lineHeight: 19, marginTop: -3 },
  panel: { backgroundColor: "#10182A", borderColor: "#222F46", borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  sectionTitle: { color: "#F1F5FB", fontSize: 15, fontWeight: "900", marginBottom: 2 },
  label: { color: "#CBD5E1", fontSize: 11, fontWeight: "800", marginTop: 7 },
  help: { color: "#8DA0BC", fontSize: 10, lineHeight: 15, marginTop: -4 },
  examRow: { flexDirection: "row", gap: 7 },
  examCard: { flex: 1, minHeight: 95, borderRadius: 14, borderWidth: 1, padding: 9, justifyContent: "space-between", gap: 4 },
  examSelected: { backgroundColor: "#142044", borderColor: "#2563EB", borderWidth: 1.5 },
  examLocked: { backgroundColor: "#141E30", borderColor: "#2A354A" },
  examTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "900" },
  examTitleMuted: { color: "#AAB4C7", fontSize: 16, fontWeight: "900" },
  examDesc: { color: "#8798B3", fontSize: 9, lineHeight: 12 },
  availableTag: { alignSelf: "flex-start", color: "#34D399", backgroundColor: "#073A34", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, fontSize: 9, fontWeight: "900", overflow: "hidden" },
  lockTag: { alignSelf: "flex-start", color: "#9AA8BE", backgroundColor: "#1F2B3F", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, fontSize: 9, fontWeight: "800", overflow: "hidden" },
  levelRow: { flexDirection: "row", gap: 7 },
  option: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: "#2B3A53", backgroundColor: "#1A263A", alignItems: "center", justifyContent: "center", paddingVertical: 9, paddingHorizontal: 5 },
  optionActive: { backgroundColor: "#1D4ED8", borderColor: "#3B82F6" },
  optionText: { color: "#AAB9CF", fontWeight: "800", fontSize: 10, textAlign: "center" },
  optionTextActive: { color: "#FFFFFF" },
  linkButton: { paddingVertical: 5, alignSelf: "flex-start" },
  linkText: { color: "#60A5FA", fontSize: 11, fontWeight: "900" },
  selector: { minHeight: 46, borderRadius: 11, borderWidth: 1, borderColor: "#3B82F6", backgroundColor: "#1D293E", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectorText: { color: "#F1F5F9", fontSize: 12, flex: 1 },
  chevron: { color: "#CBD5E1", fontSize: 21, fontWeight: "900" },
  menu: { borderColor: "#2B3A53", borderWidth: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#111B2D" },
  menuItem: { paddingHorizontal: 12, paddingVertical: 12, borderBottomColor: "#233149", borderBottomWidth: 1 },
  menuItemSelected: { backgroundColor: "#1E3A8A" },
  menuText: { color: "#CBD5E1", fontSize: 12, lineHeight: 17 },
  menuTextSelected: { color: "#FFFFFF", fontWeight: "800" },
  materialRow: { flexDirection: "row", gap: 7 },
  materialOption: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "#2B3A53", backgroundColor: "#182338", paddingVertical: 11, paddingHorizontal: 4, alignItems: "center" },
  materialActive: { backgroundColor: "#1D4ED8", borderColor: "#3B82F6" },
  materialText: { color: "#AAB9CF", fontSize: 10, fontWeight: "800", textAlign: "center" },
  materialTextActive: { color: "#FFFFFF" },
  attempts: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  attemptOption: { borderRadius: 9, borderWidth: 1, borderColor: "#2B3A53", backgroundColor: "#182338", paddingVertical: 9, paddingHorizontal: 10 },
  attemptActive: { borderColor: "#2563EB", backgroundColor: "#172E5F" },
  attemptText: { color: "#AAB9CF", fontSize: 10, fontWeight: "800" },
  attemptTextActive: { color: "#FFFFFF" },
  modeRow: { gap: 7 },
  modeOption: { borderRadius: 10, borderWidth: 1, borderColor: "#2B3A53", backgroundColor: "#141E30", padding: 10, gap: 4 },
  modeActive: { borderColor: "#3B82F6", backgroundColor: "#142044" },
  modeText: { color: "#C7D2E1", fontSize: 11, fontWeight: "900" },
  modeTextActive: { color: "#93C5FD" },
  modeHelp: { color: "#8798B3", fontSize: 10 },
  materialStatus: { flexDirection: "row", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "flex-start", marginTop: 3 },
  materialStatusGood: { backgroundColor: "#062F2D", borderColor: "#047857" },
  materialStatusBad: { backgroundColor: "#351B28", borderColor: "#9F1239" },
  materialStatusChecking: { backgroundColor: "#172337", borderColor: "#344863" },
  statusIcon: { color: "#34D399", fontSize: 16, fontWeight: "900" },
  statusContent: { flex: 1, gap: 4 },
  statusTitle: { fontSize: 11, fontWeight: "900", lineHeight: 16 },
  goodText: { color: "#34D399" },
  badText: { color: "#FDA4AF" },
  checkText: { color: "#BFDBFE" },
  statusDescription: { color: "#AAB9CF", fontSize: 10, lineHeight: 15 },
  warning: { color: "#FED7AA", fontSize: 11, lineHeight: 17 },
  file: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, borderColor: "#344863", borderStyle: "dashed", padding: 14, backgroundColor: "#121C2E" },
  fileIcon: { color: "#60A5FA", fontSize: 23, fontWeight: "900" },
  fileTitle: { color: "#F1F5FB", fontSize: 12, fontWeight: "900" },
  fileSub: { color: "#AAB9CF", fontSize: 10 },
  choose: { color: "#60A5FA", fontSize: 11, fontWeight: "900" },
  permanentInline: { borderRadius: 10, borderWidth: 1, borderColor: "#0E756E", backgroundColor: "#092A29", padding: 10 },
  permanentInlineText: { color: "#42E8C3", fontSize: 10, fontWeight: "900", lineHeight: 15 },
  ackRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 },
  checkbox: { width: 21, height: 21, borderRadius: 5, borderWidth: 1, borderColor: "#64748B", alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: "#C7F36B", borderColor: "#C7F36B" },
  checkmark: { color: "#101827", fontWeight: "900" },
  ackText: { color: "#AAB4C7", flex: 1, fontSize: 10, lineHeight: 16 },
  errorBox: { backgroundColor: "#321E2B", borderRadius: 12, padding: 12, gap: 8 },
  error: { color: "#FFC2C2", fontSize: 12, lineHeight: 18 },
  success: { color: "#C7F36B", fontSize: 12, lineHeight: 18 },
  submit: { minHeight: 53, borderRadius: 14, backgroundColor: "#1D4ED8", alignItems: "center", justifyContent: "center", padding: 12, marginTop: 5 },
  submitText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  foot: { color: "#718098", fontSize: 10, lineHeight: 16, textAlign: "center" },
});
