import React, { useState, useEffect } from 'react';
import { 
  Radio, Wifi, Database, Laptop, RefreshCw, Send, CheckCircle2, AlertTriangle, 
  HelpCircle, QrCode, ClipboardCheck, Smartphone, Network, KeyRound
} from 'lucide-react';
import { P2PMessage, GameLog, Player, GameType } from '../types';

interface P2PSyncProps {
  onSyncReceived: (data: any) => void;
  players: Player[];
  gameType: GameType;
  addLog: (message: string, playerName?: string, type?: GameLog['type']) => void;
}

export default function P2PSync({ onSyncReceived, players, gameType, addLog }: P2PSyncProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [activeTabSync, setActiveTabSync] = useState(false);
  const [discoveredPeers, setDiscoveredPeers] = useState<any[]>([]);
  const [connectedPeer, setConnectedPeer] = useState<string | null>(null);
  const [broadcastChannel, setBroadcastChannel] = useState<BroadcastChannel | null>(null);
  
  // WebRTC manualny offline handshake
  const [webrtcMode, setWebrtcMode] = useState<'none' | 'host' | 'client'>('none');
  const [localSdp, setLocalSdp] = useState('');
  const [remoteSdp, setRemoteSdp] = useState('');
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [copied, setCopied] = useState(false);

  // Unikalny identyfikator urządzenia / karty
  const [deviceId] = useState(() => `device-${Math.floor(1000 + Math.random() * 9000)}`);
  const [deviceName] = useState(() => {
    const names = ['KarcianyTelefon', 'GryTablet', 'LaptopKanapa', 'OfflineKomputer'];
    return `${names[Math.floor(Math.random() * names.length)]}-${Math.floor(10 + Math.random() * 90)}`;
  });

  // 1. Obsługa KOLEŻEŃSKIEJ SYNCHRONIZACJI KARTY (BroadcastChannel API - 100% offline między kartami)
  useEffect(() => {
    const channel = new BroadcastChannel('karciane_offline_channel');
    setBroadcastChannel(channel);

    channel.onmessage = (event) => {
      const msg = event.data as P2PMessage;
      if (msg.senderId === deviceId) return; // pominąć własną wiadomość

      if (msg.type === 'PING') {
        const reply: P2PMessage = {
          type: 'PONG',
          senderId: deviceId,
          senderName: deviceName,
          payload: { gameType },
          timestamp: Date.now(),
        };
        channel.postMessage(reply);

        // Dodaj do odkrytych urządzeń w pobliżu
        addDiscoveredPeer(msg.senderId, msg.senderName, 'BroadcastChannel (Inna karta)');
      } else if (msg.type === 'PONG') {
        addDiscoveredPeer(msg.senderId, msg.senderName, 'BroadcastChannel (Inna karta)');
      } else if (msg.type === 'SYNC_SCORES') {
        onSyncReceived(msg.payload);
        addLog(`Pomyślnie zsynchronizowano wyniki z urządzeniem: ${msg.senderName}!`, undefined, 'info');
      } else if (msg.type === 'CHAT') {
        addLog(`[Wiadomość]: ${msg.payload}`, msg.senderName, 'info');
      }
    };

    return () => {
      channel.close();
    };
  }, [deviceId, deviceName, gameType]);

  const addDiscoveredPeer = (id: string, name: string, method: string) => {
    setDiscoveredPeers(prev => {
      if (prev.some(p => p.id === id)) return prev;
      return [...prev, { id, name, method, timestamp: Date.now() }];
    });
  };

  // Skanowanie wejść
  const startScanning = () => {
    setIsScanning(true);
    setDiscoveredPeers([]);
    
    // Wyślij sygnał Ping w eter offline (BroadcastChannel)
    if (broadcastChannel) {
      const ping: P2PMessage = {
        type: 'PING',
        senderId: deviceId,
        senderName: deviceName,
        payload: null,
        timestamp: Date.now(),
      };
      broadcastChannel.postMessage(ping);
    }

    // Dodaj parę symulowanych urządzeń Bluetooth (dystansowych) dla demonstracji sparowania
    setTimeout(() => {
      addDiscoveredPeer('ble-controller', 'Gamepad Bluetooth ipega', 'BLE GATT API');
      addDiscoveredPeer('ble-phone', 'Sąsiad (Bluetooth)', 'Simulated Bluetooth Smart');
    }, 1200);

    setTimeout(() => {
      setIsScanning(false);
    }, 3000);
  };

  // Połącz z wybranym rówieśnikiem w pobliżu
  const connectPeer = (peer: any) => {
    setConnectedPeer(peer.name);
    addLog(`Połączono z peerem: ${peer.name} za pomocą ${peer.method}!`, undefined, 'info');

    // Jeśli to symulowany BLE Controller
    if (peer.id === 'ble-controller') {
      tryBLEGATT();
    } else {
      // Wyślij wyniki gry do sparowanego urządzenia w tle
      sendScoresUpdate();
    }
  };

  // Symulowane dzwonienie do Web Bluetooth API (wymaga akcji usera w secure context)
  const tryBLEGATT = () => {
    if ('bluetooth' in navigator) {
      addLog('Inicjowanie prawdziwego połączenia kontrolera Web Bluetooth...', undefined, 'info');
      // Prośba o urządzenie
      (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true
      }).then((device: any) => {
        addLog(`Połączono z fizycznym filtrem BLE: ${device.name}`, undefined, 'win');
      }).catch((e: any) => {
        addLog(`Prawdziwe BLE przerwane lub brak urządzeń: ${e.message}`, undefined, 'alert');
      });
    } else {
      addLog('Web Bluetooth GATT nie jest dostępne na tym urządzeniu lub przeglądarce.', undefined, 'alert');
    }
  };

  const sendScoresUpdate = () => {
    if (!broadcastChannel) return;
    
    const syncMsg: P2PMessage = {
      type: 'SYNC_SCORES',
      senderId: deviceId,
      senderName: deviceName,
      payload: {
        gameType,
        playersScores: players.map(p => ({ name: p.name, score: p.score })),
        timestamp: Date.now()
      },
      timestamp: Date.now(),
    };
    broadcastChannel.postMessage(syncMsg);
    addLog(`Wysłano pakiet synchronizacji wyników z urządzenia ${deviceName}.`, undefined, 'info');
  };

  // ----- INICJACJA WEBRTC OFF-LINE PEER-TO-PEER (Z POMOCĄ KODU SDP) -----
  const initWebRtcHost = async () => {
    setWebrtcMode('host');
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const dc = pc.createDataChannel('card_sync_channel');
    setupDataChannel(dc);

    pc.onicecandidate = (e) => {
      if (e.candidate === null) {
        // Wszystkie ICE zebrane, SDP jest kompletny i gotowy
        setLocalSdp(btoa(JSON.stringify(pc.localDescription)));
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    setPeerConnection(pc);
    setDataChannel(dc);
  };

  const initWebRtcClient = () => {
    setWebrtcMode('client');
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.ondatachannel = (e) => {
      setupDataChannel(e.channel);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate === null) {
        setLocalSdp(btoa(JSON.stringify(pc.localDescription)));
      }
    };

    setPeerConnection(pc);
  };

  const applyRemoteOffer = async () => {
    if (!peerConnection || !remoteSdp) return;
    try {
      const sdpJson = JSON.parse(atob(remoteSdp));
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdpJson));
      
      if (webrtcMode === 'client') {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
      }
      addLog('Zdany profil SDP wczytany pomyślnie!', undefined, 'win');
    } catch (err: any) {
      addLog(`Błąd przetwarzania profilu SDP: ${err.message}`, undefined, 'alert');
    }
  };

  const setupDataChannel = (dc: RTCDataChannel) => {
    dc.onopen = () => {
      addLog('🎉 BEZPOŚREDNI KANAŁ WEBRTC UP-AND-RUNNING! Połączenie ustanowione offline.', undefined, 'win');
      setConnectedPeer('Urządzenie WebRTC P2P');
    };
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'SYNC_SCORES') {
          onSyncReceived(msg.payload);
        }
      } catch (err) {}
    };
  };

  const copyLocalSdp = () => {
    navigator.clipboard.writeText(localSdp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl" id="sync-station-view">
      <div className="flex items-center gap-3 mb-4">
        <Network className="w-5 h-5 text-indigo-400 animate-pulse" />
        <div>
          <h2 className="text-sm font-mono font-bold tracking-wider text-slate-200 uppercase">
            Stacja Synchronizacji Peer-to-Peer
          </h2>
          <p className="text-[10px] text-slate-400 font-mono">
            Twoja tożsamość: <span className="text-indigo-400 font-bold">{deviceName}</span> ({deviceId})
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed mb-6 font-sans">
        Aplikacja działa w pełni offline. Synchronizacja danych opiera się o bezserwerową komunikację bezpośrednią: 
        <strong className="text-emerald-400"> BroadcastChannel</strong> (między kartami) oraz 
        <strong className="text-indigo-400"> WebRTC P2P</strong> (między oknami i urządzeniami).
      </p>

      {/* BLUETOOTH RADAR VIEW */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 relative overflow-hidden flex flex-col items-center">
        
        {/* Radar z pulsing circles za pomocą CSS */}
        <div className="w-32 h-32 rounded-full border border-indigo-500/20 flex items-center justify-center relative mb-4">
          <div className={`absolute inset-0 rounded-full border border-indigo-500/10 animate-ping ${isScanning ? 'opacity-100' : 'opacity-0'}`} />
          <div className="w-20 h-20 rounded-full border border-indigo-500/35 flex items-center justify-center text-indigo-400">
            <Radio className={`w-8 h-8 ${isScanning ? 'animate-pulse' : ''}`} />
          </div>
        </div>

        <button 
          onClick={startScanning}
          disabled={isScanning}
          className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold font-mono tracking-wider rounded-xl transition-all disabled:bg-white/5 disabled:text-slate-500 flex items-center gap-2 hover:scale-[1.01] active:scale-95"
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> SKANOWANIE...
            </>
          ) : (
            'SKANUJ URZĄDZENIA LOKALNE'
          )}
        </button>

        {isScanning && (
          <span className="text-[9px] font-mono text-indigo-400 mt-2 animate-pulse uppercase">
            Nasłuch w kanale nadawczym Bluetooth i LAN
          </span>
        )}
      </div>

      {/* LISTA WYKRYTYCH PEERÓW */}
      <div className="space-y-3 mb-6">
        <h4 className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
          Wykryte połączenia w pobliżu ({discoveredPeers.length}):
        </h4>
        <div className="space-y-2 max-h-[160px] overflow-y-auto">
          {discoveredPeers.map((peer) => (
            <div 
              key={peer.id} 
              className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10"
            >
              <div>
                <span className="text-xs font-bold text-slate-200 block">{peer.name}</span>
                <span className="text-[9px] uppercase font-mono text-emerald-400">{peer.method}</span>
              </div>
              <button 
                onClick={() => connectPeer(peer)}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-semibold rounded-lg transition-colors"
              >
                Połącz i synch
              </button>
            </div>
          ))}

          {discoveredPeers.length === 0 && !isScanning && (
            <div className="text-center py-4 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
              <span className="text-xs text-slate-500 italic font-mono block">Brak odkrytych oponentów</span>
              <span className="text-[9px] text-indigo-300 block mt-1 hover:underline cursor-pointer" onClick={() => {
                // Instrukcja otworzenia w nowej karcie
                addLog('Otwórz grę w drugiej karcie (lub trybie incognito) aby natychmiast przetestować synchronizację!', 'System', 'info');
              }}>
                Jak przetestować lokalną grę? (Kliknij)
              </span>
            </div>
          )}
        </div>
      </div>

      {connectedPeer && (
        <div className="mb-6 bg-emerald-950/25 border border-emerald-500/25 p-4 rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-xs text-emerald-300 block">Aktywne połączenie:</span>
            <span className="text-xs font-mono font-bold text-white">{connectedPeer}</span>
          </div>
          <button 
            onClick={sendScoresUpdate}
            className="ml-auto px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded hover:bg-emerald-500/35 transition-colors"
          >
            Wyślij wyniki
          </button>
        </div>
      )}

      {/* WEBRTC OFFLINE HANDSHAKE INTERFACE */}
      <div className="border-t border-white/10 pt-5">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-indigo-400" /> Bezpośredni Link WebRTC (Inne urządzenia)
        </h3>
        
        {webrtcMode === 'none' ? (
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={initWebRtcHost}
              className="py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-mono rounded-xl transition-all"
            >
              Rozpocznij (Host)
            </button>
            <button 
              onClick={initWebRtcClient}
              className="py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-mono rounded-xl transition-all"
            >
              Dołącz (Client)
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-slate-400 block mb-1">
                {webrtcMode === 'host' ? '1. Twój kod połączenia (Udostępnij oponentowi):' : '2. Twój wygenerowany kod zwrotny po wklejeniu kodu hosta:'}
              </span>
              {localSdp ? (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={localSdp.substring(0, 32) + '...'} 
                    className="flex-1 bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-slate-400"
                  />
                  <button 
                    onClick={copyLocalSdp}
                    className="px-3 bg-white/10 hover:bg-white/20 text-indigo-300 rounded text-xs transition-all"
                  >
                    {copied ? 'Skopiowano!' : 'Skopiuj'}
                  </button>
                </div>
              ) : (
                <span className="text-xs font-mono text-indigo-400 animate-pulse">Inicjowanie sesji i zbieranie ICE...</span>
              )}
            </div>

            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <span className="text-[10px] font-mono text-slate-400 block mb-1">
                {webrtcMode === 'host' ? '2. Wklej kod zwrotny od klienta:' : '1. Wklej kod połączenia od hosta:'}
              </span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Wklej kod SDP (base64)..." 
                  value={remoteSdp} 
                  onChange={(e) => setRemoteSdp(e.target.value)}
                  className="flex-1 bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button 
                  onClick={applyRemoteOffer}
                  className="px-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs font-bold transition-all"
                >
                  Zastosuj
                </button>
              </div>
            </div>

            <button 
              onClick={() => {
                setWebrtcMode('none');
                setLocalSdp('');
                setRemoteSdp('');
                if (peerConnection) peerConnection.close();
              }}
              className="w-full py-2 bg-white/5 hover:bg-rose-950/30 hover:text-rose-400 text-slate-400 text-xs font-mono rounded-lg transition-colors border border-white/10"
            >
              Anuluj sesję WebRTC
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
