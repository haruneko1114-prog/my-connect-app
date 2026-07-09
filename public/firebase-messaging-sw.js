importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBcPnvsqAafiyth0Iux7WKanmTpKJgzFu4",
  authDomain: "test-374ce.firebaseapp.com",
  projectId: "test-374ce",
  storageBucket: "test-374ce.firebasestorage.app",
  messagingSenderId: "916695405364",
  appId: "1:916695405364:web:7ad09da5d49df8354f8b61",
  measurementId: "G-K80D68P0GP"
};

firebase.initializeApp(firebaseConfig);

// ★FCMの標準機能に任せず、強制的に内容と音を設定する強力なコード！
self.addEventListener('push', function(event) {
  if (event.data) {
    const payload = event.data.json();
    
    // 送られてきたタイトルとメッセージを抜き出す
    const title = payload.notification?.title || "新着メッセージ";
    const body = payload.notification?.body || "メッセージが届きました";
    
    // 通知の見た目と音の設定
    const options = {
      body: body,
      icon: 'https://cdn-icons-png.flaticon.com/512/3114/3114810.png', // ベルのアイコン
      badge: 'https://cdn-icons-png.flaticon.com/512/3114/3114810.png',
      vibrate: [200, 100, 200, 100, 200], // 強制的にブルブル振動させて音を鳴らす！
      requireInteraction: true, // 勝手に消えずに画面に残るようにする
      data: { url: '/' }
    };

    // Firebaseの標準機能を止めて、この設定で強制表示する！
    event.stopImmediatePropagation();
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// 通知をクリックした時にアプリを開く処理
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});