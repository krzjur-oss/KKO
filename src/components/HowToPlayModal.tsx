import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, X, ChevronRight, Check, AlertTriangle, 
  HelpCircle, Star, Sparkles, Award, Play, RotateCw 
} from 'lucide-react';
import { GameType } from '../types';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGameType: GameType;
}

export default function HowToPlayModal({ isOpen, onClose, initialGameType }: HowToPlayModalProps) {
  const [activeTab, setActiveTab] = useState<GameType>(initialGameType);

  // States for Remik interactive section
  const [selectedRemikCombo, setSelectedRemikCombo] = useState<number | null>(null);
  
  // States for Makao interactive section
  const [makaoQuestionAnswer, setMakaoQuestionAnswer] = useState<string | null>(null);
  
  // States for Tysiąc interactive section
  const [selectedTysiacCards, setSelectedTysiacCards] = useState<string[]>([]);
  const [tysiacQuizAnswer, setTysiacQuizAnswer] = useState<number | null>(null);

  // Config data for Remik combos
  const remikCombos = [
    {
      id: 1,
      title: "Czysty Sekwens",
      cards: [
        { label: "5♣", suit: "♣", value: "5", isRed: false },
        { label: "6♣", suit: "♣", value: "6", isRed: false },
        { label: "7♣", suit: "♣", value: "7", isRed: false }
      ],
      description: "Trzy lub więcej kart tego samego koloru w kolejności liczbowej. Niezbędny do pierwszego wyłożenia!",
      points: 18,
      isValid: true
    },
    {
      id: 2,
      title: "Grupa (Trójka)",
      cards: [
        { label: "D♠", suit: "♠", value: "D", isRed: false },
        { label: "D♥", suit: "♥", value: "D", isRed: true },
        { label: "D♦", suit: "♦", value: "D", isRed: true }
      ],
      description: "Trzy lub cztery karty tej samej wartości, ale innych kolorów.",
      points: 30, // 3 x 10 pkt dla Damy
      isValid: true
    },
    {
      id: 3,
      title: "Joker w Sekwensie",
      cards: [
        { label: "9♦", suit: "♦", value: "9", isRed: true },
        { label: "🃏 JK", suit: "JOKER", value: "JK", isRed: true, isJoker: true },
        { label: "K♦", suit: "♦", value: "K", isRed: true }
      ],
      description: "Błąd! Joker zastępuje 10♦, ale po nim powinno być Walet (J) i Dama (Q), a nie Król (K)! Brak ciągłości.",
      points: 0,
      isValid: false
    },
    {
      id: 4,
      title: "Sekwens Niski",
      cards: [
        { label: "A♥", suit: "♥", value: "A", isRed: true },
        { label: "2♥", suit: "♥", value: "2", isRed: true },
        { label: "3♥", suit: "♥", value: "3", isRed: true }
      ],
      description: "As może rozpoczynać sekwens (As-2-3) lub go kończyć (Dama-Król-As). Bardzo przydatny układ!",
      points: 16,
      isValid: true
    }
  ];

  // Config for Makao lookup
  const makaoCards = [
    { label: "2", action: "⚔️ Dobierz 2 karty", desc: "Zmusza następnego gracza do dobrania 2 kart z talii, chyba że odpowie inną dwójką lub trójką (kumulacja)." },
    { label: "3", action: "⚔️ Dobierz 3 karty", desc: "Zmusza kolejnego do dobrania 3 kart. Może być łączona z inną trójką lub dwójką." },
    { label: "4", action: "🛡️ Stop / Czekasz", desc: "Następny gracz traci kolejkę (musi stać). Można się obronić kładąc inną czwórkę." },
    { label: "Walet", action: "👑 Żądanie Rangi", desc: "Pozwala zażądać konkretnej zwykłej rangi karty (np. 'żądam piątek'). Obowiązuje całe okrążenie." },
    { label: "As", action: "🎨 Zmiana Koloru", desc: "Zmienia aktualny kolor gry na wybrany przez kładącego (np. Kier, Karo, Pik, Trefl)." },
    { label: "Król Kier", action: "🔥 Dobierz 5 w tył", desc: "Poprzedni gracz musi dobrać aż 5 kart! Jeden z najbardziej niszczycielskich ruchów w grze." },
    { label: "Dama", action: "✨ Dama na wszystko", desc: "Można ją położyć na dowolną kartę i wszystko położyć na nią. Idealna obrona i ucieczka." }
  ];

  // Config for Makao quiz
  const makaoQuiz = {
    topCard: { label: "10 Pik ♠", suit: "S", value: "10" },
    options: [
      { id: "opt-1", label: "10 Kier ♥", text: "10 Kier ♥", feedback: "Doskonale! Ta sama wartość (10). Możesz ją zagrać! ✅", isCorrect: true },
      { id: "opt-2", label: "As Pik ♠", text: "As Pik ♠", feedback: "Świetnie! Ten sam kolor (Pik) oraz As jest funkcyjny i pozwala zmienić kolor. ✅", isCorrect: true },
      { id: "opt-3", label: "5 Karo ♦", text: "5 Karo ♦", feedback: "Niestety nie. 5 Karo nie pasuje do 10 Pik ani wartością, ani kolorem. ❌", isCorrect: false },
      { id: "opt-4", label: "Walet Trefl ♣", text: "Walet Trefl ♣", feedback: "Świetnie! Walet to karta funkcyjna i może być rzucona na każdą zwykłą kartę (jak 10). ✅", isCorrect: true }
    ]
  };

  // Tysiąc card points map
  const tysiacCardsData = [
    { code: "A", name: "As", value: 11, style: "text-rose-500" },
    { code: "10", name: "Dziesiątka", value: 10, style: "text-amber-500" },
    { code: "K", name: "Król", value: 4, style: "text-indigo-400" },
    { code: "Q", name: "Dama", value: 3, style: "text-purple-400" },
    { code: "J", name: "Walet", value: 2, style: "text-slate-400" },
    { code: "9", name: "Dziewiątka", value: 0, style: "text-slate-500" }
  ];

  const handleTysiacCardClick = (code: string) => {
    setSelectedTysiacCards(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const calculatedTysiacPoints = selectedTysiacCards.reduce((acc, code) => {
    const card = tysiacCardsData.find(c => c.code === code);
    return acc + (card ? card.value : 0);
  }, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 select-none flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#020617]/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div 
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            className="w-full max-w-4xl bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] z-10"
          >
            {/* Header */}
            <header className="px-6 py-5 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/20 border border-indigo-400/30 rounded-xl flex items-center justify-center text-indigo-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white font-sans tracking-tight">Akademia Karciana</h2>
                  <p className="text-xs text-slate-400 font-mono tracking-wide">Nauka i interaktywne reguły gier offline</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-colors"
                id="close-how-to-play-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Games Navigation Tabs */}
            <div className="px-6 py-3 bg-white/[0.02] border-b border-white/10 flex gap-2">
              <button 
                onClick={() => {
                  setActiveTab('remik');
                  setSelectedRemikCombo(null);
                }}
                className={`px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-xl border transition-all ${
                  activeTab === 'remik' 
                    ? 'border-indigo-500 bg-white/15 text-indigo-300 ring-2 ring-indigo-500/20' 
                    : 'border-white/5 bg-white/5 text-slate-400 hover:text-slate-200 hover:border-white/15'
                }`}
              >
                REMIK (RUMMY)
              </button>
              <button 
                onClick={() => {
                  setActiveTab('makao');
                  setMakaoQuestionAnswer(null);
                }}
                className={`px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-xl border transition-all ${
                  activeTab === 'makao' 
                    ? 'border-indigo-500 bg-white/15 text-indigo-300 ring-2 ring-indigo-500/20' 
                    : 'border-white/5 bg-white/5 text-slate-400 hover:text-slate-200 hover:border-white/15'
                }`}
              >
                MAKAO
              </button>
              <button 
                onClick={() => {
                  setActiveTab('tysiac');
                  setSelectedTysiacCards([]);
                  setTysiacQuizAnswer(null);
                }}
                className={`px-4 py-2 text-xs font-mono font-bold tracking-wider rounded-xl border transition-all ${
                  activeTab === 'tysiac' 
                    ? 'border-indigo-500 bg-white/15 text-indigo-300 ring-2 ring-indigo-500/20' 
                    : 'border-white/5 bg-white/5 text-slate-400 hover:text-slate-200 hover:border-white/15'
                }`}
              >
                TYSIĄC (1000)
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* REMIK GUIDE */}
              {activeTab === 'remik' && (
                <div className="space-y-6">
                  {/* General Overview Card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/15 flex flex-col justify-between">
                      <h4 className="text-xs font-mono font-extrabold text-indigo-400 uppercase tracking-widest mb-1">Kluczowy Cel</h4>
                      <p className="text-xs text-slate-350 leading-relaxed">
                        Pozbycie się wszystkich kart z ręki poprzez układanie ich w meldunki: grupy (np. trzy asy) lub sekwencje (np. 5, 6, 7 kier).
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 mt-3 inline-block">Wskazówka: Zawsze dobierasz i odrzucasz jedną kartę</span>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/15 flex flex-col justify-between">
                      <h4 className="text-xs font-mono font-extrabold text-purple-400 uppercase tracking-widest mb-1">Pierwsze Wyłożenie</h4>
                      <p className="text-xs text-slate-350 leading-relaxed">
                        Aby wyłożyć pierwsze karty na stół, Twoje meldunki muszą mieć łącznie co najmniej <strong>51 punktów</strong> oraz zawierać minimum jeden „czysty sekwens” (bez Jokera).
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 mt-3 inline-block">Chroń swoje punkty!</span>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/15 flex flex-col justify-between">
                      <h4 className="text-xs font-mono font-extrabold text-emerald-400 uppercase tracking-widest mb-1">Punktacja Kart</h4>
                      <p className="text-xs text-slate-350 leading-relaxed">
                        As = 11 pkt (lub 1 w sekwencji As-2-3), Figury (K, Q, J) i 10 = 10 pkt, karty 2-9 mają wartość nominalną, Joker = wartość zastępowanej karty.
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 mt-3 inline-block">Koniec rundy podlicza punkty w rękach.</span>
                    </div>
                  </div>

                  {/* INTERACTIVE COMPONENT: COMBOS TESTER */}
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-250">
                        Interaktywny Tester Układów
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      Kliknij dowolny rozłożony zestaw kart, aby sprawdzić, czy jest prawidłowym meldunkiem w Remiku i ile punktów przyniesie:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {remikCombos.map((combo, index) => (
                        <div 
                          key={combo.id}
                          onClick={() => setSelectedRemikCombo(index)}
                          className={`p-4 rounded-2xl cursor-pointer border transition-all text-center flex flex-col justify-between ${
                            selectedRemikCombo === index 
                              ? combo.isValid 
                                ? 'border-indigo-500 bg-indigo-500/10 scale-102 ring-2 ring-indigo-500/30' 
                                : 'border-rose-500 bg-rose-500/10 scale-102 ring-2 ring-rose-500/30'
                              : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                          }`}
                        >
                          <span className="text-[10px] font-mono font-bold uppercase text-slate-400 mb-2 block tracking-tight">
                            {combo.title}
                          </span>
                          
                          {/* Mini Cards layout */}
                          <div className="flex justify-center -space-x-2 my-2.5">
                            {combo.cards.map((card, cIdx) => (
                              <div 
                                key={cIdx} 
                                className={`w-10 h-14 rounded-lg bg-slate-900 border ${
                                  card.isJoker ? 'border-amber-500/60' : 'border-white/10'
                                } flex flex-col items-center justify-center text-xs font-bold leading-none shadow-md ${
                                  card.isRed ? 'text-red-400' : 'text-slate-100'
                                }`}
                              >
                                {card.isJoker ? (
                                  <div className="text-[11px] font-serif text-amber-400">🃏</div>
                                ) : (
                                  <>
                                    <span>{card.value}</span>
                                    <span className="text-[9px]">{card.suit}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>

                          <span className="text-[9px] font-mono text-slate-500 block mt-2">
                            Kliknij aby sprawdzić
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Result drawer */}
                    <AnimatePresence mode="wait">
                      {selectedRemikCombo !== null && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-xl flex-shrink-0 ${
                              remikCombos[selectedRemikCombo].isValid 
                                ? 'bg-indigo-500/20 border border-indigo-400/30 text-indigo-400' 
                                : 'bg-rose-500/20 border border-rose-400/30 text-rose-400'
                            }`}>
                              {remikCombos[selectedRemikCombo].isValid ? (
                                <Check className="w-5 h-5" />
                              ) : (
                                <AlertTriangle className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-100">
                                  {remikCombos[selectedRemikCombo].title} - {remikCombos[selectedRemikCombo].isValid ? 'Poprawny!' : 'Niepoprawny!'}
                                </h4>
                                {remikCombos[selectedRemikCombo].isValid && (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold rounded">
                                    {remikCombos[selectedRemikCombo].points} PKT
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-350 mt-1 leading-relaxed">
                                {remikCombos[selectedRemikCombo].description}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* MAKAO GUIDE */}
              {activeTab === 'makao' && (
                <div className="space-y-6">
                  {/* General Overview */}
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/15">
                    <h3 className="text-xs font-mono font-extrabold text-sky-400 uppercase tracking-widest mb-1.5">Makao w skrócie</h3>
                    <p className="text-xs text-slate-350 leading-relaxed">
                      Szybka gra akcji. Twoim celem jest jak najszybsze pozbycie się wszystkich kart. Kładziesz kartę o tej samej wartości (np. 8 na 8) lub o tym samym kolorze (np. pik na pik) co karta leżąca na stole. Karty specjalne (2, 3, 4, Walet, As, Królowie) inicjują widowiskowe bitwy i blokady, które musisz odpierać!
                    </p>
                  </div>

                  {/* Special Cards database list */}
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                    <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200 mb-4 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-sky-400 animate-pulse" /> Funkcje kart bojowych i funkcyjnych
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {makaoCards.map((card, idx) => (
                        <div key={idx} className="p-3.5 bg-white/[0.03] border border-white/5 rounded-2xl flex flex-col justify-between">
                          <div>
                            <span className="w-8 h-8 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center font-bold text-sm text-white mb-2">
                              {card.label}
                            </span>
                            <h4 className="text-xs font-semibold text-sky-300 font-mono mb-1">{card.action}</h4>
                            <p className="text-[11px] text-slate-400 leading-normal">{card.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* INTERACTIVE QUIZ FOR MAKAO MATCHING */}
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <HelpCircle className="w-4 h-4 text-sky-400" />
                      <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
                        Quiz Taktyczny: Co możesz położyć?
                      </h3>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      {/* Virtual table state */}
                      <div className="flex-shrink-0 p-5 bg-indigo-950/20 rounded-2xl border border-indigo-500/20 text-center w-40 flex flex-col items-center">
                        <span className="text-[9px] font-mono uppercase text-indigo-300 mb-2">Karta na stole</span>
                        <div className="w-16 h-22 rounded-xl bg-slate-900 border-2 border-indigo-500 flex items-center justify-center text-red-400 text-lg font-bold shadow-lg shadow-indigo-900/30">
                          {makaoQuiz.topCard.label}
                        </div>
                      </div>

                      {/* Options */}
                      <div className="flex-1 w-full space-y-3">
                        <p className="text-xs text-slate-350">
                          Twoja kolej! Na stole leży <strong>{makaoQuiz.topCard.label}</strong>. Kliknij kartę ze swojej wirtualnej ręki, którą chcesz rzucić jako legalną:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {makaoQuiz.options.map((opt) => (
                            <button 
                              key={opt.id}
                              onClick={() => setMakaoQuestionAnswer(opt.id)}
                              className={`p-3 text-left rounded-xl border text-xs transition-all flex items-center justify-between ${
                                makaoQuestionAnswer === opt.id 
                                  ? opt.isCorrect 
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' 
                                    : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                              }`}
                            >
                              <span>{opt.text}</span>
                              {makaoQuestionAnswer === opt.id && (
                                <span className="text-xs font-mono font-black">
                                  {opt.isCorrect ? '✓' : '✗'}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>

                        {/* Quiz Feedback */}
                        <AnimatePresence>
                          {makaoQuestionAnswer && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-300"
                            >
                              {makaoQuiz.options.find(o => o.id === makaoQuestionAnswer)?.feedback}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TYSIĄC GUIDE */}
              {activeTab === 'tysiac' && (
                <div className="space-y-6">
                  {/* General details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/15">
                      <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-yellow-400 mb-1.5">Melduj Marjaże (Pary)</h3>
                      <p className="text-xs text-slate-350 leading-relaxed mb-3">
                        Gdy posiadasz Króla i Damę tego samego koloru, możesz zgłosić tzw. meldunek/marjaż. Czyni to ten kolor „Atutem” (kozerą), dodając premię punktową:
                      </p>
                      <ul className="space-y-1 text-xs font-mono text-slate-300">
                        <li className="flex justify-between border-b border-white/5 pb-1"><span>♥️ Kier:</span> <span className="text-red-400 font-bold">100 pkt</span></li>
                        <li className="flex justify-between border-b border-white/5 pb-1"><span>♦️ Karo:</span> <span className="text-amber-400 font-bold">80 pkt</span></li>
                        <li className="flex justify-between border-b border-white/5 pb-1"><span>♣️ Trefl:</span> <span className="text-sky-400 font-bold">60 pkt</span></li>
                        <li className="flex justify-between border-b border-white/5 pb-1"><span>♠️ Pik:</span> <span className="text-purple-400 font-bold">40 pkt</span></li>
                      </ul>
                    </div>

                    <div className="p-4 bg-white/5 rounded-2xl border border-white/15">
                      <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-yellow-400 mb-1.5">Licytacja i Musik</h3>
                      <p className="text-xs text-slate-350 leading-relaxed">
                        Gra toczy się do 1000 pkt. Na początku rundy gracze licytują, kto zdobędzie najwięcej punktów, opierając się na swoich kartach i meldunkach. Zwycięzca bierze 3 karty z „Musika” leżącego na stole, rozdaje po 1 karcie rywalom, i stara się ugrać zadeklarowaną kwotę. Jeśli mu się nie uda (wpadka) – zadeklarowana wartość jest mu odejmowana!
                      </p>
                    </div>
                  </div>

                  {/* INTERACTIVE CALCULATOR FOR CARD VALUES */}
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                    <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200 mb-2 flex items-center gap-1.5">
                      <RotateCw className="w-4 h-4 text-yellow-500 animate-spin-slow" /> Wartości Lew i Kart w Tysiącu
                    </h3>
                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      W Tysiącu liczą się tylko te 24 karty (od dziewiątki do asa). Wybierz karty, które zdobyłeś w wirtualnej lewie, aby przetestować Offline Kalkulator ich wartości:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5 mb-6">
                      {tysiacCardsData.map((c) => {
                        const isSelected = selectedTysiacCards.includes(c.code);
                        return (
                          <div 
                            key={c.code}
                            onClick={() => handleTysiacCardClick(c.code)}
                            className={`p-3.5 rounded-2xl border cursor-pointer text-center transition-all ${
                              isSelected 
                                ? 'border-yellow-500 bg-yellow-500/10 scale-102 font-bold ring-2 ring-yellow-500/20' 
                                : 'bg-slate-900 border-white/5 hover:border-white/15'
                            }`}
                          >
                            <span className={`text-xl font-extrabold ${c.style} block`}>{c.code}</span>
                            <span className="text-[10px] text-slate-300 block font-sans truncate mt-1">{c.name}</span>
                            <span className="text-[10px] text-yellow-400 font-mono block mt-1">+{c.value} PKT</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium">Suma punktów w wybranej lewie:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-black text-yellow-400">{calculatedTysiacPoints} PKT</span>
                        {selectedTysiacCards.length > 0 && (
                          <button 
                            onClick={() => setSelectedTysiacCards([])}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[9px] font-mono tracking-tight text-slate-400 hover:text-white transition-all uppercase"
                          >
                            Wyczyść
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* MINI QUIZ FOR MARIAGE SCORE */}
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                    <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200 mb-3">
                      Szybki Quiz: Suma gry
                    </h3>
                    <p className="text-xs text-slate-350 leading-relaxed mb-4">
                      Rozgrywasz partię. Masz zameldowany <strong>Meldunek Kier (100 pkt)</strong> i zdobyłeś lewy zawierające: <strong>Asa, Dziesiątkę, oraz Króla</strong>. Ile punktów zdobywasz w sumie?
                    </p>

                    <div className="flex gap-2">
                      {[
                        { val: 121, text: "121 punktów", isCorrect: false },
                        { val: 125, text: "125 punktów", isCorrect: true, feedback: "Znakomicie! Meldunek Kier (100) + As (11) + Dziesiątka (10) + Król (4) = 125 punktów! ✅" },
                        { val: 100, text: "100 punktów", isCorrect: false },
                        { val: 115, text: "115 punktów", isCorrect: false }
                      ].map((ans, aIdx) => (
                        <button
                          key={aIdx}
                          onClick={() => setTysiacQuizAnswer(aIdx)}
                          className={`flex-1 py-3 text-xs font-mono rounded-xl border transition-all ${
                            tysiacQuizAnswer === aIdx 
                              ? ans.isCorrect
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold'
                                : 'border-rose-500 bg-rose-500/10 text-rose-300 font-bold'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          {ans.text}
                        </button>
                      ))}
                    </div>

                    {tysiacQuizAnswer !== null && (
                      <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-350">
                        {tysiacQuizAnswer === 1 
                          ? "Znakomicie! Meldunek Kier (100) + As (11) + Dziesiątka (10) + Król (4) = 125 punktów! ✅" 
                          : "Spróbuj jeszcze raz! Zsumuj odpowiednie wartości kart (As: 11, Dziesiątka: 10, Król: 4) oraz meldunku (100)."}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Footer containing quick start action */}
            <footer className="p-5 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-center sm:text-left">
                <p className="text-xs text-slate-300">Nauka reguł zakończona? Zmierz się ze sztuczną inteligencją!</p>
                <p className="text-[10px] text-slate-500 font-mono">Gry działają offline w trybie solo lub pass & play</p>
              </div>
              <button 
                onClick={onClose}
                className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs uppercase font-mono tracking-wider rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.01] active:scale-95"
              >
                Graj już teraz! <Play className="w-3.5 h-3.5 inline ml-1 fill-current" />
              </button>
            </footer>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
