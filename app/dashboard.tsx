import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, clearSession } from "@/src/lib/api";

type ProfileResponse = {
  success?: boolean;
  user?: { id: string; email: string; fullName: string; role: string; status: string; hasPermanentFreeAccess?: boolean };
  profile?: { caLevel?: string; examAttempt?: string; examAttemptId?: string; studentCode?: string; totalEvaluations?: number; completedEvaluations?: number; averageScore?: number };
  entitlement?: { hasPermanentFreeAccess?: boolean; tier?: string; reason?: string };
  creditStatus?: { [key: string]: unknown };
  error?: string;
};
type AuthMeResponse = { user?: { hasPermanentFreeAccess?: boolean } | null };

export default function DashboardScreen() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const [profile, evaluations, authMe] = await Promise.all([
        apiRequest<ProfileResponse>("/api/student/profile"),
        apiRequest<{ evaluations?: Array<{ id: string; status: string; subject_name?: string; created_at?: string; percentage?: number }> }>("/api/student/evaluations"),
        apiRequest<AuthMeResponse>("/api/auth/me").catch(() => null)
      ]);
      const permanentAccess = Boolean(profile.entitlement?.hasPermanentFreeAccess || authMe?.user?.hasPermanentFreeAccess);
      setData({
        ...profile,
        user: profile.user ? { ...profile.user, hasPermanentFreeAccess: permanentAccess } : undefined,
        profile: {
          ...profile.profile,
          totalEvaluations: evaluations.evaluations?.length ?? 0,
          completedEvaluations: evaluations.evaluations?.filter(e => e.status === "COMPLETED").length ?? 0
        }
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load your dashboard.";
      setError(message);
      if ("status" in (e as object) && (e as {status?: number}).status === 401) router.replace("/sign-in");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void apiRequest<{ unreadCount?: number }>("/api/student/notifications")
      .then((response) => { if (active) setUnreadNotifications(Number(response.unreadCount) || 0); })
      .catch(() => { if (active) setUnreadNotifications(0); });
    return () => { active = false; };
  }, []));

  async function logout() {
    try { await apiRequest("/api/auth/logout", { method: "POST" }); } catch {}
    await clearSession();
    router.replace("/sign-in");
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor="#C7F36B" />}>
      <View style={styles.header}>
        <View><Text style={styles.kicker}>CA EXAM CHECKER</Text><Text style={styles.heading}>Your dashboard</Text></View>
        <Pressable onPress={logout} style={styles.logout}><Text style={styles.logoutText}>Log out</Text></Pressable>
      </View>
      {busy && !data ? <ActivityIndicator color="#C7F36B" size="large" /> : null}
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={load}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
      {data?.user ? <>
        <View style={styles.welcome}><Text style={styles.muted}>WELCOME BACK</Text><Text style={styles.name}>{data.user.fullName || "CA Student"}</Text><Text style={styles.email}>{data.user.email}</Text><View style={styles.coursePill}><Text style={styles.courseText}>{data.profile?.caLevel || "CA INTERMEDIATE"}</Text></View></View>
        {data.user.hasPermanentFreeAccess ? <View style={styles.permanentAccess}><Text style={styles.permanentLabel}>✓  PERMANENT ACCESS ACTIVE</Text><Text style={styles.permanentTitle}>Unlimited evaluation access</Text><Text style={styles.permanentDescription}>Your access has been confirmed by the server for this account. You do not need to purchase evaluation credits.</Text></View> : null}
        <Text style={styles.section}>Your progress</Text>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statNumber}>{data.profile?.totalEvaluations ?? "—"}</Text><Text style={styles.statLabel}>Copies submitted</Text></View>
          <View style={styles.stat}><Text style={styles.statNumber}>{data.profile?.completedEvaluations ?? "—"}</Text><Text style={styles.statLabel}>Evaluated</Text></View>
        </View>
        <Text style={styles.section}>Quick access</Text>
        <Pressable style={styles.action} onPress={() => router.push("/notifications")}>
          <Text style={styles.actionIcon}>🔔</Text>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Notifications</Text>
            <Text style={styles.actionSub}>{unreadNotifications > 0 ? unreadNotifications + " unread notice(s)" : "Account updates and alerts"}</Text>
          </View>
          <Text style={styles.arrow}>{unreadNotifications > 0 ? (unreadNotifications > 99 ? "99+" : String(unreadNotifications)) : "›"}</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/credits")}>
          <Text style={styles.actionIcon}>💳</Text>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Credits & usage</Text>
            <Text style={styles.actionSub}>{data.user.hasPermanentFreeAccess ? "Permanent access · no credit purchase required" : "Free evaluations, paid credits and ledger"}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/submit-copy")}><Text style={styles.actionIcon}>📝</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Submit answer sheet</Text><Text style={styles.actionSub}>Upload a PDF for evaluation</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/evaluations")}><Text style={styles.actionIcon}>📑</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Evaluations & results</Text><Text style={styles.actionSub}>Check status, marks and feedback</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/profile")}><Text style={styles.actionIcon}>👤</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Student profile</Text><Text style={styles.actionSub}>Review course and exam attempt</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/security")}><Text style={styles.actionIcon}>🛡️</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Security & devices</Text><Text style={styles.actionSub}>Sessions, MFA, recovery and password</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/study-planner")}><Text style={styles.actionIcon}>📅</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>AI Study Planner</Text><Text style={styles.actionSub}>Schedules, chapter strengths and revision</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/mcq-arena")}><Text style={styles.actionIcon}>🎯</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>MCQ Arena</Text><Text style={styles.actionSub}>Practice, bookmarks and mistake vault</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/examiner-profile")}><Text style={styles.actionIcon}>🧬</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Personal Examiner Profile</Text><Text style={styles.actionSub}>Recurring mark-loss and improvement patterns</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/enrollments")}><Text style={styles.actionIcon}>🏫</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Institutes & assignments</Text><Text style={styles.actionSub}>Join institutes, materials and tests</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/referral")}><Text style={styles.actionIcon}>🎟️</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Promos & referral access</Text><Text style={styles.actionSub}>Redeem codes and check eligibility</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/support")}><Text style={styles.actionIcon}>🆘</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Support tickets</Text><Text style={styles.actionSub}>Create tickets and track responses</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/review")}><Text style={styles.actionIcon}>⭐</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Rate your experience</Text><Text style={styles.actionSub}>Send your server-validated review</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <Pressable style={styles.action} onPress={() => router.push("/notification-preferences")}><Text style={styles.actionIcon}>⚙️</Text><View style={styles.actionCopy}><Text style={styles.actionTitle}>Notification preferences</Text><Text style={styles.actionSub}>Manage email and in-app settings</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        <View style={styles.notice}><Text style={styles.noticeTitle}>Official evaluation data</Text><Text style={styles.noticeText}>Results and progress are fetched from your existing CA Exam Checker account.</Text></View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
 safe:{flex:1,backgroundColor:"#0B1020"},content:{padding:22,paddingBottom:40,gap:18},header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:6},kicker:{color:"#C7F36B",fontSize:10,fontWeight:"800",letterSpacing:1.5},heading:{color:"#F7F8FC",fontSize:27,fontWeight:"900",marginTop:7},logout:{borderColor:"#2B3650",borderWidth:1,borderRadius:12,paddingHorizontal:13,paddingVertical:9},logoutText:{color:"#AAB4C7",fontSize:12,fontWeight:"700"},welcome:{backgroundColor:"#131B2F",borderColor:"#263149",borderWidth:1,borderRadius:23,padding:22},muted:{color:"#9BA8BE",fontSize:10,fontWeight:"800",letterSpacing:1.3},name:{color:"#F7F8FC",fontSize:25,fontWeight:"900",marginTop:10},email:{color:"#AAB4C7",fontSize:13,marginTop:5},coursePill:{alignSelf:"flex-start",backgroundColor:"#27364A",borderRadius:20,paddingHorizontal:12,paddingVertical:7,marginTop:16},courseText:{color:"#C7F36B",fontSize:10,fontWeight:"800"},section:{color:"#F1F4FA",fontSize:18,fontWeight:"800",marginTop:5},stats:{flexDirection:"row",gap:12},stat:{flex:1,backgroundColor:"#11192A",borderColor:"#202B41",borderWidth:1,borderRadius:18,padding:18},statNumber:{color:"#C7F36B",fontSize:27,fontWeight:"900"},statLabel:{color:"#929DB2",fontSize:11,marginTop:6},action:{flexDirection:"row",alignItems:"center",gap:13,padding:15,borderRadius:17,backgroundColor:"#11192A",borderColor:"#202B41",borderWidth:1},actionIcon:{fontSize:23},actionCopy:{flex:1,gap:5},actionTitle:{color:"#F1F4FA",fontSize:14,fontWeight:"800"},actionSub:{color:"#929DB2",fontSize:11},arrow:{color:"#76839A",fontSize:26},permanentAccess:{borderRadius:16,padding:16,backgroundColor:"#092A29",borderWidth:1,borderColor:"#0E756E",gap:6},permanentLabel:{color:"#42E8C3",fontSize:10,fontWeight:"900",letterSpacing:1.2},permanentTitle:{color:"#D9FFF5",fontSize:16,fontWeight:"900"},permanentDescription:{color:"#A7F3D0",fontSize:11,lineHeight:17},notice:{borderRadius:16,padding:16,backgroundColor:"#172333",gap:6},noticeTitle:{color:"#C7F36B",fontSize:12,fontWeight:"800"},noticeText:{color:"#AAB4C7",fontSize:12,lineHeight:18},errorBox:{backgroundColor:"#321E2B",padding:15,borderRadius:14,gap:10},error:{color:"#FFC2C2",fontSize:13,lineHeight:19},retry:{color:"#C7F36B",fontWeight:"800"}
});
