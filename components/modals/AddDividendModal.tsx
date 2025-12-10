import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Asset, Dividend } from '../../types';

interface AddDividendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any, addNext: boolean) => void;
  assets: Asset[];
  editingDividend: Dividend | null;
}

const AddDividendModal: React.FC<AddDividendModalProps> = ({ isOpen, onClose, onSave, assets, editingDividend }) => {
  const [formData, setFormData] = useState({ ticker: '', exDate: '', dividendPerShare: '', units: '', isTaxable: true });
  
  useEffect(() => {
    if(editingDividend) setFormData({ ticker: editingDividend.ticker, exDate: editingDividend.exDate, dividendPerShare: editingDividend.amountPerShare.toString(), units: editingDividend.shares.toString(), isTaxable: editingDividend.tax > 0 });
    else setFormData({ ticker: '', exDate: new Date().toISOString().split('T')[0], dividendPerShare: '', units: '', isTaxable: true });
  }, [editingDividend, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
      const { name, value, type, checked } = e.target; 
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); 
  };

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
      const val = e.target.value.toUpperCase(); 
      const asset = assets.find(a => a.ticker === val); 
      setFormData(prev => ({...prev, ticker: val, units: asset ? asset.shares.toString() : prev.units})); 
  };

  const handleSave = (addNext: boolean) => { 
    if(!formData.ticker || !formData.dividendPerShare) return; 
    onSave(formData, addNext); 
    if(addNext) { 
      setFormData(prev => ({ ...prev, dividendPerShare: '', exDate: new Date().toISOString().split('T')[0] })); 
    } else { 
      onClose(); 
    } 
  };

  if(!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center rounded-t-2xl"><h3 className="font-bold">{editingDividend ? '修改' : '新增'}配息</h3><button onClick={onClose}><X size={20}/></button></div>
        <div className="p-4 space-y-3">
           <div>
               <label className="text-xs text-slate-500 mb-1 block">代碼</label>
               <input list="tickers" value={formData.ticker} onChange={handleTickerChange} className="w-full border p-2 rounded uppercase font-bold" placeholder="輸入代碼..."/>
               <datalist id="tickers">{assets.map(a => <option key={a.id} value={a.ticker}/>)}</datalist>
           </div>
           <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500 mb-1 block">除息日</label><input type="date" name="exDate" value={formData.exDate} onChange={handleChange} className="w-full border p-2 rounded"/></div>
              <div><label className="text-xs text-slate-500 mb-1 block">單位</label><input type="number" name="units" value={formData.units} onChange={handleChange} className="w-full border p-2 rounded"/></div>
              <div><label className="text-xs text-slate-500 mb-1 block">每股配息</label><input type="number" name="dividendPerShare" value={formData.dividendPerShare} onChange={handleChange} className="w-full border p-2 rounded"/></div>
           </div>
           <div className="flex items-center gap-2 mt-2"><input type="checkbox" name="isTaxable" checked={formData.isTaxable} onChange={handleChange} className="w-4 h-4"/><label className="text-sm">預扣 30% 稅</label></div>
           <div className="flex gap-2 mt-4 pt-4 border-t">{!editingDividend && <button onClick={() => handleSave(true)} className="flex-1 border border-blue-600 text-blue-600 py-2 rounded-lg font-bold text-sm">同標的新增</button>}<button onClick={() => handleSave(false)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-sm">儲存</button></div>
        </div>
      </div>
    </div>
  );
};

export default AddDividendModal;
