import React, { useEffect, useState } from 'react';
import { diagnosticService, DiagnosticData } from '../services/diagnosticService';

export const DiagnosticPanel: React.FC = () => {
  const [data, setData] = useState<DiagnosticData>({});
  const [isVisible, setIsVisible] = useState(diagnosticService.isDiagnosticModeEnabled);
  const [rawNative, setRawNative] = useState(diagnosticService.rawNativePlaybackEnabled);

  useEffect(() => {
    const unsub = diagnosticService.subscribe((newData) => {
      setData(newData);
      setIsVisible(diagnosticService.isDiagnosticModeEnabled);
      setRawNative(diagnosticService.rawNativePlaybackEnabled);
    });
    return unsub;
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 right-4 bg-black/90 text-green-400 p-4 rounded text-xs font-mono z-50 max-w-sm max-h-[60vh] overflow-y-auto border border-green-500 shadow-lg pointer-events-auto">
      <div className="flex justify-between mb-2 border-b border-green-700 pb-1">
        <strong className="uppercase">Dev Diagnostic</strong>
        <button onClick={() => diagnosticService.toggleDiagnosticMode()} className="text-red-400 hover:text-red-300">X</button>
      </div>
      
      <div className="flex flex-col gap-1 mb-3">
        <label className="flex items-center gap-2 cursor-pointer text-white">
          <input 
            type="checkbox" 
            checked={rawNative}
            onChange={() => diagnosticService.toggleRawNativePlayback()}
            className="accent-green-500"
          />
          RAW NATIVE PLAYBACK
        </label>
      </div>

      <div className="grid grid-cols-1 gap-1 break-all">
        <div><span className="text-gray-400">Song:</span> {data.songTitle}</div>
        <div><span className="text-gray-400">Artist:</span> {data.artist}</div>
        <div><span className="text-gray-400">ID:</span> {data.songId}</div>
        <div><span className="text-gray-400">Source URL:</span> {data.originalSourceUrl}</div>
        <div><span className="text-gray-400">Resolved URL:</span> {data.resolvedPlaybackUrl}</div>
        <div><span className="text-gray-400">HTTP Status:</span> {data.httpStatus}</div>
        <div><span className="text-gray-400">MIME:</span> {data.contentType}</div>
        <div><span className="text-gray-400">Length:</span> {data.contentLength}</div>
        <div><span className="text-gray-400">Redirects:</span> {data.redirectInfo}</div>
        <div><span className="text-gray-400">Extension:</span> {data.extension}</div>
        <div><span className="text-gray-400">Codec:</span> {data.codecContainer}</div>
        <div><span className="text-gray-400">Duration:</span> {data.duration}</div>
        <div><span className="text-gray-400">Player:</span> {data.player}</div>
        <div><span className="text-gray-400">Decoder:</span> {data.decoder}</div>
        <div><span className="text-gray-400">Buffering:</span> {data.buffering}</div>
        <div><span className="text-gray-400">AudioSession:</span> {data.audioSession}</div>
        <div><span className="text-gray-400">Effects:</span> {data.audioEffects}</div>
        <div className="text-red-400"><span className="text-gray-400">Error:</span> {data.playerError}</div>
        
        <div className="mt-2 pt-2 border-t border-green-700">
          <div><span className="text-gray-400">ACTIVE PLAYERS:</span> {data.activePlayers || 1}</div>
          <div><span className="text-gray-400">ACTIVE AUDIO CONTEXTS:</span> {data.activeAudioContexts || 0}</div>
          <div><span className="text-gray-400">ACTIVE MEDIA3 PLAYERS:</span> {data.activeMedia3Players || (data.player === 'Media3' ? 1 : 0)}</div>
        </div>
      </div>
    </div>
  );
};
