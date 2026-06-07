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
// const fileInput    = document.getElementById('file-input');
// const uploadTrigger= document.getElementById('upload-trigger');
// const uploadZone   = document.getElementById('upload-zone');
// const uploadProgress = document.getElementById('upload-progress');
const progressFill = document.getElementById('progress-fill');
const progressLabel= document.getElementById('progress-label');
const docList      = document.getElementById('doc-list');
const docsCount    = document.getElementById('docs-count');
const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');
const modeSelector = document.getElementById('mode-selector');
const inputArea    = document.getElementById('input-area');
const documentsForm = document.getElementById('documents-form');
const docSubmissionForm = document.getElementById('doc-submission-form');

// ---- State ----
let chatHistory = [];   // [{q, a}, ...]
let isLoading   = false;
let currentMode = 'qa'; // 'qa' or 'documents'
let docEntryCount = 1;

// ================================================
//  INIT
// ================================================
(async function init() {
  await checkHealth();
  renderDocList([]);
  setupSidebarForm();
})();

// ================================================
//  SIDEBAR — DOCUMENT FORM
// ================================================
function setupSidebarForm() {
  const toggleBtn = document.getElementById('toggle-form-btn');
  const form = document.getElementById('sidebar-doc-form');
  
  toggleBtn.addEventListener('click', () => {
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'flex' : 'none';
    toggleBtn.classList.toggle('open');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitSidebarDocuments();
  });
}

function addSidebarDocEntry() {
  const container = document.getElementById('sidebar-docs-container');
  const index = docEntryCount++;
  
  const entry = document.createElement('div');
  entry.className = 'sidebar-doc-entry';
  entry.dataset.index = index;
  entry.innerHTML = `
    <div class="entry-title">
      <span>Документ ${index + 1}</span>
      <button type="button" class="entry-remove-btn" onclick="removeSidebarDocEntry(${index})">
        <i class="fa fa-times"></i>
      </button>
    </div>
    <div class="sidebar-form-group">
      <label for="sidebar-title-${index}">Назва</label>
      <input type="text" id="sidebar-title-${index}" placeholder="Homepage overview" required>
    </div>
    <div class="sidebar-form-group">
      <label for="sidebar-content-${index}">Вміст</label>
      <textarea id="sidebar-content-${index}" placeholder="Вміст..." rows="2" required></textarea>
    </div>
    <div class="sidebar-form-group">
      <label for="sidebar-source-${index}">URL</label>
      <input type="url" id="sidebar-source-${index}" placeholder="https://example.com/" required>
    </div>
    <div class="sidebar-form-group">
      <label for="sidebar-section-${index}">Розділ</label>
      <input type="text" id="sidebar-section-${index}" placeholder="homepage">
    </div>
  `;
  
  container.appendChild(entry);
  updateSidebarRemoveButtonVisibility();
}

function removeSidebarDocEntry(index) {
  const entry = document.querySelector(`[data-index="${index}"]`);
  if (entry) {
    entry.remove();
    updateSidebarRemoveButtonVisibility();
  }
}

function updateSidebarRemoveButtonVisibility() {
  const entries = document.querySelectorAll('.sidebar-doc-entry');
  entries.forEach(entry => {
    const removeBtn = entry.querySelector('.entry-remove-btn');
    removeBtn.style.display = entries.length > 1 ? 'block' : 'none';
  });
}

