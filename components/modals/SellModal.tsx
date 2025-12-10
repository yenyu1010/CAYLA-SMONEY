import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Asset } from '../../types';

interface SellModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onConfirm: (id: string, qty: number, price: number, date: string) => void;
}

const SellModal: React.FC<SellModalProps> = ({ isOpen, onClose, asset, onConfirm }) => {
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { 
    if(asset) { 
        setQty(asset.shares.toString()); 
        setPrice(asset.currentPrice.toString()); 
    } 
  }, [asset]);

  const handleConfirm = () => { 
    if(!qty || !price || !asset) return; 
    onConfirm(asset.id, parseFloat(qty), parseFloat(price), date); 
    onClose(); 
  };

  if (!isOpen || !asset) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-4 bg-red-600 text-white flex justify-between items-center"><h3 className="font-bold">賣出: {asset.ticker}</h3><button onClick={onClose}><X size={20}/></button></div>
        <div className="p-4 space-y-4">
          <div className="bg-red-50 p-3 rounded text-sm text-red-800">持有: {Number(asset.shares).toLocaleString()} / 均價: ${Number(asset.avgCost).toFixed(2)}</div>
          <div className="grid grid-cols-2 gap-3">
             <div><label className="text-xs text-slate-500 mb-1 block">賣出數量</label><input type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-full border p-2 rounded"/></div>
             <div><label className="text-xs text-slate-500 mb-1 block">單價 ($)</label><input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full border p-2 rounded"/></div>
          </div>
          <div><label className="text-xs text-slate-500 mb-1 block">日期</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border p-2 rounded"/></div>
          <div className="text-xs text-slate-400 mt-2">* 系統將採用「先進先出 (FIFO)」法，優先扣除最早買入的批次來計算已實現損益。</div>
          <button onClick={handleConfirm} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold mt-2 shadow-lg hover:bg-red-700">確認賣出 (FIFO)</button>
        </div>
      </div>
    </div>
  );
};

export default SellModal;
