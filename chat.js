// chat.js
let unreadMessages = { public: 0, private: {} };
let currentChatTab = 'public';
let selectedPrivateUserId = null;
let publicEmojiPicker = null;
let privateEmojiPicker = null;

function openChatModal() {
  if (!firebase.database || !firebase.storage || !globalEmployeeData || !currentEmployeeId) {
    showToastNotification('Hệ thống chưa sẵn sàng, vui lòng thử lại sau!');
    return;
  }
  const modal = document.getElementById('chat-modal');
  if (!modal) {
    console.error('Modal chat not found');
    return;
  }
  modal.style.display = 'block';
  initEmojiPickers();
  switchChatTab(currentChatTab);
  updateChatBadge();
}

function initEmojiPickers() {
  if (!window.EmojiMart) {
    console.error('EmojiMart not loaded');
    return;
  }
  if (!publicEmojiPicker) {
    publicEmojiPicker = new EmojiMart.Picker({
      data: async () => {
        try {
          const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
          return response.json();
        } catch (err) {
          console.error('Failed to load emoji data:', err);
          return {};
        }
      },
      onEmojiSelect: (emoji) => {
        const input = document.getElementById('public-message-input');
        if (input) {
          input.value += emoji.native;
          input.focus();
        }
        document.getElementById('public-emoji-picker').style.display = 'none';
      }
    });
    const publicPickerContainer = document.getElementById('public-emoji-picker');
    if (publicPickerContainer) publicPickerContainer.appendChild(publicEmojiPicker);
  }
  if (!privateEmojiPicker) {
    privateEmojiPicker = new EmojiMart.Picker({
      data: async () => {
        try {
          const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
          return response.json();
        } catch (err) {
          console.error('Failed to load emoji data:', err);
          return {};
        }
      },
      onEmojiSelect: (emoji) => {
        const input = document.getElementById('private-message-input');
        if (input) {
          input.value += emoji.native;
          input.focus();
        }
        document.getElementById('private-emoji-picker').style.display = 'none';
      }
    });
    const privatePickerContainer = document.getElementById('private-emoji-picker');
    if (privatePickerContainer) privatePickerContainer.appendChild(privateEmojiPicker);
  }

  const publicEmojiBtn = document.getElementById('public-emoji-btn');
  if (publicEmojiBtn) {
    publicEmojiBtn.onclick = () => {
      const picker = document.getElementById('public-emoji-picker');
      if (picker) picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    };
  }
  const privateEmojiBtn = document.getElementById('private-emoji-btn');
  if (privateEmojiBtn) {
    privateEmojiBtn.onclick = () => {
      const picker = document.getElementById('private-emoji-picker');
      if (picker) picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    };
  }
}

function switchChatTab(tab) {
  currentChatTab = tab;
  const publicTab = document.getElementById('chat-public');
  const employeesTab = document.getElementById('chat-employees');
  const privateChat = document.getElementById('chat-private');
  const employeeList = document.getElementById('employee-list');
  const publicBtn = document.querySelector('button[onclick="switchChatTab(\'public\')"]');
  const employeesBtn = document.querySelector('button[onclick="switchChatTab(\'employees\')"]');

  if (!publicTab || !employeesTab || !publicBtn || !employeesBtn) {
    console.error('Chat tab elements not found');
    return;
  }

  if (tab === 'public') {
    publicTab.style.display = 'block';
    employeesTab.style.display = 'none';
    publicBtn.classList.add('active');
    employeesBtn.classList.remove('active');
    loadPublicMessages();
    markMessagesAsRead('public');
  } else {
    publicTab.style.display = 'none';
    employeesTab.style.display = 'block';
    publicBtn.classList.remove('active');
    employeesBtn.classList.add('active');
    if (selectedPrivateUserId && privateChat && employeeList) {
      employeeList.style.display = 'none';
      privateChat.style.display = 'block';
      loadPrivateMessages(selectedPrivateUserId);
    } else if (employeeList && privateChat) {
      employeeList.style.display = 'block';
      privateChat.style.display = 'none';
      loadEmployeeList();
    }
  }
}

