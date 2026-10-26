export function helloVerification(result) {
 const verified=result?.verified===true && result?.status==='Verified';
 const messages={Canceled:'Verification was cancelled.',DeviceNotPresent:'No Windows Hello device is available.',NotConfiguredForUser:'Set up Windows Hello in Windows Sign-in options.',DisabledByPolicy:'Windows Hello is disabled by your device policy.',DeviceBusy:'Windows Hello is busy. Try again.',RetriesExhausted:'Windows could not verify you. Try again using Windows Sign-in options.'};
 return {verified,message:verified?'Windows verified your identity. This result does not identify whether face, fingerprint or PIN was used.':messages[result?.status]??'Verification did not complete. Try again.'};
}
