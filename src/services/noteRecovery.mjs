export const notesKey='sapphire_quick_notes';
export const notesRecoveryKey='sapphire_notes_recovery';

export function readNoteRecovery(storage) {
  const raw=storage.getItem(notesRecoveryKey);
  if(raw===null)return null;
  try{
    const value=JSON.parse(raw);
    return value?.version===1&&typeof value.content==='string'&&Number.isFinite(value.updatedAt)?value:null;
  }catch{return null;}
}
export function preserveNoteDraft(storage,content,now=Date.now()) {
  storage.setItem(notesRecoveryKey,JSON.stringify({version:1,content,updatedAt:now}));
}
export function clearMatchingNoteRecovery(storage,content) {
  const recovery=readNoteRecovery(storage);
  if(!recovery||recovery.content!==content)return false;
  storage.removeItem(notesRecoveryKey);
  return true;
}
export function discardNoteRecovery(storage,content,confirmedContent) {
  const recovery=readNoteRecovery(storage);
  if(!recovery)return;
  if(recovery.content!==content)throw new Error('The recovery draft changed. Reopen Notes to review the latest copy.');
  storage.setItem(notesKey,confirmedContent);
  clearMatchingNoteRecovery(storage,content);
}
export function hydrateNotes(storage,content) {
  const previous=storage.getItem(notesKey);
  if(previous!==null&&previous!==content&&!readNoteRecovery(storage))preserveNoteDraft(storage,previous);
  storage.setItem(notesKey,content);
}
export async function saveNotesWithRecovery(storage,content,persist) {
  preserveNoteDraft(storage,content);
  storage.setItem(notesKey,content);
  await persist(content);
  clearMatchingNoteRecovery(storage,content);
}
