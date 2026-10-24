import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/src/lib/api";

export default function MfaRecoveryScreen() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [srn, setSrn] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestId, setRequestId] = useState("");
  async function submit() {
    setError(""); setNotice(""); setRequestId("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter the email address registered to your account."); return; }
    if (reason.trim().length < 30) { setError("Explain your account recovery situation in at least 30 characters."); return; }
    setBusy(true);
    try {
      const r = await apiRequest<{success?:boolean;requestId?:string;message?:string}>("/api/auth/mfa/recovery-request", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), phone: phone.trim() || undefined, srnRegNo: srn.trim().toUpperCase() || undefined, reason: reason.trim() })
      });
      if (!r.success) throw new Error(r.message || "The server did not accept the recovery request.");
      setRequestId(r.requestId || "");
      setNotice(r.message || "Account recovery request submitted for review.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit recovery request."); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}>
    <Pressable onPress={() => router.back()}><Text style={s.back}>←  Back to MFA verification</Text></Pressable>
    <Text style={s.kicker}>ACCOUNT RECOVERY</Text><Text style={s.title}>Lost your MFA devices?</Text>
    <Text style={s.sub}>Use this only if you cannot access any registered authenticator or one-time recovery code. The request goes to the website's authorised recovery review process; submitting it does not unlock the account or disable MFA automatically.</Text>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {notice ? <View style={s.notice}><Text style={s.noticeText}>{notice}</Text>{requestId ? <Text selectable style={s.requestId}>Reference: {requestId}</Text> : null}</View> : null}
    <View style={s.card}>
      <Text style={s.label}>REGISTERED EMAIL *</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} style={s.input} placeholder="Account email" placeholderTextColor="#718098"/>
      <Text style={s.label}>PHONE (OPTIONAL)</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={s.input} placeholder="Phone on account" placeholderTextColor="#718098" maxLength={25}/>
      <Text style={s.label}>ICAI REGISTRATION NUMBER (OPTIONAL)</Text><TextInput value={srn} onChangeText={setSrn} autoCapitalize="characters" autoCorrect={false} style={s.input} placeholder="Registration number" placeholderTextColor="#718098" maxLength={25}/>
      <Text style={s.label}>EXPLAIN WHAT HAPPENED *</Text><TextInput value={reason} onChangeText={setReason} style={[s.input,s.multiline]} multiline textAlignVertical="top" maxLength={2000} placeholder="Explain why you lost access to the authenticator and recovery codes, and how support can verify account ownership." placeholderTextColor="#718098"/>
      <Pressable disabled={busy} onPress={() => { void submit(); }} style={[s.button,busy&&s.disabled]}>{busy?<ActivityIndicator color="#101827"/>:<Text style={s.buttonText}>Submit for manual review</Text>}</Pressable>
    </View>
    <Text style={s.foot}>Never share your password or email OTP with anyone. Only submit account details through this official app. The server applies rate limits and authorised reviewers make the recovery decision.</Text>
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#0B1020"},content:{padding:22,paddingBottom:40,gap:14},back:{color:"#AAB4C7",fontSize:12,marginBottom:10},kicker:{color:"#60A5FA",fontSize:10,fontWeight:"900",letterSpacing:1.5},title:{color:"#F7F8FC",fontSize:28,fontWeight:"900"},sub:{color:"#AAB4C7",fontSize:12,lineHeight:19},card:{backgroundColor:"#11192A",borderColor:"#202B41",borderWidth:1,borderRadius:17,padding:16,gap:10},label:{color:"#8290A8",fontSize:9,fontWeight:"900",letterSpacing:1.1},input:{minHeight:47,borderRadius:11,borderWidth:1,borderColor:"#34425D",backgroundColor:"#0B1020",paddingHorizontal:12,color:"#F7F8FC",fontSize:12},multiline:{minHeight:130,paddingTop:12},button:{minHeight:49,borderRadius:12,backgroundColor:"#C7F36B",alignItems:"center",justifyContent:"center",padding:12},buttonText:{color:"#101827",fontWeight:"900"},error:{color:"#FFC2C2",backgroundColor:"#321E2B",padding:11,borderRadius:10,fontSize:12},notice:{backgroundColor:"#092A29",borderWidth:1,borderColor:"#0E756E",borderRadius:12,padding:12,gap:8},noticeText:{color:"#A7F3D0",fontSize:12,lineHeight:18},requestId:{color:"#C7F36B",fontSize:11,fontWeight:"900"},foot:{color:"#718098",fontSize:10,lineHeight:16},disabled:{opacity:.45}});
