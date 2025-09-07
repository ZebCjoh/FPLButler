import React from 'react';

interface TopThreeEntry {
  rank: number;
  teamName: string;
  manager: string;
  points: number;
}

interface TopThreeSectionProps {
  topThree: TopThreeEntry[];
  isLoading?: boolean;
}

const TopThreeSection: React.FC<TopThreeSectionProps> = ({ topThree, isLoading = false }) => {
  return (
    <section>
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          🏆 Topp 3
        </h2>
        <p className="text-white/80 text-sm">De beste lagene i ligaen</p>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-2xl p-4">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto bg-gray-600 rounded-full animate-pulse"></div>
                <div className="h-4 bg-gray-600 rounded animate-pulse"></div>
                <div className="h-3 bg-gray-600 rounded w-2/3 mx-auto animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {topThree.map(({ rank, teamName, manager, points }) => (
            <div
              key={rank}
              className={`
                h-full group cursor-pointer transform transition-all duration-300 hover:scale-105
                ${rank === 1 ? 'md:order-2' : rank === 2 ? 'md:order-1 md:mt-4' : 'md:order-3 md:mt-4'}
              `}
            >
              <div className={`
                flex h-full flex-col justify-between rounded-xl shadow-xl border-2 p-4
                ${rank === 1 
                  ? 'bg-[#3D195B] border-[#FFD700]' 
                  : rank === 2
                  ? 'bg-[#360D3A] border-[#00E0D3]/80'
                  : 'bg-[#2D0A2E] border-[#00E0D3]/60'
                }
              `}>
                
                <div className="flex items-center justify-center">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-lg border-2
                    ${rank === 1 
                      ? 'bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black border-white' 
                      : 'bg-[#00E0D3]/80 text-[#3D195B] border-white/80'
                    }
                  `}>
                    {rank}
                  </div>
                </div>

                <div className="flex flex-col items-center text-center min-h-[56px] justify-center">
                  <h3 className="font-bold text-white leading-tight max-w-[18ch] clamp-2 text-sm">
                    {teamName}
                  </h3>
                  <p className="mt-1 text-xs text-white/90 font-medium">av {manager}</p>
                </div>

                <div className="bg-[#00E0D3]/20 border border-[#00E0D3] rounded-lg px-3 py-2 text-center">
                  <div className="text-lg font-bold text-white">{points}</div>
                  <div className="text-xs text-white/90">poeng</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default TopThreeSection;
