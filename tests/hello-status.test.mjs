import test from 'node:test';
import assert from 'node:assert/strict';
import {helloVerification} from '../src/services/helloStatus.mjs';

test('only a consistent OS verification succeeds; it does not claim face verification',()=>{
 assert.equal(helloVerification({verified:true,status:'Verified'}).verified,true);
 assert.match(helloVerification({verified:true,status:'Verified'}).message,/does not identify/);
 for(const result of [null,{},true,{verified:true,status:'Canceled'},{verified:false,status:'Verified'},{status:'Verified'}])assert.equal(helloVerification(result).verified,false);
});
test('Hello cancellation, unavailable and denied states remain failures with useful messages',()=>{
 for(const [status,pattern] of [['Canceled',/cancelled/],['DeviceNotPresent',/No Windows Hello device/],['NotConfiguredForUser',/Set up/],['DisabledByPolicy',/policy/],['DeviceBusy',/busy/],['RetriesExhausted',/could not verify/],['Unknown',/did not complete/]]){
  const result=helloVerification({verified:false,status});assert.equal(result.verified,false);assert.match(result.message,pattern);
 }
});
