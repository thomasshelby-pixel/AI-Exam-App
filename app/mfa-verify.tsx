import { useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, getOrCreateDeviceId, saveDeviceTrustToken, saveSessionToken } from "@/src/lib/api";

export default function MfaVerifyScreen() {
 const params=useLocalSearchParams<{token?:string;message?:string}>();const sessionToken=Array.isArray(params.token)?params.token[0]:params.token;const message=Array.isArray(params.message)?params.message[0]:params.message;
 const [code,setCode]=useState("");const [remember,setRemember]=useState(true);const [useRecovery,setUseRecovery]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function verify(){
  setError("");
  if(!sessionToken){setError("Verification session is missing. Please sign in again.");return;}
  if(useRecovery ? code.trim().length<6 : !/^\d{6}$/.test(code.trim())){setError(useRecovery?"Enter one of your unused recovery codes.":"Enter the 6-digit code from your authenticator app.");return;}
  setBusy(true);
  try{
   const deviceId=await getOrCreateDeviceId();
   const route=useRecovery?"/api/auth/mfa/recovery-codes/verify":"/api/auth/mfa/verify-challenge";
   const payload=useRecovery
    ? {mfaSessionToken:sessionToken,recoveryCode:code.trim(),rememberDevice:remember,trustDevice:remember,deviceId}
    : {mfaSessionToken:sessionToken,otpCode:code.trim(),rememberDevice:remember,trustDevice:remember,deviceId};
   const r=await apiRequest<{success?:boolean;token?:string;trustToken?:string;user?:{role?:string};remainingCodes?:number;warning?:string}>(route,{method:"POST",body:JSON.stringify(payload)});
   if(!r.success||!r.token||r.user?.role!=="STUDENT")throw new Error("The server did not return a valid student session.");
   await saveSessionToken(r.token);
   await saveDeviceTrustToken(r.trustToken || null);
   router.replace("/dashboard");
  }catch(e){setError(e instanceof Error?e.message:"Verification failed.");}
  finally{setBusy(false);}
 }
 return <SafeAreaView style={s.safe}><View style={s.content}><Pressable onPress={()=>router.back()}><Text style={s.back}>←  Back</Text></Pressable><Text style={s.kicker}>ACCOUNT SECURITY</Text><Text style={s.title}>Verify it's you</Text><Text style={s.sub}>{message||"Enter the 6-digit code from your authenticator app."}</Text>
 <View style={s.modeRow}><Pressable onPress={()=>{setUseRecovery(false);setCode("");setError("");}} style={[s.modeButton,!useRecovery&&s.modeActive]}><Text style={[s.modeText,!useRecovery&&s.modeTextActive]}>Authenticator code</Text></Pressable><Pressable onPress={()=>{setUseRecovery(true);setCode("");setError("");}} style={[s.modeButton,useRecovery&&s.modeActive]}><Text style={[s.modeText,useRecovery&&s.modeTextActive]}>Recovery code</Text></Pressable></View>
 <Text style={s.label}>{useRecovery?"ONE-TIME RECOVERY CODE":"AUTHENTICATOR CODE"}</Text><TextInput value={code} onChangeText={v=>setCode(useRecovery?v.slice(0,80):v.replace(/\D/g,"").slice(0,6))} autoCapitalize={useRecovery?"characters":"none"} autoCorrect={false} keyboardType={useRecovery?"default":"number-pad"} maxLength={useRecovery?80:6} style={[s.input,useRecovery&&s.recoveryInput]} placeholder={useRecovery?"Enter an unused recovery code":"000000"} placeholderTextColor="#66738A"/>
 <Pressable onPress={()=>setRemember(!remember)} style={s.remember}><View style={[s.checkbox,remember&&s.checked]}><Text style={s.check}>{remember?"✓":""}</Text></View><Text style={s.rememberText}>Trust this device, if allowed by account policy</Text></Pressable>{error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}<Pressable disabled={busy} onPress={verify} style={s.button}>{busy?<ActivityIndicator color="#101827"/>:<Text style={s.buttonText}>Verify & continue →</Text>}</Pressable><Text style={s.foot}>Recovery codes are single-use. The server verifies each code and enforces rate limits; unused codes must be kept private.</Text></View></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#0B1020"},content:{flex:1,padding:24,justifyContent:"center",gap:14},back:{color:"#AAB4C7",marginBottom:16},kicker:{color:"#C7F36B",fontSize:10,fontWeight:"800",letterSpacing:1.5},title:{color:"#F7F8FC",fontSize:30,fontWeight:"900"},sub:{color:"#AAB4C7",fontSize:13,lineHeight:20,marginBottom:5},modeRow:{flexDirection:"row",gap:7},modeButton:{flex:1,borderRadius:10,borderWidth:1,borderColor:"#2B3650",padding:10,alignItems:"center"},modeActive:{backgroundColor:"#172B4D",borderColor:"#3B82F6"},modeText:{color:"#AAB4C7",fontSize:10,fontWeight:"800",textAlign:"center"},modeTextActive:{color:"#93C5FD"},label:{color:"#AAB4C7",fontSize:10,fontWeight:"800",letterSpacing:1.2},input:{minHeight:56,borderRadius:14,borderWidth:1,borderColor:"#2B3650",backgroundColor:"#121A2B",paddingHorizontal:16,color:"#F7F8FC",fontSize:18,letterSpacing:5},recoveryInput:{letterSpacing:1},remember:{flexDirection:"row",alignItems:"center",gap:10,marginTop:8},checkbox:{width:22,height:22,borderWidth:1,borderColor:"#53617B",borderRadius:6,alignItems:"center",justifyContent:"center"},checked:{backgroundColor:"#C7F36B",borderColor:"#C7F36B"},check:{color:"#101827",fontWeight:"900"},rememberText:{color:"#AAB4C7",fontSize:12,flex:1},button:{minHeight:54,borderRadius:14,backgroundColor:"#C7F36B",alignItems:"center",justifyContent:"center",marginTop:8},buttonText:{color:"#101827",fontWeight:"900"},error:{color:"#FFC2C2",backgroundColor:"#321E2B",padding:12,borderRadius:10,fontSize:12},foot:{color:"#718098",fontSize:10,lineHeight:16,textAlign:"center",marginTop:8}});
