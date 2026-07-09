import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Video, Phone, User, X, Plus, Lock, Palette, Gamepad2, ChevronLeft, ChevronRight, Settings, Menu, Mic, Search, Smile, Edit2, Trash2, Volume2, Reply, Link as LinkIcon, MessageCircle, LogOut, Users, Play, Check, Pen, Type, ArrowRight, Home, SkipForward, Clock, ZoomIn, ZoomOut, Move, PenTool, Ghost, Pin, PinOff } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDoc, getDocs } from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';

// 🌟 あなた専用のFirebase設定
const firebaseConfig = {
  apiKey: "AIzaSyBcPnvsqAafiyth0Iux7WKanmTpKJgzFu4",
  authDomain: "test-374ce.firebaseapp.com",
  projectId: "test-374ce",
  storageBucket: "test-374ce.firebasestorage.app",
  messagingSenderId: "916695405364",
  appId: "1:916695405364:web:7ad09da5d49df8354f8b61",
  measurementId: "G-K80D68P0GP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const messaging = typeof window !== 'undefined' && 'serviceWorker' in navigator ? getMessaging(app) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ★ 先ほど作成したGASロボットのURL
const GAS_URL = "https://script.google.com/macros/s/AKfycbyJ10Y6_oEL402L_gpOY8INVgag1giFz_l5a_OqMfbw0l-RAzvw8l5J1NuQoyrHo_vKIQ/exec";

// Firestoreのパス生成ヘルパー
const getPublicCollection = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
const getPublicDoc = (colName, docId) => doc(db, 'artifacts', appId, 'public', 'data', colName, docId);
const getMessagesCollection = () => collection(db, 'artifacts', appId, 'public', 'data', 'messages');
const getMessageDoc = (msgId) => doc(db, 'artifacts', appId, 'public', 'data', 'messages', msgId);

// 🌸 ゆるふわスタンプリスト
const cuteStamps = [
  'おつかれ☕', 'よろしく✨', 'ありがとう💖', 'ごめんね💦', 
  'すごい🎉', 'それな👍', 'なるほど👀', '草😂',
  'わーい🙌', 'やったー😆', 'えっ😳', 'まじか💦',
  'OK🙆‍♀️', 'NG🙅‍♀️', '待って✋', '了解🫡',
  '🥺ぴえん', '尊い🙏', '天才✨', '神😇'
];

// 🐺 ワードウルフお題リスト
const WORD_PAIRS = [
  ['りんご', 'みかん'], ['うどん', 'そば'], ['海', '山'], ['犬', '猫'], ['動物園', '水族館'],
  ['コーラ', 'サイダー'], ['スマホ', 'パソコン'], ['夏休み', '冬休み'], ['ラーメン', 'カレー'],
  ['朝', '夜'], ['晴れ', '雨'], ['映画館', '美術館'], ['カラオケ', 'ボウリング'],
  ['勇者', '魔王'], ['忍者', '侍'], ['友達', '恋人'], ['過去', '未来']
];

// 📸 画像圧縮ユーティリティ
const processImageFile = (file, maxSizeMB = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject("画像ファイルを選択してください。");
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 1920; 
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        const targetBytes = maxSizeMB * 1024 * 1024;
        
        while (dataUrl.length > targetBytes && quality > 0.1) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject("画像の読み込みに失敗しました");
      img.src = event.target.result;
    };
    reader.onerror = () => reject("ファイルの読み込みに失敗しました");
    reader.readAsDataURL(file);
  });
};

// ==========================================
// 🎨 ガーティックフォン コンポーネント群
// ==========================================
const DrawingCanvas = ({ previousWord, onSubmit, initialTime = 60 }) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const canvasRef = useRef(null);
  const [undoStack, setUndoStack] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const isAutoSubmitted = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [isPanMode, setIsPanMode] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preventScroll = (e) => { if (!isPanMode) e.preventDefault(); };
    canvas.addEventListener('touchstart', preventScroll, { passive: false });
    canvas.addEventListener('touchmove', preventScroll, { passive: false });
    
    if (undoStack.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setUndoStack([canvas.toDataURL()]);
    }
    return () => {
      canvas.removeEventListener('touchstart', preventScroll);
      canvas.removeEventListener('touchmove', preventScroll);
    };
  }, [isPanMode, undoStack.length]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isAutoSubmitted.current) {
      isAutoSubmitted.current = true;
      onSubmit(canvasRef.current.toDataURL());
    }
  }, [timeLeft, onSubmit]);

  const startDrawing = (e) => {
    if (isPanMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * scaleX;
    const y = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * scaleY;
    ctx.beginPath(); ctx.moveTo(x, y); setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || isPanMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * scaleX;
    const y = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * scaleY;
    ctx.lineTo(x, y); ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && !isPanMode) {
      setIsDrawing(false);
      setUndoStack(prev => [...prev, canvasRef.current.toDataURL()]);
    }
  };

  const undo = () => {
    if (undoStack.length <= 1) return;
    const newStack = [...undoStack]; newStack.pop();
    const previousState = newStack[newStack.length - 1];
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    const img = new Image(); img.src = previousState;
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
    setUndoStack(newStack);
  };

  const colors = ['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#ffffff'];

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto space-y-4 p-4">
      <div className="bg-yellow-100 border-4 border-yellow-400 p-4 rounded-2xl w-full text-center shadow-md">
        <h3 className="text-sm text-yellow-800 font-bold mb-1">このお題を描いて！</h3>
        <p className="text-2xl font-extrabold text-gray-800 tracking-wider">{previousWord}</p>
      </div>
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center space-x-2 text-red-500 font-bold bg-red-100 px-4 py-2 rounded-full"><Clock size={16} /><span>残り {timeLeft}秒</span></div>
        <button onClick={() => { isAutoSubmitted.current = true; onSubmit(canvasRef.current.toDataURL()); }} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full font-bold shadow-md transform active:scale-95">完成！</button>
      </div>
      <div className="flex justify-between items-center w-full bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
        <div className="flex gap-2">
          <button onClick={() => setIsPanMode(false)} className={`p-2 rounded-lg transition ${!isPanMode ? 'bg-indigo-100 text-indigo-700 font-bold shadow-inner' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}><PenTool size={18}/></button>
          <button onClick={() => setIsPanMode(true)} className={`p-2 rounded-lg transition ${isPanMode ? 'bg-indigo-100 text-indigo-700 font-bold shadow-inner' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}><Move size={18}/></button>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg"><ZoomOut size={18}/></button>
          <span className="text-xs font-black w-10 text-center text-gray-700">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.5))} className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg"><ZoomIn size={18}/></button>
        </div>
      </div>
      <div className="bg-gray-100 p-1 rounded-2xl shadow-inner border-2 border-gray-200 w-full overflow-auto max-h-[50vh] relative">
        <canvas ref={canvasRef} width={800} height={600} style={{ width: `${100 * zoom}%`, height: 'auto', touchAction: isPanMode ? 'auto' : 'none' }} className={`bg-white shadow-sm transition-transform origin-top-left ${isPanMode ? 'cursor-grab' : 'cursor-crosshair'}`} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
      </div>
      <div className="flex flex-wrap gap-2 justify-center w-full bg-white p-3 rounded-2xl shadow-md border-2 border-gray-200">
        <div className="flex gap-2 mr-4 border-r-2 border-gray-200 pr-4">
          {colors.map(c => ( <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-800 scale-110' : 'border-gray-300'} shadow-sm`} style={{ backgroundColor: c }} /> ))}
        </div>
        <div className="flex gap-4 items-center">
          <input type="range" min="1" max="30" value={lineWidth} onChange={(e) => setLineWidth(e.target.value)} className="w-24 accent-indigo-500" />
          <button onClick={undo} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"><ChevronLeft size={20}/></button>
        </div>
      </div>
    </div>
  );
};

const WordInput = ({ previousImage, onSubmit, isFirstRound = false, initialTime = 45 }) => {
  const [text, setText] = useState('');
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const isAutoSubmitted = useRef(false);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isAutoSubmitted.current) {
      isAutoSubmitted.current = true;
      onSubmit(text.trim() || '（無言）');
    }
  }, [timeLeft, text, onSubmit]);

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto space-y-6 p-4">
      <div className="flex justify-between items-center w-full">
        <h3 className="text-lg font-bold text-gray-700">{isFirstRound ? '最初のお題を決めよう！' : 'この絵は何を描いている？'}</h3>
        <div className="flex items-center space-x-2 text-red-500 font-bold bg-red-100 px-4 py-2 rounded-full shadow-sm"><Clock size={16} /><span>残り {timeLeft}秒</span></div>
      </div>
      {!isFirstRound && previousImage && (
        <div className="bg-white p-3 rounded-2xl shadow-xl border-4 border-indigo-200 w-full"><img src={previousImage} className="w-full h-auto aspect-[4/3] object-contain rounded-xl" alt="previous" /></div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !isAutoSubmitted.current) { isAutoSubmitted.current = true; onSubmit(text.trim()); } }} className="w-full flex flex-col space-y-4">
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={isFirstRound ? "例：リンゴを食べるゴリラ" : "絵が表している言葉を入力..."} className="w-full px-6 py-4 text-xl rounded-2xl border-4 border-indigo-200 focus:border-indigo-500 outline-none shadow-inner" autoFocus />
        <button type="submit" disabled={!text.trim()} className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 text-white rounded-2xl font-bold text-xl shadow-lg">送信する</button>
      </form>
    </div>
  );
};