async function submitSidebarDocuments() {
  const website = document.getElementById('sidebar-website').value;
  const entries = document.querySelectorAll('.sidebar-doc-entry');
  
  const documents = Array.from(entries).map(entry => {
    const index = entry.dataset.index;
    return {
      title: document.getElementById(`sidebar-title-${index}`).value,
      content: document.getElementById(`sidebar-content-${index}`).value,
      source: document.getElementById(`sidebar-source-${index}`).value,
      metadata: {
        section: document.getElementById(`sidebar-section-${index}`).value || 'general'
      }
    };
  });

  if (!website || documents.length === 0) {
    showToast('Заповніть все поля', 'error');
    return;
  }

  const submitBtn = document.querySelector('.submit-btn-sidebar');
  submitBtn.disabled = true;

  try {
    const payload = { website, documents };
    console.log('Submitting documents:', payload);

    const res = await fetch(`${API}/api/qa/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Response:', res.status, errText);
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    console.log('Response:', data);

    showToast(`✓ Документи успішно завантажені! (${documents.length})`, 'success');
    document.getElementById('sidebar-doc-form').reset();
    
    // Reset to single entry
    const container = document.getElementById('sidebar-docs-container');
    const allEntries = container.querySelectorAll('.sidebar-doc-entry');
    allEntries.forEach((entry, idx) => {
      if (idx > 0) entry.remove();
    });
    docEntryCount = 1;
    updateSidebarRemoveButtonVisibility();

  } catch (err) {
    console.error('Error:', err);
    showToast(`Помилка завантаження: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

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
// uploadTrigger.addEventListener('click', () => fileInput.click());

// fileInput.addEventListener('change', () => {
//   if (fileInput.files.length > 0) uploadFiles(fileInput.files);
// });

// drag-and-drop
// uploadZone.addEventListener('dragover', e => {
//   e.preventDefault();
//   uploadZone.classList.add('drag-over');
// });
// uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
// uploadZone.addEventListener('drop', e => {
//   e.preventDefault();
//   uploadZone.classList.remove('drag-over');
//   if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
// });

async function uploadFiles(files) {
  for (const file of files) {
    await uploadSingleFile(file);
  }
  await loadDocuments();
}

async function uploadSingleFile(file) {
  // showUploadProgress(0, `Завантаження: ${file.name}`);

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
    // fileInput.value = '';
  }
}

function showUploadProgress(pct, label) {
  // uploadTrigger.style.display = 'none';
  uploadProgress.style.display = 'block';
  setProgress(pct, label);
}

function setProgress(pct, label) {
  progressFill.style.width = pct + '%';
  if (label) progressLabel.textContent = label;
}

function hideUploadProgress() {
  // uploadTrigger.style.display = 'flex';
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
    if (data.status === 'failed') {
      const responseText = `❌ Помилка аналізу:\n${data.reasons?.join('\n') || 'Невідома помилка'}`;
      addMessage('assistant', responseText, data.sources || []);
      chatHistory.push({ q: text, a: responseText });
    } else if (data.case === 'web_page' || data.bug_reports) {
      // This is a QA response with bug reports
      addQACard(data);
      chatHistory.push({ q: text, a: data });
    } else if (data.answer) {
      addMessage('assistant', data.answer, data.sources || []);
      chatHistory.push({ q: text, a: data.answer });
    } else if (data.response) {
      addMessage('assistant', data.response, data.sources || []);
      chatHistory.push({ q: text, a: data.response });
    } else {
      const responseText = JSON.stringify(data, null, 2);
      addMessage('assistant', responseText, data.sources || []);
      chatHistory.push({ q: text, a: responseText });
    }

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

// ================================================
//  QA CARD — RENDER
// ================================================
function addQACard(data) {
  const div = document.createElement('div');
  div.className = 'message assistant';

  // Case badge
  const caseBadge = data.case ? `<span class="qa-case-badge">${esc(data.case)}</span>` : '';
  
  // Confidence level
  let confidenceClass = 'low';
  if (data.confidence >= 0.8) confidenceClass = 'high';
  else if (data.confidence >= 0.6) confidenceClass = 'medium';
  const confidenceBadge = data.confidence !== undefined 
    ? `<span class="qa-confidence ${confidenceClass}">${Math.round(data.confidence * 100)}%</span>`
    : '';

  // Summary
  const summaryHTML = data.summary ? `
    <div class="qa-summary">
      ${renderMarkdown(data.summary)}
    </div>
  ` : '';

  // Bug reports
  let bugReportsHTML = '';
  if (data.bug_reports && data.bug_reports.length > 0) {
    const reports = data.bug_reports.map(bug => `
      <div class="bug-report">
        <div class="bug-report-title">
          <span>${esc(bug.title)}</span>
          ${bug.severity ? `<span class="bug-severity ${bug.severity}">${bug.severity}</span>` : ''}
        </div>
        
        ${bug.description ? `
          <div class="bug-report-section">
            <span class="bug-report-label">Опис</span>
            <div class="bug-report-content">${esc(bug.description)}</div>
          </div>
        ` : ''}
        
        ${bug.steps_to_reproduce && bug.steps_to_reproduce.length > 0 ? `
          <div class="bug-report-section">
            <span class="bug-report-label">Кроки для відтворення</span>
            <div class="bug-report-content">
              <ol>${bug.steps_to_reproduce.map(step => `<li>${esc(step)}</li>`).join('')}</ol>
            </div>
          </div>
        ` : ''}
        
        ${bug.expected_result ? `
          <div class="bug-report-section">
            <span class="bug-report-label">Очікуваний результат</span>
            <div class="bug-report-content">${esc(bug.expected_result)}</div>
          </div>
        ` : ''}
        
        ${bug.actual_result ? `
          <div class="bug-report-section">
            <span class="bug-report-label">Фактичний результат</span>
            <div class="bug-report-content">${esc(bug.actual_result)}</div>
          </div>
        ` : ''}
        
        ${bug.additional_context ? `
          <div class="bug-report-section">
            <span class="bug-report-label">Додатковий контекст</span>
            <div class="bug-report-content">${esc(bug.additional_context)}</div>
          </div>
        ` : ''}
      </div>
    `).join('');

    bugReportsHTML = `
      <div class="bug-reports-container">
        ${reports}
      </div>
    `;
  }

  // Related context
  let contextHTML = '';
  if (data.related_context) {
    contextHTML = `
      <div class="qa-context">
        <div class="qa-context-label">
          <i class="fa fa-circle-info"></i> ДОДАТКОВА ІНФОРМАЦІЯ
        </div>
        ${esc(data.related_context)}
      </div>
    `;
  }

  div.innerHTML = `
    <div class="msg-avatar"><i class="fa fa-hexagon-nodes"></i></div>
    <div class="msg-body">
      <div class="msg-role">QA ASSIST</div>
      <div class="qa-card">
        <div class="qa-header">
          ${caseBadge}
          ${confidenceBadge}
        </div>
        ${summaryHTML}
        ${bugReportsHTML}
        ${contextHTML}
      </div>
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