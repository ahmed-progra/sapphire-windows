import test from 'node:test';
import assert from 'node:assert/strict';
import {Spotify} from '../electron/spotify.mjs';
test('Spotify refresh keeps tokens in main storage and respects playback permissions',async()=>{
 let saved={clientId:'a'.repeat(32),refreshToken:'test-refresh',accessToken:'expired',expiresAt:0};const requests=[];
 const credentials={status:()=>({spotify:true}),get:()=>JSON.stringify(saved),set:(provider,value)=>{saved=JSON.parse(value);}};
 const spotify=new Spotify(credentials,()=>{},async(url,options)=>{requests.push({url,options});return url.includes('/api/token')?new Response(JSON.stringify({access_token:'refreshed',expires_in:3600})):new Response('{}',{status:403});});
 await assert.rejects(()=>spotify.play('spotify:track:abc'),/Premium/);assert.equal(saved.accessToken,'refreshed');assert.equal(requests[1].options.headers.authorization,'Bearer refreshed');
 await assert.rejects(()=>spotify.play('https://untrusted.example/track'),/Invalid Spotify track/);
 await assert.rejects(()=>spotify.connect('invalid'),/client ID/);
});

test('disconnect during token refresh cannot restore credentials or continue playback',async()=>{
 let saved=JSON.stringify({clientId:'a'.repeat(32),refreshToken:'fixture',accessToken:'expired',expiresAt:0});
 let finish;const requests=[];
 const credentials={status:()=>({spotify:!!saved}),get:()=>saved,set:(_provider,value)=>{saved=value;}};
 const spotify=new Spotify(credentials,()=>{},async url=>{requests.push(url);if(url.includes('/api/token'))return new Promise(resolve=>{finish=()=>resolve(new Response(JSON.stringify({access_token:'fixture-new',expires_in:3600})));});return new Response('{}');});
 const pending=spotify.queue();spotify.disconnect();finish();
 await assert.rejects(pending,/disconnected|cancelled/i);assert.equal(saved,'');assert.equal(requests.length,1);
});
