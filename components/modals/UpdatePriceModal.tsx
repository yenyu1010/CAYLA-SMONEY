import React, { useState, useEffect } from 'react';
import { Globe, X, RefreshCw } from 'lucide-react';
import { Asset } from '../../types';

interface UpdatePriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  onUpdatePrices: (priceMap: Record<string, number>) => void;
}

const fetchStockPrice = async (ticker: string) => {
  try {
    const proxyUrl = `https://corsproxy.io/?`; 
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
    const data = await response.json();
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price || null;
  } catch (e) { 
    console.error(`Failed to fetch ${ticker}`, e); 
    return null; 
  }
};

const fetchMoneyDJFund = async (url: string) => {
  try {
    if (!url.includes('http')) return null;

    // Cache busting
    const timestamp = new Date().getTime();
    const targetUrl = url.includes('?') ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    const html = await response.text();
    
    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Strategy 1: IDs
      const commonIds = ['Ctl00_ContentPlaceHolder1_lblNav', 'Ctl00_ContentPlaceHolder1_lblNet', 'oMain_lblNav'];
      for (const id of commonIds) {
          const el = doc.getElementById(id);
          if (el && el.innerText) {
              const val = parseFloat(el.innerText.replace(/,/g, '').trim());
              if (!isNaN(val)) return val;
          }
      }

      // Strategy 2: Keywords
      const elements = doc.querySelectorAll('td, th, span, div, p');
      for (let i = 0; i < elements.length; i++) {
          const text = elements[i].textContent?.trim() || '';
          if (text.includes('淨值')) {
              const selfMatch = text.match(/[\d,]+\.\d+/);
              if (selfMatch) {
                   const val = parseFloat(selfMatch[0].replace(/,/g, ''));
                   if (!isNaN(val) && val < 2000) return val;
              }
              const nextEl = elements[i].nextElementSibling;
              if (nextEl && nextEl.textContent) {
                  const nextText = nextEl.textContent.trim();
                  const nextMatch = nextText.match(/[\d,]+\.\d+/);
                  if (nextMatch) {
                      const val = parseFloat(nextMatch[0].replace(/,/g, ''));
                      if (!isNaN(val)) return val;
                  }
              }
          }
      }
    }
    return null;
  } catch (e) { 
    console.error("Failed to scrape MoneyDJ", e); 
    return null; 
  }
};

const UpdatePriceModal: React.FC<UpdatePriceModalProps> = ({ isOpen, onClose, assets, onUpdatePrices }) => {
  const [localPrices, setLocalPrices] = useState<Record<string, number>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if(isOpen && assets) {
      const initial: Record<string, number> = {};
      assets.forEach(a => initial[a.id] = a.currentPrice);
      setLocalPrices(initial);
      setLogs([]);
    }
  }, [isOpen, assets]);

  const handleInputChange = (id: string, val: string) => {
    setLocalPrices(prev => ({...prev, [id]: parseFloat(val) || 0}));
  };

  const saveChanges = () => { onUpdatePrices(localPrices); onClose(); };

  const startRealFetch = async () => {
    setIsUpdating(true);
    setLogs(prev => [...prev, "開始連線更新..."]);
    const newPrices = { ...localPrices };
    
    for (const asset of assets) {
      setLogs(prev => [...prev, `正在更新: ${asset.ticker}...`]);
      let price = null;
      
      // Check for MoneyDJ URLs (Multi-line support)
      if (asset.dataUrl && asset.dataUrl.includes('moneydj')) {
         const urls = asset.dataUrl.split('\n').map(u => u.trim()).filter(u => u);
         for (const url of urls) {
             // Try fetching each URL until one works
             price = await fetchMoneyDJFund(url);
             if (price) {
                 setLogs(prev => [...prev, `   ↳ 來源成功: ...${url.slice(-10)}`]);
                 break;
             }
         }
      } else if (asset.type === 'Stock' || asset.type === 'ETF') {
         price = await fetchStockPrice(asset.ticker);
      }
      
      if (price) {
        newPrices[asset.id] = price;
        setLogs(prev => [...prev, `✅ ${asset.ticker} 更新成功: ${price}`]);
      } else {
        setLogs(prev => [...prev, `❌ ${asset.ticker} 更新失敗 (請手動輸入)`]);
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
    }
    
    setLocalPrices(newPrices);
    setIsUpdating(false);
    setLogs(prev => [...prev, "更新完成！"]);
  };

  if(!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
           <h3 className="font-bold flex items-center gap-2"><Globe size={18}/> 更新現有市價</h3>
           <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
           <p className="text-xs text-slate-500">
             支援 Yahoo Finance (美股) <br/> 及 MoneyDJ (基金，多來源)
           </p>
           <button onClick={startRealFetch} disabled={isUpdating} className={`text-xs border px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-all ${isUpdating ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'}`}>
             <RefreshCw size={12} className={isUpdating ? "animate-spin" : ""} />
             {isUpdating ? "抓取中..." : "一鍵更新 (真實)"}
           </button>
        </div>
        {logs.length > 0 && <div className="bg-gray-900 text-green-400 text-[10px] p-2 max-h-20 overflow-y-auto font-mono">{logs.map((log, i) => <div key={i}>{log}</div>)}</div>}
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
           {assets.map(asset => (
             <div key={asset.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                <div>
                    <p className="font-bold text-slate-700">{asset.ticker}</p>
                    <p className="text-xs text-slate-400 truncate w-24">{asset.name}</p>
                    {asset.dataUrl && asset.dataUrl.includes('moneydj') && (
                        <span className="text-[10px] text-blue-500 block">來源: MoneyDJ</span>
                    )}
                </div>
                <div className="flex items-center gap-2"><span className="text-xs text-slate-400">現價 $</span>
                <input 
                    type="number" 
                    className="w-24 border border-slate-200 rounded p-1 text-right font-mono font-bold text-slate-800 focus:border-blue-500 outline-none" 
                    value={localPrices[asset.id] ?? ''} 
                    onChange={(e) => handleInputChange(asset.id, e.target.value)}
                />
                </div>
             </div>
           ))}
        </div>
        <div className="p-4 border-t border-slate-100"><button onClick={saveChanges} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-transform">確認儲存</button></div>
      </div>
    </div>
  );
};

export default UpdatePriceModal;
