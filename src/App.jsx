import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';
import { Bell, Send } from 'lucide-react';

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

// ★ここでGASのロボットのURLを指定します！
const GAS_URL = "https://script.google.com/macros/s/AKfycbyJ10Y6_oEL402L_gpOY8INVgag1giFz_l5a_OqMfbw0l-RAzvw8l5J1NuQoyrHo_vKIQ/exec";

export default function App() {
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    signInAnonymously(auth).catch((error) => console.error("Login Error:", error));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, []);

  const requestNotification = async () => {
    if (!window.Notification) {
      setAlertMsg("お使いのブラウザは通知に対応していません。");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setAlertMsg("通知設定を保存しています...");
        if (messaging) {
          const token = await getToken(messaging, { vapidKey: "BJJhm_Fz-6j-jL0MfPuLm5At8XNXRPXU_unU_mz9oBDIonz0avlERuTXb3N-wmU_lnI3dfR5_SjX1F5p6SvgeSY" });
          if (user) {
            await setDoc(doc(db, 'users', user.uid), { 
              fcmToken: token,
              name: profileName || "名無し",
              updatedAt: serverTimestamp()
            }, { merge: true });
            setAlertMsg("✅ 通知の準備が完了しました！");
          }
        }
      } else {
        setAlertMsg("通知が拒否されました。");
      }
    } catch (error) {
      console.error("Notification Error:", error);
      setAlertMsg("エラーが発生しました。");
    }
  };

  // 🚀 GASに通知を依頼する関数
  const sendNotificationViaGAS = async (senderName, messageText) => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        
        // ★テスト用に制限を解除：「自分自身が送ったメッセージでも通知を鳴らす」設定に変更！
        if (userData.fcmToken) {
          fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // ★スマホ(iOS)のセキュリティブロックを回避して強制送信！
            headers: {
              'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
              token: userData.fcmToken,
              title: `${senderName} からの新着メッセージ`,
              body: messageText
            })
          }).catch(err => console.error("GASへの送信エラー:", err));
        }
      });
    } catch (error) {
      console.error("通知ユーザー取得エラー:", error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const senderName = profileName || "名無し";
    const messageText = newMessage;

    await addDoc(collection(db, 'messages'), {
      text: messageText,
      userId: user.uid,
      userName: senderName,
      createdAt: serverTimestamp()
    });

    sendNotificationViaGAS(senderName, messageText);
    setNewMessage("");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden flex flex-col h-[90vh]">
        <div className="bg-blue-600 text-white p-4 shadow-md z-10 flex justify-between items-center">
          <h1 className="font-bold text-xl flex items-center gap-2"><Send size={24} /> Connect App</h1>
        </div>
        {alertMsg && <div className="bg-green-100 text-green-800 p-2 text-center text-sm font-bold animate-pulse">{alertMsg}</div>}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h2 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><Bell size={20} /> 通知設定</h2>
            <input type="text" placeholder="名前を入力..." value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full p-2 border rounded mb-2" />
            <button onClick={requestNotification} className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded transition">通知を受け取る</button>
          </div>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-slate-500 mb-1 pl-1">{msg.userName}</span>
              <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${msg.userId === user?.uid ? 'bg-blue-500 text-white' : 'bg-white border'}`}>{msg.text}</div>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="p-3 bg-white border-t flex gap-2">
          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="メッセージ..." className="flex-1 border rounded-full px-4 py-2" />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded-full w-10 h-10"><Send size={18} /></button>
        </form>
      </div>
    </div>
  );
}