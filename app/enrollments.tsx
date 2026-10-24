import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, ApiError } from "@/src/lib/api";

type Enrollment={membership_id:string;institute_id:string;institute_name:string;institute_code:string;batch_name?:string|null;batch_level?:string|null;membership_status?:string;sponsored_access?:number|boolean;joined_at?:string;materials_count?:number;tests_count?:number};
type Material={id:string;title?:string;institute_id?:string;institute_name?:string;institute_code?:string;level?:string;subject_name?:string;paper?:string;material_type?:string;created_at?:string;submission?:{id?:string;status?:string;percentage?:number}|null};
type Test={id:string;title?:string;institute_name?:string;subject_name?:string;level?:string;maximum_marks?:number;deadline?:string;submission?:{id?:string;status?:string;percentage?:number}|null};
const MAX_UPLOAD=30*1024*1024;
export default function EnrollmentsScreen(){
 const [items,setItems]=useState<Enrollment[]>([]);const [materials,setMaterials]=useState<Material[]>([]);const [tests,setTests]=useState<Test[]>([]);
 const [code,setCode]=useState("");const [tab,setTab]=useState<"institutes"|"materials"|"tests">("institutes");
 const [busy,setBusy]=useState(true);const [joining,setJoining]=useState(false);const [uploading,setUploading]=useState("");
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{setError("");try{const [e,m,t]=await Promise.all([
 apiRequest<{enrollments?:Enrollment[];institutes?:Enrollment[]}>("/api/student/enrollments"),
 apiRequest<{materials?:Material[]}>("/api/student/institute-materials"),
 apiRequest<{tests?:Test[]}>("/api/student/institute/my-tests")
 ]);setItems(e.enrollments||e.institutes||[]);setMaterials(m.materials||[]);setTests(t.tests||[]);}catch(e){setError(e instanceof Error?e.message:"Could not load institute data.");}finally{setBusy(false);}},[]);
 useEffect(()=>{void load();},[load]);
 async function join(){const instituteCode=code.trim().toUpperCase();if(!instituteCode){setError("Enter the institute code provided by your institute.");return;}setJoining(true);setError("");setNotice("");try{const r=await apiRequest<{success?:boolean;message?:string}>("/api/student/join-institute",{method:"POST",body:JSON.stringify({instituteCode})});setNotice(r.message||"Institute enrollment confirmed.");setCode("");await load();setTab("institutes");}catch(e){setError(e instanceof Error?e.message:"Could not join institute.");}finally{setJoining(false);}}
 async function submitPaper(kind:"test"|"material", item:Test|Material){
   setError("");setNotice("");
   const picker=await DocumentPicker.getDocumentAsync({type:["application/pdf","image/*"],copyToCacheDirectory:true,multiple:false});
   if(picker.canceled||!picker.assets?.length)return;
   const file=picker.assets[0];
   if(typeof file.size==="number"&&file.size>MAX_UPLOAD){setError("File exceeds the mobile upload limit of 30 MB. Please compress it before submitting.");return;}
   setUploading(item.id);
   try{
     const encoded=await FileSystem.readAsStringAsync(file.uri,{encoding:FileSystem.EncodingType.Base64});
     if(Math.ceil(encoded.length*3/4)>MAX_UPLOAD)throw new Error("File exceeds the 30 MB mobile upload limit.");
     const path=kind==="test"?"/api/student/institute/tests/"+encodeURIComponent(item.id)+"/submit":"/api/student/institute-materials/"+encodeURIComponent(item.id)+"/submit";
     const r=await apiRequest<{success?:boolean;evaluationId?:string;message?:string}>(path,{method:"POST",body:JSON.stringify({fileBase64:encoded,mimeType:file.mimeType||(file.name.toLowerCase().endsWith(".pdf")?"application/pdf":"image/jpeg"),filename:file.name,checkingMode:"standard"})});
     if(!r.success||!r.evaluationId)throw new Error(r.message||"The server did not confirm submission.");
     setNotice((r.message||"Institute paper submitted.")+" Evaluation: "+r.evaluationId);
     await load();
     router.push({pathname:"/evaluation-detail",params:{id:r.evaluationId}});
   }catch(e){setError(e instanceof Error?e.message:"Could not submit institute paper.");}
   finally{setUploading("");}
 }
 const fmt=(v?:string)=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleDateString():"—";
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={busy&&(items.length+materials.length+tests.length)>0} onRefresh={()=>{void load();}} tintColor="#C7F36B" />}><Pressable onPress={()=>router.back()}><Text style={s.back}>←  Dashboard</Text></Pressable><Text style={s.kicker}>INSTITUTE LEARNING</Text><Text style={s.title}>Institutes & assignments</Text><Text style={s.sub}>Enrolment, materials and assigned tests are restricted by the existing server membership rules. The app cannot grant institute access locally.</Text>
 {error?<View style={s.errorBox}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable onPress={()=>{void load();}}><Text style={s.link}>Retry</Text></Pressable></View>:null}{notice?<Text style={s.notice}>{notice}</Text>:null}
 <View style={s.tabs}>{(["institutes","materials","tests"] as const).map(x=><Pressable key={x} onPress={()=>setTab(x)} style={[s.tab,tab===x&&s.tabActive]}><Text style={[s.tabText,tab===x&&s.tabTextActive]}>{x==="institutes"?"My institutes":x==="materials"?"Materials":"Assigned tests"}</Text></Pressable>)}</View>
 {tab==="institutes"?<>
 <View style={s.card}><Text style={s.cardTitle}>Join an institute</Text><Text style={s.help}>Enter the official enrollment code provided by your institute administrator.</Text><TextInput value={code} onChangeText={v=>setCode(v.toUpperCase().replace(/\s/g,"").slice(0,40))} autoCapitalize="characters" style={s.input} placeholder="Institute code" placeholderTextColor="#718098"/><Pressable disabled={joining} onPress={()=>{void join();}} style={[s.button,joining&&s.disabled]}><Text style={s.buttonText}>{joining?"Checking code…":"Join institute"}</Text></Pressable></View>
 {busy&&!items.length?<ActivityIndicator color="#C7F36B" size="large"/>:null}{items.length===0&&!busy?<Text style={s.sub}>No active institute enrolments on this account.</Text>:null}
 {items.map(i=><View key={i.membership_id} style={s.card}><View style={s.row}><Text style={s.cardTitle}>{i.institute_name}</Text><Text style={s.activeBadge}>ACTIVE</Text></View><Text style={s.code}>{i.institute_code}</Text><Text style={s.help}>Batch: {i.batch_name||"Unassigned"} · Level: {i.batch_level||"—"}</Text><Text style={s.help}>Materials: {i.materials_count??0} · Tests: {i.tests_count??0} · Joined: {fmt(i.joined_at)}</Text>{i.sponsored_access?<Text style={s.sponsored}>✓ Institute-sponsored access is enabled</Text>:null}</View>)}
 </>:null}
 {tab==="materials"?<>
 {materials.length===0&&!busy?<Text style={s.sub}>No materials were returned for your active institute enrolments.</Text>:null}
 {materials.map(m=><View key={m.id} style={s.card}><Text style={s.cardTitle}>{m.title||m.subject_name||"Institute paper"}</Text><Text style={s.help}>{m.institute_name||"Institute"} · {m.level||"—"} · {m.subject_name||"Subject"} · {m.material_type||"Material"}</Text><Text style={s.help}>Status: {m.submission?.status||"Not submitted"}{typeof m.submission?.percentage==="number"?" · "+m.submission.percentage.toFixed(1)+"%":""}</Text><Pressable disabled={!!uploading} onPress={()=>{void submitPaper("material",m);}} style={[s.secondary,!!uploading&&s.disabled]}><Text style={s.secondaryText}>{uploading===m.id?"Uploading…":"Submit answer sheet for this material"}</Text></Pressable></View>)}
 </>:null}
 {tab==="tests"?<>
 {tests.length===0&&!busy?<Text style={s.sub}>No published tests were returned for your active institutes.</Text>:null}
 {tests.map(t=><View key={t.id} style={s.card}><Text style={s.cardTitle}>{t.title||"Institute test"}</Text><Text style={s.help}>{t.institute_name||"Institute"} · {t.subject_name||"Subject"} · {t.level||"—"}</Text><Text style={s.help}>Maximum marks: {t.maximum_marks??100} · Deadline: {fmt(t.deadline)}</Text><Text style={s.help}>Submission: {t.submission?.status||"Not submitted"}{typeof t.submission?.percentage==="number"?" · "+t.submission.percentage.toFixed(1)+"%":""}</Text><Pressable disabled={!!uploading} onPress={()=>{void submitPaper("test",t);}} style={[s.button,!!uploading&&s.disabled]}><Text style={s.buttonText}>{uploading===t.id?"Uploading…":"Submit test answer sheet"}</Text></Pressable></View>)}
 </>:null}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#0B1020"},content:{padding:22,paddingBottom:44,gap:14},back:{color:"#AAB4C7",fontSize:13,marginBottom:8},kicker:{color:"#60A5FA",fontSize:10,fontWeight:"900",letterSpacing:1.5},title:{color:"#F7F8FC",fontSize:28,fontWeight:"900"},sub:{color:"#AAB4C7",fontSize:12,lineHeight:19},tabs:{flexDirection:"row",gap:5,padding:4,backgroundColor:"#11192A",borderRadius:12,borderWidth:1,borderColor:"#202B41"},tab:{flex:1,paddingVertical:10,borderRadius:9,alignItems:"center"},tabActive:{backgroundColor:"#1D4ED8"},tabText:{color:"#9BA8BE",fontSize:10,fontWeight:"800"},tabTextActive:{color:"#FFFFFF"},card:{backgroundColor:"#11192A",borderColor:"#202B41",borderWidth:1,borderRadius:17,padding:16,gap:10},row:{flexDirection:"row",justifyContent:"space-between",gap:8,alignItems:"center"},cardTitle:{color:"#F1F4FA",fontSize:14,fontWeight:"900",flex:1},help:{color:"#9BA8BE",fontSize:11,lineHeight:17},input:{height:48,borderRadius:11,borderColor:"#34425D",borderWidth:1,backgroundColor:"#0B1020",paddingHorizontal:13,color:"#F7F8FC"},button:{minHeight:48,borderRadius:12,backgroundColor:"#C7F36B",alignItems:"center",justifyContent:"center",padding:10},buttonText:{color:"#101827",fontWeight:"900",fontSize:12},secondary:{minHeight:43,borderRadius:11,borderWidth:1,borderColor:"#34425D",alignItems:"center",justifyContent:"center",padding:10},secondaryText:{color:"#B7F36B",fontWeight:"800",fontSize:11},code:{color:"#C7F36B",fontSize:13,fontWeight:"900"},activeBadge:{color:"#34D399",fontSize:9,fontWeight:"900",backgroundColor:"#073A34",padding:6,borderRadius:7},sponsored:{color:"#42E8C3",fontSize:11,fontWeight:"800"},errorBox:{backgroundColor:"#321E2B",padding:13,borderRadius:12,gap:8},error:{color:"#FFC2C2",fontSize:12},link:{color:"#60A5FA",fontSize:12,fontWeight:"900"},notice:{color:"#C7F36B",fontSize:12,lineHeight:18},disabled:{opacity:.45}});
