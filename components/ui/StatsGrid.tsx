import React from 'react';

interface StatsItem {
  label: string;
  value: string;
  valueColor?: string;
  subValue?: string;
}

interface StatsGridProps {
  items: StatsItem[];
  colorClass?: string;
}

const StatsGrid: React.FC<StatsGridProps> = ({ items, colorClass = "from-slate-700 to-slate-900" }) => (
  <div className={`bg-gradient-to-br ${colorClass} text-white rounded-2xl p-4 shadow-lg mb-4`}>
     <div className="grid grid-cols-2 gap-y-4 gap-x-4">
        {items.map((item, idx) => (
           <div key={idx} className={idx % 2 !== 0 ? "text-right" : ""}>
              <p className="text-xs text-slate-300 mb-1 opacity-80">{item.label}</p>
              <p className={`font-bold text-lg ${item.valueColor || "text-white"}`}>{item.value}</p>
              {item.subValue && <p className="text-[10px] text-slate-400 mt-0.5">{item.subValue}</p>}
           </div>
        ))}
     </div>
  </div>
);

export default StatsGrid;
