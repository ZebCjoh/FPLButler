import React from 'react';

interface BottomThreeEntry {
  rank: number;
  teamName: string;
  manager: string;
  points: number;
}

interface BottomThreeSectionProps {
  bottomThree: BottomThreeEntry[];
  isLoading?: boolean;
}

const BottomThreeSection: React.FC<BottomThreeSectionProps> = ({ bottomThree, isLoading = false }) => {
  return (
    <section>
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">📉 Bunn 3</h2>
        <p className="text-white/80 text-sm">Lagene som må skjerpe seg</p>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          // Loading skeleton
          [1, 2, 3].map(i => (
            <div key={i} className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-600 animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-600 rounded animate-pulse"></div>
                  <div className="h-3 bg-gray-600 rounded w-2/3 animate-pulse"></div>
                </div>
                <div className="w-16 h-12 bg-gray-600 rounded-lg animate-pulse"></div>
              </div>
            </div>
          ))
        ) : (
          bottomThree.map(({ rank, teamName, manager, points }, index) => (
          <div
            key={rank}
            className={`
              group border-2 rounded-xl p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg
              ${index === 0 
                ? 'bg-[#3D195B] border-[#00E0D3]/60' 
                : index === 1
                ? 'bg-[#360D3A] border-[#00E0D3]/80'
                : 'bg-[#2D0A2E] border-[#00E0D3]'
              }
            `}
          >
            <div className="flex items-center gap-4">
              <div className={`
                w-12 h-12 rounded-full border-2 border-white flex items-center justify-center font-bold text-sm shadow-lg
                ${index === 0 
                  ? 'bg-red-600/70 text-white' 
                  : index === 1
                  ? 'bg-red-700/80 text-white'
                  : 'bg-red-800 text-white'
                }
              `}>
                {rank}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white mb-1 truncate">{teamName}</h3>
                <p className="text-white/80 text-xs truncate">av {manager}</p>
              </div>
              <div className="text-center bg-[#00E0D3]/20 border border-[#00E0D3] rounded-lg p-2">
                <div className="text-lg font-bold text-white">{points}</div>
                <div className="text-white/80 text-xs">poeng</div>
              </div>
            </div>
          </div>
        )))}
      </div>
    </section>
  );
};

export default BottomThreeSection;
