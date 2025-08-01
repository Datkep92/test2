// chat.js
let currentChatTab = 'public';
let selectedPrivateUserId = '';
let unreadMessages = { public: 0, private: {} };

function openChatModal() {
  const modal = document.getElementById('chat-modal');
  modal.style.display = 'block';
  loadPublicMessages();
  loadPrivateUserList();
  markMessagesAsRead();
  updateChatBadge();
}

function switchChatTab(tab) {
  currentChatTab = tab;
  document.querySelectorAll('.chat-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.chat-content').forEach(content => content.style.display = 'none');
  document.querySelector(`.chat-tab-btn[onclick="switchChatTab('${tab}')"]`).classList.add('active');
  document.getElementById(`chat-${tab}`).style.display = 'block';
  if (tab === 'public') {
    loadPublicMessages();
    unreadMessages.public = 0;
    updatePublicBadge();
  } else {
    loadPrivateUserList();
    if (selectedPrivateUserId) {
      loadPrivateMessages();
      unreadMessages.private[selectedPrivateUserId] = 0;
    }
  }
  updateChatBadge();
}

function loadPrivateUserList() {
  const userList = document.getElementById('private-user-list');
  userList.innerHTML = '';
  globalEmployeeData.forEach(user => {
    if (user.id !== currentEmployeeId) {
      const chatId = [currentEmployeeId, user.id].sort().join('_');
      db.ref(`chat/private/${chatId}`).orderByChild('timestamp').limitToLast(1).once('value', snapshot => {
        let snippet = 'Chưa có tin nhắn';
        let timestamp = '';
        snapshot.forEach(child => {
          const msg = child.val();
          snippet = msg.text.length > 30 ? msg.text.substring(0, 30) + '...' : msg.text;
          timestamp = new Date(msg.timestamp).toLocaleString('vi-VN');
        });
        const unreadCount = unreadMessages.private[user.id] || 0;
        userList.innerHTML += `
          <div class="user-item ${selectedPrivateUserId === user.id ? 'active' : ''}" onclick="selectPrivateUser('${user.id}')">
            <img class="user-avatar" src="${user.avatar || 'https://placehold.co/64x64.png'}" alt="${user.name || 'User'}">
            <div class="user-info">
              <div class="user-name">${user.name || 'Không xác định'}</div>
              <div class="message-snippet">${snippet} (${timestamp})</div>
            </div>
            ${unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : ''}
          </div>
        `;
      });
    }
  });
}
function selectPrivateUser(userId) {
  selectedPrivateUserId = userId;
  document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
  document.querySelector(`.user-item[onclick="selectPrivateUser('${userId}')"]`).classList.add('active');
  loadPrivateMessages();
  unreadMessages.private[userId] = 0;
  updateChatBadge();
}

function loadPublicMessages() {
  const messagesDiv = document.getElementById('public-messages');
  messagesDiv.innerHTML = '';
  db.ref('chat/public').orderByChild('timestamp').on('value', snapshot => {
    messagesDiv.innerHTML = '';
    snapshot.forEach(child => {
      const msg = child.val();
      messagesDiv.innerHTML += `
        <div class="message">
          <strong>${msg.senderName || 'Không xác định'}</strong> (${new Date(msg.timestamp).toLocaleString('vi-VN')}): ${msg.text}
        </div>
      `;
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    if (currentChatTab === 'public') {
      unreadMessages.public = 0;
      updatePublicBadge();
      updateChatBadge();
    }
  });
}

function loadPrivateMessages() {
  const messagesDiv = document.getElementById('private-messages');
  if (!selectedPrivateUserId) {
    messagesDiv.innerHTML = '<p>Chọn người dùng để xem tin nhắn</p>';
    return;
  }
  const chatId = [currentEmployeeId, selectedPrivateUserId].sort().join('_');
  messagesDiv.innerHTML = '';
  db.ref(`chat/private/${chatId}`).orderByChild('timestamp').on('value', snapshot => {
    messagesDiv.innerHTML = '';
    snapshot.forEach(child => {
      const msg = child.val();
      messagesDiv.innerHTML += `
        <div class="message">
          <strong>${msg.senderName || 'Không xác định'}</strong> (${new Date(msg.timestamp).toLocaleString('vi-VN')}): ${msg.text}
        </div>
      `;
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    if (currentChatTab === 'private' && selectedPrivateUserId) {
      unreadMessages.private[selectedPrivateUserId] = 0;
      updateChatBadge();
    }
  });
}

function sendPublicMessage() {
  const input = document.getElementById('public-message-input');
  const text = input.value.trim();
  if (!text) return;
  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee) return;
  db.ref('chat/public').push({
    text,
    senderId: currentEmployeeId,
    senderName: employee.name || 'Không xác định',
    timestamp: Date.now()
  });
  input.value = '';
}

function sendPrivateMessage() {
  const input = document.getElementById('private-message-input');
  const text = input.value.trim();
  if (!text || !selectedPrivateUserId) return;
  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee) return;
  const chatId = [currentEmployeeId, selectedPrivateUserId].sort().join('_');
  db.ref(`chat/private/${chatId}`).push({
    text,
    senderId: currentEmployeeId,
    senderName: employee.name || 'Không xác định',
    receiverId: selectedPrivateUserId,
    timestamp: Date.now()
  });
  input.value = '';
}

function updateChatBadge() {
  const badge = document.getElementById('chat-badge');
  const totalUnread = unreadMessages.public + Object.values(unreadMessages.private).reduce((sum, count) => sum + count, 0);
  badge.textContent = totalUnread;
  badge.style.display = totalUnread > 0 ? 'inline' : 'none';
}

function updatePublicBadge() {
  const badge = document.getElementById('public-unread-badge');
  badge.textContent = unreadMessages.public;
  badge.style.display = unreadMessages.public > 0 ? 'inline' : 'none';
}

function setupChatNotifications() {
  // Chat Chung
  db.ref('chat/public').on('child_added', snapshot => {
    const msg = snapshot.val();
    if (msg.senderId !== currentEmployeeId && currentChatTab !== 'public') {
      unreadMessages.public++;
      showToastNotification(`Tin nhắn mới trong Chat Chung từ ${msg.senderName}: ${msg.text.length > 30 ? msg.text.substring(0, 30) + '...' : msg.text}`);
      updatePublicBadge();
      updateChatBadge();
    }
  });

  // Chat Riêng
  globalEmployeeData.forEach(user => {
    if (user.id !== currentEmployeeId) {
      const chatId = [currentEmployeeId, user.id].sort().join('_');
      db.ref(`chat/private/${chatId}`).on('child_added', snapshot => {
        const msg = snapshot.val();
        if (msg.senderId !== currentEmployeeId && (currentChatTab !== 'private' || selectedPrivateUserId !== msg.senderId)) {
          unreadMessages.private[msg.senderId] = (unreadMessages.private[msg.senderId] || 0) + 1;
          showToastNotification(`Tin nhắn mới từ ${msg.senderName}: ${msg.text.length > 30 ? msg.text.substring(0, 30) + '...' : msg.text}`);
          loadPrivateUserList();
          updateChatBadge();
        }
      });
    }
  });
}

function showToastNotification(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">💬</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function markMessagesAsRead() {
  if (currentChatTab === 'public') {
    unreadMessages.public = 0;
    updatePublicBadge();
  } else if (currentChatTab === 'private' && selectedPrivateUserId) {
    unreadMessages.private[selectedPrivateUserId] = 0;
  }
  updateChatBadge();
}