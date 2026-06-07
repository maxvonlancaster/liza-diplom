// ================================================
//  QA RAG Assistant — script.js
// ================================================

const API = 'https://chnu-ai-systems-production.up.railway.app'; // Railway QA endpoint

// ---- DOM refs ----
const welcomeView  = document.getElementById('welcome-view');
const chatView     = document.getElementById('chat-view');
const messagesEl   = document.getElementById('messages');
const messageInput = document.getElementById('message');
const sendBtn      = document.getElementById('send-btn');
const fileInput    = document.getElementById('file-input');
const uploadTrigger= document.getElementById('upload-trigger');
const uploadZone   = document.getElementById('upload-zone');
const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressLabel= document.getElementById('progress-label');
const docList      = document.getElementById('doc-list');
const docsCount    = document.getElementById('docs-count');
const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');

// ---- State ----
let chatHistory = [];   // [{q, a}, ...]
let isLoading   = false;

// ================================================
//  INIT
// ================================================
(async function init() {
  await checkHealth();
  // Railway QA endpoint не підтримує управління документами
  renderDocList([]);
})();

// ================================================
//  HEALTH CHECK
// ================================================
async function checkHealth() {
  try {
    const res = await fetch(`${API}/api/qa`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'https://example.com', context: '', chat_history: [] })
    });
    if (res.ok) {
      setStatus('online', 'Сервер онлайн');
    } else {
      setStatus('offline', 'Сервер недоступний');
    }
  } catch {
    setStatus('offline', 'Сервер недоступний');
  }
}

function setStatus(state, label) {
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = label;
}

// ================================================
//  DOCUMENTS — LOAD
// ================================================
async function loadDocuments() {
  try {
    const res  = await fetch(`${API}/api/documents`);
    const data = await res.json();
    renderDocList(data.documents || []);
  } catch {
    renderDocList([]);
  }
}

function renderDocList(docs) {
  docsCount.textContent = `${docs.length} документ${ending(docs.length)} у базі`;

  if (docs.length === 0) {
    docList.innerHTML = '<li class="doc-empty">Документи відсутні</li>';
    return;
  }

  docList.innerHTML = docs.map(d => `
    <li class="doc-item">
      <i class="fa fa-file-lines doc-icon"></i>
      <span class="doc-name" title="${esc(d.name)}">${esc(d.name)}</span>
      ${d.chunks ? `<span class="doc-chunks">${d.chunks}</span>` : ''}
      <button class="doc-delete" onclick="deleteDoc('${esc(d.name)}')" title="Видалити">
        <i class="fa fa-xmark"></i>
      </button>
    </li>
  `).join('');
}

// ================================================
//  DOCUMENTS — UPLOAD
// ================================================
uploadTrigger.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) uploadFiles(fileInput.files);
});

// drag-and-drop
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
});

async function uploadFiles(files) {
  for (const file of files) {
    await uploadSingleFile(file);
  }
  await loadDocuments();
}

async function uploadSingleFile(file) {
  showUploadProgress(0, `Завантаження: ${file.name}`);

  const formData = new FormData();
  formData.append('file', file);

  try {
    // simulate progress during upload
    let fakeProgress = 0;
    const ticker = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + 8, 85);
      setProgress(fakeProgress);
    }, 180);

    const res  = await fetch(`${API}/api/upload`, { method: 'POST', body: formData });
    clearInterval(ticker);

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    setProgress(100, `Готово: ${data.chunks} фрагментів`);

    await new Promise(r => setTimeout(r, 700));
    showToast(`✓ ${file.name} — ${data.chunks} фрагментів`, 'success');
  } catch (err) {
    showToast(`Помилка завантаження: ${err.message}`, 'error');
  } finally {
    hideUploadProgress();
    fileInput.value = '';
  }
}

function showUploadProgress(pct, label) {
  uploadTrigger.style.display = 'none';
  uploadProgress.style.display = 'block';
  setProgress(pct, label);
}

function setProgress(pct, label) {
  progressFill.style.width = pct + '%';
  if (label) progressLabel.textContent = label;
}

function hideUploadProgress() {
  uploadTrigger.style.display = 'flex';
  uploadProgress.style.display = 'none';
  setProgress(0);
}