function loadPublicMessages() {
  const messagesDiv = document.getElementById('public-messages');
  if (!messagesDiv) return;
  messagesDiv.innerHTML = '';
  db.ref('chat/public').orderByChild('timestamp').on('value', snapshot => {
    messagesDiv.innerHTML = '';
    snapshot.forEach(child => {
      const msg = child.val();
      const content = msg.imageUrl ? `<img src="${msg.imageUrl}" style="max-width: 200px; border-radius: 8px;">` : msg.text;
      messagesDiv.innerHTML += `
        <div class="message">
          <strong>${msg.senderName || 'Không xác định'}</strong> (${new Date(msg.timestamp).toLocaleString('vi-VN')}): ${content}
        </div>
      `;
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    unreadMessages.public = 0;
    updateChatBadge();
  }, err => {
    console.error('Failed to load public messages:', err);
  });
}

function loadEmployeeList() {
  const employeeListDiv = document.getElementById('employee-list');
  if (!employeeListDiv) return;
  employeeListDiv.innerHTML = '';
  if (!globalEmployeeData || globalEmployeeData.length === 0) {
    employeeListDiv.innerHTML = '<p>Không có nhân viên nào.</p>';
    return;
  }
  globalEmployeeData.forEach(employee => {
    if (employee.id !== currentEmployeeId) {
      employeeListDiv.innerHTML += `
        <div class="employee-item" onclick="selectPrivateUser('${employee.id}')">
          <div class="employee-info">
            <strong>${employee.name || 'Không xác định'}</strong>
            <p>${employee.role || 'Không có vai trò'}</p>
          </div>
        </div>
      `;
    }
  });
}

function selectPrivateUser(userId) {
  selectedPrivateUserId = userId;
  const employee = globalEmployeeData.find(e => e.id === userId);
  if (!employee) return;
  const privateUserName = document.getElementById('private-user-name');
  if (privateUserName) privateUserName.textContent = employee.name || 'Không xác định';
  const employeeList = document.getElementById('employee-list');
  const privateChat = document.getElementById('chat-private');
  if (employeeList && privateChat) {
    employeeList.style.display = 'none';
    privateChat.style.display = 'block';
    loadPrivateMessages(userId);
    markMessagesAsRead('private', userId);
  }
}

function loadPrivateMessages(userId) {
  const messagesDiv = document.getElementById('private-messages');
  if (!messagesDiv) return;
  messagesDiv.innerHTML = '';
  const chatId = [currentEmployeeId, userId].sort().join('_');
  db.ref(`chat/private/${chatId}`).orderByChild('timestamp').on('value', snapshot => {
    messagesDiv.innerHTML = '';
    snapshot.forEach(child => {
      const msg = child.val();
      const content = msg.imageUrl ? `<img src="${msg.imageUrl}" style="max-width: 200px; border-radius: 8px;">` : msg.text;
      messagesDiv.innerHTML += `
        <div class="message">
          <strong>${msg.senderName || 'Không xác định'}</strong> (${new Date(msg.timestamp).toLocaleString('vi-VN')}): ${content}
        </div>
      `;
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    if (!unreadMessages.private[userId]) unreadMessages.private[userId] = 0;
    unreadMessages.private[userId] = 0;
    updateChatBadge();
  }, err => {
    console.error('Failed to load private messages:', err);
  });
}

function sendPublicMessage() {
  const input = document.getElementById('public-message-input');
  const fileInput = document.getElementById('public-image-input');
  const text = input && input.value.trim();
  const file = fileInput && fileInput.files[0];
  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee || (!text && !file)) {
    showToastNotification('Vui lòng nhập tin nhắn hoặc chọn ảnh!');
    return;
  }

  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      showToastNotification('Ảnh quá lớn! Vui lòng chọn ảnh dưới 5MB.');
      return;
    }
    const storageRef = firebase.storage().ref(`chat/public/images/${Date.now()}_${file.name}`);
    storageRef.put(file).then(snapshot => {
      snapshot.ref.getDownloadURL().then(url => {
        db.ref('chat/public').push({
          imageUrl: url,
          senderId: currentEmployeeId,
          senderName: employee.name || 'Không xác định',
          timestamp: Date.now()
        });
        if (fileInput) fileInput.value = '';
        showToastNotification('Đã gửi ảnh thành công!');
      }).catch(err => {
        console.error('Failed to get download URL:', err);
        showToastNotification('Lỗi khi gửi ảnh!');
      });
    }).catch(err => {
      console.error('Failed to upload image:', err);
      showToastNotification('Lỗi khi gửi ảnh! Vui lòng kiểm tra kết nối hoặc thử lại.');
    });
  }
  if (text) {
    db.ref('chat/public').push({
      text,
      senderId: currentEmployeeId,
      senderName: employee.name || 'Không xác định',
      timestamp: Date.now()
    });
  }
  if (input) input.value = '';
}

function sendPrivateMessage() {
  if (!selectedPrivateUserId) {
    showToastNotification('Vui lòng chọn người nhận!');
    return;
  }
  const input = document.getElementById('private-message-input');
  const fileInput = document.getElementById('private-image-input');
  const text = input && input.value.trim();
  const file = fileInput && fileInput.files[0];
  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee || (!text && !file)) {
    showToastNotification('Vui lòng nhập tin nhắn hoặc chọn ảnh!');
    return;
  }

  const chatId = [currentEmployeeId, selectedPrivateUserId].sort().join('_');
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      showToastNotification('Ảnh quá lớn! Vui lòng chọn ảnh dưới 5MB.');
      return;
    }
    const storageRef = firebase.storage().ref(`chat/private/${chatId}/images/${Date.now()}_${file.name}`);
    storageRef.put(file).then(snapshot => {
      snapshot.ref.getDownloadURL().then(url => {
        db.ref(`chat/private/${chatId}`).push({
          imageUrl: url,
          senderId: currentEmployeeId,
          senderName: employee.name || 'Không xác định',
          timestamp: Date.now()
        });
        if (fileInput) fileInput.value = '';
        showToastNotification('Đã gửi ảnh thành công!');
      }).catch(err => {
        console.error('Failed to get download URL:', err);
        showToastNotification('Lỗi khi gửi ảnh!');
      });
    }).catch(err => {
      console.error('Failed to upload image:', err);
      showToastNotification('Lỗi khi gửi ảnh! Vui lòng kiểm tra kết nối hoặc thử lại.');
    });
  }
  if (text) {
    db.ref(`chat/private/${chatId}`).push({
      text,
      senderId: currentEmployeeId,
      senderName: employee.name || 'Không xác định',
      timestamp: Date.now()
    });
  }
  if (input) input.value = '';
}