const GarticGame = ({ gameId, user, profile, onClose }) => {
  const [gameData, setGameData] = useState(null);
  const [hasSubmittedThisRound, setHasSubmittedThisRound] = useState(false);
  const resultScrollRef = useRef(null);

  useEffect(() => {
    if (!gameId || !user) return;
    const unsub = onSnapshot(
      getPublicDoc('games', gameId),
      (docSnap) => { if (docSnap.exists()) setGameData(docSnap.data()); else onClose(); },
      (error) => console.error(error)
    );
    return () => unsub();
  }, [gameId, user, onClose]);

  useEffect(() => {
    if (!gameData || gameData.status !== 'playing' || gameData.hostId !== user?.uid) return;
    const allSubmitted = gameData.players.every(p => (gameData.chains[p.id] || []).length === gameData.currentRound + 1);
    if (allSubmitted) {
      const nextRound = gameData.currentRound + 1;
      const gameRef = getPublicDoc('games', gameId);
      if (nextRound >= gameData.players.length) updateDoc(gameRef, { status: 'finished' });
      else updateDoc(gameRef, { currentRound: nextRound });
    }
  }, [gameData, user, gameId]);

  useEffect(() => { if (gameData?.status === 'playing') setHasSubmittedThisRound(false); }, [gameData?.currentRound, gameData?.status]);
  useEffect(() => { if (gameData?.status === 'finished') resultScrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [gameData?.resultState?.entryIndex, gameData?.resultState?.playerIndex, gameData?.status]);

  if (!gameData) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div></div>;

  const isHost = gameData.hostId === user.uid;
  const me = gameData.players.find(p => p.id === user.uid);
  const allReady = gameData.players.every(p => p.ready);

  const updateSettings = async (timeLimit) => updateDoc(getPublicDoc('games', gameId), { 'settings.timeLimit': timeLimit });
  const toggleReady = async () => updateDoc(getPublicDoc('games', gameId), { players: gameData.players.map(p => p.id === user.uid ? { ...p, ready: !p.ready } : p) });
  const startGame = async () => {
    const initialChains = {}; gameData.players.forEach(p => { initialChains[p.id] = []; });
    await updateDoc(getPublicDoc('games', gameId), { status: 'playing', currentRound: 0, chains: initialChains, resultState: { playerIndex: 0, entryIndex: 0 } });
  };
  const submitTurn = async (value) => {
    if (hasSubmittedThisRound) return; setHasSubmittedThisRound(true);
    const myIndex = gameData.players.findIndex(p => p.id === user.uid);
    const targetIndex = (myIndex - gameData.currentRound + gameData.players.length * 100) % gameData.players.length;
    const targetChainId = gameData.players[targetIndex].id;
    const newEntry = { type: gameData.currentRound % 2 === 0 ? 'word' : 'draw', value, authorId: user.uid, authorName: profile.name };
    await updateDoc(getPublicDoc('games', gameId), { [`chains.${targetChainId}`]: arrayUnion(newEntry) }).catch(() => setHasSubmittedThisRound(false));
  };
  const forceNextRound = async () => {
    const updates = {}; let missing = 0;
    gameData.players.forEach((p, idx) => {
      const targetIndex = (idx - gameData.currentRound + gameData.players.length * 100) % gameData.players.length;
      const tId = gameData.players[targetIndex].id;
      if ((gameData.chains[tId] || []).length === gameData.currentRound) {
        missing++; const isWord = gameData.currentRound % 2 === 0;
        updates[`chains.${tId}`] = arrayUnion({ type: isWord ? 'word' : 'draw', value: isWord ? '（スキップ）' : '', authorId: p.id, authorName: p.name + ' (スキップ)' });
      }
    });
    if (missing > 0) await updateDoc(getPublicDoc('games', gameId), updates);
  };

  if (gameData.status === 'lobby') {
    return (
      <div className="flex-1 flex flex-col bg-indigo-50 overflow-y-auto">
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center shadow-md relative">
          <button onClick={onClose} className="absolute left-4 top-6 p-2 bg-white/20 hover:bg-white/30 rounded-full"><X size={20}/></button>
          <h2 className="text-2xl font-extrabold mb-1">お絵描き伝言ゲーム</h2>
        </div>
        <div className="p-4 flex-1">
          {isHost && (
            <div className="mb-4 bg-white p-4 rounded-2xl border-2 border-indigo-100 flex items-center justify-between">
              <div><h4 className="font-bold text-indigo-700 flex items-center"><Settings size={16} className="mr-1"/> ゲーム設定</h4><p className="text-[10px] text-gray-500 font-bold mt-0.5">※ホストのみ変更可能</p></div>
              <div className="flex items-center"><input type="number" min="10" max="300" step="10" value={gameData.settings?.timeLimit || 60} onChange={(e) => updateSettings(Number(e.target.value))} className="w-16 border-2 border-indigo-200 rounded-lg p-2 text-center font-black outline-none" /><span className="text-xs font-bold text-gray-600 ml-1">秒</span></div>
            </div>
          )}
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-gray-700 flex items-center"><Users size={18} className="mr-1"/> 参加者 ({gameData.players.length}人)</h3>
          </div>
          <div className="space-y-2 mb-6">
            {gameData.players.map(p => (
              <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl border ${p.ready ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                <span className="font-bold text-gray-700">{p.id === gameData.hostId && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full mr-2">ホスト</span>}{p.name}</span>
                {p.ready ? <span className="text-green-600 text-xs font-bold flex items-center"><Check size={14} className="mr-1"/>準備OK</span> : <span className="text-gray-400 text-xs font-bold">準備中...</span>}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <button onClick={toggleReady} className={`w-full py-4 rounded-2xl font-black text-white shadow-md transition ${me?.ready ? 'bg-gray-400' : 'bg-green-500'}`}>{me?.ready ? '準備をキャンセル' : '準備完了！'}</button>
            {isHost && <button onClick={startGame} disabled={!allReady || gameData.players.length < 2} className="w-full py-4 bg-indigo-600 disabled:bg-gray-300 text-white rounded-2xl font-black flex justify-center items-center"><Play size={20} className="mr-2"/> ゲームを開始</button>}
          </div>
        </div>
      </div>
    );
  }

  if (gameData.status === 'playing') {
    const myIndex = gameData.players.findIndex(p => p.id === user.uid);
    const targetIndex = (myIndex - gameData.currentRound + gameData.players.length * 100) % gameData.players.length;
    const targetChain = gameData.chains[gameData.players[targetIndex].id] || [];
    const timeLimit = gameData.settings?.timeLimit || 60;
    if (targetChain.length < gameData.currentRound) return <div className="flex-1 flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500"></div></div>;
    const isWordRound = gameData.currentRound % 2 === 0;
    return (
      <div className="flex-1 flex flex-col bg-gray-50 overflow-y-auto relative">
        <button onClick={onClose} className="absolute left-2 top-2 p-2 bg-gray-200 rounded-full z-10"><X size={16}/></button>
        <div className="text-center py-4 bg-white shadow-sm"><span className="font-extrabold text-indigo-600 text-lg">ラウンド {gameData.currentRound + 1} / {gameData.players.length}</span></div>
        <div className="flex-1 flex flex-col">
          {hasSubmittedThisRound ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4"><Check className="text-green-500 w-10 h-10" /></div>
              <h2 className="text-xl font-bold text-gray-700">送信完了！</h2>
              {isHost && <button onClick={forceNextRound} className="mt-8 flex items-center px-4 py-2 bg-red-100 text-red-600 rounded-lg font-bold"><SkipForward size={16} className="mr-1" /> 強制スキップ</button>}
            </div>
          ) : (
            isWordRound ? <WordInput initialTime={timeLimit} isFirstRound={gameData.currentRound === 0} previousImage={gameData.currentRound > 0 ? targetChain[targetChain.length - 1].value : null} onSubmit={submitTurn} />
                        : <DrawingCanvas initialTime={timeLimit} previousWord={targetChain[targetChain.length - 1].value} onSubmit={submitTurn} />
          )}
        </div>
      </div>
    );
  }

  if (gameData.status === 'finished') {
    const rState = gameData.resultState || { playerIndex: 0, entryIndex: 0 };
    const isDone = rState.playerIndex === 'done';
    const albumPlayer = !isDone ? gameData.players[rState.playerIndex] : null;
    const chains = albumPlayer ? (gameData.chains[albumPlayer.id] || []) : [];
    const visibleChains = chains.slice(0, rState.entryIndex + 1);

    const handleNextResult = async () => {
      let pIdx = rState.playerIndex; let eIdx = rState.entryIndex;
      const tChain = gameData.chains[gameData.players[pIdx].id];
      if (eIdx < tChain.length - 1) eIdx++;
      else if (pIdx < gameData.players.length - 1) { pIdx++; eIdx = 0; }
      else pIdx = 'done';
      await updateDoc(getPublicDoc('games', gameId), { 'resultState.playerIndex': pIdx, 'resultState.entryIndex': eIdx });
    };

    return (
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden relative">
        <button onClick={onClose} className="absolute left-2 top-2 p-2 bg-white rounded-full z-20 shadow-sm"><X size={16}/></button>
        <div className="p-4 text-center bg-white shadow-sm z-10 flex-shrink-0">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-500">結果発表！</h2>
          {!isDone && <p className="text-xs text-gray-500 font-bold mt-1">みんなで順番に見ていきます</p>}
        </div>
        {isDone ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
             <h3 className="text-2xl font-extrabold text-indigo-600 mb-6">全結果の発表が終了🎉</h3>
             {isHost && <button onClick={() => updateDoc(getPublicDoc('games', gameId), { status: 'lobby', currentRound: 0, chains: {} })} className="px-8 py-4 bg-indigo-500 text-white rounded-full font-bold shadow-xl"><Home className="inline mr-2"/> もう一度遊ぶ</button>}
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 border-b border-indigo-100 flex justify-center items-center shadow-sm z-10 flex-shrink-0">
              <h3 className="font-bold text-gray-800 text-base"><span className="text-indigo-600 border-b-2 border-indigo-600 pb-0.5">{albumPlayer?.name}</span> の伝言</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {visibleChains.map((entry, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full mb-2 shadow-sm flex items-center">{idx % 2 === 0 ? <Type size={10} className="mr-1"/> : <Pen size={10} className="mr-1"/>} {entry.authorName}</div>
                  <div className={`w-full max-w-lg bg-white p-4 rounded-2xl shadow-md border-2 ${idx % 2 === 0 ? 'border-indigo-200' : 'border-yellow-200'} text-center`}>
                    {entry.type === 'word' ? <p className="text-xl font-extrabold text-gray-800 whitespace-pre-wrap">{entry.value}</p> : entry.value ? <img src={entry.value} className="w-full h-auto rounded-lg border border-gray-100" alt="drawing" /> : <div className="p-6 bg-gray-100 text-gray-400 rounded-lg text-sm font-bold">スキップ</div>}
                  </div>
                  {idx < visibleChains.length - 1 && <ArrowRight size={24} className="text-indigo-300 my-4 rotate-90" />}
                </div>
              ))}
              <div ref={resultScrollRef} className="h-4" />
            </div>
            {isHost ? (
              <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0"><button onClick={handleNextResult} className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black shadow-lg">次を見る <ChevronRight className="inline"/></button></div>
            ) : (<div className="p-4 bg-gray-50 border-t border-gray-200 text-center flex-shrink-0"><p className="text-sm font-bold text-gray-500 animate-pulse">ホストが進行中...</p></div>)}
          </>
        )}
      </div>
    );
  }
  return null;
};

// ==========================================
// 🐺 ワードウルフ コンポーネント群
// ==========================================
const WordWolfGame = ({ gameId, user, profile, onClose }) => {
  const [gameData, setGameData] = useState(null);
  const [timeLeft, setTimeLeft] = useState('00:00');

  useEffect(() => {
    if (!gameId || !user) return;
    const unsub = onSnapshot(getPublicDoc('ww_games', gameId), (docSnap) => {
      if (docSnap.exists()) setGameData(docSnap.data()); else onClose();
    }, (error) => console.error(error));
    return () => unsub();
  }, [gameId, user, onClose]);

  // タイマー処理
  useEffect(() => {
    if (gameData?.state === 'playing' && gameData?.gameData?.endTime) {
      const interval = setInterval(() => {
        const remain = gameData.gameData.endTime - Date.now();
        if (remain <= 0) {
          setTimeLeft('00:00');
          clearInterval(interval);
          if (gameData.hostId === user.uid) {
            updateDoc(getPublicDoc('ww_games', gameId), { state: 'result' });
          }
        } else {
          const m = Math.floor(remain / 60000).toString().padStart(2, '0');
          const s = Math.floor((remain % 60000) / 1000).toString().padStart(2, '0');
          setTimeLeft(`${m}:${s}`);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [gameData?.state, gameData?.gameData?.endTime, gameData?.hostId, user.uid, gameId]);

  if (!gameData) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div></div>;

  const isHost = gameData.hostId === user.uid;
  const activePlayers = gameData.players.filter(p => !p.isSpectator);
  const spectators = gameData.players.filter(p => p.isSpectator);

  const updateSettings = async (field, value) => {
    if (!isHost) return;
    await updateDoc(getPublicDoc('ww_games', gameId), { [`settings.${field}`]: value });
  };

  const startGame = async () => {
    if (activePlayers.length < 3) return alert("3人以上必要です");
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    const isReversed = Math.random() > 0.5;
    const citizenWord = isReversed ? pair[1] : pair[0];
    const wolfWord = isReversed ? pair[0] : pair[1];

    let rolesArr = Array(activePlayers.length).fill('citizen');
    for(let i = 0; i < gameData.settings.wolves; i++) { if(i < rolesArr.length) rolesArr[i] = 'wolf'; }
    // 役職シャッフル
    for (let i = rolesArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolesArr[i], rolesArr[j]] = [rolesArr[j], rolesArr[i]];
    }

    let rolesMap = {}; let wordsMap = {};
    activePlayers.forEach((p, index) => {
      const r = rolesArr[index];
      rolesMap[p.id] = r;
      wordsMap[p.id] = r === 'citizen' ? citizenWord : wolfWord;
    });

    const endTime = Date.now() + (gameData.settings.timeMinutes * 60 * 1000) + 2000;
    await updateDoc(getPublicDoc('ww_games', gameId), {
      state: 'playing',
      gameData: { citizenWord, wolfWord, roles: rolesMap, words: wordsMap, endTime }
    });
  };

  const endDiscussion = async () => {
    if (!isHost) return;
    await updateDoc(getPublicDoc('ww_games', gameId), { state: 'result' });
  };

  const backToLobby = async () => {
    if (!isHost) return;
    await updateDoc(getPublicDoc('ww_games', gameId), { state: 'lobby', gameData: null });
  };

  if (gameData.state === 'lobby') {
    return (
      <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto text-white">
        <div className="p-6 bg-gradient-to-r from-slate-800 to-indigo-950 text-center shadow-md relative border-b border-indigo-500/30">
          <button onClick={onClose} className="absolute left-4 top-6 p-2 bg-white/10 hover:bg-white/20 rounded-full"><X size={20}/></button>
          <h2 className="text-3xl font-black mb-1 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 tracking-widest">WORD WOLF</h2>
          <p className="text-xs text-indigo-300 font-bold opacity-80">オンラインマルチプレイ</p>
        </div>
        <div className="p-4 flex-1">
          {isHost && (
            <div className="mb-6 bg-slate-800/80 p-5 rounded-2xl border border-indigo-500/30 shadow-lg">
              <h4 className="font-bold text-purple-300 mb-4 text-center border-b border-purple-500/30 pb-2">ホスト設定</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">最大人数 ({gameData.settings.maxPlayers}人)</span>
                  <input type="range" min="3" max="10" value={gameData.settings.maxPlayers} onChange={(e)=>updateSettings('maxPlayers', Number(e.target.value))} className="w-1/2 accent-purple-500"/>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">ウルフ数 ({gameData.settings.wolves}人)</span>
                  <input type="range" min="1" max={Math.max(1, Math.floor(gameData.settings.maxPlayers/2))} value={gameData.settings.wolves} onChange={(e)=>updateSettings('wolves', Number(e.target.value))} className="w-1/2 accent-pink-500"/>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold">議論時間 ({gameData.settings.timeMinutes}分)</span>
                  <input type="range" min="1" max="10" value={gameData.settings.timeMinutes} onChange={(e)=>updateSettings('timeMinutes', Number(e.target.value))} className="w-1/2 accent-blue-500"/>
                </div>
              </div>
            </div>
          )}
          <div className="mb-4">
            <h3 className="font-bold text-gray-400 mb-3 text-sm flex items-center"><Users size={16} className="mr-1"/> プレイヤー ({activePlayers.length}/{gameData.settings.maxPlayers})</h3>
            <div className="grid grid-cols-2 gap-2">
              {activePlayers.map(p => (
                <div key={p.id} className="bg-slate-800 p-2 rounded-xl border border-slate-700 flex items-center gap-2 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0">{p.icon ? <img src={p.icon} className="w-full h-full object-cover" alt="icon"/> : <User size={16} className="m-2 text-gray-400"/>}</div>
                  <span className="font-bold text-sm truncate">{p.name} {p.id === gameData.hostId && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded ml-1">Host</span>}</span>
                </div>
              ))}
            </div>
          </div>
          {spectators.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-400 mb-3 text-sm flex items-center"><Ghost size={16} className="mr-1"/> 観戦者 ({spectators.length})</h3>
              <div className="flex flex-wrap gap-2">
                {spectators.map(p => <div key={p.id} className="bg-slate-800 px-3 py-1 rounded-full text-xs text-gray-300 border border-slate-700">{p.name}</div>)}
              </div>
            </div>
          )}
          {!isHost && <p className="text-center text-sm text-gray-400 my-8 animate-pulse">ホストが開始するのを待っています...</p>}
          {isHost && (
            <button onClick={startGame} disabled={activePlayers.length < 3} className="w-full mt-4 py-4 bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 text-white rounded-2xl font-black text-lg shadow-[0_0_15px_rgba(192,132,252,0.4)] transform active:scale-95 transition">
              {activePlayers.length < 3 ? `3人以上必要です (${activePlayers.length}/3)` : 'ゲームスタート'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (gameData.state === 'playing') {
    const myRoleData = gameData.gameData.words[user.uid];
    const isSpectator = !myRoleData;
    return (
      <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto text-white items-center p-6 relative">
        <button onClick={onClose} className="absolute left-4 top-4 p-2 bg-white/10 rounded-full"><X size={16}/></button>
        <div className="w-full max-w-sm mt-8">
          <div className="bg-slate-800 border-t-4 border-indigo-500 rounded-3xl p-8 text-center shadow-2xl mb-10">
            <p className="text-sm font-bold text-gray-400 mb-2">あなたのお題</p>
            {isSpectator ? (
              <h2 className="text-xl font-black text-pink-400 py-6 leading-tight">あなたは観戦者です<br/>議論を見守りましょう👀</h2>
            ) : (
              <h2 className="text-4xl font-black text-white py-6 leading-tight break-words tracking-widest">{myRoleData}</h2>
            )}
          </div>
          <div className="text-center mb-10">
            <h3 className="text-lg font-bold text-purple-300 mb-4">議論タイム</h3>
            <div className={`w-48 h-48 mx-auto rounded-full bg-slate-800 border-4 ${timeLeft === '00:00' ? 'border-red-500 animate-pulse' : 'border-indigo-500/50'} flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.2)] transition-colors duration-300`}>
                <span className={`text-5xl font-black tracking-widest ${timeLeft === '00:00' ? 'text-red-500' : 'text-white'}`}>{timeLeft}</span>
            </div>
          </div>
          {isHost ? (
            <button onClick={endDiscussion} className="w-full py-4 bg-red-600/80 hover:bg-red-500 text-white rounded-xl font-bold border border-red-500 transition">議論を強制終了する</button>
          ) : (
            <p className="text-center text-sm text-gray-500">ホストが終了するか、時間が来ると結果発表へ進みます</p>
          )}
        </div>
      </div>
    );
  }

  if (gameData.state === 'result') {
    return (
      <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto text-white items-center p-6 relative">
        <button onClick={onClose} className="absolute left-4 top-4 p-2 bg-white/10 rounded-full"><X size={16}/></button>
        <h2 className="text-4xl font-black mb-8 mt-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] tracking-widest">結果発表</h2>
        <div className="w-full max-w-md space-y-6 pb-20">
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl">
            <h3 className="text-center text-gray-400 text-sm font-bold mb-4">今回のお題</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-900/80 rounded-xl p-4 border-l-4 border-blue-500">
                <span className="text-blue-400 font-bold text-sm">多数派 (市民)</span>
                <span className="text-xl font-black">{gameData.gameData.citizenWord}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-900/80 rounded-xl p-4 border-l-4 border-pink-500">
                <span className="text-pink-400 font-bold text-sm">少数派 (ウルフ)</span>
                <span className="text-xl font-black">{gameData.gameData.wolfWord}</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-xl">
            <h3 className="text-center text-gray-400 text-sm font-bold mb-4">プレイヤーの配役</h3>
            <div className="space-y-2">
              {activePlayers.map(p => {
                const role = gameData.gameData.roles[p.id];
                const isWolf = role === 'wolf';
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${isWolf ? 'bg-pink-900/20 border-pink-500/50' : 'bg-slate-900/50 border-slate-700'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden shrink-0">{p.icon ? <img src={p.icon} className="w-full h-full object-cover" alt="icon"/> : <User size={16} className="m-1.5 text-gray-400"/>}</div>
                      <span className="font-bold text-sm">{p.name} {p.id === user.uid && <span className="text-xs text-gray-400 font-normal ml-1">(あなた)</span>}</span>
                    </div>
                    {isWolf ? <span className="text-pink-400 font-bold text-sm drop-shadow-[0_0_5px_rgba(244,114,182,0.8)]">ウルフ 🐺</span> : <span className="text-blue-400 font-bold text-sm">市民 👤</span>}
                  </div>
                )
              })}
            </div>
          </div>
          {isHost ? (
            <button onClick={backToLobby} className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg transition">待機室に戻る</button>
          ) : (
            <p className="text-center text-sm text-gray-500 mt-6 animate-pulse">ホストが待機室に戻るのを待っています...</p>
          )}
        </div>
      </div>
    );
  }
  return null;
}

// ==========================================
// ⚙️ 部屋の設定 モーダル
// ==========================================
const RoomSettingsModal = ({ room, messages, user, allUsers, onClose, setAlertMsg, setCurrentRoom, setTargetGame }) => {
  const [tab, setTab] = useState('general');
  const [roomName, setRoomName] = useState(room.name || '');
  const [roomIcon, setRoomIcon] = useState(room.icon || '');
  const [roomPassword, setRoomPassword] = useState(room.password || '');
  const [confirmAction, setConfirmAction] = useState(null);

  const isHost = room.leaderId === user.uid;
  const isAdmin = isHost || room.subLeaders?.includes(user.uid);
  const isMember = room.members?.includes(user.uid);
  const members = allUsers.filter(u => room.members?.includes(u.id));
  const gallery = messages.filter(m => m.type === 'image' || m.type === 'video');

  const handleSave = async () => {
    await updateDoc(getPublicDoc('rooms', room.id), { name: roomName, icon: roomIcon, password: roomPassword });
    setAlertMsg("設定を保存しました");
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === 'delete') {
        await deleteDoc(getPublicDoc('rooms', room.id));
        setAlertMsg("グループを解散しました。");
        onClose(); setCurrentRoom(null); setTargetGame(null);
      } else if (confirmAction.type === 'kick') {
        await updateDoc(getPublicDoc('rooms', room.id), { members: arrayRemove(confirmAction.payload), banned: arrayUnion(confirmAction.payload) });
      } else if (confirmAction.type === 'giveLeader') {
        await updateDoc(getPublicDoc('rooms', room.id), { leaderId: confirmAction.payload, subLeaders: arrayUnion(user.uid) });
      }
    } catch (err) {
      console.error(err); setAlertMsg("操作に失敗しました。権限を確認してください。");
    }
    setConfirmAction(null);
  };

  const handleToggleAdmin = async (memberId) => {
    if (room.subLeaders?.includes(memberId)) {
      await updateDoc(getPublicDoc('rooms', room.id), { subLeaders: arrayRemove(memberId) });
    } else {
      await updateDoc(getPublicDoc('rooms', room.id), { subLeaders: arrayUnion(memberId) });
    }
  };

  if (room.isDirectMessage) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 text-center relative">
          <button onClick={onClose} className="absolute right-4 top-4 p-1 text-gray-400 hover:bg-gray-100 rounded-full"><X size={20}/></button>
          <h2 className="font-black text-xl mb-2">個別チャット</h2>
          <p className="text-gray-500 text-sm mb-6">ここは2人だけのチャットルームです。</p>
          <button onClick={() => setConfirmAction({ type: 'delete', message: 'チャット履歴を削除しますか？\nお互いに見れなくなります。' })} className="w-full bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition">チャット履歴を削除する</button>
        </div>
        {confirmAction && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center shadow-xl">
              <h3 className="font-bold text-lg text-red-600 mb-2">確認</h3>
              <p className="mb-6 text-gray-600 text-sm whitespace-pre-wrap">{confirmAction.message}</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setConfirmAction(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 rounded-lg font-bold">キャンセル</button>
                <button onClick={executeConfirmAction} className="px-4 py-2 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-lg font-bold">実行する</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] relative">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h2 className="font-bold text-lg text-gray-800">グループ設定</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500"><X size={20}/></button>
        </div>
        <div className="flex border-b border-gray-200 bg-gray-50 text-sm font-bold text-gray-500">
          <button onClick={()=>setTab('general')} className={`flex-1 py-3 border-b-2 transition-colors ${tab==='general'?'border-blue-500 text-blue-600':'border-transparent hover:bg-gray-100'}`}>一般</button>
          <button onClick={()=>setTab('members')} className={`flex-1 py-3 border-b-2 transition-colors ${tab==='members'?'border-blue-500 text-blue-600':'border-transparent hover:bg-gray-100'}`}>メンバー</button>
          <button onClick={()=>setTab('gallery')} className={`flex-1 py-3 border-b-2 transition-colors ${tab==='gallery'?'border-blue-500 text-blue-600':'border-transparent hover:bg-gray-100'}`}>ギャラリー</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {tab === 'general' && (
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-gray-500">グループ名</label>
                <input type="text" value={roomName} onChange={e=>setRoomName(e.target.value)} disabled={!isAdmin} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 mt-1 disabled:opacity-70"/></div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">グループアイコン</label>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {roomIcon ? <img src={roomIcon} className="w-full h-full object-cover" alt="icon" /> : <User size={20} className="m-2.5 text-gray-400"/>}
                  </div>
                  <input type="file" accept="image/*" disabled={!isAdmin} onChange={async (e) => { 
                    const file = e.target.files[0]; if (!file) return; 
                    if (file.size > 20 * 1024 * 1024) return setAlertMsg("画像は20MB以下にしてください"); 
                    try { const compressed = await processImageFile(file, 0.7); setRoomIcon(compressed); } catch(err) { setAlertMsg(err); }
                  }} className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg p-1.5 disabled:opacity-70" />
                </div>
              </div>
              <div><label className="text-xs font-bold text-gray-500">パスワード (空でパスなし)</label>
                <input type="text" value={roomPassword} onChange={e=>setRoomPassword(e.target.value)} disabled={!isAdmin} className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 mt-1 disabled:opacity-70"/></div>
              
              {isAdmin && <button onClick={handleSave} className="w-full bg-blue-500 text-white font-bold py-2 rounded-lg hover:bg-blue-600 mt-2">設定を保存する</button>}
              {!isAdmin && <p className="text-xs text-red-500 text-center mt-2 border-b border-gray-100 pb-4">設定変更は管理者のみ可能です</p>}

              {isMember && (
                <div className="mt-8 pt-4 border-t border-gray-200">
                  <button onClick={() => setConfirmAction({ type: 'delete', message: '本当にこのグループを解散（削除）しますか？' })} className="w-full bg-red-50 text-red-600 border border-red-200 font-bold py-3 rounded-xl hover:bg-red-100 transition flex items-center justify-center gap-2">
                    <Trash2 size={18} /> このグループを解散（削除）する
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === 'members' && (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex justify-between items-center p-2 border border-gray-100 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden">{m.icon ? <img src={m.icon} className="w-full h-full object-cover" alt="user" /> : <User size={16} className="m-2 text-gray-400"/>}</div>
                    <span className="font-bold text-sm text-gray-700">
                      {m.name} 
                      {room.leaderId === m.id && <span className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full ml-1">リーダー</span>}
                      {room.subLeaders?.includes(m.id) && <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full ml-1">管理者</span>}
                    </span>
                  </div>
                  {isHost && m.id !== user.uid && (
                    <div className="flex gap-1 flex-col sm:flex-row items-end">
                      <button onClick={() => handleToggleAdmin(m.id)} className={`text-[10px] px-2 py-1 rounded transition ${room.subLeaders?.includes(m.id) ? 'bg-gray-100 text-gray-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {room.subLeaders?.includes(m.id) ? '管理者を外す' : '管理者にする'}
                      </button>
                      <button onClick={() => setConfirmAction({ type: 'giveLeader', payload: m.id, message: 'リーダー権限を譲渡しますか？' })} className="text-[10px] bg-yellow-50 text-yellow-600 px-2 py-1 rounded hover:bg-yellow-100">リーダー譲渡</button>
                      <button onClick={() => setConfirmAction({ type: 'kick', payload: m.id, message: '本当にキックしますか？' })} className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded hover:bg-red-100">キック</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {tab === 'gallery' && (
            <div className="grid grid-cols-3 gap-2">
              {gallery.length===0 && <p className="col-span-3 text-center text-sm text-gray-400 py-4">写真や動画がありません</p>}
              {gallery.map(m => (
                <div key={m.id} className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 cursor-pointer">
                  {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover" alt="gallery item" /> : <video src={m.url} className="w-full h-full object-cover"/>}
                </div>
              ))}
            </div>
          )}
        </div>
        {confirmAction && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center shadow-xl">
              <h3 className="font-bold text-lg text-red-600 mb-2">確認</h3>
              <p className="mb-6 text-gray-600 text-sm whitespace-pre-wrap">{confirmAction.message}</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setConfirmAction(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 rounded-lg font-bold">キャンセル</button>
                <button onClick={executeConfirmAction} className="px-4 py-2 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-lg font-bold">実行する</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 📱 メイン App コンポーネント
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: '', icon: '', bio: '' });
  const [appState, setAppState] = useState('login');
  const [activeTab, setActiveTab] = useState('rooms');
  
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [targetGame, setTargetGame] = useState(null); 
  const [activeCall, setActiveCall] = useState(null); // 通話機能のステート
  
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [notifPerm, setNotifPerm] = useState(window.Notification ? Notification.permission : 'default');

  const [alertMsg, setAlertMsg] = useState("");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomData, setNewRoomData] = useState({ name: '', password: '', icon: '' });
  const [joinRoomTarget, setJoinRoomTarget] = useState(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [confirmLeaveRoom, setConfirmLeaveRoom] = useState(null); 
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [targetUserModal, setTargetUserModal] = useState(null);

  const [allUsers, setAllUsers] = useState([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [showStampModal, setShowStampModal] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textInputRef = useRef(null);

  // 1. Auth Init
  useEffect(() => {
    const initAuth = async () => { 
      try { 
        await signInAnonymously(auth);
      } catch (e) { 
        console.error("SignIn error:", e); 
      } 
    };
    initAuth();
    
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // ユーザープロフィールの取得
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(getPublicDoc('users', user.uid), (snap) => { 
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        if (appState === 'login' && data.name) {
          setAppState('main');
          setActiveTab('rooms');
        }
      }
    }, (err) => console.error(err));
    
    updateDoc(getPublicDoc('users', user.uid), { isOnline: true }).catch(()=>{});
    const handleUnload = () => updateDoc(getPublicDoc('users', user.uid), { isOnline: false }).catch(()=>{});
    window.addEventListener('beforeunload', handleUnload);
    return () => { unsub(); window.removeEventListener('beforeunload', handleUnload); };
  }, [user, appState]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(getPublicCollection('users'), (snap) => {
      const u = []; snap.forEach(d => u.push({ id: d.id, ...d.data() })); setAllUsers(u);
    }, (err) => console.error(err));
    return () => unsub();
  }, [user]);

  // ルームの取得とフィルタリング
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(getPublicCollection('rooms'), (snapshot) => {
      const rm = [];
      snapshot.forEach(d => rm.push({ id: d.id, ...d.data() }));
      rm.sort((a, b) => b.createdAt - a.createdAt); 
      setRooms(rm);
      
      if (currentRoom) {
        const updated = rm.find(r => r.id === currentRoom.id);
        if (updated) {
          if (updated.banned?.includes(user.uid) || !updated.members?.includes(user.uid)) {
            setAlertMsg("この部屋から退出しました。");
            setCurrentRoom(null); setTargetGame(null); setActiveTab('rooms');
          } else { setCurrentRoom(updated); }
        } else {
          setCurrentRoom(null); setTargetGame(null); setActiveTab('rooms');
        }
      }
    }, (err) => console.error(err));
    return () => unsub();
  }, [user, currentRoom?.id]);

  // メッセージの取得
  useEffect(() => {
    if (!currentRoom?.id || !user?.uid) return;
    let isInitialLoad = true;
    const loadTime = Date.now();
    
    const unsub = onSnapshot(getMessagesCollection(), (snapshot) => {
      const fetchedMsgs = [];
      const unreadDocs = [];
      
      snapshot.forEach(d => {
        const data = d.data();
        if (data.roomId === currentRoom.id) {
          fetchedMsgs.push({ id: d.id, ...data });
          if (data.senderId !== user.uid && (!data.readBy || !data.readBy.includes(user.uid))) unreadDocs.push(d.id);
        }
      });

      // 新規メッセージのブラウザ通知
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.roomId === currentRoom.id && !isInitialLoad && data.senderId !== user.uid && data.createdAt > loadTime) {
             if (window.Notification && Notification.permission === "granted") {
               let body = data.text;
               if (data.type === 'game_invite') body = '🎨 お絵描き伝言ゲームに招待されました！';
               else if (data.type === 'ww_invite') body = '🐺 ワードウルフに招待されました！';
               else if (data.type === 'image') body = '📷 画像が送信されました';
               else if (data.type === 'video') body = '🎥 動画が送信されました';
               else if (data.type === 'call_start') body = '📞 通話が開始されました！';
               try { new Notification(`${data.senderName} (${currentRoom.name || '個別チャット'})`, { body, icon: data.senderIcon }); } catch(e) {}
             }
          }
        }
      });
      isInitialLoad = false;
      
      fetchedMsgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      setMessages(prev => {
        const pendingMsgs = prev.filter(p => p.isPending && !fetchedMsgs.some(f => f.id === p.id));
        const merged = [...fetchedMsgs, ...pendingMsgs].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        return merged;
      });
      
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      unreadDocs.forEach(id => updateDoc(getMessageDoc(id), { readBy: arrayUnion(user.uid) }).catch(()=>{}));
    }, (err) => console.error(err));
    
    return () => unsub();
  }, [currentRoom?.id, user?.uid]);

  // アクション類
  const handleLogin = async (e) => {
    e.preventDefault();
    if (profile.name.trim() && user) {
      if (window.Notification && Notification.permission !== "granted" && Notification.permission !== "denied") {
        try { const perm = await Notification.requestPermission(); setNotifPerm(perm); } catch(e){}
      }
      await setDoc(getPublicDoc('users', user.uid), { ...profile, uid: user.uid }, { merge: true });
      setAppState('main');
      setActiveTab('rooms');
    }
  };

  const requestNotification = async () => {
    if (!window.Notification) return setAlertMsg("ブラウザが通知機能に対応していません。");
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm === 'granted') {
        setAlertMsg("通知設定を保存しています...");
        if (messaging) {
          const token = await getToken(messaging, { vapidKey: "BJJhm_Fz-6j-jL0MfPuLm5At8XNXRPXU_unU_mz9oBDIonz0avlERuTXb3N-wmU_lnI3dfR5_SjX1F5p6SvgeSY" });
          await updateDoc(getPublicDoc('users', user.uid), { fcmToken: token });
          setAlertMsg("✅ 通知の準備が完了しました！");
        }
      }
    } catch (error) {
      console.error("Notification Error:", error);
      setAlertMsg("エラーが発生しました。");
    }
  };

  // 🚀 GASにバックグラウンド通知を依頼する関数
  const sendNotificationViaGAS = async (senderName, notifyText, targetRoomId) => {
    try {
      const usersSnapshot = await getDocs(getPublicCollection('users'));
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        const targetRoom = rooms.find(r => r.id === targetRoomId);
        
        // メッセージを送った本人「以外」で、かつその部屋のメンバーにだけ通知を飛ばす
        if (userDoc.id !== user.uid && userData.fcmToken && targetRoom?.members?.includes(userDoc.id)) {
          fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              token: userData.fcmToken,
              title: `${senderName} からの新着メッセージ`,
              body: notifyText
            })
          }).catch(err => console.error("GASエラー:", err));
        }
      });
    } catch (error) {
      console.error("通知ユーザー取得エラー:", error);
    }
  };

  const createRoomAction = async () => {
    if (!newRoomData.name.trim()) return setAlertMsg("部屋の名前を入力してください");
    const newRef = doc(getPublicCollection('rooms'));
    await setDoc(newRef, { ...newRoomData, leaderId: user.uid, createdAt: Date.now(), members: [user.uid], banned: [], subLeaders: [] });
    const roomDataWithId = { id: newRef.id, ...newRoomData, leaderId: user.uid, members: [user.uid], banned: [], subLeaders: [] };
    
    setShowCreateRoom(false); 
    setNewRoomData({ name: '', password: '', icon: '' });
    setCurrentRoom(roomDataWithId);
    setActiveTab('chat');
    
    setTimeout(() => {
        const msgRef = doc(getMessagesCollection());
        setDoc(msgRef, {
            id: msgRef.id, roomId: roomDataWithId.id, text: `🎉 ${profile.name} さんがグループ「${roomDataWithId.name}」を作成しました！`, senderName: 'システム', senderId: 'system', type: 'text',
            createdAt: Date.now(), readBy: [], timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }).catch(err => { console.error(err); });
    }, 500);
  };

  const triggerJoinRoom = (room) => {
    if (room.banned?.includes(user.uid)) return setAlertMsg("この部屋からはキックされています。");
    if (room.members?.includes(user.uid)) { setCurrentRoom(room); setActiveTab('chat'); return; }
    if (room.password) setJoinRoomTarget(room);
    else finalizeJoinRoom(room);
  };

  const handleJoinRoomSubmit = () => {
    if (joinPassword !== joinRoomTarget.password) return setAlertMsg("パスワードが違います");
    finalizeJoinRoom(joinRoomTarget); setJoinRoomTarget(null); setJoinPassword("");
  };

  const finalizeJoinRoom = (room) => {
    updateDoc(getPublicDoc('rooms', room.id), { members: arrayUnion(user.uid) }).catch(()=>{});
    setCurrentRoom(room); setActiveTab('chat');
    
    setTimeout(() => {
        const msgRef = doc(getMessagesCollection());
        setDoc(msgRef, {
            id: msgRef.id, roomId: room.id, text: `👋 ${profile.name} さんが参加しました！`, senderName: 'システム', senderId: 'system', type: 'text',
            createdAt: Date.now(), readBy: [], timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }).catch(err => { console.error(err); });
    }, 500);
  };

  const leaveRoom = async () => {
    if(!confirmLeaveRoom) return;
    await updateDoc(getPublicDoc('rooms', confirmLeaveRoom.id), { members: arrayRemove(user.uid) });
    
    const msgRef = doc(getMessagesCollection());
    setDoc(msgRef, {
        id: msgRef.id, roomId: confirmLeaveRoom.id, text: `🏃 ${profile.name} さんが退出しました。`, senderName: 'システム', senderId: 'system', type: 'text',
        createdAt: Date.now(), readBy: [], timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }).catch(err => { console.error(err); });
    
    if(currentRoom?.id === confirmLeaveRoom.id) { setCurrentRoom(null); setTargetGame(null); setActiveTab('rooms'); }
    setConfirmLeaveRoom(null);
  };

  const startDirectMessage = async (targetUser) => {
    setTargetUserModal(null);
    if (targetUser.id === user.uid) return;
    const existingDM = rooms.find(r => r.isDirectMessage && r.members?.includes(user.uid) && r.members?.includes(targetUser.id) && r.members.length === 2);
    if (existingDM) {
      setCurrentRoom(existingDM); setActiveTab('chat');
    } else {
      const newRef = doc(getPublicCollection('rooms'));
      const newDM = { isDirectMessage: true, createdAt: Date.now(), members: [user.uid, targetUser.id], banned: [] };
      await setDoc(newRef, newDM);
      setCurrentRoom({ id: newRef.id, ...newDM });
      setActiveTab('chat');
    }
  };

  const getRoomName = (room) => {
    if (room.isDirectMessage) {
      const otherId = room.members?.find(id => id !== user.uid);
      const otherUser = allUsers.find(u => u.id === otherId);
      return otherUser ? otherUser.name : '退出したユーザー';
    }
    return room.name;
  };
  const getRoomIcon = (room) => {
    if (room.isDirectMessage) {
      const otherId = room.members?.find(id => id !== user.uid);
      const otherUser = allUsers.find(u => u.id === otherId);
      return otherUser?.icon || '';
    }
    return room.icon;
  };

  // ゲームの作成・参加
  const createGarticGame = async () => {
    if(!currentRoom) return;
    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    await setDoc(getPublicDoc('games', newGameId), {
      id: newGameId, hostId: user.uid, roomId: currentRoom.id, status: 'lobby', currentRound: 0,
      players: [{ id: user.uid, name: profile.name, ready: true }], chains: {}, settings: { timeLimit: 60 }
    });
    sendMessage("🎨 お絵描き伝言ゲームを作成しました！\n下のボタンから参加してね！", "game_invite", newGameId);
    setTargetGame({ id: newGameId, type: 'gartic' }); setActiveTab('game');
  };

  const joinGarticGame = async (gameIdToJoin) => {
    try {
      const snap = await getDoc(getPublicDoc('games', gameIdToJoin));
      if (snap.exists()) {
        const data = snap.data();
        if (data.status !== 'lobby') return setAlertMsg("このゲームはすでに開始されているか、終了しています。");
        if (!data.players?.some(p => p.id === user.uid)) {
          await updateDoc(getPublicDoc('games', gameIdToJoin), { players: arrayUnion({ id: user.uid, name: profile.name, ready: false }) });
        }
        setTargetGame({ id: gameIdToJoin, type: 'gartic' }); setActiveTab('game');
      } else { setAlertMsg("ゲームが見つかりません。"); }
    } catch(e) { console.error(e); setAlertMsg("参加エラー"); }
  };

  const createWordWolfGame = async () => {
    if(!currentRoom) return;
    const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
    await setDoc(getPublicDoc('ww_games', newGameId), {
      id: newGameId, hostId: user.uid, roomId: currentRoom.id, state: 'lobby',
      players: [{ id: user.uid, name: profile.name, icon: profile.icon, isSpectator: false }], 
      settings: { maxPlayers: 6, wolves: 1, timeMinutes: 3 }
    });
    sendMessage("🐺 ワードウルフを作成しました！\n下のボタンから参加してね！", "ww_invite", newGameId);
    setTargetGame({ id: newGameId, type: 'wordwolf' }); setActiveTab('game');
  };

  const joinWordWolfGame = async (gameIdToJoin) => {
    try {
      const snap = await getDoc(getPublicDoc('ww_games', gameIdToJoin));
      if (snap.exists()) {
        const data = snap.data();
        if (data.state !== 'lobby') return setAlertMsg("ゲームは開始されているか終了しています。");
        if (!data.players?.some(p => p.id === user.uid)) {
          const isSpectator = data.players.filter(p => !p.isSpectator).length >= data.settings.maxPlayers;
          await updateDoc(getPublicDoc('ww_games', gameIdToJoin), { players: arrayUnion({ id: user.uid, name: profile.name, icon: profile.icon, isSpectator }) });
        }
        setTargetGame({ id: gameIdToJoin, type: 'wordwolf' }); setActiveTab('game');
      } else { setAlertMsg("ゲームが見つかりません。"); }
    } catch(e) { console.error(e); setAlertMsg("参加エラー"); }
  };

  const handleInputChange = (e) => {
    const val = e.target.value; setInputValue(val);
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\S*)$/);
    if (mentionMatch) { setShowMentionList(true); setMentionFilter(mentionMatch[1]); } 
    else { setShowMentionList(false); }
  };

  const insertMention = (mentionText) => {
    const inputEle = textInputRef.current; if (!inputEle) return;
    const pos = inputEle.selectionStart;
    const before = inputValue.substring(0, pos); const after = inputValue.substring(pos);
    const match = before.match(/@(\S*)$/);
    if (match) {
      setInputValue(before.substring(0, match.index) + `@${mentionText} ` + after);
      setShowMentionList(false); setTimeout(() => inputEle.focus(), 10);
    }
  };

  // メッセージ送信とGAS通知呼び出し
  const sendMessage = (text, type = "text", url = null, audioUrl = null) => {
    if (!text && !url && !audioUrl) return;
    const content = text; setInputValue(""); setShowMentionList(false);
    
    if (editingMsgId) {
      setMessages(prev => prev.map(m => m.id === editingMsgId ? { ...m, text: content, isEdited: true } : m));
      updateDoc(getMessageDoc(editingMsgId), { text: content, isEdited: true });
      setEditingMsgId(null); return;
    }

    const msgRef = doc(getMessagesCollection());
    const replyData = replyingTo ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text, type: replyingTo.type } : null;
    setReplyingTo(null);

    const newMsg = {
      id: msgRef.id, roomId: currentRoom.id, text: content, senderName: profile.name, senderId: user.uid, senderIcon: profile.icon, type, url, audioUrl,
      createdAt: Date.now(), readBy: [], replyTo: replyData, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isPending: true
    };
    
    setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 10);
    
    const { isPending, ...dataToSave } = newMsg;
    setDoc(msgRef, dataToSave).catch(err => { console.error(err); setAlertMsg("送信失敗"); });

    // 🚀 GASに通知を依頼
    let notifyText = content;
    if (type === 'image') notifyText = '📷 画像が送信されました';
    if (type === 'video') notifyText = '🎥 動画が送信されました';
    if (type === 'audio') notifyText = '🎤 ボイスメッセージが送信されました';
    if (type === 'game_invite') notifyText = '🎨 お絵描き伝言ゲームに招待されました！';
    if (type === 'ww_invite') notifyText = '🐺 ワードウルフに招待されました！';
    if (type === 'call_start') notifyText = '📞 通話が開始されました！';

    sendNotificationViaGAS(profile.name, notifyText, currentRoom.id);
  };

  // 📞 通話開始機能
  const startCall = (type) => {
    setActiveCall({ type, roomId: currentRoom.id });
    sendMessage(`📞 ${profile.name} が${type === 'video' ? 'ビデオ' : '音声'}通話を開始しました！\n上のボタンから参加できます。`, 'call_start');
  };

  const togglePin = (msg) => {
    updateDoc(getMessageDoc(msg.id), { isPinned: !msg.isPinned }).catch(err => setAlertMsg("ピン留めの変更に失敗しました"));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    if (file.type.startsWith('video/')) {
      if (file.size > 1024 * 1024) return setAlertMsg("動画は制限により1MB以下のファイルにしてください🙏");
      const reader = new FileReader();
      reader.onload = (ev) => sendMessage("", 'video', ev.target.result);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('image/')) {
      if (file.size > 20 * 1024 * 1024) return setAlertMsg("画像は20MB以下にしてください");
      try {
        const compressed = await processImageFile(file, 0.8);
        sendMessage("", 'image', compressed);
      } catch(err) { setAlertMsg(err); }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
      }
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (audioChunksRef.current.length === 0) return;
        const finalMimeType = recorder.mimeType || mimeType || 'audio/mp4';
        const blob = new Blob(audioChunksRef.current, { type: finalMimeType });
        if (blob.size < 500) return; 
        if (blob.size > 1024 * 1024) { setAlertMsg("録音が長すぎます（1MB以下にしてください）"); return; }
        const reader = new FileReader();
        reader.onload = (e) => sendMessage("🎤 ボイスメッセージ", "audio", null, e.target.result);
        reader.readAsDataURL(blob);
      };
      recorder.start(); setIsRecording(true);
    } catch (e) { setAlertMsg("マイクの許可が必要です"); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  // UI レンダリング
  if (appState === 'login') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-indigo-50 to-blue-100 text-gray-900 p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center border-2 border-white">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner"><MessageCircle className="w-10 h-10 text-indigo-500" /></div>
          <h1 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Connect App</h1>
          <p className="text-gray-500 mb-6 text-sm font-bold">プロフィールを設定してスタート</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" placeholder="名前 (必須)" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" required maxLength={15} />
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                {profile.icon ? <img src={profile.icon} className="w-full h-full object-cover" alt="icon"/> : <User size={20} className="m-2.5 text-gray-400"/>}
              </div>
              <div className="flex-1 text-left">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">プロフィールアイコン (任意)</label>
                <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    if (file.size > 20 * 1024 * 1024) return alert("画像は20MB以下にしてください");
                    try { const compressed = await processImageFile(file, 0.7); setProfile({...profile, icon: compressed}); } catch (err) { alert(err); }
                  }} className="w-full text-xs" />
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg transform transition active:scale-95">はじめる</button>
          </form>
        </div>
      </div>
    );
  }

  const filteredMessages = messages.filter(m => m.text?.includes(searchQuery) || m.senderName?.includes(searchQuery));
  const mentionCands = (() => {
    const d = [{ id: 'all', name: 'all', desc: '全員' }, { id: 'online', name: 'online', desc: 'オンライン' }];
    const m = allUsers.filter(u => currentRoom?.members?.includes(u.id));
    const all = [...d, ...m]; return mentionFilter ? all.filter(c => c.name?.toLowerCase().includes(mentionFilter.toLowerCase())) : all;
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 text-gray-900 font-sans relative">
      {/* 📹 通話モーダル (最前面) */}
      {activeCall && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          <div className="bg-gray-900 p-3 sm:p-4 flex justify-between items-center text-white border-b border-gray-800">
            <h2 className="font-bold flex items-center gap-2 text-sm sm:text-base">
              {activeCall.type === 'video' ? <Video size={20} className="text-blue-400"/> : <Phone size={20} className="text-green-400"/>}
              {getRoomName(currentRoom)} の通話
            </h2>
            <button onClick={() => setActiveCall(null)} className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-full font-bold text-xs sm:text-sm shadow-lg transition transform active:scale-95 flex items-center gap-1">
              <Phone size={14} className="rotate-[135deg]" /> 切断
            </button>
          </div>
          <iframe
            allow="camera; microphone; display-capture; autoplay"
            src={`https://meet.jit.si/connect-app-room-${activeCall.roomId}#config.startWithVideo=${activeCall.type === 'video' ? 'true' : 'false'}`}
            className="w-full flex-1 border-none bg-black"
          />
        </div>
      )}

      {/* 左ペイン: 部屋一覧 */}
      <div className={`${activeTab === 'rooms' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-20 lg:w-72 border-r border-gray-200 bg-gray-900 text-white flex-shrink-0 z-10 transition-all`}>
        <div className="p-4 border-b border-gray-800 flex items-center gap-3 cursor-pointer hover:bg-gray-800 transition group" onClick={() => setShowProfileEdit(true)}>
          <div className="w-10 h-10 rounded-full bg-indigo-500 flex-shrink-0 overflow-hidden shadow-inner relative">
            {profile.icon ? <img src={profile.icon} className="w-full h-full object-cover" alt="profile" /> : <User className="m-2"/>}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><Edit2 size={14} className="text-white"/></div>
          </div>
          <div className="hidden lg:block overflow-hidden"><h3 className="font-bold truncate">{profile.name}</h3><p className="text-[10px] text-gray-400">タップして編集</p></div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-2">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2 pt-2 hidden lg:block">グループ</p>
          {rooms.filter(r => !r.isDirectMessage).map(room => {
            const isJoined = room.members?.includes(user.uid);
            return (
              <button key={room.id} onClick={() => triggerJoinRoom(room)} className={`w-full flex items-center p-2 lg:p-3 rounded-xl transition ${currentRoom?.id === room.id ? 'bg-indigo-600 shadow-md' : 'hover:bg-gray-800'} relative group`}>
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">{room.icon ? <img src={room.icon} className="w-full h-full object-cover" alt="room" /> : <Users size={20}/>}</div>
                <div className="hidden lg:flex flex-col items-start ml-3 overflow-hidden">
                  <span className="font-bold truncate w-full text-left">{room.name} {room.password && <Lock size={10} className="inline text-gray-400"/>}</span>
                  <span className="text-[10px] text-gray-400">{isJoined ? '参加中' : '未参加'}</span>
                </div>
                {isJoined && currentRoom?.id !== room.id && <div onClick={(e)=>{e.stopPropagation(); setConfirmLeaveRoom(room);}} className="hidden lg:group-hover:block absolute right-2 p-1 text-gray-400 hover:text-red-400" title="退出"><LogOut size={14}/></div>}
              </button>
            )
          })}
          
          <div className="mt-4 border-t border-gray-800 pt-2 hidden lg:block">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2 pt-2">ダイレクトメッセージ</p>
          </div>
          {rooms.filter(r => r.isDirectMessage && r.members?.includes(user.uid)).map(room => {
            const rName = getRoomName(room); const rIcon = getRoomIcon(room);
            return (
              <button key={room.id} onClick={() => triggerJoinRoom(room)} className={`w-full flex items-center p-2 lg:p-3 rounded-xl transition ${currentRoom?.id === room.id ? 'bg-indigo-600 shadow-md' : 'hover:bg-gray-800'} relative group`}>
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 overflow-hidden">{rIcon ? <img src={rIcon} className="w-full h-full object-cover" alt="dm user" /> : <User size={20}/>}</div>
                <div className="hidden lg:flex flex-col items-start ml-3 overflow-hidden"><span className="font-bold truncate w-full text-left">{rName}</span></div>
              </button>
            )
          })}
        </div>

        <div className="p-3 border-t border-gray-800">
          <button onClick={() => setShowCreateRoom(true)} className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center lg:justify-start gap-2 font-bold transition">
            <Plus size={20} className="text-indigo-400"/> <span className="hidden lg:inline text-indigo-400">部屋を作成</span>
          </button>
        </div>
      </div>

      {/* 中央ペイン: ゲーム画面 */}
      {targetGame && (
        <div className={`${activeTab === 'game' ? 'flex' : 'hidden'} md:flex flex-col flex-1 bg-white relative overflow-hidden border-r border-gray-200`}>
          {targetGame.type === 'gartic' && <GarticGame gameId={targetGame.id} user={user} profile={profile} onClose={() => { setTargetGame(null); setActiveTab('chat'); }} />}
          {targetGame.type === 'wordwolf' && <WordWolfGame gameId={targetGame.id} user={user} profile={profile} onClose={() => { setTargetGame(null); setActiveTab('chat'); }} />}
        </div>
      )}

      {/* 右ペイン: チャット */}
      <div className={`${activeTab === 'chat' ? 'flex' : 'hidden'} md:flex flex-col w-full ${targetGame ? 'md:w-[350px] lg:w-[400px]' : 'flex-1'} bg-gray-50 flex-shrink-0 z-20 transition-all`}>
        {currentRoom ? (
          <>
            <header className="p-3 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
              <div className="flex flex-col overflow-hidden mr-auto">
                <span className="font-black text-gray-800 truncate leading-tight">{getRoomName(currentRoom)}</span>
                {!currentRoom.isDirectMessage && <span className="text-[10px] text-gray-400 font-bold flex items-center"><Users size={10} className="mr-1"/> {currentRoom.members?.length}人</span>}
              </div>
              
              {/* 通話＆設定ボタン */}
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <button onClick={() => startCall('audio')} className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-full transition" title="音声通話"><Phone size={18}/></button>
                <button onClick={() => startCall('video')} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full transition" title="ビデオ通話"><Video size={18}/></button>
                <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                <button onClick={() => setShowRoomSettings(true)} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"><Settings size={18}/></button>
              </div>
            </header>
            
            {messages.filter(m => m.isPinned).length > 0 && (
              <div className="bg-yellow-50 border-b border-yellow-200 p-2 flex flex-col gap-1 max-h-32 overflow-y-auto shadow-inner z-10 relative">
                {messages.filter(m => m.isPinned).map(pm => (
                  <div key={`pin-${pm.id}`} className="flex items-center justify-between bg-white px-3 py-1.5 rounded shadow-sm border border-yellow-100">
                     <div className="flex items-center gap-2 overflow-hidden">
                       <Pin size={14} className="text-yellow-600 flex-shrink-0"/>
                       <span className="font-bold text-gray-700 text-xs flex-shrink-0">{pm.senderName}:</span>
                       <span className="truncate text-gray-600 text-xs">{pm.text || (pm.type==='image'?'':pm.type==='video'?'[動画]':'[ボイスメッセージ]')}</span>
                     </div>
                     <button onClick={() => togglePin(pm)} className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0 bg-gray-50 hover:bg-red-50 p-1 rounded-full"><X size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-4 relative">
              {filteredMessages.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm font-bold">メッセージがありません</div>}
              {filteredMessages.map((msg) => {
                const isMine = msg.senderId === user.uid;
                
                if (msg.senderId === 'system') {
                    return (<div key={msg.id} className="flex justify-center my-2"><span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">{msg.text}</span></div>)
                }

                if (msg.type === 'call_start') {
                    return (
                      <div key={msg.id} className="flex justify-center my-4">
                         <div className="bg-green-100 text-green-800 px-5 py-3 rounded-2xl font-bold shadow-sm flex flex-col items-center gap-2 text-sm text-center">
                           <Phone size={24} className="text-green-600 animate-pulse" /> 
                           <span className="whitespace-pre-wrap">{msg.text}</span>
                           <button onClick={() => setActiveCall({ type: msg.text.includes('ビデオ') ? 'video' : 'audio', roomId: currentRoom.id })} className="mt-2 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full shadow transition transform active:scale-95">参加する</button>
                         </div>
                      </div>
                    )
                }

                if (msg.type === 'game_invite') {
                  return (
                    <div key={msg.id} className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-2xl border-2 border-indigo-100 shadow-sm text-center mx-2 my-4">
                      <div className="flex justify-center mb-2"><Palette className="text-indigo-500 w-8 h-8"/></div>
                      <p className="font-bold text-indigo-800 mb-3 whitespace-pre-wrap">{msg.text}</p>
                      <button onClick={() => joinGarticGame(msg.url)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-2.5 rounded-full font-black shadow-md transform transition active:scale-95 text-lg">参加する！</button>
                      <p className="text-[10px] text-gray-400 mt-2">by {msg.senderName}</p>
                    </div>
                  );
                }

                if (msg.type === 'ww_invite') {
                  return (
                    <div key={msg.id} className="bg-gradient-to-br from-slate-800 to-indigo-950 p-4 rounded-2xl border-2 border-indigo-500 shadow-sm text-center mx-2 my-4">
                      <div className="flex justify-center mb-2"><span className="text-4xl drop-shadow-md">🐺</span></div>
                      <p className="font-bold text-indigo-200 mb-3 whitespace-pre-wrap">{msg.text}</p>
                      <button onClick={() => joinWordWolfGame(msg.url)} className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white px-8 py-2.5 rounded-full font-black shadow-[0_0_15px_rgba(236,72,153,0.5)] transform transition active:scale-95 text-lg">参加する！</button>
                      <p className="text-[10px] text-gray-400 mt-2">by {msg.senderName}</p>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"} ${msg.isPending ? 'opacity-70' : ''}`}>
                    {!isMine && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden shadow-inner cursor-pointer hover:opacity-80 transition" onClick={() => setTargetUserModal(msg.senderId)}>
                        {msg.senderIcon ? <img src={msg.senderIcon} className="w-full h-full object-cover" alt="user icon"/> : <User size={16} className="m-1.5 text-gray-400"/>}
                      </div>
                    )}
                    <div className={`flex flex-col max-w-[80%] ${isMine ? "items-end" : "items-start"}`}>
                      {!isMine && <span className="text-[10px] text-gray-500 mb-0.5 ml-1 font-bold">{msg.senderName}</span>}
                      <div className="flex items-center gap-1 group relative">
                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ${isMine ? 'order-1' : 'order-2'}`}>
                          <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full" title="返信"><Reply size={12}/></button>
                          <button onClick={() => togglePin(msg)} className={`p-1.5 rounded-full ${msg.isPinned ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`} title={msg.isPinned ? "ピン留め解除" : "ピン留め"}>{msg.isPinned ? <PinOff size={12}/> : <Pin size={12}/>}</button>
                          {isMine && msg.type === "text" && <button onClick={() => {setEditingMsgId(msg.id); setInputValue(msg.text);}} className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full" title="編集"><Edit2 size={12}/></button>}
                          {isMine && <button onClick={() => deleteDoc(getMessageDoc(msg.id))} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-full"><Trash2 size={12}/></button>}
                        </div>
                        <div className={`px-3 py-2 rounded-2xl shadow-sm relative text-sm ${isMine ? "bg-blue-500 text-white rounded-tr-sm order-2" : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm order-1"}`}>
                          {msg.replyTo && <div className={`text-[10px] p-1.5 rounded mb-1 truncate ${isMine?'bg-blue-600 text-blue-100':'bg-gray-100 border-l-2 border-gray-400'}`}><span className="font-bold">{msg.replyTo.senderName}</span>: {msg.replyTo.text||'[メディア]'}</div>}
                          {msg.type === "text" && <p className="whitespace-pre-wrap break-words">{(msg.text||"").split(/(@\S+)/).map((part, i) => part.startsWith('@') ? <span key={i} className={`font-bold ${isMine?'text-blue-200':'text-blue-500'}`}>{part}</span> : part)}</p>}
                          {msg.type === "image" && <img src={msg.url} onClick={() => setZoomedImage(msg.url)} className="rounded-lg max-h-40 object-contain mt-1 cursor-pointer hover:opacity-90 transition" alt="attachment" />}
                          {msg.type === "video" && <video src={msg.url} controls className="rounded-lg max-h-40 mt-1" />}
                          {msg.type === "audio" && <audio src={msg.audioUrl} controls className="h-8 w-32" />}
                          {msg.isEdited && <span className="text-[8px] opacity-60 absolute bottom-1 right-2">編集済</span>}
                        </div>
                      </div>
                      <div className={`flex gap-1 mt-0.5 ${isMine ? "justify-end" : "justify-start"}`}>
                        <span className="text-[9px] text-gray-400">{msg.timestamp}</span>
                        {isMine && msg.readBy?.length > 0 && <span className="text-[9px] text-blue-500 font-bold">既読 {msg.readBy.length}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-2 bg-white border-t border-gray-200">
              {editingMsgId && <div className="flex justify-between items-center bg-blue-50 text-blue-600 px-3 py-1 text-xs rounded-t-lg mb-[-4px]"><span>編集中</span><button onClick={()=>{setEditingMsgId(null); setInputValue("");}}><X size={12}/></button></div>}
              {replyingTo && <div className="flex justify-between items-center bg-gray-100 text-gray-600 px-3 py-1 text-xs rounded-t-lg mb-[-4px] border-l-2 border-blue-500 truncate"><span className="truncate">返信: {replyingTo.text}</span><button onClick={()=>setReplyingTo(null)}><X size={12}/></button></div>}
              
              {showStampModal && (
                <div className="absolute bottom-20 left-4 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 w-80 z-50 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-sm text-gray-700">ゆるふわスタンプ</h3>
                    <button onClick={() => setShowStampModal(false)} className="hover:bg-gray-100 rounded-full p-1"><X size={16} className="text-gray-400"/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {cuteStamps.map((stamp, i) => (
                      <button key={i} onClick={() => { sendMessage(stamp, "text"); setShowStampModal(false); }} className="text-sm font-bold p-2.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-100 rounded-xl transition-colors text-left pl-3">
                        {stamp}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={e=>{e.preventDefault(); sendMessage(inputValue);}} className="flex items-end gap-1 relative pt-1">
                {showMentionList && mentionCands.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 w-48 bg-white border border-gray-200 shadow-xl rounded-xl overflow-y-auto max-h-40 z-50">
                    {mentionCands.map(c => <button key={c.id} type="button" onClick={()=>insertMention(c.name)} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 text-sm">@{c.name}</button>)}
                  </div>
                )}
                
                {!currentRoom.isDirectMessage && (
                  <div className="flex gap-1">
                    <button type="button" onClick={createWordWolfGame} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition flex-shrink-0 shadow-sm" title="ワードウルフを開始"><Ghost size={18} /></button>
                    <button type="button" onClick={createGarticGame} className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-full transition flex-shrink-0 shadow-sm" title="伝言ゲームを開始"><Palette size={18} /></button>
                  </div>
                )}

                <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-2 py-1">
                  <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  <button type="button" onClick={()=>fileInputRef.current?.click()} className="p-1.5 text-gray-400 hover:text-blue-500"><ImageIcon size={18} /></button>
                  <input type="text" ref={textInputRef} value={inputValue} onChange={handleInputChange} placeholder="メッセージ..." className="w-full bg-transparent border-none focus:ring-0 outline-none text-sm px-1 py-1" />
                  <button type="button" onClick={() => setShowStampModal(!showStampModal)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"><Smile size={18} /></button>
                  <button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`p-1.5 ${isRecording?'text-red-500 animate-pulse':'text-gray-400 hover:text-blue-500'}`}><Mic size={18} /></button>
                </div>
                <button type="submit" disabled={!inputValue.trim()} className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 flex-shrink-0 shadow-md"><Send size={16} className={inputValue.trim()?"translate-x-0.5":""} /></button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-white">
            <MessageCircle className="w-16 h-16 text-gray-200 mb-4"/>
            <h2 className="text-xl font-bold text-gray-600">チャット未選択</h2>
            <p className="text-sm text-gray-400 mt-2 font-bold">左のメニューから部屋を選ぶか<br/>新しく作成してください</p>
          </div>
        )}
      </div>

      {/* モバイル用 ボトムナビゲーション */}
      <div className="md:hidden flex bg-white border-t border-gray-200 text-xs font-bold text-gray-500 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-50">
        <button className={`flex-1 py-3 flex flex-col items-center transition-colors ${activeTab === 'rooms' ? 'text-indigo-600 bg-indigo-50' : ''}`} onClick={() => setActiveTab('rooms')}><Users size={20} className="mb-1"/>グループ</button>
        {targetGame && (
          <button className={`flex-1 py-3 flex flex-col items-center transition-colors ${activeTab === 'game' ? 'text-indigo-600 bg-indigo-50' : ''}`} onClick={() => setActiveTab('game')}><Gamepad2 size={20} className="mb-1"/>ゲーム</button>
        )}
        <button className={`flex-1 py-3 flex flex-col items-center transition-colors ${activeTab === 'chat' ? 'text-indigo-600 bg-indigo-50' : ''}`} onClick={() => setActiveTab('chat')}><MessageCircle size={20} className="mb-1"/>チャット</button>
      </div>

      {/* プロフィール編集モーダル */}
      {showProfileEdit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-black mb-4">プロフィール設定</h2>
            <input type="text" value={profile.name} onChange={e=>setProfile({...profile, name: e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 mb-3 font-bold outline-none focus:border-indigo-500" />
            <div className="flex items-center gap-3 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                {profile.icon ? <img src={profile.icon} className="w-full h-full object-cover" alt="profile"/> : <User size={20} className="m-2.5 text-gray-400"/>}
              </div>
              <div className="flex-1 text-left">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">新しいアイコン (画像を選択)</label>
                <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    if (file.size > 20 * 1024 * 1024) return setAlertMsg("画像は20MB以下にしてください");
                    try { const compressed = await processImageFile(file, 0.7); setProfile({...profile, icon: compressed}); } catch(err) { setAlertMsg(err); }
                  }} className="w-full text-xs" />
              </div>
            </div>
            
            <div className="mb-6 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3">
              <label className="text-[10px] text-gray-500 font-bold block mb-2">通知設定 (オンライン時のみ)</label>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">{notifPerm === 'granted' ? '🔔 通知はオンです' : '🔕 通知はオフです'}</span>
                {notifPerm !== 'granted' && <button onClick={requestNotification} className="text-xs bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-200 transition">許可する</button>}
              </div>
              {notifPerm === 'denied' && <p className="text-[10px] text-red-500 mt-2">※ブラウザの設定から通知を許可してください。</p>}
            </div>

            <div className="flex gap-2">
              <button onClick={()=>setShowProfileEdit(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">キャンセル</button>
              <button onClick={async () => {
                await updateDoc(getPublicDoc('users', user.uid), profile);
                setShowProfileEdit(false); setAlertMsg("プロフィールを更新しました");
              }} className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-bold">保存する</button>
            </div>
          </div>
        </div>
      )}

      {/* 他のユーザーのプロフィール＆DM開始モーダル */}
      {targetUserModal && (
        (() => {
          const tUser = allUsers.find(u => u.id === targetUserModal);
          if (!tUser) return null;
          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm" onClick={() => setTargetUserModal(null)}>
              <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl text-center" onClick={e=>e.stopPropagation()}>
                 <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto overflow-hidden shadow-inner mb-4">
                   {tUser.icon ? <img src={tUser.icon} className="w-full h-full object-cover" alt="user icon"/> : <User size={48} className="m-6 text-gray-400"/>}
                 </div>
                 <h2 className="text-2xl font-black mb-1">{tUser.name}</h2>
                 {tUser.bio && <p className="text-gray-500 mb-6 text-sm">{tUser.bio}</p>}
                 {tUser.id !== user.uid && (
                   <button onClick={() => startDirectMessage(tUser)} className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 mt-4 transform active:scale-95 transition">
                     <MessageCircle size={20}/> メッセージを送る (個チャ)
                   </button>
                 )}
                 <button onClick={() => setTargetUserModal(null)} className="mt-6 text-gray-400 font-bold hover:text-gray-600">閉じる</button>
              </div>
            </div>
          );
        })()
      )}

      {/* その他モーダル類 */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-black mb-4">新しい部屋を作る</h2>
            <input type="text" placeholder="部屋の名前" value={newRoomData.name} onChange={e=>setNewRoomData({...newRoomData,name:e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 mb-3 font-bold outline-none focus:border-indigo-500" />
            <div className="flex items-center gap-3 bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                {newRoomData.icon ? <img src={newRoomData.icon} className="w-full h-full object-cover" alt="room icon"/> : <User size={20} className="m-2.5 text-gray-400"/>}
              </div>
              <div className="flex-1 text-left">
                <label className="text-[10px] text-gray-500 font-bold block mb-1">グループアイコン (任意)</label>
                <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return;
                    if (file.size > 20 * 1024 * 1024) return setAlertMsg("アイコン画像は20MB以下にしてください");
                    try { const compressed = await processImageFile(file, 0.7); setNewRoomData({...newRoomData, icon: compressed}); } catch(err) { setAlertMsg(err); }
                  }} className="w-full text-xs" />
              </div>
            </div>
            <input type="text" placeholder="パスワード (任意)" value={newRoomData.password} onChange={e=>setNewRoomData({...newRoomData,password:e.target.value})} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 mb-5 outline-none focus:border-indigo-500" />
            <div className="flex gap-2"><button onClick={()=>setShowCreateRoom(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold">キャンセル</button><button onClick={createRoomAction} className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold shadow-md">作成する</button></div>
          </div>
        </div>
      )}
      {joinRoomTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl"><h2 className="text-xl font-black mb-2">鍵付きの部屋</h2><p className="text-xs text-gray-500 mb-4">{joinRoomTarget.name} に入室します</p><input type="password" placeholder="パスワード" value={joinPassword} onChange={e=>setJoinPassword(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3 mb-5 font-bold outline-none focus:border-indigo-500" autoFocus /><div className="flex gap-2"><button onClick={()=>{setJoinRoomTarget(null);setJoinPassword("");}} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold">キャンセル</button><button onClick={handleJoinRoomSubmit} className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-bold">入室</button></div></div>
        </div>
      )}
      {alertMsg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl"><p className="mb-6 font-bold text-gray-800 whitespace-pre-wrap">{alertMsg}</p><button onClick={()=>setAlertMsg("")} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold">OK</button></div>
        </div>
      )}
      {confirmLeaveRoom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl">
            <h3 className="font-bold text-lg text-red-600 mb-2">確認</h3>
            <p className="mb-6 text-gray-600 text-sm">このグループから退出しますか？</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmLeaveRoom(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 rounded-lg font-bold">キャンセル</button>
              <button onClick={leaveRoom} className="px-4 py-2 bg-red-500 hover:bg-red-600 transition-colors text-white rounded-lg font-bold">退出する</button>
            </div>
          </div>
        </div>
      )}
      {showRoomSettings && currentRoom && (
        <RoomSettingsModal room={currentRoom} messages={messages} user={user} allUsers={allUsers} onClose={() => setShowRoomSettings(false)} setAlertMsg={setAlertMsg} setCurrentRoom={setCurrentRoom} setTargetGame={setTargetGame} />
      )}
      {zoomedImage && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[120] p-4 backdrop-blur-sm cursor-zoom-out" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition"><X size={24}/></button>
          <img src={zoomedImage} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-default" onClick={e => e.stopPropagation()} alt="zoomed preview" />
        </div>
      )}
    </div>
  );
}