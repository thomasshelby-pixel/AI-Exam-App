import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const features = [
  { icon: "📚", title: "Study dashboard", detail: "Your CA course, exam attempt and study progress" },
  { icon: "📝", title: "Answer-sheet evaluation", detail: "Submit a copy and follow its real evaluation status" },
  { icon: "📊", title: "Results & checked copies", detail: "Access authoritative results and examiner feedback" },
  { icon: "☁️", title: "Synced student profile", detail: "Keep profile and exam-attempt data consistent across devices" }
];

export default function HomeScreen() {
  const apiConfigured = Boolean(process.env.EXPO_PUBLIC_API_BASE_URL?.trim());

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topline}>
          <View style={styles.logo}><Text style={styles.logoText}>AI</Text></View>
          <Text style={styles.brand}>CA EXAM CHECKER</Text>
          <View style={styles.status}><View style={[styles.dot, apiConfigured ? styles.dotReady : styles.dotSetup]} /><Text style={styles.statusText}>{apiConfigured ? "API SET" : "SETUP"}</Text></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR CA JOURNEY, IN ONE PLACE</Text>
          <Text style={styles.heading}>Prepare smarter.{"\n"}Know where you stand.</Text>
          <Text style={styles.subheading}>A mobile companion for your CA Exam Checker account, practice and evaluation results.</Text>
          <Link href="/sign-in" asChild>
            <Pressable style={styles.primaryButton}><Text style={styles.primaryText}>Continue to sign in  →</Text></Pressable>
          </Link>
          <Text style={styles.note}>Secure account access will use the existing AI-Exam backend.</Text>
        </View>

        <Text style={styles.sectionTitle}>Built around your exam workflow</Text>
        <View style={styles.featureList}>
          {features.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <View style={styles.featureIcon}><Text style={{ fontSize: 22 }}>{feature.icon}</Text></View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDetail}>{feature.detail}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          ))}
        </View>
        <View style={styles.footer}><Text style={styles.footerText}>AI EXAM APP · MOBILE FOUNDATION</Text><Text style={styles.footerSub}>Your results stay governed by the existing evaluation system.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B1020" },
  content: { padding: 22, paddingBottom: 42 },
  topline: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 38 },
  logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#C7F36B", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#111827", fontWeight: "900", fontSize: 17 },
  brand: { color: "#E8ECF5", fontSize: 11, letterSpacing: 1.5, fontWeight: "800", flex: 1 },
  status: { flexDirection: "row", gap: 6, alignItems: "center", borderColor: "#263149", borderWidth: 1, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 4 },
  dotReady: { backgroundColor: "#C7F36B" },
  dotSetup: { backgroundColor: "#F4B860" },
  statusText: { color: "#AAB4C7", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  hero: { backgroundColor: "#131B2F", borderColor: "#263149", borderWidth: 1, borderRadius: 28, padding: 23, marginBottom: 32 },
  eyebrow: { color: "#C7F36B", fontSize: 10, letterSpacing: 1.6, fontWeight: "800", marginBottom: 16 },
  heading: { color: "#F7F8FC", fontSize: 34, lineHeight: 40, fontWeight: "900", letterSpacing: -1.1 },
  subheading: { color: "#AAB4C7", fontSize: 15, lineHeight: 23, marginTop: 14, marginBottom: 24 },
  primaryButton: { backgroundColor: "#C7F36B", borderRadius: 15, minHeight: 54, alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#101827", fontSize: 15, fontWeight: "800" },
  note: { color: "#7F8AA2", fontSize: 11, lineHeight: 17, marginTop: 13 },
  sectionTitle: { color: "#F1F4FA", fontSize: 19, fontWeight: "800", marginBottom: 15, letterSpacing: -0.3 },
  featureList: { gap: 10 },
  feature: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: "#11192A", borderColor: "#202B41", borderWidth: 1, borderRadius: 18, padding: 15 },
  featureIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#202B41", alignItems: "center", justifyContent: "center" },
  featureTitle: { color: "#F1F4FA", fontSize: 14, fontWeight: "800" },
  featureDetail: { color: "#929DB2", fontSize: 12, lineHeight: 18 },
  chevron: { color: "#76839A", fontSize: 26, paddingLeft: 4 },
  footer: { marginTop: 30, alignItems: "center", gap: 7 },
  footerText: { color: "#748199", fontSize: 9, letterSpacing: 1.5, fontWeight: "800" },
  footerSub: { color: "#65718A", fontSize: 11, textAlign: "center", lineHeight: 17 }
});
