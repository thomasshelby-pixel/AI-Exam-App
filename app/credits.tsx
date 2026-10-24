import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, apiRequest } from "@/src/lib/api";

type Level = "FOUNDATION" | "INTERMEDIATE" | "FINAL";
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
  entitlement?: {
    freeEvaluationsRemaining?: number;
    monthlyFreeEvaluationsLimit?: number;
    hasPermanentFreeAccess?: boolean;
    canEvaluate?: boolean;
    tier?: string;
  };
  creditSummary?: CreditSummary;
  ledger?: CreditLedgerItem[];
};
type AuthMeResponse = {
  user?: {
    fullName?: string;
    email?: string;
    phone?: string;
    hasPermanentFreeAccess?: boolean;
  } | null;
  profile?: Record<string, unknown> | null;
};
type StudentProfileResponse = {
  profile?: {
    caLevel?: string;
    ca_level?: string;
  } | null;
};
type Order = {
  orderId: string;
  razorpayOrderId: string;
  amountPaise: number;
  amountINR: number;
  currency: string;
  keyId: string;
  quantity: number;
  purchaseType: "COMBO_1" | "COMBO_2" | "CUSTOM";
  courseLevel?: Level;
  description: string;
};
type CreateOrderResponse = {
  success: boolean;
  isConfigured: boolean;
  keyId?: string;
  order: Order;
};

const COMBOS = {
  COMBO_1: {
    title: "Combo 1",
    foundation: { count: 4, price: 119 },
    intermediate: { count: 6, price: 175 },
  },
  COMBO_2: {
    title: "Combo 2",
    foundation: { count: 8, price: 219 },
    intermediate: { count: 12, price: 329 },
  },
} as const;
const CUSTOM_RATE = 35;

function formatDate(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "Date unavailable";
  return new Date(value).toLocaleDateString();
}

function normalizeLevel(value: unknown): Level | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "FOUNDATION" || normalized === "INTERMEDIATE" || normalized === "FINAL"
    ? normalized
    : null;
}

