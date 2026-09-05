export interface ToolCallData {
  name: string;
  args: Record<string, any>;
  liveText?: string;
  commandString?: string;
}

export interface ResourceData {
  title: string;
  domain: string;
  url: string;
}

export interface AttachedFile {
  id?: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  previewUrl?: string;
  fileTypeLabel?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCall?: ToolCallData;
  toolResult?: any;
  resource?: ResourceData;
  resources?: ResourceData[];
  rawCommand?: string;
  thoughts?: string[];
  rating?: 'up' | 'down' | null;
  attachment?: AttachedFile;
  attachments?: AttachedFile[];
}

export interface UserCoordinates {
  lat: number;
  lon: number;
  accuracy?: number;
  city?: string;
}

export interface PreviewContent {
  type: 'map' | 'bin' | 'web' | 'terminal' | 'file' | 'calendar' | 'weather' | 'custom';
  title: string;
  subTitle: string;
  data: any;
  htmlContent?: string;
}

export interface BinScheduleItem {
  type: 'general' | 'recycling' | 'garden' | 'food';
  name: string;
  date: string;
  daysRemaining: number;
  color: string;
  items: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  previewContent?: PreviewContent | null;
}

export interface UserSettings {
  model: string;
  userName: string;
  userEmail: string;
  defaultLocation: string;
  postcode?: string;
  darkness?: 'pitch' | 'oled' | 'espresso' | 'slate' | 'titanium';
  accentColor?: 'gold' | 'sky' | 'emerald' | 'rose' | 'violet';
  fontSize?: 'compact' | 'standard' | 'comfortable' | 'large';
  temperature?: number;
  aiTone?: 'concise' | 'friendly' | 'technical' | 'creative';
  timeFormat?: '24h' | '12h';
  tempUnits?: 'c' | 'f';
  enableToolGrounding?: boolean;
  enableSuggestions?: boolean;
}
