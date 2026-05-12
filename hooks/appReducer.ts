import { AppListKey, AppState, AppAction } from './stateTypes';

type IdentifiedItem = { id: string };
const getList = (data: AppState['data'], key: AppListKey): IdentifiedItem[] =>
  ([...(data[key] || [])] as IdentifiedItem[]);

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...state,
        data: { ...state.data, ...action.payload }
      };
    case 'UPDATE_ITEM': {
      const { key, item } = action.payload;
      const newList = getList(state.data, key);
      const idx = newList.findIndex(i => i.id === item.id);
      if (idx > -1) {
        newList[idx] = { ...newList[idx], ...item };
      } else {
        newList.push(item);
      }
      return {
        ...state,
        data: { ...state.data, [key]: newList }
      };
    }
    case 'DELETE_ITEM': {
      const { key, id } = action.payload;
      const newList = getList(state.data, key).filter(i => i.id !== id);
      return {
        ...state,
        data: { ...state.data, [key]: newList }
      };
    }
    case 'UPDATE_SURGICAL': {
      let nextData = { ...state.data };
      for (const u of action.payload) {
        const key = u.key;
        const newList = getList(nextData, key);
        const idx = newList.findIndex(i => i.id === u.item.id);
        if (u.isDelete) {
          if (idx > -1) newList.splice(idx, 1);
        } else {
          if (idx > -1) {
            newList[idx] = { ...newList[idx], ...u.item };
          } else {
            newList.push(u.item);
          }
        }
        nextData = { ...nextData, [key]: newList };
      }
      return {
        ...state,
        data: nextData
      };
    }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_BRAND_PROFILE':
      return { ...state, brandProfile: action.payload };
    case 'SET_CHAT_MESSAGES':
      return { ...state, chatMessages: action.payload };
    case 'SET_SYNCING':
      return { ...state, isSyncing: action.payload };
    case 'SET_CLOUD_CONNECTED':
      return { ...state, isCloudConnected: action.payload };
    case 'SET_SHOW_RESIGNED':
      return { ...state, showResigned: action.payload };
    case 'SET_DIAGNOSIS_RANGE':
      return { ...state, diagnosisRange: action.payload };
    case 'SET_DIAG_START_DATE':
      return { ...state, diagStartDate: action.payload };
    case 'SET_DIAG_END_DATE':
      return { ...state, diagEndDate: action.payload };
    case 'SET_SYNC_ERRORS':
      return { ...state, syncErrors: action.payload };
    case 'SET_LAST_SYNC_TIME':
      return { ...state, lastSyncTime: action.payload };
    default:
      return state;
  }
}
