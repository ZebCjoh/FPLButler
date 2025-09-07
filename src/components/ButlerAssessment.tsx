import React from 'react';

interface ButlerAssessmentProps {
  assessment: string;
  isLoading?: boolean;
}

const ButlerAssessment: React.FC<ButlerAssessmentProps> = ({ assessment, isLoading = false }) => {
  return (
    <section className="mb-8">
      <div className="bg-[#3D195B] border-2 border-[#00E0D3]/60 rounded-2xl p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#00E0D3]/60 flex items-center justify-center text-2xl">
            🍷
          </div>
          <h3 className="text-xl font-bold text-white">Butlerens vurdering</h3>
        </div>
        <div className="bg-[#00E0D3]/10 rounded-lg p-4">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00E0D3]"></div>
              <p className="text-white/70 text-sm italic">Butleren forbereder sin vurdering...</p>
            </div>
          ) : (
            <p className="text-white leading-relaxed text-sm">
              {assessment || "Butleren vurderer dagens prestasjoner..."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default ButlerAssessment;
