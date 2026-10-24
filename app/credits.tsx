import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/src/lib/api";

type CreditSummary = {
  monthlyFreeEvaluationsUsed?: number;
  monthlyFreeEvaluationsLimit?: number;
  freeEvaluationResetMonth?: string;
  freeEvaluationsRemaining?: number;
  paidCredits?: number;
  totalAvailable?: number;
  canEvaluate?: boolean;
  statusMessage?: string;
};
type CreditLedgerItem = {
  id: string;
  amount?: number;
  source?: string;
  balance_after?: number;
  order_id?: string | null;
  payment_id?: string | null;
  note?: string | null;
  created_at?: string;
};
type CreditsResponse = {
  entitlement?: { freeEvaluationsRemaining?: number; monthlyFreeEvaluationsLimit?: number };
  creditSummary?: CreditSummary;
  ledger?: CreditLedgerItem[];
};

function formatDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date unavailable";
  return new Date(value).toLocaleDateString();
}

export default function CreditsScreen() {
  const [data, setData] = useState<CreditsResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest<CreditsResponse>("/api/student/credits");
      setData(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load credit balance.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const summary = data?.creditSummary;
  const remaining = summary?.freeEvaluationsRemaining ?? data?.entitlement?.freeEvaluationsRemaining ?? 0;
  const limit = summary?.monthlyFreeEvaluationsLimit ?? data?.entitlement?.monthlyFreeEvaluationsLimit ?? 0;
  const paid = summary?.paidCredits ?? 0;
  const total = summary?.totalAvailable ?? (remaining + paid);

  async function openWebsite() {
    try {
      await WebBrowser.openBrowserAsync("https://caexamcheckerai.com");
    } catch {
      setError("Could not open the CA Exam Checker website. Please open it in your browser.");
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={busy && Boolean(data)} onRefresh={() => { void load(); }} tintColor="#C7F36B" />}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>←  Dashboard</Text></Pressable>
        <Text style={s.kicker}>ACCOUNT & BILLING</Text>
        <Text style={s.title}>Credits & usage</Text>
        <Text style={s.sub}>Balances are read from the existing account service. The app never changes credits locally.</Text>
        {busy && !data ? <ActivityIndicator color="#C7F36B" size="large" /> : null}
        {error ? <View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable onPress={() => { void load(); }}><Text style={s.retry}>Try again</Text></Pressable></View> : null}
        {data ? (
          <>
            <View style={s.hero}>
              <Text style={s.muted}>TOTAL AVAILABLE EVALUATIONS</Text>
              <Text style={s.total}>{total}</Text>
              <Text style={s.status}>{summary?.statusMessage || (total > 0 ? "Your account can submit eligible answer sheets." : "No evaluations are currently available.")}</Text>
            </View>
            <View style={s.stats}>
              <View style={s.stat}><Text style={s.statNumber}>{remaining}</Text><Text style={s.statLabel}>Free evaluations left</Text></View>
              <View style={s.stat}><Text style={s.statNumber}>{paid}</Text><Text style={s.statLabel}>Paid credits</Text></View>
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>Monthly free allowance</Text>
              <Text style={s.statDescription}>{summary?.monthlyFreeEvaluationsUsed ?? Math.max(0, limit - remaining)} used of {limit || "—"}</Text>
              <Text style={s.statDescription}>Reset month: {summary?.freeEvaluationResetMonth || "Managed by the server"}</Text>
              <Text style={s.statDescription}>No credit or payment information is edited on this screen.</Text>
            </View>
            <Pressable style={s.purchase} onPress={() => { void openWebsite(); }}><Text style={s.purchaseText}>Purchase credits securely on website ↗</Text></Pressable>
            <Text style={s.section}>Recent credit activity</Text>
            {data.ledger?.length ? data.ledger.slice(0, 25).map((item) => (
              <View key={item.id} style={s.ledgerCard}>
                <View style={s.ledgerHead}>
                  <Text style={s.ledgerTitle}>{item.note || String(item.source || "Credit activity").replaceAll("_", " ")}</Text>
                  <Text style={[s.amount, (item.amount || 0) < 0 && s.negative]}>{(item.amount || 0) > 0 ? "+" : ""}{item.amount ?? 0}</Text>
                </View>
                <Text style={s.ledgerMeta}>{formatDate(item.created_at)} · Balance after: {item.balance_after ?? "—"}</Text>
              </View>
            )) : <View style={s.card}><Text style={s.statDescription}>No credit activity has been recorded yet.</Text></View>}
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
  title: { color: "#F7F8FC", fontSize: 28, fontWeight: "900", marginTop: -8 },
  sub: { color: "#AAB4C7", fontSize: 13, lineHeight: 20 },
  hero: { backgroundColor: "#131B2F", borderColor: "#263149", borderWidth: 1, borderRadius: 22, padding: 22, gap: 10 },
  muted: { color: "#929DB2", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  total: { color: "#C7F36B", fontSize: 48, fontWeight: "900" },
  status: { color: "#AAB4C7", fontSize: 13, lineHeight: 20 },
  stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, backgroundColor: "#11192A", borderColor: "#202B41", borderWidth: 1, borderRadius: 18, padding: 18, gap: 6 },
  statNumber: { color: "#C7F36B", fontSize: 26, fontWeight: "900" },
  statLabel: { color: "#929DB2", fontSize: 11, lineHeight: 16 },
  card: { backgroundColor: "#11192A", borderColor: "#202B41", borderWidth: 1, borderRadius: 17, padding: 17, gap: 9 },
  cardTitle: { color: "#F1F4FA", fontSize: 14, fontWeight: "800" },
  statDescription: { color: "#AAB4C7", fontSize: 12, lineHeight: 18 },
  purchase: { minHeight: 52, borderRadius: 14, backgroundColor: "#C7F36B", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  purchaseText: { color: "#101827", fontWeight: "900", fontSize: 13 },
  section: { color: "#F1F4FA", fontSize: 18, fontWeight: "800", marginTop: 5 },
  ledgerCard: { backgroundColor: "#11192A", borderRadius: 15, borderWidth: 1, borderColor: "#202B41", padding: 15, gap: 8 },
  ledgerHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  ledgerTitle: { color: "#F1F4FA", fontSize: 13, fontWeight: "700", flex: 1, lineHeight: 18 },
  amount: { color: "#C7F36B", fontSize: 13, fontWeight: "900" },
  negative: { color: "#FFBABA" },
  ledgerMeta: { color: "#718098", fontSize: 10 },
  errorBox: { backgroundColor: "#321E2B", padding: 15, borderRadius: 14, gap: 10 },
  error: { color: "#FFC2C2", fontSize: 13, lineHeight: 19 },
  retry: { color: "#C7F36B", fontWeight: "800" }
});
