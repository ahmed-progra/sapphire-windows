import http from 'node:http';
import crypto from 'node:crypto';
import {text} from './core.mjs';
export const spotifyRedirect='http://127.0.0.1:42813/callback';
export class Spotify {
 constructor(credentials,openExternal,fetcher=globalThis.fetch){this.credentials=credentials;this.openExternal=openExternal;this.fetcher=fetcher;this.server=null;this.cancel=null;this.generation=0;}
 status(){if(!this.credentials.status().spotify)return{connected:false};try{const value=JSON.parse(this.credentials.get('spotify'));return{connected:true,expiresAt:value.expiresAt};}catch{return{connected:false};}}
 async connect(clientId){
  text(clientId,100);if(!/^[a-z0-9]{32}$/i.test(clientId))throw new Error('Enter the client ID from your Spotify developer app. Register http://127.0.0.1:42813/callback as its redirect URI.');if(this.server)throw new Error('A Spotify connection is already in progress.');
  const verifier=crypto.randomBytes(48).toString('base64url'),state=crypto.randomBytes(32).toString('base64url');
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  const generation=++this.generation;
  return new Promise((resolve,reject)=>{
   let timer,finished=false;const finish=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);this.server?.close();this.server=null;this.cancel=null;if(error)reject(error);else resolve(result);};
   this.cancel=()=>finish(new Error('Spotify connection cancelled.'));
   this.server=http.createServer(async(req,res)=>{
    const url=new URL(req.url??'/',spotifyRedirect);if(req.method!=='GET'||url.pathname!=='/callback'){res.writeHead(404).end();return;}
    if(url.searchParams.get('state')!==state){res.writeHead(400).end('Invalid sign-in state.');return;}
    if(url.searchParams.has('error')){res.writeHead(200,{'content-type':'text/plain'}).end('Spotify connection cancelled. Return to Sapphire.');finish(new Error('Spotify connection was cancelled.'));return;}
    const code=url.searchParams.get('code');if(!code){res.writeHead(400).end('Missing sign-in code.');return;}
    res.writeHead(200,{'content-type':'text/plain','cache-control':'no-store'}).end('You can return to Sapphire. This sign-in window may be closed.');
    try{const token=await this.token({client_id:clientId,grant_type:'authorization_code',code,redirect_uri:spotifyRedirect,code_verifier:verifier});if(finished||generation!==this.generation)return;if(!token.refresh_token||!token.access_token)throw new Error('Spotify did not issue a valid token.');this.credentials.set('spotify',JSON.stringify({clientId,refreshToken:token.refresh_token,accessToken:token.access_token,expiresAt:Date.now()+token.expires_in*1000}));finish(null,this.status());}catch(error){finish(error);}
   });
   this.server.once('error',()=>finish(new Error('Spotify sign-in could not open its local callback port. Close other Sapphire sign-in attempts and retry.')));
   this.server.listen(42813,'127.0.0.1',()=>{
    timer=setTimeout(()=>finish(new Error('Spotify sign-in timed out. Retry Connect.')),180000);
    const query=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:spotifyRedirect,state,code_challenge_method:'S256',code_challenge:challenge,scope:'user-read-playback-state user-modify-playback-state user-read-currently-playing'});
    Promise.resolve(this.openExternal(`https://accounts.spotify.com/authorize?${query}`)).catch(()=>finish(new Error('The browser could not open Spotify sign-in.')));
   });
  });
 }
 async token(form){let response;try{response=await this.fetcher('https://accounts.spotify.com/api/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form),signal:AbortSignal.timeout(20000)});}catch{throw new Error('Spotify could not be reached.');}if(!response.ok)throw new Error('Spotify rejected the sign-in or refresh token. Reconnect your account.');return response.json();}
 async request(endpoint,options={}){
  const generation=this.generation;
  let auth;try{auth=JSON.parse(this.credentials.get('spotify'));}catch{throw new Error('Connect Spotify first.');}
  if(Date.now()>=auth.expiresAt-30000){const token=await this.token({client_id:auth.clientId,grant_type:'refresh_token',refresh_token:auth.refreshToken});if(generation!==this.generation)throw new Error('Spotify was disconnected.');auth={...auth,accessToken:token.access_token,refreshToken:token.refresh_token??auth.refreshToken,expiresAt:Date.now()+token.expires_in*1000};this.credentials.set('spotify',JSON.stringify(auth));}
  let response;try{response=await this.fetcher('https://api.spotify.com/v1'+endpoint,{...options,headers:{...options.headers,authorization:'Bearer '+auth.accessToken},signal:AbortSignal.timeout(20000)});}catch{throw new Error('Spotify could not be reached.');}
  if(!response.ok)throw new Error(response.status===403?'Spotify playback requires account/app permission and may require Premium.':response.status===404?'Open Spotify on an available playback device first.':response.status===429?'Spotify rate limit reached. Retry later.':'Spotify rejected the request. Reconnect or check your developer app permissions.');
  return response.status===204?{}:response.json();
 }
 queue(){return this.request('/me/player/queue');}
 async play(uri){text(uri,200);if(!/^spotify:track:[A-Za-z0-9]+$/.test(uri))throw new Error('Invalid Spotify track.');return this.request('/me/player/play',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({uris:[uri]})});}
 disconnect(){this.generation++;this.cancel?.();this.credentials.set('spotify','');return{connected:false};}
 close(){this.generation++;this.cancel?.();this.server?.close();this.server=null;}
}
