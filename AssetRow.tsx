import React, { useState } from 'react';
import { 
  ChevronDown, ChevronUp, LogOut, Edit, Trash2, Link as LinkIcon, Plus, Calendar
} from 'lucide-react';
import FrequencyBadge from './ui/FrequencyBadge';
import { Asset, Transaction } from '../types';

interface AssetRowProps {
  asset: Asset;
  onSell: (asset: Asset) => void;
  onDelete: (id: string) => void;
  onEdit: (asset: Asset) => void;
  onAddTx: (asset: Asset) => void;
  onEditTx: (asset: Asset, tx: Transaction) => void;
  onDeleteTx: (asset: Asset, txId: string) => void;
}

const AssetRow: React.FC<AssetRowProps> = ({ asset, onSell, onDelete, onEdit, onAddTx, onEditTx, onDeleteTx }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const currentPrice = Number(asset.currentPrice) || 0;
  const shares = Number(asset.shares) || 0;
  const totalCost = Number(asset.totalCost) || 0;
  const avgCost = Number(asset.avgCost) || 0;
  
  const marketValue = currentPrice * shares;
  const unrealizedPL = marketValue - totalCost;
  const plPercent = totalCost > 0 ? (unrealizedPL / totalCost) * 100 : 0;
  const isProfit = unrealizedPL >= 0;
  const freq = asset.frequency || 'Individual';

  // Handle multiple URLs (take the first one)
  const mainUrl = asset.dataUrl ? asset.dataUrl.split('\n')[0] : '';
  const isMultiUrl = asset.dataUrl && asset.dataUrl.includes('\n');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3 overflow-hidden transition-all hover:shadow-md">
      {/* Main Card Area */}
      <div className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
               <FrequencyBadge freq={freq} />
               {freq === 'Individual' && <FrequencyBadge type={asset.type} />}
            </div>
            <div className="overflow-hidden">
               <h3 className="font-bold text-lg text-slate-800 leading-tight truncate w-32 sm:w-auto">{asset.ticker}</h3>
               {asset.name && <p className="text-xs text-slate-400 truncate w-40">{asset.name}</p>}
            </div>
          </div>
          <div className="text-right">
             <p className="font-mono font-bold text-slate-800">${currentPrice.toFixed(2)}</p>
             <div className={`text-xs font-bold flex items-center justify-end gap-1 ${isProfit ? 'text-red-500' : 'text-green-600'}`}>
                {isProfit ? '+' : ''}{unrealizedPL.toFixed(1)} ({plPercent.toFixed(1)}%)
             </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center text-sm mt-3 text-slate-600 border-t border-slate-50 pt-2">
           <div>
             <span className="text-xs text-slate-400 block">持有</span>
             <span className="font-medium">{shares.toLocaleString()}</span>
           </div>
           <div>
             <span className="text-xs text-slate-400 block">均價</span>
             <span className="font-medium">${avgCost.toFixed(2)}</span>
           </div>
           <div className="text-right">
             <span className="text-xs text-slate-400 block">總值 (USD)</span>
             <span className="font-bold">${marketValue.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
           </div>
           <div className="text-slate-400">
             {isExpanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
           </div>
        </div>
      </div>

      {/* Expanded Details Area */}
      {isExpanded && (
        <div className="bg-slate-50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex gap-2 mb-4">
             <button onClick={(e) => { e.stopPropagation(); onSell(asset); }} className="flex-1 bg-white text-red-600 border border-red-200 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 hover:bg-red-50 shadow-sm"><LogOut size={16}/> 賣出(FIFO)</button>
             <button onClick={(e) => { e.stopPropagation(); onEdit(asset); }} className="flex-1 bg-white text-slate-600 border border-slate-200 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 hover:bg-white shadow-sm"><Edit size={16}/> 修改資訊</button>
             <button onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }} className="w-10 bg-white text-slate-400 border border-slate-200 rounded-lg flex items-center justify-center hover:text-red-500 hover:border-red-200 shadow-sm"><Trash2 size={16}/></button>
          </div>
          
          {mainUrl && (
             <a href={mainUrl} target="_blank" rel="noopener noreferrer" className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700 flex items-center gap-2 truncate hover:bg-blue-100 transition-colors block">
                <LinkIcon size={12}/> 資料來源: {mainUrl} {isMultiUrl ? '(多來源)' : ''}
             </a>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">購入紀錄明細 (FIFO順序)</p>
               <button 
                 onClick={(e) => { e.stopPropagation(); onAddTx(asset); }}
                 className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-200"
               >
                 <Plus size={12}/> 新增一筆
               </button>
            </div>
            
            {asset.transactions && asset.transactions.length > 0 ? (
              <div className="space-y-2">
                {[...asset.transactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((tx, idx) => (
                  <div key={tx.id || idx} className="flex justify-between items-center text-sm bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm group">
                    <div className="flex flex-col">
                       <span className="text-slate-500 text-[10px] font-medium flex items-center gap-1"><Calendar size={10}/> {tx.date}</span>
                       <span className="font-mono text-slate-700 font-bold">{Number(tx.units).toLocaleString()} 單位 @ ${Number(tx.price).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-slate-400 text-xs bg-slate-100 px-1.5 py-0.5 rounded">匯 {tx.rate}</span>
                       <div className="flex gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onEditTx(asset, tx); }}
                            className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit size={14}/>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteTx(asset, tx.id); }}
                            className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14}/>
                          </button>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-xs text-slate-400 py-2 italic">無詳細紀錄</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetRow;