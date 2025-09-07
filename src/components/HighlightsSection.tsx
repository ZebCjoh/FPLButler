import React from 'react';

interface Highlight {
  id?: number;
  text: string;
}

interface HighlightsSectionProps {
  highlights: Highlight[];
  isLoading?: boolean;
}

const HighlightsSection: React.FC<HighlightsSectionProps> = ({ highlights = [], isLoading = false }) => {
  return (
    <section>
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-2">
          ✨ Høydepunkter
        </h2>
        <p className="text-white/80 text-xs">Rundens mest interessante øyeblikk</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
          // Loading skeleton
          [1, 2, 3].map(i => (
            <div key={i} className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-600 animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-600 rounded animate-pulse"></div>
                  <div className="h-3 bg-gray-600 rounded w-3/4 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))
        ) : Array.isArray(highlights) && highlights.length > 0 ? (
          highlights.map((h: Highlight, index: number) => (
            <div 
              key={h.id ?? index} 
              className="group bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-lg p-3 transition-all duration-300 hover:border-[#00E0D3] hover:scale-105"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00E0D3] border-2 border-white flex items-center justify-center text-[#3D195B] text-xs font-bold shadow-lg">
                  {index + 1}
                </div>
                <p className="text-white leading-relaxed text-sm flex-1">{h.text}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-white/80 text-sm">
            Ingen høydepunkter tilgjengelig
          </div>
        )}
      </div>
    </section>
  );
};

export default HighlightsSection;
