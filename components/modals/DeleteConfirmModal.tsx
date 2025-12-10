import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DeleteConfirmInfo } from '../../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  info: DeleteConfirmInfo | null;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ isOpen, onClose, onConfirm, info }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
        <div className="flex items-center gap-3 mb-3 text-red-600">
           <div className="bg-red-50 p-2 rounded-full"><AlertTriangle size={24}/></div>
           <h3 className="font-bold text-lg text-slate-800">確認刪除?</h3>
        </div>
        <p className="text-slate-600 mb-6 text-sm">
          您確定要永久刪除 <span className="font-bold text-slate-900">{info?.title}</span> 嗎？<br/>
          <span className="text-xs text-slate-400 mt-1 block">此動作將同步到雲端且無法復原。</span>
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">取消</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-red-700 active:scale-95 transition-all">確認刪除</button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
