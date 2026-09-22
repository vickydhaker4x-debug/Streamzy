import React from 'react';
import { X, Bell } from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 'notif-1',
      title: 'Streamzy v3.0.5 Engine Update',
      time: 'Just now',
      desc: 'YouTube Music & Piped stream plugins upgraded with zero-buffering fallback and 320kbps high-fidelity audio.',
      tag: 'System',
      color: 'text-[#FE385E]'
    },
    {
      id: 'notif-2',
      title: '10-Band DSP Equalizer Active',
      time: '2 hours ago',
      desc: 'Customize your acoustic curve or toggle Bass Boost and 0-12s audio crossfade in the player.',
      tag: 'Audio',
      color: 'text-[#0EA5E0]'
    },
    {
      id: 'notif-3',
      title: 'Lossless Streaming Active',
      time: '1 day ago',
      desc: 'High-fidelity audio decoding and smart cache enabled for smooth playback.',
      tag: 'New Feature',
      color: 'text-emerald-400'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#140C16] border border-[#2D1A2F] rounded-3xl p-6 relative text-[#DAEAF7]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#0EA5E0]/20 text-[#0EA5E0] flex items-center justify-center">
            <Bell size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Notifications</h2>
            <p className="text-xs text-[#A193A5]">Streamzy updates and audio stream alerts</p>
          </div>
        </div>

        <div className="space-y-3">
          {notifications.map((notif) => (
            <div key={notif.id} className="p-3.5 rounded-2xl bg-[#1D1020] border border-[#2F1B33]">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${notif.color}`}>{notif.tag}</span>
                <span className="text-[11px] text-[#A193A5] font-mono">{notif.time}</span>
              </div>
              <h4 className="font-semibold text-sm text-white">{notif.title}</h4>
              <p className="text-xs text-[#A193A5] mt-1 leading-relaxed">{notif.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