export default function CreditsScreen() {
  const [data, setData] = useState<CreditsResponse | null>(null);
  const [course, setCourse] = useState<Level | null>(null);
  const [isPermanent, setIsPermanent] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<"COMBO_1" | "COMBO_2">("COMBO_1");
  const [tab, setTab] = useState<"COMBO" | "CUSTOM">("COMBO");
  const [quantityInput, setQuantityInput] = useState("5");
  const [busy, setBusy] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (initial = false) => {
    if (initial) setBusy(true);
    setError("");
    try {
      const response = await apiRequest<CreditsResponse>("/api/student/credits");
      setData(response);
      setIsPermanent(Boolean(response.entitlement?.hasPermanentFreeAccess));

      const me = await apiRequest<AuthMeResponse>("/api/auth/me").catch(() => null);
      setIsPermanent(Boolean(response.entitlement?.hasPermanentFreeAccess || me?.user?.hasPermanentFreeAccess));
      setFullName(me?.user?.fullName || "");
      setEmail(me?.user?.email || "");
      setPhone(me?.user?.phone || "");

      const profile = await apiRequest<StudentProfileResponse>("/api/student/profile").catch(() => null);
      setCourse(normalizeLevel(profile?.profile?.caLevel || profile?.profile?.ca_level || me?.profile?.caLevel || me?.profile?.ca_level));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your credit balance.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(true); }, [load]);

  const summary = data?.creditSummary;
  const remaining = summary?.freeEvaluationsRemaining ?? data?.entitlement?.freeEvaluationsRemaining ?? 0;
  const limit = summary?.monthlyFreeEvaluationsLimit ?? data?.entitlement?.monthlyFreeEvaluationsLimit ?? 0;
  const paid = summary?.paidCredits ?? 0;
  const total = summary?.totalAvailable ?? remaining + paid;
  const parsedQuantity = Number(quantityInput);
  const validQuantity = Number.isInteger(parsedQuantity) && parsedQuantity >= 1 && parsedQuantity <= 500 && String(parsedQuantity) === quantityInput.trim();
  const comboForCourse = course === "FOUNDATION" ? "foundation" : "intermediate";
  const activeCombo = COMBOS[plan][comboForCourse];
  const expectedAmount = tab === "COMBO" ? activeCombo.price : (validQuantity ? parsedQuantity * CUSTOM_RATE : 0);
  const expectedQuantity = tab === "COMBO" ? activeCombo.count : (validQuantity ? parsedQuantity : 0);

  async function purchase() {
    setError("");
    setMessage("");
    if (isPermanent) {
      setMessage("Your account already has permanent evaluation access. No credit purchase is needed.");
      return;
    }
    if (tab === "COMBO" && course !== "FOUNDATION" && course !== "INTERMEDIATE") {
      setError("Course-specific combos are available for Foundation and Intermediate only. CA Final accounts can buy custom credits.");
      setTab("CUSTOM");
      return;
    }
    if (tab === "CUSTOM" && !validQuantity) {
      setError("Enter a whole number from 1 to 500 evaluations.");
      return;
    }
    if (Platform.OS === "web") {
      setError("Native Razorpay checkout is available in the installed Android app, not in the web preview.");
      return;
    }

    setPaying(true);
    try {
      let RazorpayCheckout: typeof import("react-native-razorpay").default;
      try {
        RazorpayCheckout = (await import("react-native-razorpay")).default;
      } catch {
        throw new Error("Native Razorpay checkout could not load. Install the updated standalone Android APK; Expo Go does not include this native module.");
      }
      const payload = tab === "COMBO"
        ? { purchaseType: plan, courseLevel: course }
        : { purchaseType: "CUSTOM", quantity: parsedQuantity };
      const created = await apiRequest<CreateOrderResponse>("/api/payments/create-order", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!created.success || !created.order) throw new Error("The server did not create a payment order.");
      if (!created.isConfigured) throw new Error("Razorpay is not configured on the server. No payment was started.");
      const order = created.order;
      if (!order.razorpayOrderId || !order.keyId || !Number.isFinite(order.amountPaise) || order.amountPaise <= 0) {
        throw new Error("The server returned an invalid checkout order. No payment was started.");
      }

      const checkout = await RazorpayCheckout.open({
        key: order.keyId || created.keyId || "",
        amount: String(order.amountPaise),
        currency: order.currency || "INR",
        name: "CA Exam Checker AI",
        description: order.description || ("Evaluation credits · " + order.quantity),
        order_id: order.razorpayOrderId,
        prefill: { name: fullName, email, contact: phone },
        theme: { color: "#2563eb" },
      });

      await apiRequest("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify({
          razorpayOrderId: checkout.razorpay_order_id,
          razorpayPaymentId: checkout.razorpay_payment_id,
          razorpaySignature: checkout.razorpay_signature,
        }),
      });
      setMessage("Payment verified by the server. Your evaluation credits have been updated.");
      await load(false);
    } catch (e) {
      const err = e as { description?: string; message?: string; code?: number | string };
      const description = err?.description || err?.message;
      if (e instanceof ApiError) {
        setError(e.message);
      } else if (description && /cancel/i.test(description)) {
        setError("Payment was cancelled. No successful purchase has been recorded by this app.");
      } else {
        setError(description || "Payment could not be verified. Refresh credits before trying again.");
      }
    } finally {
      setPaying(false);
    }
  }

  const purchaseLabel = tab === "COMBO"
    ? "Continue to secure payment · ₹" + expectedAmount
    : "Buy " + expectedQuantity + " evaluations · ₹" + expectedAmount;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={busy && Boolean(data)} onRefresh={() => { void load(false); }} tintColor="#C7F36B" />}
      >
        <Pressable onPress={() => router.back()}><Text style={s.back}>←  Dashboard</Text></Pressable>
        <Text style={s.kicker}>ACCOUNT & BILLING</Text>
        <Text style={s.title}>Credits & usage</Text>
        <Text style={s.sub}>Your account, entitlement and payments are verified by the CA Exam Checker server.</Text>

        {isPermanent ? (
          <View style={s.permanentCard}>
            <Text style={s.permanentKicker}>PERMANENT ACCESS</Text>
            <Text style={s.permanentTitle}>Unlimited evaluation access is active</Text>
            <Text style={s.status}>This status comes from your account entitlement on the server. No credit purchase is required for eligible evaluations.</Text>
          </View>
        ) : null}

        {busy && !data ? <ActivityIndicator color="#C7F36B" size="large" /> : null}
        {error ? <View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable onPress={() => { void load(true); }}><Text style={s.retry}>Try again</Text></Pressable></View> : null}
        {message ? <Text style={s.success}>{message}</Text> : null}

        {data ? (
          <>
            <View style={s.hero}>
              <Text style={s.muted}>TOTAL AVAILABLE EVALUATIONS</Text>
              <Text style={s.total}>{isPermanent ? "∞" : total}</Text>
              <Text style={s.status}>{isPermanent ? "Permanent access active" : (summary?.statusMessage || (total > 0 ? "Your account can submit eligible answer sheets." : "No evaluations are currently available."))}</Text>
            </View>
            <View style={s.stats}>
              <View style={s.stat}><Text style={s.statNumber}>{isPermanent ? "∞" : remaining}</Text><Text style={s.statLabel}>Free evaluations left</Text></View>
              <View style={s.stat}><Text style={s.statNumber}>{paid}</Text><Text style={s.statLabel}>Paid credits</Text></View>
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>Monthly free allowance</Text>
              <Text style={s.statDescription}>{summary?.monthlyFreeEvaluationsUsed ?? Math.max(0, limit - remaining)} used of {limit || "—"}</Text>
              <Text style={s.statDescription}>Reset month: {summary?.freeEvaluationResetMonth || "Managed by the server"}</Text>
              <Text style={s.statDescription}>Paid credits and entitlements are never changed locally.</Text>
            </View>

            {!isPermanent ? (
              <>
                <Text style={s.section}>Buy evaluations in the app</Text>
                <Text style={s.sub}>Choose a course combo or a custom quantity. Final price and credit fulfilment are confirmed by the existing server and Razorpay.</Text>
                <View style={s.tabs}>
                  <Pressable onPress={() => setTab("COMBO")} style={[s.tab, tab === "COMBO" && s.tabSelected]}>
                    <Text style={[s.tabText, tab === "COMBO" && s.tabTextSelected]}>Combo plans</Text>
                  </Pressable>
                  <Pressable onPress={() => setTab("CUSTOM")} style={[s.tab, tab === "CUSTOM" && s.tabSelected]}>
                    <Text style={[s.tabText, tab === "CUSTOM" && s.tabTextSelected]}>Custom · ₹35 each</Text>
                  </Pressable>
                </View>

                {tab === "COMBO" ? (
                  <>
                    <View style={s.courseCard}>
                      <Text style={s.cardTitle}>Your saved CA course</Text>
                      <Text style={s.courseText}>{course ? (course === "FOUNDATION" ? "CA Foundation" : course === "INTERMEDIATE" ? "CA Intermediate" : "CA Final") : "Could not verify your course"}</Text>
                      <Text style={s.statDescription}>Course-specific combo prices are limited to your saved Foundation or Intermediate course.</Text>
                      <Pressable onPress={() => router.push("/profile")}><Text style={s.retry}>Edit profile</Text></Pressable>
                    </View>
                    {course === "FINAL" ? <Text style={s.warning}>Combo plans are not available for CA Final yet. Switch to Custom to buy credits for your saved course.</Text> : (
                      <View style={s.planRow}>
                        {(["COMBO_1", "COMBO_2"] as const).map((value) => {
                          const option = COMBOS[value][comboForCourse];
                          return (
                            <Pressable key={value} onPress={() => setPlan(value)} style={[s.planCard, plan === value && s.planSelected]}>
                              <Text style={s.planName}>{COMBOS[value].title}</Text>
                              <Text style={s.planCount}>{option.count} evaluations</Text>
                              <Text style={s.planPrice}>₹{option.price}</Text>
                              <Text style={s.planCaption}>Server verifies this price</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </>
                ) : (
                  <View style={s.card}>
                    <Text style={s.cardTitle}>Number of evaluations</Text>
                    <TextInput
                      value={quantityInput}
                      onChangeText={(v) => setQuantityInput(v.replace(/\D/g, "").slice(0, 3))}
                      keyboardType="number-pad"
                      style={s.quantity}
                      accessibilityLabel="Number of evaluations to purchase"
                      placeholder="Enter quantity (1–500)"
                      placeholderTextColor="#718098"
                    />
                    <Text style={s.statDescription}>₹35 per evaluation · Minimum 1, maximum 500 per order.</Text>
                    <Text style={s.planPrice}>Total: ₹{expectedAmount}</Text>
                  </View>
                )}
                {tab === "COMBO" && course === "FINAL" ? null : (
                  <Pressable disabled={paying || busy || (tab === "CUSTOM" && !validQuantity)} onPress={() => { void purchase(); }} style={[s.purchase, (paying || busy || (tab === "CUSTOM" && !validQuantity)) && s.disabled]}>
                    {paying ? <ActivityIndicator color="#101827" /> : <Text style={s.purchaseText}>{purchaseLabel}</Text>}
                  </Pressable>
                )}
                <Text style={s.foot}>Payment starts only after the server creates a real Razorpay order. Credits are displayed after cryptographic payment verification on the server.</Text>
              </>
            ) : null}

            <Text style={s.section}>Recent credit activity</Text>
            {data.ledger?.length ? data.ledger.slice(0, 25).map((item) => (
              <View key={item.id} style={s.ledgerCard}>
                <View style={s.ledgerHead}>
                  <Text style={s.cardTitle}>{String(item.source || "Credit activity").replaceAll("_", " ")}</Text>
                  <Text style={s.ledgerAmount}>{typeof item.amount === "number" ? (item.amount > 0 ? "+" : "") + item.amount : "—"}</Text>
                </View>
                <Text style={s.statDescription}>{item.note || "Account credit ledger entry"}</Text>
                <Text style={s.statDescription}>{formatDate(item.created_at)}{item.balance_after !== undefined ? " · Balance after: " + item.balance_after : ""}</Text>
                {item.order_id ? <Text style={s.ledgerId}>Order: {item.order_id}</Text> : null}
                {item.payment_id ? <Text style={s.ledgerId}>Payment: {item.payment_id}</Text> : null}
              </View>
            )) : <Text style={s.sub}>No recent credit activity was returned by the server.</Text>}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1020" },
  content: { padding: 22, paddingBottom: 42, gap: 12 },
  back: { color: "#AAB4C7", fontSize: 13, marginBottom: 12 },
  kicker: { color: "#C7F36B", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#F7F8FC", fontSize: 28, fontWeight: "900", marginTop: -5 },
  sub: { color: "#AAB4C7", fontSize: 13, lineHeight: 20, marginBottom: 4 },
  hero: { backgroundColor: "#131B2F", borderColor: "#263149", borderWidth: 1, borderRadius: 22, padding: 22, gap: 10 },
  muted: { color: "#929DB2", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  total: { color: "#C7F36B", fontSize: 48, fontWeight: "900" },
  status: { color: "#AAB4C7", fontSize: 13, lineHeight: 20 },
  stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, backgroundColor: "#11192A", borderColor: "#202B41", borderWidth: 1, borderRadius: 18, padding: 18, gap: 6 },
  statNumber: { color: "#F7F8FC", fontSize: 25, fontWeight: "900" },
  statLabel: { color: "#AAB4C7", fontSize: 12 },
  card: { backgroundColor: "#11192A", borderColor: "#202B41", borderWidth: 1, borderRadius: 17, padding: 16, gap: 8 },
  cardTitle: { color: "#F1F4FA", fontSize: 14, fontWeight: "800" },
  statDescription: { color: "#AAB4C7", fontSize: 12, lineHeight: 18 },
  permanentCard: { backgroundColor: "#092A29", borderColor: "#0E756E", borderWidth: 1, borderRadius: 17, padding: 16, gap: 6 },
  permanentKicker: { color: "#42E8C3", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  permanentTitle: { color: "#D9FFF5", fontSize: 16, fontWeight: "900" },
  tabs: { flexDirection: "row", backgroundColor: "#131B2F", borderColor: "#263149", borderWidth: 1, borderRadius: 13, padding: 4, gap: 4 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10, padding: 11 },
  tabSelected: { backgroundColor: "#1D4ED8" },
  tabText: { color: "#AAB4C7", fontSize: 12, fontWeight: "800", textAlign: "center" },
  tabTextSelected: { color: "#FFFFFF" },
  courseCard: { backgroundColor: "#11192A", borderColor: "#2B3650", borderWidth: 1, borderRadius: 17, padding: 16, gap: 7 },
  courseText: { color: "#C7F36B", fontSize: 16, fontWeight: "900" },
  planRow: { flexDirection: "row", gap: 10 },
  planCard: { flex: 1, borderColor: "#2B3650", borderWidth: 1, borderRadius: 16, backgroundColor: "#11192A", padding: 14, gap: 7 },
  planSelected: { borderColor: "#3B82F6", backgroundColor: "#142448" },
  planName: { color: "#F7F8FC", fontSize: 12, fontWeight: "900" },
  planCount: { color: "#AAB4C7", fontSize: 11 },
  planPrice: { color: "#C7F36B", fontSize: 22, fontWeight: "900" },
  planCaption: { color: "#718098", fontSize: 10 },
  quantity: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: "#34425D", backgroundColor: "#0B1020", paddingHorizontal: 14, color: "#F7F8FC", fontSize: 16 },
  purchase: { minHeight: 54, borderRadius: 15, backgroundColor: "#C7F36B", alignItems: "center", justifyContent: "center", paddingHorizontal: 15, paddingVertical: 12 },
  purchaseText: { color: "#101827", fontWeight: "900", fontSize: 13, textAlign: "center" },
  disabled: { opacity: 0.5 },
  warning: { color: "#FED7AA", backgroundColor: "#422006", borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18 },
  errorBox: { backgroundColor: "#321E2B", borderRadius: 12, padding: 12, gap: 8 },
  error: { color: "#FFC2C2", fontSize: 12, lineHeight: 18 },
  success: { color: "#C7F36B", fontSize: 12, lineHeight: 18 },
  retry: { color: "#C7F36B", fontSize: 12, fontWeight: "800" },
  section: { color: "#F1F4FA", fontSize: 18, fontWeight: "800", marginTop: 7 },
  foot: { color: "#718098", fontSize: 10, lineHeight: 16, textAlign: "center" },
  ledgerCard: { backgroundColor: "#11192A", borderRadius: 15, borderWidth: 1, borderColor: "#202B41", padding: 15, gap: 8 },
  ledgerHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  ledgerAmount: { color: "#C7F36B", fontWeight: "900", fontSize: 14 },
  ledgerId: { color: "#718098", fontSize: 10 },
});
