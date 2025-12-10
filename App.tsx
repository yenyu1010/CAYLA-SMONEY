import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wallet, DollarSign, History, 
  Plus, Users, Lock, RefreshCw, User as UserIcon, ChevronDown, AlertTriangle, Trash2, Database, HardDrive
} from 'lucide-react';
import { 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
} from 'firebase/firestore';

// Internal Imports
import { auth, db, getAppId } from './firebase';
import { Asset, Dividend, HistoryItem, User, Transaction, DeleteConfirmInfo } from './types';
import StatsGrid from './components/ui/StatsGrid';
import AssetRow from './components/AssetRow';
import DividendGroup from './components/DividendGroup';
import DeleteConfirmModal from './components/modals/DeleteConfirmModal';
import UserManageModal from './components/modals/UserManageModal';
import UpdatePriceModal from './components/modals/UpdatePriceModal';
import SellModal from './components/modals/SellModal';
import AddAssetModal from './components/modals/AddAssetModal';
import AddDividendModal from './components/modals/AddDividendModal';

const INITIAL_USERS: User[] = [
  { id: 'u1', name: '楠仔' },
  { id: 'u2', name: '盼盼' }
];

const LOCAL_STORAGE_KEY = 'investment_portfolio_data_v1';
const appId = getAppId();

