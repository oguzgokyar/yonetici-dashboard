import type { MusicSearchItem } from "./music-discovery";

export type MusicPickerState = {
  provider: "instagram" | "youtube";
  query: string;
  items: MusicSearchItem[];
  selectedId: string;
  previewId: string;
  offsetSeconds: number;
};
export function createMusicPickerState(): MusicPickerState {
  return { provider: "instagram", query: "", items: [], selectedId: "", previewId: "", offsetSeconds: 0 };
}
export type MusicPickerAction =
  | { type: "provider"; provider: MusicPickerState["provider"] }
  | { type: "query"; query: string }
  | { type: "results"; items: MusicSearchItem[]; provider: MusicPickerState["provider"]; query: string }
  | { type: "select"; id: string }
  | { type: "preview"; id: string }
  | { type: "offset"; seconds: number };
export function reduceMusicPicker(state: MusicPickerState, action: MusicPickerAction): MusicPickerState {
  switch (action.type) {
    case "provider": return { ...createMusicPickerState(), provider: action.provider };
    case "query": return { ...state, query: action.query, items: [], selectedId: "", previewId: "", offsetSeconds: 0 };
    case "results": return action.provider === state.provider && action.query === state.query ? { ...state, items: action.items } : state;
    case "select": return { ...state, selectedId: action.id, offsetSeconds: 0 };
    case "preview": return { ...state, previewId: action.id };
    case "offset": return { ...state, offsetSeconds: Number.isFinite(action.seconds) ? Math.max(0, action.seconds) : 0 };
  }
}
