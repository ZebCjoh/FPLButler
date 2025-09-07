import React from 'react';

const InfoSection: React.FC = () => {
  return (
    <section className="text-center">
      <div className="bg-[#3D195B] border-2 border-[#00E0D3] rounded-xl p-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-lg">🚀</span>
          <h3 className="text-base font-bold text-white">
            Live FPL Data
          </h3>
        </div>
        <p className="text-white/80 text-xs">
          Dataene hentes direkte fra Fantasy Premier League API i sanntid.
        </p>
      </div>
    </section>
  );
};

export default InfoSection;
