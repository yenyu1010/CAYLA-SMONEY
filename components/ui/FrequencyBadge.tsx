import React from 'react';

interface FrequencyBadgeProps {
  freq?: string;
  type?: string;
}

const FrequencyBadge: React.FC<FrequencyBadgeProps> = ({ freq, type }) => {
  const map: Record<string, { text: string; color: string }> = {
    'Weekly': { text: '週', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    'Monthly': { text: '月', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    'Quarterly': { text: '季', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    'Individual': { text: '個', color: 'bg-gray-100 text-gray-700 border-gray-200' },
    'Stock': { text: '股', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    'ETF': { text: 'E', color: 'bg-green-100 text-green-700 border-green-200' },
    'Fund': { text: '基', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  };

  const safeFreq = freq || 'Individual';
  const safeType = type || 'Stock';
  
  // Prioritize freq unless it's Individual, then try type
  const config = map[safeFreq] && safeFreq !== 'Individual' 
    ? map[safeFreq] 
    : (map[safeType] || { text: safeType.charAt(0), color: 'bg-gray-100' });
  
  return (
    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold border ${config.color}`}>
      {config.text}
    </span>
  );
};

export default FrequencyBadge;
