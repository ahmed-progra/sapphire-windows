import { desktopBridge,desktopCall } from './desktopClient';
import { encodePCM16 } from './widgetLogic.mjs';

export async function startLiveConversation(onText:(text:string)=>void,onError:(error:Error)=>void):Promise<()=>void> {
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,sampleRate:16000,echoCancellation:true},video:false});
  const [input,output]=(()=>{let createdInput:AudioContext|undefined;try{createdInput=new AudioContext({sampleRate:16000});return [createdInput,new AudioContext({sampleRate:24000})] as const;}catch(error){stream.getTracks().forEach(track=>track.stop());void createdInput?.close();throw error;}})();
  // shortcut: ScriptProcessor remains supported in Chromium; replace with an AudioWorklet if Chromium removes it.
  let source:MediaStreamAudioSourceNode;let processor:ScriptProcessorNode;
  try{source=input.createMediaStreamSource(stream);processor=input.createScriptProcessor(2048,1,1);}catch(error){stream.getTracks().forEach(track=>track.stop());void input.close();void output.close();throw error;}
  let stopped=false;let playAt=0;let failure:Error|undefined;
  let offAudio:(()=>void)|undefined;let offText:(()=>void)|undefined;let offState:(()=>void)|undefined;
  const players=new Set<AudioBufferSourceNode>();
  const clearPlayback=()=>{for(const player of players){player.onended=null;try{player.stop();}catch{}player.disconnect();}players.clear();playAt=output.currentTime;};
  const stop=()=>{if(stopped)return;stopped=true;processor.onaudioprocess=null;processor.disconnect();source.disconnect();clearPlayback();stream.getTracks().forEach(track=>track.stop());void input.close();void output.close();offAudio?.();offText?.();offState?.();void desktopCall('ai.live',{action:'stop'}).catch(()=>{});};
  const fail=(error:unknown)=>{if(stopped)return;failure=error instanceof Error?error:new Error('Voice connection failed.');stop();onError(failure);};
  try {
  offAudio=desktopBridge()?.onDesktopEvent('ai-live-audio',(event:{data:string;mimeType?:string})=>{
    if(stopped)return;
    try {
      const bytes=Uint8Array.from(atob(event.data),char=>char.charCodeAt(0));
      const view=new DataView(bytes.buffer);const frames=Math.floor(bytes.length/2);if(!frames)return;
      const rate=Number(/rate=(\d+)/.exec(event.mimeType??'')?.[1]??24000);
      if(!Number.isFinite(rate)||rate<8000||rate>48000)throw new Error('The voice service returned an unsupported audio rate.');
      const buffer=output.createBuffer(1,frames,rate);const samples=buffer.getChannelData(0);
      for(let i=0;i<frames;i++)samples[i]=view.getInt16(i*2,true)/32768;
      const player=output.createBufferSource();player.buffer=buffer;player.connect(output.destination);
      players.add(player);player.onended=()=>{players.delete(player);player.disconnect();};
      playAt=Math.max(playAt,output.currentTime);player.start(playAt);playAt+=buffer.duration;
    } catch(error){fail(error);}
  });
  offText=desktopBridge()?.onDesktopEvent('ai-live-text',(event:any)=>{if(!stopped)onText(typeof event==='string'?event:event.text??'');});
  offState=desktopBridge()?.onDesktopEvent('ai-live-state',(event:any)=>{if(stopped)return;if(event.error)fail(new Error(event.error));else if(event.state==='interrupted')clearPlayback();else if(event.state==='disconnected')fail(new Error('The voice session ended. Start a new conversation to reconnect.'));});
    await desktopCall('ai.live',{action:'start'});await input.resume();await output.resume();
    if(stopped)throw failure??new Error('The voice session ended before it was ready.');
    processor.onaudioprocess=event=>{
      if(stopped)return;
      const bytes=encodePCM16(event.inputBuffer.getChannelData(0));
      let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
      void desktopCall('ai.live',{action:'audio',audio:btoa(binary)}).catch(fail);
    };
    source.connect(processor);processor.connect(input.destination);
    return stop;
  } catch(error){stop();throw error;}
}