function updateChatBadge() {
  const badge = document.getElementById('chat-badge');
  if (!badge) return;
  const privateUnread = Object.values(unreadMessages.private).reduce((sum, count) => sum + count, 0);
  const totalUnread = unreadMessages.public + privateUnread;
  badge.textContent = totalUnread;
  badge.style.display = totalUnread > 0 ? 'inline' : 'none';
}

function setupChatNotifications() {
  db.ref('chat/public').on('child_added', snapshot => {
    const msg = snapshot.val();
    if (msg.senderId !== currentEmployeeId) {
      unreadMessages.public++;
      const content = msg.imageUrl ? 'đã gửi một hình ảnh' : msg.text.length > 30 ? msg.text.substring(0, 30) + '...' : msg.text;
      showToastNotification(`Tin nhắn mới trong Chat Chung từ ${msg.senderName}: ${content}`);
      updateChatBadge();
    }
  });
  if (globalEmployeeData) {
    globalEmployeeData.forEach(employee => {
      if (employee.id !== currentEmployeeId) {
        const chatId = [currentEmployeeId, employee.id].sort().join('_');
        db.ref(`chat/private/${chatId}`).on('child_added', snapshot => {
          const msg = snapshot.val();
          if (msg.senderId !== currentEmployeeId && (currentChatTab !== 'employees' || selectedPrivateUserId !== employee.id)) {
            if (!unreadMessages.private[employee.id]) unreadMessages.private[employee.id] = 0;
            unreadMessages.private[employee.id]++;
            const content = msg.imageUrl ? 'đã gửi một hình ảnh' : msg.text.length > 30 ? msg.text.substring(0, 30) + '...' : msg.text;
            showToastNotification(`Tin nhắn riêng mới từ ${msg.senderName}: ${content}`);
            updateChatBadge();
          }
        });
      }
    });
  }
}

function showToastNotification(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">💬</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function markMessagesAsRead(type, userId = null) {
  if (type === 'public') {
    unreadMessages.public = 0;
  } else if (type === 'private' && userId) {
    if (!unreadMessages.private[userId]) unreadMessages.private[userId] = 0;
    unreadMessages.private[userId] = 0;
  }
  updateChatBadge();
}