// ================================================
//  DOCUMENTS — DELETE
// ================================================
async function deleteDoc(name) {
  try {
    await fetch(`${API}/api/documents/${encodeURIComponent(name)}`, { method: 'DELETE' });
    showToast(`Видалено: ${name}`, 'success');
    await loadDocuments();
  } catch {
    showToast('Помилка видалення', 'error');
  }
}

// ================================================
//  CHAT — INPUT
// ================================================
messageInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && e.shiftKey && !isLoading) {
    e.preventDefault();
    await sendMessage();
  }
  // auto-resize
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';
});

sendBtn.addEventListener('click', () => { if (!isLoading) sendMessage(); });

// ================================================
//  CHAT — SEND MESSAGE
// ================================================
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  showChatView();

  // addMessage('user', `Аналізую: ${urlToAnalyze}`);
  messageInput.value = '';
  messageInput.style.height = 'auto';

  setLoading(true);
  const typingId = addTyping();

  try {
    const res = await fetch(`${API}/api/qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: text, 
        context: '', 
        chat_history: chatHistory 
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Response:', res.status, errText);
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    const data = await res.json();

    removeTyping(typingId);
    
    // Handle different response formats
    let responseText = '';
    if (data.status === 'failed') {
      responseText = `❌ Помилка аналізу:\n${data.reasons?.join('\n') || 'Невідома помилка'}`;
    } else if (data.answer) {
      responseText = data.answer;
    } else if (data.response) {
      responseText = data.response;
    } else {
      responseText = JSON.stringify(data, null, 2);
    }
    
    addMessage('assistant', responseText, data.sources || []);
    chatHistory.push({ q: text, a: responseText });

  } catch (err) {
    removeTyping(typingId);
    addMessage('assistant', `Помилка: ${err.message}. Перевірте URL та спробуйте ще раз.`, []);
  } finally {
    setLoading(false);
  }
}

// ================================================
//  CHAT — RENDER MESSAGES
// ================================================
function addMessage(role, text, sources = []) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatarIcon = role === 'user' ? 'fa-user' : 'fa-hexagon-nodes';
  const roleLabel  = role === 'user' ? 'ВИ' : 'QA ASSIST';

  let sourcesHTML = '';
  if (sources && sources.length > 0) {
    const chips = sources.map(s => `
      <div class="source-chip">
        <span class="source-file"><i class="fa fa-file-lines"></i> ${esc(s.source)}</span>
        <span class="source-excerpt">${esc(s.content)}</span>
      </div>
    `).join('');
    sourcesHTML = `
      <div class="sources-block">
        <div class="sources-label"><i class="fa fa-link"></i> ДЖЕРЕЛА</div>
        ${chips}
      </div>
    `;
  }

  div.innerHTML = `
    <div class="msg-avatar"><i class="fa ${avatarIcon}"></i></div>
    <div class="msg-body">
      <div class="msg-role">${roleLabel}</div>
      <div class="msg-text">${renderMarkdown(text)}</div>
      ${sourcesHTML}
    </div>
  `;

  messagesEl.appendChild(div);
  scrollToBottom();
  return div;
}

function addTyping() {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar"><i class="fa fa-hexagon-nodes"></i></div>
    <div class="msg-body">
      <div class="msg-role">QA ASSIST</div>
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messagesEl.appendChild(div);
  scrollToBottom();
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ================================================
//  MARKDOWN — minimal renderer
// ================================================
function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code>$1</code>')
    .replace(/\n/g,             '<br>');
}

function esc(str) {
  if (!str) return '';
  return str
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ================================================
//  HELPERS
// ================================================
function showChatView() {
  welcomeView.style.display = 'none';
  chatView.style.display    = 'flex';
}

function scrollToBottom() {
  chatView.scrollTop = chatView.scrollHeight;
}

function setLoading(state) {
  isLoading = state;
  sendBtn.disabled = state;
  messageInput.disabled = state;
}

function setPrompt(text) {
  messageInput.value = text;
  messageInput.focus();
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 180) + 'px';
}

function ending(n) {
  if (n % 10 === 1 && n % 100 !== 11) return '';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'и';
  return 'ів';
}

// ================================================
//  TOAST
// ================================================
let toastTimer;
const toast = document.createElement('div');
toast.id = 'toast';
document.body.appendChild(toast);

function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className   = type ? `show ${type}` : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = type; }, 2800);
}