import React, { useState } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import FrequencyBadge from './ui/FrequencyBadge';
import { Dividend } from '../types';

interface DividendGroupProps {
  ticker: string;
  dividends: Dividend[];
  onDelete: (id: string) => void;
  onEdit: (dividend: Dividend) => void;
}

const DividendGroup: React.FC<DividendGroupProps> = ({ ticker, dividends, onDelete, onEdit }) => {
  const [isOpen, setIsOpen] = useState(false);
  const totalNet = dividends.reduce((acc, curr) => acc + (Number(curr.netAmount) || 0), 0);
  const totalNetTWD = dividends.reduce((acc, curr) => acc + (Number(curr.netAmountTWD) || 0), 0);
  const freq = dividends[0]?.frequency || 'Individual';
  const lastDate = dividends.length > 0 ? dividends[0].payDate : '';

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-3 bg-white flex items-center justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-3">
           <FrequencyBadge freq={freq} />
           <div>
             <div className="flex items-center gap-2">
               <span className="font-bold text-slate-800">{ticker}</span>
               <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">{dividends.length} 筆</span>
             </div>
             <p className="text-xs text-slate-400 mt-0.5">最近: {lastDate}</p>
           </div>
        </div>
        <div className="text-right">
           <p className="font-bold text-blue-600">${totalNet.toFixed(2)}</p>
           {totalNetTWD > 0 && <p className="text-xs text-slate-400">NT$ {totalNetTWD.toLocaleString()}</p>}
        </div>
      </div>
      {isOpen && (
        <div className="bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-1">
          {dividends.map(div => (
            <div key={div.id} className="p-3 border-b border-slate-100 last:border-0 flex justify-between items-center group hover:bg-slate-100 transition-colors">
               <div>
                  <p className="text-xs font-bold text-slate-600">{div.exDate} (除息)</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {Number(div.shares).toLocaleString()} × ${Number(div.amountPerShare).toFixed(2)} 
                    {div.tax > 0 && <span className="text-red-400 ml-1"> (稅 ${Number(div.tax).toFixed(2)})</span>}
                  </p>
               </div>
               <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-slate-700 font-medium">${Number(div.netAmount).toFixed(2)}</span>
                  <div className="flex gap-1"> 
                    <button onClick={() => onEdit(div)} className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 shadow-sm"><Edit size={12}/></button>
                    <button onClick={() => onDelete(div.id)} className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-red-600 shadow-sm"><Trash2 size={12}/></button>
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DividendGroup;