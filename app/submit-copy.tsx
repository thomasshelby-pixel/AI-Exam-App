import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "@/src/lib/api";

const levels = ["FOUNDATION", "INTERMEDIATE", "FINAL"] as const;
const materials = ["MODEL", "MTP", "RTP", "PYQ", "MODEL_TEST_PAPER", "QUESTION_PAPER"] as const;
const modes = ["standard", "strict", "lenient"] as const;
type Picked = { uri: string; name: string; mimeType?: string | null; size?: number | null };

export default function SubmitCopyScreen() {
 const [level,setLevel]=useState<typeof levels[number]>("INTERMEDIATE");
 const [courseLoading,setCourseLoading]=useState(true);
 const [courseLoadError,setCourseLoadError]=useState("");
 const [materialType,setMaterialType]=useState<typeof materials[number]>("MTP");
 const [subjectName,setSubjectName]=useState("");
 const [subjectKey,setSubjectKey]=useState("");
 const [attempt,setAttempt]=useState("");
 const [mtpSeries,setMtpSeries]=useState("1");
 const [checkingMode,setCheckingMode]=useState<typeof modes[number]>("standard");
 const [picked,setPicked]=useState<Picked|null>(null);
 const [ack,setAck]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");

 const loadCurrentCourse = useCallback(async () => {
   setCourseLoading(true);
   setCourseLoadError("");
   try {
     const response = await apiRequest<{ profile?: { caLevel?: string } }>("/api/student/profile");
     const current = String(response.profile?.caLevel || "").trim().toUpperCase();
     if (!levels.includes(current as typeof levels[number])) {
       throw new Error("Your current CA course is not set correctly in your profile.");
     }
     setLevel(current as typeof levels[number]);
   } catch (e) {
     setCourseLoadError(e instanceof Error ? e.message : "Could not verify your saved CA course.");
   } finally {
     setCourseLoading(false);
   }
 }, []);

 useFocusEffect(useCallback(() => { void loadCurrentCourse(); }, [loadCurrentCourse]));

 async function chooseFile() {
   setError(""); setMessage("");
   const result=await DocumentPicker.getDocumentAsync({type:"application/pdf",copyToCacheDirectory:true,multiple:false});
   if(result.canceled||!result.assets?.length)return;
   const file=result.assets[0];
   if(file.size && file.size>4*1024*1024){setError("PDF must be 4 MB or smaller. Please compress the file and try again.");return;}
   setPicked({uri:file.uri,name:file.name,mimeType:file.mimeType,size:file.size});
 }
 async function submit() {
   setError("");setMessage("");
   if(courseLoading){setError("Please wait while we verify your saved CA course.");return;}
   if(courseLoadError){setError("Your saved CA course could not be verified. Reload it before submitting.");return;}
   if(!ack){setError("Please acknowledge the evaluation disclaimer before continuing.");return;}
   if(!picked){setError("Choose your answer-sheet PDF first.");return;}
   if(!subjectName.trim()||!subjectKey.trim()){setError("Enter the exact subject name and subject key used by CA Exam Checker.");return;}
   if(!attempt.trim()){setError("Enter your actual exam attempt (for example, MAY 2027) before submitting.");return;}
   if(materialType==="MTP"&& !["1","2"].includes(mtpSeries)){setError("Choose MTP Series 1 or 2.");return;}
   setBusy(true);
   try {
     const disclaimer=await apiRequest<{acknowledged?:boolean;currentVersion?:string}>("/api/student/disclaimer/status");
     if(!disclaimer.currentVersion) throw new Error("The server did not provide the current disclaimer version. Please try again later.");
     if(!disclaimer.acknowledged) await apiRequest("/api/student/disclaimer/acknowledge",{method:"POST",body:JSON.stringify({version:disclaimer.currentVersion})});
     const encoded=await FileSystem.readAsStringAsync(picked.uri,{encoding:FileSystem.EncodingType.Base64});
     const body:Record<string,unknown>={studentName:"",level,materialType,subjectKey:subjectKey.trim(),subjectName:subjectName.trim(),attempt:attempt.trim(),checkingMode,fileBase64:encoded,mimeType:picked.mimeType||"application/pdf",filename:picked.name,evaluationSource:"SELF",examType:"CA"};
     if(materialType==="MTP")body.mtpSeries=Number(mtpSeries);
     const result=await apiRequest<{success?:boolean;id?:string;evaluationId?:string;message?:string;error?:string}>("/api/student/evaluate",{method:"POST",body:JSON.stringify(body)});
     setMessage(result.message||"Submission received by the server. Check evaluations for the authoritative status.");
     setPicked(null);
     router.replace("/evaluations");
   } catch(e) { setError(e instanceof Error?e.message:"Submission failed. No success has been assumed."); }
   finally {setBusy(false);}
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}>
 <Pressable onPress={()=>router.back()}><Text style={s.back}>←  Back</Text></Pressable>
 <Text style={s.kicker}>ANSWER-SHEET CHECKER</Text><Text style={s.title}>Submit a copy</Text><Text style={s.sub}>Your PDF is sent to the existing CA Exam Checker evaluation engine. The app does not calculate marks locally.</Text>
 <Text style={s.label}>YOUR SAVED CA COURSE</Text><View style={s.courseBadge}><Text style={s.courseBadgeText}>{courseLoading?"Verifying course…":level}</Text></View>{courseLoadError?<View style={s.courseError}><Text style={s.error}>{courseLoadError}</Text><Pressable onPress={()=>{void loadCurrentCourse();}}><Text style={s.courseRetry}>Retry course check</Text></Pressable><Pressable onPress={()=>router.push("/profile")}><Text style={s.courseRetry}>Open student profile</Text></Pressable></View>:<Text style={s.courseHelp}>Course is read from your saved student profile to match the server eligibility check. Update it in Profile first if needed.</Text>}
 <Text style={s.label}>REFERENCE MATERIAL TYPE</Text><View style={s.chips}>{materials.map(x=><Pressable key={x} onPress={()=>setMaterialType(x)} style={[s.chip,materialType===x&&s.selected]}><Text style={[s.chipText,materialType===x&&s.selectedText]}>{x.replaceAll("_"," ")}</Text></Pressable>)}</View>
 {materialType==="MTP"?<><Text style={s.label}>MTP SERIES</Text><View style={s.chips}>{["1","2"].map(x=><Pressable key={x} onPress={()=>setMtpSeries(x)} style={[s.chip,mtpSeries===x&&s.selected]}><Text style={[s.chipText,mtpSeries===x&&s.selectedText]}>Series {x}</Text></Pressable>)}</View></>:null}
 <Text style={s.label}>SUBJECT NAME</Text><TextInput value={subjectName} onChangeText={setSubjectName} placeholder="e.g. Corporate and Other Laws" placeholderTextColor="#66738A" style={s.input}/>
 <Text style={s.label}>SUBJECT KEY</Text><TextInput value={subjectKey} onChangeText={setSubjectKey} placeholder="Exact subject key from website" placeholderTextColor="#66738A" autoCapitalize="characters" style={s.input}/>
 <Text style={s.label}>EXAM ATTEMPT</Text><TextInput value={attempt} onChangeText={setAttempt} autoCapitalize="characters" placeholder="Enter your actual attempt, e.g. MAY 2027" placeholderTextColor="#66738A" style={s.input}/><Text style={s.courseHelp}>This value is saved with your submission. Check it carefully before evaluation.</Text>
 <Text style={s.label}>CHECKING MODE</Text><View style={s.chips}>{modes.map(x=><Pressable key={x} onPress={()=>setCheckingMode(x)} style={[s.chip,checkingMode===x&&s.selected]}><Text style={[s.chipText,checkingMode===x&&s.selectedText]}>{x.toUpperCase()}</Text></Pressable>)}</View>
 <Pressable onPress={chooseFile} style={s.file}><Text style={s.fileIcon}>📄</Text><View style={{flex:1,gap:5}}><Text style={s.fileTitle}>{picked?picked.name:"Choose answer-sheet PDF"}</Text><Text style={s.fileSub}>{picked?((picked.size||0)/1024/1024).toFixed(2)+" MB":"PDF only · maximum 4 MB"}</Text></View><Text style={s.choose}>{picked?"Change":"Browse"}</Text></Pressable>
 <Pressable onPress={()=>setAck(!ack)} style={s.ackRow}><View style={[s.checkbox,ack&&s.checkboxOn]}>{ack?<Text style={s.check}>✓</Text>:null}</View><Text style={s.ackText}>I understand that evaluation is based on the official material available to the platform and results are subject to the displayed evaluation disclaimer.</Text></Pressable>
 {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}{message?<Text style={s.success}>{message}</Text>:null}
 <Pressable disabled={busy||courseLoading||Boolean(courseLoadError)} onPress={submit} style={[s.button,(busy||courseLoading||Boolean(courseLoadError))&&{opacity:.55}]}>{busy||courseLoading?<ActivityIndicator color="#101827"/>:<Text style={s.buttonText}>Submit for evaluation  →</Text>}</Pressable>
 <Text style={s.foot}>Submission is subject to server-side eligibility, reference-material availability, credit checks and disclaimer validation.</Text>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#0B1020"},content:{padding:22,paddingBottom:40,gap:12},courseBadge:{alignSelf:"flex-start",borderRadius:12,backgroundColor:"#27364A",borderWidth:1,borderColor:"#3A4966",paddingHorizontal:14,paddingVertical:11},courseBadgeText:{color:"#C7F36B",fontSize:12,fontWeight:"900",letterSpacing:.7},courseHelp:{color:"#718098",fontSize:10,lineHeight:15,marginTop:-5},courseError:{backgroundColor:"#321E2B",borderRadius:12,padding:12,gap:8},courseRetry:{color:"#C7F36B",fontSize:12,fontWeight:"800"},back:{color:"#AAB4C7",fontSize:13,marginBottom:12},kicker:{color:"#C7F36B",fontSize:10,fontWeight:"800",letterSpacing:1.5},title:{color:"#F7F8FC",fontSize:28,fontWeight:"900",marginTop:-5},sub:{color:"#AAB4C7",fontSize:13,lineHeight:20,marginBottom:8},label:{color:"#AAB4C7",fontSize:10,fontWeight:"800",letterSpacing:1.2,marginTop:8},chips:{flexDirection:"row",flexWrap:"wrap",gap:7},chip:{borderColor:"#2B3650",borderWidth:1,borderRadius:11,paddingHorizontal:11,paddingVertical:10,backgroundColor:"#121A2B"},selected:{backgroundColor:"#C7F36B",borderColor:"#C7F36B"},chipText:{color:"#AAB4C7",fontSize:10,fontWeight:"800"},selectedText:{color:"#101827"},input:{height:50,borderRadius:13,borderWidth:1,borderColor:"#2B3650",backgroundColor:"#121A2B",paddingHorizontal:14,color:"#F7F8FC",fontSize:14},file:{marginTop:8,flexDirection:"row",alignItems:"center",gap:12,borderRadius:16,borderWidth:1,borderColor:"#34425D",borderStyle:"dashed",padding:15,backgroundColor:"#121A2B"},fileIcon:{fontSize:23},fileTitle:{color:"#F1F4FA",fontSize:13,fontWeight:"800"},fileSub:{color:"#929DB2",fontSize:11},choose:{color:"#C7F36B",fontSize:12,fontWeight:"800"},ackRow:{flexDirection:"row",gap:10,alignItems:"flex-start",marginTop:8},checkbox:{width:22,height:22,borderRadius:6,borderWidth:1,borderColor:"#53617B",alignItems:"center",justifyContent:"center"},checkboxOn:{backgroundColor:"#C7F36B",borderColor:"#C7F36B"},check:{color:"#101827",fontWeight:"900"},ackText:{flex:1,color:"#AAB4C7",fontSize:11,lineHeight:17},error:{color:"#FFBABA",backgroundColor:"#321E2B",padding:12,borderRadius:10,fontSize:12},success:{color:"#C7F36B",fontSize:12},button:{marginTop:8,minHeight:54,borderRadius:15,backgroundColor:"#C7F36B",alignItems:"center",justifyContent:"center"},buttonText:{color:"#101827",fontSize:14,fontWeight:"900"},foot:{color:"#718098",fontSize:10,lineHeight:16,textAlign:"center",marginTop:6}});
