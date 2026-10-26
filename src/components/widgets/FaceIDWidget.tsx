import React,{useEffect,useRef,useState} from 'react';
import { ScanFace,ShieldCheck,ShieldX } from 'lucide-react';
import { desktopBridge,desktopCall,messageOf } from '../../services/desktopClient';
import { helloVerification } from '../../services/helloStatus.mjs';

type HelloAvailability={available:boolean;status:string;reason?:string;faceEnrolled:boolean|null;faceReason?:string;biometricsDisabledByPolicy:boolean|null};
export const FaceIDWidget:React.FC=()=>{
 const [availability,setAvailability]=useState<HelloAvailability|null>(null);
 const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');const [verified,setVerified]=useState(false);const [error,setError]=useState('');
 const inFlight=useRef(false);
 const refresh=async()=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setStatus('');setVerified(false);
  try{setAvailability(await desktopCall<HelloAvailability>('hello.availability'));}
  catch(e){setAvailability(null);setError(messageOf(e));}finally{inFlight.current=false;setBusy(false);}
 };
 useEffect(()=>{void refresh();return desktopBridge()?.onDesktopEvent('system-resume',()=>void refresh());},[]);
 const verify=async()=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setStatus('');setVerified(false);setError('');
  try{const result=helloVerification(await desktopCall('hello.verify'));setVerified(result.verified);setStatus(result.message);}
  catch(e){setError(messageOf(e));}finally{inFlight.current=false;setBusy(false);}
 };
 return <section className="p-6 flex flex-col items-center text-center gap-3" aria-label="Windows Hello">
  <ScanFace size={48} strokeWidth={1} className="text-muted"/><h3 className="text-xl">Windows Hello</h3>
  <p className="max-w-sm text-xs text-muted leading-relaxed">Windows manages face sign-in after startup or wake. Sapphire can ask Windows to verify your identity while you are signed in.</p>
  <p className="text-xs" role="status">{availability?(availability.available?'Windows Hello verification is available.':availability.reason||availability.status):busy?'Checking Windows Hello…':'Windows Hello status is unknown.'}</p>
  <p className="text-xs text-muted">{availability?.faceEnrolled===true?'Windows reports facial enrollment for your account. Test face sign-in in Windows to confirm the camera works.':availability?.faceEnrolled===false?'No Windows facial enrollment was found for your account.':availability?.faceReason||'Facial enrollment has not been confirmed.'}</p>
  {availability?.biometricsDisabledByPolicy===true&&<p role="alert" className="text-xs text-warning">Windows policy disables biometrics on this PC. A device administrator must allow biometrics before facial sign-in can work; a compatible infrared camera is still required.</p>}
  <p className="max-w-sm text-xs text-muted">A regular webcam is not proof of Windows Hello face support. Check Facial recognition in Windows Sign-in options for compatible infrared hardware and setup.</p>
  <div className="flex flex-wrap justify-center gap-2">
   <button className="glass-button px-4 py-2 text-xs disabled:opacity-40" disabled={busy||availability?.available!==true} onClick={()=>void verify()}>{busy?'Please wait…':'Test Windows Hello'}</button>
   <button className="glass-button px-4 py-2 text-xs disabled:opacity-40" disabled={busy} onClick={()=>void refresh()}>Refresh status</button>
   <button className="glass-button px-4 py-2 text-xs" disabled={busy} onClick={()=>{setError('');void desktopCall('shell.openSignInSettings').catch(e=>setError(messageOf(e)));}}>Open Windows sign-in settings</button>
  </div>
  {status&&<p role="status" className="text-xs flex gap-2 items-center">{verified?<ShieldCheck size={14}/>:<ShieldX size={14}/>}<span>{status}</span></p>}
  {error&&<p role="alert" className="text-xs text-warning">{error}</p>}
  <p className="text-[11px] text-muted">Windows owns biometric data. Face recognition cannot operate while the laptop is powered off.</p>
 </section>;
};
