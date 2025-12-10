import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, X, RefreshCw, AlertCircle } from 'lucide-react';
import { Asset, Transaction } from '../../types';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any, addNext: boolean) => void;
  editingAsset: Asset | null;
  editingTx: { asset: Asset; tx: Transaction } | null;
  addingTxToAsset: Asset | null;
}

const fetchStockPrice = async (ticker: string, dateStr?: string) => {
  try {
    const proxyUrl = `https://corsproxy.io/?`; 
    let targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;

    if (dateStr) {
        // Handle Historical Date
        // Create date object from YYYY-MM-DD (Treated as UTC start of day by Date.parse usually, 
        // but let's be safe and construct timestamp)
        const date = new Date(dateStr);
        const startTs = Math.floor(date.getTime() / 1000);
        // Add 24h to cover the full trading day globally (UTC 00:00 to UTC 24:00 covers US/Asia sessions)
        const endTs = startTs + 86400; 
        
        targetUrl += `?period1=${startTs}&period2=${endTs}&interval=1d`;
    }

    const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (result) {
        // Historical
        if (dateStr) {
             const quote = result.indicators?.quote?.[0];
             // If we have close prices, take the first one (should be only one for 1d interval)
             if (quote?.close && quote.close.length > 0 && quote.close[0] != null) {
                 return { price: quote.close[0], isHistorical: true };
             }
             // If requested date has no data (e.g. Weekend), return null or fallback?
             // Let's return null to indicate "No data for this date"
             return null;
        } 
        // Latest / Real-time
        else {
            return { price: result.meta?.regularMarketPrice, isHistorical: false };
        }
    }
    return null;
  } catch (e) { 
    console.error(`Failed to fetch ${ticker}`, e); 
    return null; 
  }
};

