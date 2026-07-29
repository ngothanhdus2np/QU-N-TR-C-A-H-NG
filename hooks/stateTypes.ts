import { AppData, AppDataItem, AppDataListKey, AppDataSurgicalUpdate, ChatMessage, BrandProfile, DiagnosisRange } from '../types';

export type AppListKey = AppDataListKey;
type AppListItem = AppDataItem<AppListKey>;

export type AppAction =
  | { type: 'SET_DATA'; payload: Partial<AppData> }
  | { type: 'UPDATE_ITEM'; payload: { key: AppListKey; item: AppListItem } }
  | { type: 'DELETE_ITEM'; payload: { key: AppListKey; id: string } }
  | { type: 'UPDATE_SURGICAL'; payload: AppDataSurgicalUpdate[] }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_BRAND_PROFILE'; payload: BrandProfile }
  | { type: 'SET_CHAT_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'SET_CLOUD_CONNECTED'; payload: boolean }
  | { type: 'SET_SHOW_RESIGNED'; payload: boolean }
  | { type: 'SET_DIAGNOSIS_RANGE'; payload: DiagnosisRange }
  | { type: 'SET_DIAG_START_DATE'; payload: string }
  | { type: 'SET_DIAG_END_DATE'; payload: string }
  | { type: 'SET_SYNC_ERRORS'; payload: string[] | null }
  | { type: 'SET_LAST_SYNC_TIME'; payload: string | null };

export interface AppState {
  data: AppData;
  activeTab: string;
  brandProfile: BrandProfile;
  chatMessages: ChatMessage[];
  isSyncing: boolean;
  isCloudConnected: boolean;
  showResigned: boolean;
  diagnosisRange: DiagnosisRange;
  diagStartDate: string;
  diagEndDate: string;
  syncErrors: string[] | null;
  lastSyncTime: string | null;
  isDataReady: boolean;
}
