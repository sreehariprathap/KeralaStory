export type CollectKind = 'coin' | 'heart' | 'money';
export interface CollectItem { id: string; kind: CollectKind; x: number; y: number; z: number }
export interface CollectState { coins: number; dateKey: string; collectedIds: string[] }
export type Carrier = 'foot' | 'bicycle' | 'car' | 'glider';
