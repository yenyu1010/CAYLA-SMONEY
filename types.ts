export interface User {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  date: string;
  price: number;
  units: number;
  rate: string;
}

export interface Asset {
  id: string;
  userId: string;
  ticker: string;
  name?: string;
  shares: number;
  avgCost: number;
  totalCost: number;
  currentPrice: number;
  transactions: Transaction[];
  type: 'Stock' | 'ETF' | 'Fund';
  frequency?: 'Weekly' | 'Monthly' | 'Quarterly' | 'Individual';
  dataUrl?: string;
  currency?: string;
}

export interface Dividend {
  id: string;
  userId: string;
  ticker: string;
  exDate: string;
  payDate: string;
  amountPerShare: number;
  shares: number;
  grossAmount: number;
  tax: number;
  netAmount: number;
  netAmountTWD: number;
  frequency?: string;
}

export interface HistoryItem {
  id: string;
  userId: string;
  ticker: string;
  name?: string;
  sellDate: string;
  sellPrice: number;
  avgBuyPrice: number;
  shares: number;
  pnl: number;
  pnlPercent: number;
  currency?: string;
}

export type DeleteConfirmType = 'asset' | 'transaction' | 'dividend' | 'history';

export interface DeleteConfirmInfo {
  type: DeleteConfirmType;
  id: string;
  title: string;
  assetId?: string;
}

// Global declaration for variables injected by the environment (if any)
declare global {
  interface Window {
    __firebase_config: string;
    __app_id: string;
    __initial_auth_token: string;
  }
}