const fetchFundData = async (url: string, dateStr?: string) => {
  try {
    if (!url.includes('http')) return null;

    // Extract URL if user pasted a formula like =IMPORTHTML("...")
    let cleanUrl = url;
    if (url.includes('http') && (url.includes('"') || url.includes("'"))) {
       const match = url.match(/https?:\/\/[^"']+/);
       if (match) cleanUrl = match[0];
    }

    const timestamp = new Date().getTime();
    const targetUrl = cleanUrl.includes('?') ? `${cleanUrl}&t=${timestamp}` : `${cleanUrl}?t=${timestamp}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    const html = await response.text();
    
    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // --- Historical Attempt (Best Effort) ---
      if (dateStr) {
          // Try to find the date string in the document (e.g., 2023/10/05, 10/05)
          // Format dateStr (YYYY-MM-DD) to YYYY/MM/DD which is common in Taiwan tables
          const targetDateSlash = dateStr.replace(/-/g, '/'); // 2023/10/05
          
          // Strategy: Find a cell with the date, then look for the price in the next cell
          // Or find text containing the date
          const allCells = doc.querySelectorAll('td, th, span, div');
          for (let i = 0; i < allCells.length; i++) {
              const text = allCells[i].textContent?.trim() || '';
              if (text.includes(targetDateSlash)) {
                  // Found the date! Check neighbors or same cell
                  
                  // Case 1: Same cell "2023/10/05: 10.5"
                  const selfMatch = text.match(/[\d,]+\.\d+/);
                  if (selfMatch) {
                      const val = parseFloat(selfMatch[0].replace(/,/g, ''));
                      // Simple check to ensure it's not the year 2023
                      if (!isNaN(val) && val < 2000 && val !== parseFloat(dateStr.split('-')[0])) {
                          return { price: val, isHistorical: true };
                      }
                  }

                  // Case 2: Next Sibling (Table structure)
                  let nextEl = allCells[i].nextElementSibling;
                  // Skip empty siblings
                  while (nextEl && !nextEl.textContent?.trim()) {
                      nextEl = nextEl.nextElementSibling;
                  }

                  if (nextEl && nextEl.textContent) {
                      const nextText = nextEl.textContent.trim();
                      const nextMatch = nextText.match(/[\d,]+\.\d+/);
                      if (nextMatch) {
                          const val = parseFloat(nextMatch[0].replace(/,/g, ''));
                          if (!isNaN(val)) return { price: val, isHistorical: true };
                      }
                  }
              }
          }
      }

      // --- Latest Value Strategy (Fallback) ---
      
      // Priority 1: MoneyDJ Specific IDs
      const commonIds = ['Ctl00_ContentPlaceHolder1_lblNav', 'Ctl00_ContentPlaceHolder1_lblNet', 'oMain_lblNav'];
      for (const id of commonIds) {
          const el = doc.getElementById(id);
          if (el && el.innerText) {
              const val = parseFloat(el.innerText.replace(/,/g, '').trim());
              if (!isNaN(val)) return { price: val, isHistorical: false };
          }
      }

      // Priority 2: "Latest Net Value" Keywords
      const elements = doc.querySelectorAll('td, th, span, div, p');
      for (let i = 0; i < elements.length; i++) {
          const text = elements[i].textContent?.trim() || '';
          
          // Look for "Latest Net Value" or just "Net Value"
          if (text.includes('最新淨值') || text.includes('淨值')) {
              // Check self
              const selfMatch = text.match(/[\d,]+\.\d+/);
              if (selfMatch) {
                   const val = parseFloat(selfMatch[0].replace(/,/g, ''));
                   if (!isNaN(val) && val < 2000) return { price: val, isHistorical: false };
              }
              
              // Check Next Sibling
              const nextEl = elements[i].nextElementSibling;
              if (nextEl && nextEl.textContent) {
                  const nextText = nextEl.textContent.trim();
                  const nextMatch = nextText.match(/[\d,]+\.\d+/);
                  if (nextMatch) {
                      const val = parseFloat(nextMatch[0].replace(/,/g, ''));
                      if (!isNaN(val)) return { price: val, isHistorical: false };
                  }
              }
          }
      }
    }
    return null;
  } catch (e) { 
    console.error("Failed to scrape Fund Data", e); 
    return null; 
  }
};

const AddAssetModal: React.FC<AddAssetModalProps> = ({ isOpen, onClose, onSave, editingAsset, editingTx, addingTxToAsset }) => {
  const isTransactionMode = !!editingTx || !!addingTxToAsset;
  const [formData, setFormData] = useState({ 
    ticker: '', 
    type: 'Stock', 
    frequency: 'Individual', 
    buyDate: new Date().toISOString().split('T')[0], 
    units: '', 
    unitPrice: '', 
    exchangeRate: '32.5', 
    dataUrl: '' 
  });
  const [isFetching, setIsFetching] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (editingTx) {
        setFormData({ ticker: editingTx.asset?.ticker || '', type: 'Stock', frequency: 'Individual', buyDate: editingTx.tx.date, units: editingTx.tx.units.toString(), unitPrice: editingTx.tx.price.toString(), exchangeRate: editingTx.tx.rate || '32.5', dataUrl: '' });
      } else if (addingTxToAsset) {
        setFormData({ ticker: addingTxToAsset.ticker, type: 'Stock', frequency: 'Individual', buyDate: new Date().toISOString().split('T')[0], units: '', unitPrice: '', exchangeRate: '32.5', dataUrl: '' });
      } else if (editingAsset) {
        setFormData({ ticker: editingAsset.ticker, type: editingAsset.type, frequency: editingAsset.frequency || 'Individual', buyDate: new Date().toISOString().split('T')[0], units: editingAsset.shares.toString(), unitPrice: editingAsset.avgCost.toString(), exchangeRate: '32.5', dataUrl: editingAsset.dataUrl || '' });
      } else {
        setFormData({ ticker: '', type: 'Stock', frequency: 'Individual', buyDate: new Date().toISOString().split('T')[0], units: '', unitPrice: '', exchangeRate: '32.5', dataUrl: '' });
      }
      setIsFetching(false);
      setFetchStatus('');
    }
  }, [isOpen, editingAsset, editingTx, addingTxToAsset]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setFormData({...formData, [e.target.name]: e.target.value});
  
  const handleFetchPrice = async () => {
      if (!formData.dataUrl && !formData.ticker) return alert("請輸入代碼或網址");
      setIsFetching(true);
      setFetchStatus('搜尋中...');
      
      const isHistoricalRequest = formData.buyDate !== new Date().toISOString().split('T')[0];
      let result = null;
      
      // 1. Try URL Scraping (Funds)
      if (formData.dataUrl) {
          const urls = formData.dataUrl.split('\n').map(u => u.trim()).filter(u => u);
          for (const url of urls) {
              setFetchStatus(`嘗試來源: ...${url.slice(-15)}`);
              // Try to fetch with date first
              result = await fetchFundData(url, isHistoricalRequest ? formData.buyDate : undefined);
              if (result) break; 
          }
      } 
      // 2. Try Stock Ticker (Yahoo)
      else if (formData.ticker && (formData.type === 'Stock' || formData.type === 'ETF')) {
          result = await fetchStockPrice(formData.ticker, isHistoricalRequest ? formData.buyDate : undefined);
      }

      if (result) {
          setFormData(prev => ({ ...prev, unitPrice: result.price.toString() }));
          
          if (isHistoricalRequest) {
              if (result.isHistorical) {
                  setFetchStatus(`✅ 成功抓取 ${formData.buyDate} 價格`);
              } else {
                  setFetchStatus(`⚠️ 僅抓到最新價格 (無 ${formData.buyDate} 資料)`);
              }
          } else {
              setFetchStatus('✅ 抓取最新價格成功');
          }
      } else {
          setFetchStatus('❌ 抓取失敗 (請檢查日期或來源)');
      }
      setIsFetching(false);
  };

  const handleSave = (addNext: boolean) => { 
    if(!formData.units || !formData.unitPrice) return alert("請填寫數量與價格");
    if(!isTransactionMode && !formData.ticker) return alert("請填寫代碼");
    onSave(formData, addNext);
    
    if(addNext && !isTransactionMode) { 
      setFormData(prev => ({ ...prev, units: '', unitPrice: '', buyDate: new Date().toISOString().split('T')[0] })); 
      setFetchStatus('');
    } else { 
      onClose(); 
    } 
  };

  if(!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <h3 className="font-bold">{editingTx ? '修改購入紀錄' : addingTxToAsset ? '新增購入紀錄' : editingAsset ? '修改資產資訊' : '新增資產'}</h3>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
           <div className="grid grid-cols-2 gap-3">
             <div className="col-span-2">
               <label className="text-xs text-slate-500 mb-1 block">代碼 (Ticker)</label>
               <input name="ticker" value={formData.ticker} onChange={(e) => setFormData({...formData, ticker: e.target.value.toUpperCase()})} className="w-full border p-2 rounded uppercase font-bold disabled:bg-slate-100 disabled:text-slate-500" disabled={isTransactionMode || !!editingAsset} placeholder="ex: AAPL"/>
             </div>
             {!isTransactionMode && (
               <>
                 <div><label className="text-xs text-slate-500 mb-1 block">類別</label><select name="type" value={formData.type} onChange={handleChange} className="w-full border p-2 rounded"><option value="Stock">個股</option><option value="ETF">ETF</option><option value="Fund">基金</option></select></div>
                 <div><label className="text-xs text-slate-500 mb-1 block">頻率</label><select name="frequency" value={formData.frequency} onChange={handleChange} className="w-full border p-2 rounded"><option value="Individual">不固定</option><option value="Weekly">週配</option><option value="Monthly">月配</option><option value="Quarterly">季配</option></select></div>
               </>
             )}
             
             <div className="col-span-2"><label className="text-xs text-slate-500 mb-1 block">交易日期 (將連動價格抓取)</label><input type="date" name="buyDate" value={formData.buyDate} onChange={handleChange} className="w-full border p-2 rounded" /></div>

             {/* Price Input Row with Fetch Button */}
             <div className="col-span-2">
                 <label className="text-xs text-slate-500 mb-1 block">購入單價 (成本)</label>
                 <div className="flex gap-2 relative">
                    <input type="number" name="unitPrice" value={formData.unitPrice} onChange={handleChange} className="flex-1 border p-2 rounded font-mono font-bold" placeholder="0.00"/>
                    <button 
                        onClick={handleFetchPrice}
                        disabled={isFetching || (!formData.ticker && !formData.dataUrl)}
                        className={`border border-slate-200 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50 ${isFetching ? 'bg-slate-100' : 'bg-slate-50 hover:bg-slate-100 text-blue-600'}`}
                    >
                        <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
                        抓取價格
                    </button>
                 </div>
                 {fetchStatus && <p className={`text-[10px] text-right mt-1 font-bold ${fetchStatus.includes('⚠️') ? 'text-yellow-600' : fetchStatus.includes('❌') ? 'text-red-500' : 'text-green-600'}`}>{fetchStatus}</p>}
             </div>

             <div><label className="text-xs text-slate-500 mb-1 block">購入單位 (股數)</label><input type="number" name="units" value={formData.units} onChange={handleChange} className="w-full border p-2 rounded" /></div>
             <div><label className="text-xs text-slate-500 mb-1 block">匯率</label><input type="number" name="exchangeRate" value={formData.exchangeRate} onChange={handleChange} className="w-full border p-2 rounded" /></div>
             
             {!isTransactionMode && (
               <div className="col-span-2">
                   <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><LinkIcon size={10}/> 基金網址 (支援 MoneyDJ, StockQ, 鉅亨網)</label>
                   <textarea 
                       name="dataUrl" 
                       value={formData.dataUrl} 
                       onChange={handleChange} 
                       className="w-full border p-2 rounded text-xs text-blue-600 h-16" 
                       placeholder="https://..." 
                   />
                   <p className="text-[10px] text-slate-400 mt-1">
                      * 支援多行網址，系統將依序嘗試。<br/>
                      * 基金歷史淨值抓取困難，若找不到指定日期將自動抓取最新淨值。
                   </p>
               </div>
             )}
           </div>
        </div>
        <div className="p-4 border-t flex gap-2">
          {!isTransactionMode && !editingAsset && <button onClick={() => handleSave(true)} className="flex-1 border border-blue-600 text-blue-600 py-2 rounded-lg text-sm font-bold">同標的新增</button>}
          <button onClick={() => handleSave(false)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold">儲存</button>
        </div>
      </div>
    </div>
  );
};

export default AddAssetModal;
