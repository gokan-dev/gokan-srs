import { useSyncExternalStore } from 'react';
import { StorageService } from '../services/storage.service';

const subscribe = (listener: () => void) => StorageService.subscribeToSaveStatus(listener);
const getSnapshot = () => StorageService.progressSaveFailed();

/** Whether the latest progress save to this browser failed (storage full or unavailable). */
export function useProgressSaveFailed(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot);
}
