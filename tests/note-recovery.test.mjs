import test from 'node:test';
import assert from 'node:assert/strict';
import {clearMatchingNoteRecovery,discardNoteRecovery,hydrateNotes,notesKey,preserveNoteDraft,readNoteRecovery,saveNotesWithRecovery} from '../src/services/noteRecovery.mjs';

function storage(seed='saved notes'){
 const values=new Map([[notesKey,seed]]);
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
test('failed notes survive restart hydration and importing other notes without replacing the imported text',async()=>{
 const local=storage();
 await assert.rejects(saveNotesWithRecovery(local,'new unsaved draft',async()=>{throw new Error('disk unavailable');}),/disk unavailable/);
 assert.equal(readNoteRecovery(local).content,'new unsaved draft');
 hydrateNotes(local,'older desktop notes');
 assert.equal(local.getItem(notesKey),'older desktop notes');assert.equal(readNoteRecovery(local).content,'new unsaved draft');
 hydrateNotes(local,'newly imported notes');
 assert.equal(local.getItem(notesKey),'newly imported notes');assert.equal(readNoteRecovery(local).content,'new unsaved draft');
 assert.equal(clearMatchingNoteRecovery(local,'another draft'),false);assert.equal(readNoteRecovery(local).content,'new unsaved draft');
 assert.equal(clearMatchingNoteRecovery(local,'new unsaved draft'),true);assert.equal(readNoteRecovery(local),null);assert.equal(local.getItem(notesKey),'newly imported notes');
});
test('an older successful save cannot erase a newer failed draft, and only matching success clears recovery',async()=>{
 const local=storage();let firstDone;let secondFailed;
 const first=saveNotesWithRecovery(local,'first',()=>new Promise(resolve=>{firstDone=resolve;}));
 const second=saveNotesWithRecovery(local,'second',()=>new Promise((_resolve,reject)=>{secondFailed=reject;}));
 firstDone();await first;assert.equal(readNoteRecovery(local).content,'second');
 secondFailed(new Error('write rejected'));await assert.rejects(second,/write rejected/);assert.equal(readNoteRecovery(local).content,'second');
 await saveNotesWithRecovery(local,'second',async()=>{});assert.equal(readNoteRecovery(local),null);
});
test('a failed empty note draft and an unmarked pre-hydration draft are both preserved',async()=>{
 const local=storage();await assert.rejects(saveNotesWithRecovery(local,'',async()=>{throw new Error('offline');}));
 hydrateNotes(local,'saved text');assert.equal(readNoteRecovery(local).content,'');
 const legacy=storage('legacy unsaved text');hydrateNotes(legacy,'desktop text');assert.equal(readNoteRecovery(legacy).content,'legacy unsaved text');assert.equal(legacy.getItem(notesKey),'desktop text');
 preserveNoteDraft(legacy,'reviewed recovery edit');assert.equal(readNoteRecovery(legacy).content,'reviewed recovery edit');assert.equal(legacy.getItem(notesKey),'desktop text');
});
test('discard restores the confirmed local cache so a discarded failed draft cannot reappear on remount',async()=>{
 const local=storage('confirmed desktop notes');
 await assert.rejects(saveNotesWithRecovery(local,'discarded draft',async()=>{throw new Error('disk failed');}));
 assert.throws(()=>discardNoteRecovery(local,'outdated draft','confirmed desktop notes'),/changed/);
 assert.equal(readNoteRecovery(local).content,'discarded draft');
 discardNoteRecovery(local,'discarded draft','confirmed desktop notes');
 assert.equal(local.getItem(notesKey),'confirmed desktop notes');assert.equal(readNoteRecovery(local),null);
 hydrateNotes(local,'confirmed desktop notes');assert.equal(readNoteRecovery(local),null);
});