const fetchUsdTwdRate = async () => {
  try {
    const proxyUrl = "https://corsproxy.io/?";
    const targetUrl = "https://query1.finance.yahoo.com/v8/finance/chart/TWD=X"; // TWD=X is USD -> TWD
    const res = await fetch(proxyUrl + encodeURIComponent(targetUrl));
    const data = await res.json();
    const rate = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    return rate || 32.5;
  } catch (e) {
    console.warn("Failed to fetch exchange rate, using default 32.5", e);
    return 32.5; 
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'assets' | 'dividends' | 'history'>('assets');
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(null); 
  const [showUserModal, setShowUserModal] = useState(false);
  
  // Data State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [usdToTwd, setUsdToTwd] = useState<number>(32.5);

  // Auth & Sync State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isPublicMode, setIsPublicMode] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [useLocalStorage, setUseLocalStorage] = useState(false);

  // Modals States
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [addingTxToAsset, setAddingTxToAsset] = useState<Asset | null>(null); 
  const [editingTx, setEditingTx] = useState<{ asset: Asset; tx: Transaction } | null>(null); 

  const [showDividendModal, setShowDividendModal] = useState(false);
  const [editingDividend, setEditingDividend] = useState<Dividend | null>(null);
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedAssetForSell, setSelectedAssetForSell] = useState<Asset | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmInfo | null>(null); 

  // --- Auth & Sync Hooks ---
  useEffect(() => {
    if (!auth) {
      setUseLocalStorage(true);
      return; 
    }
    
    const initAuth = async () => {
      // Check for global token if injected, else anon
      if (typeof window !== 'undefined' && window.__initial_auth_token) {
        await signInWithCustomToken(auth, window.__initial_auth_token).catch(e => console.warn("Auth failed, falling back", e));
      } else {
        await signInAnonymously(auth).catch(e => console.warn("Anon Auth failed", e));
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Fetch Exchange Rate ---
  useEffect(() => {
      fetchUsdTwdRate().then(rate => setUsdToTwd(rate));
  }, []);

  // --- Data Loading Effect ---
  useEffect(() => {
    // Mode 1: Firebase Sync
    if (user && db && !useLocalStorage) {
        setIsSyncing(true);
        const basePath = isPublicMode ? `artifacts/${appId}/public/data` : `artifacts/${appId}/users/${user.uid}`;

        const unsubAssets = onSnapshot(collection(db, basePath, 'assets'), (s) => {
            setAssets(s.docs.map(d => ({ ...d.data(), id: d.id } as Asset)));
        }, (e) => console.error(e));

        const unsubDividends = onSnapshot(collection(db, basePath, 'dividends'), (s) => {
            const d = s.docs.map(doc => ({ ...doc.data(), id: doc.id } as Dividend));
            d.sort((a,b) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime());
            setDividends(d);
        }, (e) => console.error(e));

        const unsubHistory = onSnapshot(collection(db, basePath, 'history'), (s) => {
            const d = s.docs.map(doc => ({ ...doc.data(), id: doc.id } as HistoryItem));
            d.sort((a,b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime());
            setHistory(d);
            setIsSyncing(false);
        }, (e) => console.error(e));

        return () => { unsubAssets(); unsubDividends(); unsubHistory(); };
    } 
    
    // Mode 2: Local Storage Loading
    else if (useLocalStorage) {
        setIsSyncing(true);
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                if (data.assets) setAssets(data.assets);
                if (data.dividends) setDividends(data.dividends);
                if (data.history) setHistory(data.history);
            }
        } catch (e) {
            console.error("Failed to load local data", e);
        }
        setIsSyncing(false);
    }
  }, [user, isPublicMode, useLocalStorage]);

  // --- Helpers ---
  const getCollectionPath = (colName: string) => {
    if (!user) return null;
    return isPublicMode ? `artifacts/${appId}/public/data/${colName}` : `artifacts/${appId}/users/${user.uid}/${colName}`;
  };

  const saveToLocal = (newAssets?: Asset[], newDividends?: Dividend[], newHistory?: HistoryItem[]) => {
      const data = {
          assets: newAssets ?? assets,
          dividends: newDividends ?? dividends,
          history: newHistory ?? history
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      // Update state immediately for UI reflect
      if (newAssets) setAssets(newAssets);
      if (newDividends) setDividends(newDividends);
      if (newHistory) setHistory(newHistory);
  };

  const displayedAssets = useMemo(() => currentUser ? assets.filter(a => a.userId === currentUser.id) : assets, [assets, currentUser]);
  const displayedDividends = useMemo(() => currentUser ? dividends.filter(d => d.userId === currentUser.id) : dividends, [dividends, currentUser]);
  const displayedHistory = useMemo(() => currentUser ? history.filter(h => h.userId === currentUser.id) : history, [history, currentUser]);

  const assetStats = useMemo(() => {
    const totalInvested = displayedAssets.reduce((sum, a) => sum + (Number(a.totalCost) || 0), 0);
    const currentMarketValue = displayedAssets.reduce((sum, a) => sum + ((Number(a.currentPrice) || 0) * (Number(a.shares) || 0)), 0);
    const totalDivs = displayedDividends.reduce((sum, d) => sum + (Number(d.netAmount) || 0), 0);
    const valuePlusDivs = currentMarketValue + totalDivs;
    const roiCurrent = totalInvested > 0 ? ((currentMarketValue - totalInvested) / totalInvested) * 100 : 0;
    const roiTotal = totalInvested > 0 ? ((valuePlusDivs - totalInvested) / totalInvested) * 100 : 0;
    return { totalInvested, currentMarketValue, totalDivs, valuePlusDivs, roiCurrent, roiTotal };
  }, [displayedAssets, displayedDividends]);

  const dividendStats = useMemo(() => {
    const totalReceived = displayedDividends.reduce((sum, d) => sum + (Number(d.netAmount) || 0), 0);
    const totalReceivedTWD = displayedDividends.reduce((sum, d) => sum + (Number(d.netAmountTWD) || 0), 0);
    const estMonthly = totalReceived / 6; // Simple estimation
    const totalCost = displayedAssets.reduce((sum, a) => sum + (Number(a.totalCost) || 0), 0);
    const yieldRate = totalCost > 0 ? (totalReceived / totalCost) * 100 : 0;
    return { totalReceived, totalReceivedTWD, estMonthly, yieldRate };
  }, [displayedDividends, displayedAssets]);

  const historyStats = useMemo(() => {
    const totalPnL = displayedHistory.reduce((sum, h) => sum + (Number(h.pnl) || 0), 0);
    const totalHistoryCost = displayedHistory.reduce((sum, h) => sum + ((Number(h.avgBuyPrice) || 0) * (Number(h.shares) || 0)), 0);
    const totalRoi = totalHistoryCost > 0 ? (totalPnL / totalHistoryCost) * 100 : 0;
    return { totalPnL, totalRoi };
  }, [displayedHistory]);

  const groupedDividends = useMemo(() => {
    const groups: Record<string, Dividend[]> = {};
    displayedDividends.forEach(d => { if(!groups[d.ticker]) groups[d.ticker] = []; groups[d.ticker].push(d); });
    Object.keys(groups).forEach(key => { groups[key].sort((a,b) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime()); });
    return groups;
  }, [displayedDividends]);

  // --- CRUD Handlers ---

  const handleSaveAsset = async (data: any, addNext: boolean) => {
    const userId = currentUser ? currentUser.id : users[0].id;

    // --- Prepare Data Logic ---
    let newAssetsList = [...assets];
    let operationPromise = null;
    const path = getCollectionPath('assets');

    if (editingTx) {
      const { asset, tx } = editingTx;
      const updatedTx: Transaction = { ...tx, date: data.buyDate, price: parseFloat(data.unitPrice), units: parseFloat(data.units), rate: data.exchangeRate };
      
      const newTransactions = asset.transactions.map(t => t.id === tx.id ? updatedTx : t);
      const newShares = newTransactions.reduce((acc, t) => acc + t.units, 0);
      const newTotalCost = newTransactions.reduce((acc, t) => acc + (t.units * t.price), 0);
      const newAvgCost = newShares > 0 ? newTotalCost / newShares : 0;

      const updatedAsset = { ...asset, transactions: newTransactions, shares: newShares, totalCost: newTotalCost, avgCost: newAvgCost };
      
      if (useLocalStorage) {
          newAssetsList = assets.map(a => a.id === asset.id ? updatedAsset : a);
          saveToLocal(newAssetsList);
      } else if (path && db) {
          operationPromise = updateDoc(doc(db, path, asset.id), { transactions: newTransactions, shares: newShares, totalCost: newTotalCost, avgCost: newAvgCost });
      }
      setEditingTx(null);

    } else if (addingTxToAsset) {
      const asset = addingTxToAsset;
      const newTx: Transaction = { id: Date.now().toString(), date: data.buyDate, price: parseFloat(data.unitPrice), units: parseFloat(data.units), rate: data.exchangeRate };
      
      const newTransactions = [...(asset.transactions || []), newTx];
      const newShares = newTransactions.reduce((acc, t) => acc + t.units, 0);
      const newTotalCost = newTransactions.reduce((acc, t) => acc + (t.units * t.price), 0);
      const newAvgCost = newShares > 0 ? newTotalCost / newShares : 0;

      const updatedAsset = { ...asset, transactions: newTransactions, shares: newShares, totalCost: newTotalCost, avgCost: newAvgCost };

      if (useLocalStorage) {
          newAssetsList = assets.map(a => a.id === asset.id ? updatedAsset : a);
          saveToLocal(newAssetsList);
      } else if (path && db) {
          operationPromise = updateDoc(doc(db, path, asset.id), { transactions: newTransactions, shares: newShares, totalCost: newTotalCost, avgCost: newAvgCost });
      }
      setAddingTxToAsset(null);

    } else if (editingAsset) {
      const updatedAsset = { ...editingAsset, ticker: data.ticker, type: data.type, frequency: data.frequency, dataUrl: data.dataUrl };
      
      if (useLocalStorage) {
          newAssetsList = assets.map(a => a.id === editingAsset.id ? updatedAsset : a);
          saveToLocal(newAssetsList);
      } else if (path && db) {
          operationPromise = updateDoc(doc(db, path, editingAsset.id), { ticker: data.ticker, type: data.type, frequency: data.frequency, dataUrl: data.dataUrl });
      }
      setEditingAsset(null);

    } else {
      const targetTicker = data.ticker.toUpperCase();
      const existingAsset = assets.find(a => a.ticker === targetTicker);

      if (existingAsset) {
        const newTx: Transaction = { id: Date.now().toString(), date: data.buyDate, price: parseFloat(data.unitPrice), units: parseFloat(data.units), rate: data.exchangeRate };
        const newTransactions = [...(existingAsset.transactions || []), newTx];
        const newShares = newTransactions.reduce((acc, t) => acc + t.units, 0);
        const newTotalCost = newTransactions.reduce((acc, t) => acc + (t.units * t.price), 0);
        const newAvgCost = newShares > 0 ? newTotalCost / newShares : 0;

        const updatedAsset = { ...existingAsset, transactions: newTransactions, shares: newShares, totalCost: newTotalCost, avgCost: newAvgCost };

        if (useLocalStorage) {
            newAssetsList = assets.map(a => a.id === existingAsset.id ? updatedAsset : a);
            saveToLocal(newAssetsList);
        } else if (path && db) {
            operationPromise = updateDoc(doc(db, path, existingAsset.id), { transactions: newTransactions, shares: newShares, totalCost: newTotalCost, avgCost: newAvgCost });
        }
      } else {
        const shares = parseFloat(data.units);
        const avgCost = parseFloat(data.unitPrice);
        const newAssetBase: Omit<Asset, 'id'> = {
          userId,
          ticker: targetTicker,
          shares,
          avgCost,
          totalCost: shares * avgCost,
          currentPrice: avgCost,
          transactions: [{ id: Date.now().toString(), date: data.buyDate, price: avgCost, units: shares, rate: data.exchangeRate }],
          type: data.type,
          frequency: data.frequency,
          dataUrl: data.dataUrl
        };
        
        if (useLocalStorage) {
            const newAsset = { ...newAssetBase, id: Date.now().toString() };
            newAssetsList = [...assets, newAsset];
            saveToLocal(newAssetsList);
        } else if (path && db) {
            operationPromise = addDoc(collection(db, path), newAssetBase);
        }
      }
    }
    
    if (operationPromise) await operationPromise;

    if(!addNext) {
        setShowAssetModal(false);
    }
  };

  const handleSellAsset = async (id: string, qty: number, price: number, date: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;

    const sellQty = qty;
    const sellPrice = price;
    
    if (sellQty > asset.shares) {
      alert("賣出數量大於持有數量");
      return;
    }

    let remainingToSell = sellQty;
    let costBasis = 0;
    const sortedTransactions = [...(asset.transactions || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const newTransactions: Transaction[] = [];

    for (const tx of sortedTransactions) {
      if (remainingToSell <= 0) {
        newTransactions.push(tx); 
        continue;
      }

      if (tx.units <= remainingToSell) {
        costBasis += tx.units * tx.price;
        remainingToSell -= tx.units;
      } else {
        costBasis += remainingToSell * tx.price;
        const updatedTx = { ...tx, units: tx.units - remainingToSell };
        newTransactions.push(updatedTx);
        remainingToSell = 0;
      }
    }

    const totalSellValue = sellQty * sellPrice;
    const pnl = totalSellValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    const newHistoryItem: Omit<HistoryItem, 'id'> = { 
      userId: currentUser ? currentUser.id : users[0].id, 
      ticker: asset.ticker, 
      name: asset.name, 
      sellDate: date, 
      sellPrice: sellPrice, 
      avgBuyPrice: sellQty > 0 ? costBasis / sellQty : 0, 
      shares: sellQty, 
      pnl, 
      pnlPercent, 
      currency: asset.currency 
    };

    // Execution
    if (useLocalStorage) {
        const fullHistoryItem = { ...newHistoryItem, id: Date.now().toString() };
        const newHistoryList = [...history, fullHistoryItem];

        let newAssetsList = [];
        if (newTransactions.length === 0 || sellQty === asset.shares) {
             newAssetsList = assets.filter(a => a.id !== id);
        } else {
             const newTotalShares = newTransactions.reduce((acc, t) => acc + t.units, 0);
             const newTotalCost = newTransactions.reduce((acc, t) => acc + (t.units * t.price), 0);
             const newAvgCost = newTotalShares > 0 ? newTotalCost / newTotalShares : 0;
             const updatedAsset = { ...asset, shares: newTotalShares, totalCost: newTotalCost, avgCost: newAvgCost, transactions: newTransactions };
             newAssetsList = assets.map(a => a.id === id ? updatedAsset : a);
        }
        saveToLocal(newAssetsList, undefined, newHistoryList);

    } else {
        if (!user || !db) return;
        const pathAssets = getCollectionPath('assets');
        const pathHistory = getCollectionPath('history');
        if(!pathAssets || !pathHistory) return;

        try {
          await addDoc(collection(db, pathHistory), newHistoryItem);
          
          if (newTransactions.length === 0 || sellQty === asset.shares) {
            await deleteDoc(doc(db, pathAssets, id));
          } else {
            const newTotalShares = newTransactions.reduce((acc, t) => acc + t.units, 0);
            const newTotalCost = newTransactions.reduce((acc, t) => acc + (t.units * t.price), 0);
            const newAvgCost = newTotalShares > 0 ? newTotalCost / newTotalShares : 0;

            await updateDoc(doc(db, pathAssets, id), {
              shares: newTotalShares,
              totalCost: newTotalCost,
              avgCost: newAvgCost,
              transactions: newTransactions
            });
          }
        } catch (e) { console.error(e); alert("賣出失敗"); }
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id, assetId } = deleteConfirm;
    
    if (useLocalStorage) {
        if (type === 'transaction' && assetId) {
             const asset = assets.find(a => a.id === assetId);
             if (asset) {
                const newTransactions = asset.transactions.filter(t => t.id !== id);
                const newShares = newTransactions.reduce((acc, t) => acc + t.units, 0);
                const newTotalCost = newTransactions.reduce((acc, t) => acc + (t.units * t.price), 0);
                const newAvgCost = newShares > 0 ? newTotalCost / newShares : 0; 
                const updatedAsset = { ...asset, transactions: newTransactions, shares: newShares, totalCost: newTotalCost, avgCost: newAvgCost };
                const newAssetsList = assets.map(a => a.id === assetId ? updatedAsset : a);
                saveToLocal(newAssetsList);
             }
        } else if (type === 'asset') {
            saveToLocal(assets.filter(a => a.id !== id));
        } else if (type === 'dividend') {
            saveToLocal(undefined, dividends.filter(d => d.id !== id));
        } else if (type === 'history') {
            saveToLocal(undefined, undefined, history.filter(h => h.id !== id));
        }
    } else {
        if (!user || !db) return;
        if (type === 'transaction' && assetId) {
          const asset = assets.find(a => a.id === assetId);
          if (asset) {
            const newTransactions = asset.transactions.filter(t => t.id !== id);
            const newShares = newTransactions.reduce((acc, t) => acc + t.units, 0);
            const newTotalCost = newTransactions.reduce((acc, t) => acc + (t.units * t.price), 0);
            const newAvgCost = newShares > 0 ? newTotalCost / newShares : 0; 
            const path = getCollectionPath('assets');
            if(path) await updateDoc(doc(db, path, assetId), { transactions: newTransactions, shares: newShares, totalCost: newTotalCost, avgCost: newAvgCost });
          }
        } else {
          let colName = '';
          if (type === 'asset') colName = 'assets';
          else if (type === 'dividend') colName = 'dividends';
          else if (type === 'history') colName = 'history';
          const path = getCollectionPath(colName);
          if(path) await deleteDoc(doc(db, path, id));
        }
    }
    setDeleteConfirm(null);
  };

  const handleSaveDividend = async (data: any, addNext: boolean) => {
    const userId = currentUser ? currentUser.id : users[0].id;
    const gross = parseFloat(data.dividendPerShare) * parseFloat(data.units);
    const tax = data.isTaxable ? gross * 0.3 : 0;
    const net = gross - tax;
    const payloadBase: Omit<Dividend, 'id'> = { userId, ticker: data.ticker, exDate: data.exDate, payDate: data.exDate, amountPerShare: parseFloat(data.dividendPerShare), shares: parseFloat(data.units), grossAmount: gross, tax, netAmount: net, netAmountTWD: net * 32.5, frequency: 'Unknown' };
    
    if (useLocalStorage) {
        let newDividendsList;
        if (editingDividend) {
            newDividendsList = dividends.map(d => d.id === editingDividend.id ? { ...payloadBase, id: editingDividend.id } : d);
        } else {
            newDividendsList = [...dividends, { ...payloadBase, id: Date.now().toString() }];
        }
        saveToLocal(undefined, newDividendsList);
    } else {
        if (!user || !db) return;
        const path = getCollectionPath('dividends');
        if(!path) return;
        if(editingDividend) { 
            await updateDoc(doc(db, path, editingDividend.id), payloadBase); 
        } else { 
            await addDoc(collection(db, path), payloadBase); 
        }
    }

    if(!addNext) {
        setShowDividendModal(false);
    }
  };

  const handleUpdatePrices = async (newPriceMap: Record<string, number>) => {
    if (useLocalStorage) {
        const newAssetsList = assets.map(a => newPriceMap[a.id] ? { ...a, currentPrice: newPriceMap[a.id] } : a);
        saveToLocal(newAssetsList);
    } else {
        if (!user || !db) return;
        const path = getCollectionPath('assets');
        if(!path) return;
        for (const [id, price] of Object.entries(newPriceMap)) {
          try { await updateDoc(doc(db, path, id), { currentPrice: price }); } catch (e) { console.error(e); }
        }
    }
  };

  const promptDelete = (type: DeleteConfirmInfo['type'], id: string, title: string, assetId?: string) => {
    setDeleteConfirm({ type, id, title, assetId });
  };

  // --- Modal Open Handlers ---
  const openAddAsset = () => { setEditingAsset(null); setEditingTx(null); setAddingTxToAsset(null); setShowAssetModal(true); };
  const openEditAsset = (asset: Asset) => { setEditingAsset(asset); setEditingTx(null); setAddingTxToAsset(null); setShowAssetModal(true); };
  const openAddTx = (asset: Asset) => { setAddingTxToAsset(asset); setEditingAsset(null); setEditingTx(null); setShowAssetModal(true); };
  const openEditTx = (asset: Asset, tx: Transaction) => { setEditingTx({ asset, tx }); setAddingTxToAsset(null); setEditingAsset(null); setShowAssetModal(true); };

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen flex flex-col font-sans text-slate-900 pb-24 relative">
      <div className="bg-slate-900 px-4 pt-4 pb-2 text-white">
         <div className="flex justify-between items-center mb-3">
            <h1 className="font-bold text-lg flex items-center gap-2"><Wallet size={20}/> 投資管家</h1>
            <div className="flex bg-slate-800 rounded-lg p-1">
               <button onClick={() => setIsPublicMode(false)} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all ${!isPublicMode ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Lock size={12}/> 個人</button>
               <button onClick={() => setIsPublicMode(true)} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold transition-all ${isPublicMode ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}><Users size={12}/> 共享</button>
            </div>
         </div>
         <div className="flex items-center gap-2 text-xs text-slate-400">
             <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-yellow-400 animate-pulse' : useLocalStorage ? 'bg-orange-400' : 'bg-green-400'}`}></div>
             <span>
                 {isSyncing ? '同步中...' : 
                  useLocalStorage ? '本機儲存模式 (離線)' :
                  isPublicMode ? '已連線至共享空間' : '已連線至個人空間'}
             </span>
         </div>
      </div>

      <div className="bg-white px-4 py-2 border-b border-slate-100 flex justify-between items-center sticky top-0 z-20 shadow-sm">
         <div className="flex items-center gap-2" onClick={() => setShowUserModal(true)}><div className={`p-1.5 rounded-full ${currentUser ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}><UserIcon size={16}/></div><div className="text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer">{currentUser ? currentUser.name : '所有人'} <ChevronDown size={12}/></div></div>
         <div className="flex bg-slate-50 p-1 rounded-lg"><button onClick={() => setCurrentUser(null)} className={`px-3 py-1 rounded text-[10px] font-bold ${!currentUser ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>總覽</button>{users.map(u => (<button key={u.id} onClick={() => setCurrentUser(u)} className={`px-3 py-1 rounded text-[10px] font-bold ${currentUser?.id === u.id ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>{u.name}</button>))}</div>
      </div>

      {useLocalStorage && (
        <div className="bg-orange-50 border-b border-orange-100 text-orange-700 px-4 py-2 text-xs flex items-center gap-2">
            <HardDrive size={12}/> 
            <span>目前使用本機儲存，資料僅保留於此瀏覽器。</span>
        </div>
      )}

      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'assets' && (
          <div className="space-y-4">
            <StatsGrid items={[
              { 
                label: '總投入金額 (USD)', 
                value: `$${assetStats.totalInvested.toLocaleString()}`, 
                valueColor: 'text-white',
                subValue: `≈ NT$ ${(assetStats.totalInvested * usdToTwd).toLocaleString(undefined, {maximumFractionDigits:0})}`
              }, 
              { 
                label: '現值總額 (USD)', 
                value: `$${assetStats.currentMarketValue.toLocaleString()}`, 
                valueColor: 'text-blue-300',
                subValue: `≈ NT$ ${(assetStats.currentMarketValue * usdToTwd).toLocaleString(undefined, {maximumFractionDigits:0})} @ ${usdToTwd.toFixed(2)}`
              }, 
              { 
                label: '現值投報率', 
                value: `${assetStats.roiCurrent.toFixed(2)}%`, 
                valueColor: assetStats.roiCurrent >= 0 ? 'text-red-400' : 'text-green-400' 
              }, 
              { 
                label: '含息總投報率', 
                value: `${assetStats.roiTotal.toFixed(2)}%`, 
                valueColor: assetStats.roiTotal >= 0 ? 'text-red-400' : 'text-green-400', 
                subValue: `(含息 $${assetStats.valuePlusDivs.toLocaleString()})` 
              }
            ]} />
            <div className="flex justify-between items-center mb-2">
               <div className="flex items-center gap-2"><h2 className="font-bold text-lg text-slate-800">持倉明細</h2><button onClick={() => setShowPriceModal(true)} className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors"><RefreshCw size={12} /> 更新市價</button></div>
               <button onClick={openAddAsset} className="bg-blue-600 text-white p-2 rounded-full shadow-lg"><Plus size={20}/></button>
            </div>
            {displayedAssets.length === 0 ? <div className="text-center text-slate-400 py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">{useLocalStorage ? "本機無資料，請新增" : "雲端無資料，請新增"}</div> : displayedAssets.map(asset => (
                <AssetRow 
                  key={asset.id} 
                  asset={asset} 
                  onSell={() => { setSelectedAssetForSell(asset); setShowSellModal(true); }} 
                  onDelete={(id) => promptDelete('asset', id, asset.ticker)} 
                  onEdit={openEditAsset}
                  onAddTx={openAddTx}
                  onEditTx={openEditTx}
                  onDeleteTx={(a, txId) => promptDelete('transaction', txId, '此筆購入紀錄', a.id)}
                />
              ))
            }
          </div>
        )}

        {activeTab === 'dividends' && (
           <div className="space-y-4">
             <StatsGrid colorClass="from-blue-600 to-blue-800" items={[{ label: '已配息金額', value: `$${dividendStats.totalReceived.toLocaleString()}`, subValue: `≈ NT$ ${dividendStats.totalReceivedTWD.toLocaleString()}` }, { label: '預估月配', value: `$${dividendStats.estMonthly.toFixed(0)}` }, { label: '配息投報率', value: `${dividendStats.yieldRate.toFixed(2)}%` }, { label: '筆數', value: `${displayedDividends.length}` }]} />
             <div className="flex justify-between items-center mb-2"><h2 className="font-bold text-lg text-slate-800">配息明細</h2><button onClick={() => { setEditingDividend(null); setShowDividendModal(true); }} className="bg-blue-600 text-white p-2 rounded-full shadow-lg"><Plus size={20}/></button></div>
             {Object.keys(groupedDividends).length === 0 ? <div className="text-center text-slate-400 py-10">尚無配息</div> : Object.entries(groupedDividends).map(([ticker, divs]) => (
                 <DividendGroup key={ticker} ticker={ticker} dividends={divs} onDelete={(id) => promptDelete('dividend', id, '此筆配息')} onEdit={(div) => { setEditingDividend(div); setShowDividendModal(true); }}/>
               ))
             }
           </div>
        )}
        {activeTab === 'history' && (
           <div className="space-y-4">
              <div className="bg-gradient-to-br from-gray-700 to-gray-900 text-white rounded-2xl p-4 shadow-lg mb-4"><div className="flex justify-between items-center"><div><p className="text-slate-300 text-xs mb-1">已實現總損益</p><h2 className={`text-3xl font-bold ${historyStats.totalPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>{historyStats.totalPnL >= 0 ? '+' : ''}{historyStats.totalPnL.toFixed(2)}</h2></div><div className="text-right"><p className="text-slate-300 text-xs mb-1">總報酬率</p><p className={`text-xl font-bold ${historyStats.totalRoi >= 0 ? 'text-red-400' : 'text-green-400'}`}>{historyStats.totalRoi >= 0 ? '+' : ''}{historyStats.totalRoi.toFixed(2)}%</p></div></div></div>
              <h2 className="font-bold text-lg text-slate-800 mb-2">交易紀錄</h2>
              {displayedHistory.length === 0 ? <div className="text-center text-slate-400 py-10">尚無紀錄</div> : displayedHistory.map(item => (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm mb-2">
                    <div><div className="flex items-center gap-2"><h4 className="font-bold text-slate-700">{item.ticker}</h4><span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-slate-500">{item.sellDate}</span></div><p className="text-xs text-slate-400 mt-1">成本 {Number(item.avgBuyPrice).toFixed(2)} → 賣出 {item.sellPrice} × {item.shares}</p></div>
                    <div className="text-right">
                      <p className={`font-bold ${item.pnl >= 0 ? 'text-red-500' : 'text-green-600'}`}>{item.pnl >= 0 ? '+' : ''}{item.pnl.toFixed(2)}</p>
                      <div className="flex items-center justify-end gap-2 mt-1"><span className={`text-xs ${item.pnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>{item.pnlPercent.toFixed(2)}%</span><button onClick={() => promptDelete('history', item.id, item.ticker + ' 交易紀錄')} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14}/></button></div>
                    </div>
                  </div>
                ))
              }
           </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex justify-around items-center z-20 max-w-md mx-auto">
        <button onClick={() => setActiveTab('assets')} className={`flex flex-col items-center p-2 rounded-lg w-16 transition-colors ${activeTab === 'assets' ? 'text-blue-600' : 'text-slate-400'}`}><Wallet size={24} /><span className="text-[10px] font-bold mt-1">資產庫</span></button>
        <button onClick={() => setActiveTab('dividends')} className={`flex flex-col items-center p-2 rounded-lg w-16 transition-colors ${activeTab === 'dividends' ? 'text-blue-600' : 'text-slate-400'}`}><DollarSign size={24} /><span className="text-[10px] font-bold mt-1">配息</span></button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center p-2 rounded-lg w-16 transition-colors ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-400'}`}><History size={24} /><span className="text-[10px] font-bold mt-1">已實現</span></button>
      </div>

      <UserManageModal isOpen={showUserModal} onClose={() => setShowUserModal(false)} users={users} setUsers={setUsers} currentUserId={currentUser?.id} />
      <UpdatePriceModal isOpen={showPriceModal} onClose={() => setShowPriceModal(false)} assets={assets} onUpdatePrices={handleUpdatePrices} />
      {/* Integrated AddAssetModal: Handles both Asset and Transaction Create/Update */}
      <AddAssetModal isOpen={showAssetModal} onClose={() => setShowAssetModal(false)} onSave={handleSaveAsset} editingAsset={editingAsset} editingTx={editingTx} addingTxToAsset={addingTxToAsset}/>
      <AddDividendModal isOpen={showDividendModal} onClose={() => setShowDividendModal(false)} onSave={handleSaveDividend} assets={assets} editingDividend={editingDividend}/>
      <SellModal isOpen={showSellModal} onClose={() => setShowSellModal(false)} asset={selectedAssetForSell} onConfirm={handleSellAsset}/>
      <DeleteConfirmModal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={executeDelete} info={deleteConfirm} />
    </div>
  );
}
