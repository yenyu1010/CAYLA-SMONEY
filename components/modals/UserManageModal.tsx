import React, { useState } from 'react';
import { Users, X, Edit, Save } from 'lucide-react';
import { User } from '../../types';

interface UserManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  setUsers: (users: User[]) => void;
  currentUserId?: string;
}

const UserManageModal: React.FC<UserManageModalProps> = ({ isOpen, onClose, users, setUsers, currentUserId }) => {
  const [newUserName, setNewUserName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = () => { 
    if(!newUserName.trim()) return; 
    setUsers([...users, { id: Date.now().toString(), name: newUserName }]); 
    setNewUserName(''); 
  };

  const startEdit = (user: User) => { 
    setEditingId(user.id); 
    setEditName(user.name); 
  };

  const saveEdit = () => { 
    setUsers(users.map(u => u.id === editingId ? { ...u, name: editName } : u)); 
    setEditingId(null); 
  };

  if(!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl">
        <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2"><Users size={16}/> 成員管理</h3>
            <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="p-4 space-y-3">
           <div className="flex gap-2">
             <input 
                value={newUserName} 
                onChange={e => setNewUserName(e.target.value)} 
                className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm" 
                placeholder="新成員名稱"
             />
             <button onClick={handleAdd} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">新增</button>
           </div>
           <div className="space-y-2 max-h-60 overflow-y-auto">
             {users.map(u => (
               <div key={u.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                 {editingId === u.id ? (
                    <div className="flex gap-2 w-full">
                        <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 border border-blue-300 rounded px-1 text-sm"/>
                        <button onClick={saveEdit} className="text-green-600"><Save size={16}/></button>
                    </div>
                 ) : (
                    <>
                        <span className="font-medium text-slate-700">{u.name}</span>
                        <button onClick={() => startEdit(u)} className="text-slate-400 hover:text-blue-600"><Edit size={14}/></button>
                    </>
                 )}
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default UserManageModal;
