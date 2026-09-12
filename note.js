// === LOGIKA JAM REAL-TIME ===
function updateClock() {
    const now = new Date();
    const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
    document.getElementById('realtimeClock').innerText = now.toLocaleTimeString('id-ID', options).replace(/\./g, ':') + ' WIB';

    const hour = parseInt(now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }));
    let greeting = "Malam!";
    if (hour >= 5 && hour < 11) greeting = "Pagi!";
    else if (hour >= 11 && hour < 15) greeting = "Siang!";
    else if (hour >= 15 && hour < 18) greeting = "Sore!";
    document.getElementById('greetingText').innerText = greeting;
}
setInterval(updateClock, 1000);
updateClock();

// === MANAJEMEN DATA ===
let tasks = JSON.parse(localStorage.getItem("dataTugasPPLG")) || [];
let currentFilter = 'all';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const filterBtns = document.querySelectorAll('.filter-btn');

// === SISTEM NOTIFIKASI (TOAST) ===
let deleteTimer;
let deletedTaskBackup = null;
let deletedTaskIndex = -1;

function showToast(message, isUndo = false) {
    const container = document.getElementById('toastContainer');
    container.innerHTML = ''; // Clear existing toast

    const toast = document.createElement('div');
    toast.className = 'toast';
    
    if (isUndo) {
        toast.innerHTML = `
            <span>${message} <span id="toastCount" style="color:var(--secondary)">3</span>s</span>
            <button class="toast-undo-btn" id="btnUndoToast">Batal (Undo)</button>
        `;
        
        let timeLeft = 3;
        deleteTimer = setInterval(() => {
            timeLeft--;
            const countEl = document.getElementById('toastCount');
            if(countEl) countEl.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(deleteTimer);
                toast.remove();
                deletedTaskBackup = null;
            }
        }, 1000);

        setTimeout(() => {
            const btnUndo = document.getElementById('btnUndoToast');
            if(btnUndo) {
                btnUndo.onclick = () => {
                    clearInterval(deleteTimer);
                    if (deletedTaskBackup) {
                        tasks.splice(deletedTaskIndex, 0, deletedTaskBackup);
                        saveData();
                        renderTasks();
                        showToast("✅ Tugas dikembalikan.");
                    }
                    toast.remove();
                };
            }
        }, 0);
    } else {
        toast.innerHTML = `<span>${message}</span>`;
        setTimeout(() => toast.remove(), 3000);
    }
    
    container.appendChild(toast);
}

// === UTILITAS TANGGAL ===
function formatDate(dateString) {
    if (!dateString) return "Tanpa Tenggat";
    return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDateStatus(dateString) {
    if (!dateString) return { status: 'none', text: 'Tanpa Tenggat' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(dateString);
    deadline.setHours(0, 0, 0, 0);
    
    const diffTime = deadline - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: 'overdue', text: `Terlambat (${formatDate(dateString)})` };
    if (diffDays === 0) return { status: 'today', text: 'Hari Ini' };
    return { status: 'normal', text: formatDate(dateString) };
}

function saveData() {
    localStorage.setItem("dataTugasPPLG", JSON.stringify(tasks));
}

// === RENDER & STATISTIK ===
function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    const overdue = tasks.filter(t => !t.completed && t.deadline && getDateStatus(t.deadline).status === 'overdue').length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    document.getElementById('statTotal').innerText = total;
    document.getElementById('statCompleted').innerText = completed;
    document.getElementById('statActive').innerText = active;
    document.getElementById('statOverdue').innerText = overdue;
    document.getElementById('progressFill').style.width = progress + '%';
    
    const progressText = document.getElementById('progressText');
    if (progressText) progressText.innerText = progress + '%';
}

function updateNearestTask() {
    const container = document.getElementById('nearestTaskContainer');
    const upcomingTasks = tasks.filter(t => !t.completed && t.deadline && getDateStatus(t.deadline).status !== 'overdue');
    
    if (upcomingTasks.length > 0) {
        upcomingTasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
        const nearest = upcomingTasks[0];
        const status = getDateStatus(nearest.deadline);
        const timeText = status.status === 'today' ? '<strong style="color:var(--danger)">HARI INI!</strong>' : `pada <strong>${formatDate(nearest.deadline)}</strong>`;
        
        container.innerHTML = `
            <div class="nearest-card">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Fokus: <b>${nearest.name}</b> selesai ${timeText}</span>
            </div>
        `;
    } else {
        const hasOverdue = tasks.some(t => !t.completed && t.deadline && getDateStatus(t.deadline).status === 'overdue');
        if (hasOverdue) {
            container.innerHTML = '<div class="nearest-card" style="background:var(--danger-light); border-color:var(--danger); color:var(--danger);">🚨 Selesaikan tugas yang terlambat!</div>';
        } else {
            container.innerHTML = ''; // Kosongkan jika tidak ada tugas mendesak
        }
    }
}

function renderTasks() {
    const taskList = document.getElementById("taskList");
    taskList.innerHTML = ""; 
    const query = searchInput.value.toLowerCase();
    const sortBy = sortSelect.value;

    let filteredTasks = tasks.map((task, index) => ({...task, originalIndex: index}))
        .filter(task => {
            const matchSearch = task.name.toLowerCase().includes(query);
            const matchFilter = currentFilter === 'all' || 
                              (currentFilter === 'active' && !task.completed) || 
                              (currentFilter === 'completed' && task.completed);
            return matchSearch && matchFilter;
        });

    // Logika Sorting
    filteredTasks.sort((a, b) => {
        if (sortBy === 'newest') return b.originalIndex - a.originalIndex;
        
        // Handle tanggal kosong
        if (!a.deadline && b.deadline) return 1;
        if (a.deadline && !b.deadline) return -1;
        if (!a.deadline && !b.deadline) return b.originalIndex - a.originalIndex;

        const dateA = new Date(a.deadline);
        const dateB = new Date(b.deadline);
        return sortBy === 'nearest' ? dateA - dateB : dateB - dateA;
    });

    if(filteredTasks.length === 0) {
        taskList.innerHTML = '<div class="empty-state">Mulus! Tidak ada tugas di sini. ✨</div>';
    }

    filteredTasks.forEach(task => {
        const li = document.createElement("li");
        li.className = `task-item ${task.completed ? "completed" : ""}`;
        
        const subj = task.subject || task.category || "Umum";
        const prio = task.priority || "Sedang";
        const dateStat = !task.completed ? getDateStatus(task.deadline) : { status: 'normal', text: formatDate(task.deadline) };
        
        let dateClass = "badge-date";
        let dateIcon = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
        
        if (dateStat.status === 'overdue') dateClass += " overdue";
        if (dateStat.status === 'today') dateClass += " today";

        li.innerHTML = `
            <div class="custom-checkbox" onclick="toggleComplete(${task.originalIndex})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="task-info">
                <div class="task-title">${task.name}</div>
                <div class="task-meta">
                    <span class="badge badge-subject">🏷️ ${subj}</span>
                    <span class="badge badge-subject"><span class="dot dot-${prio.toLowerCase()}"></span> ${prio}</span>
                    <span class="${dateClass}">${dateIcon} ${dateStat.text}</span>
                </div>
            </div>
            <button class="btn-delete" onclick="deleteTask(${task.originalIndex})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        `;
        taskList.appendChild(li);
    });

    updateStats();
    updateNearestTask();
}

// === EVENT LISTENERS ===
document.getElementById("btnAdd").addEventListener("click", () => {
    const name = document.getElementById("taskName").value.trim();
    const subject = document.getElementById("taskSubject").value;
    const priority = document.getElementById("taskPriority").value;
    const deadline = document.getElementById("taskDeadline").value;

    if (name === "") return showToast("⚠️ Nama tugas tidak boleh kosong.");

    tasks.push({ name, subject, priority, deadline, completed: false });
    saveData();
    
    document.getElementById("taskName").value = "";
    document.getElementById("taskDeadline").value = "";
    document.getElementById("addDetails").removeAttribute("open");
    
    renderTasks();
    showToast("✅ Tugas baru ditambahkan!");
});

searchInput.addEventListener('input', renderTasks);
sortSelect.addEventListener('change', renderTasks);
filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderTasks();
    });
});

window.toggleComplete = function(index) {
    tasks[index].completed = !tasks[index].completed;
    saveData();
    renderTasks();
    if(tasks[index].completed) showToast("🎉 Mantap! Satu tugas selesai.");
}

window.deleteTask = function(index) {
    deletedTaskBackup = tasks[index];
    deletedTaskIndex = index;

    tasks.splice(index, 1);
    saveData();
    renderTasks();
    
    showToast("🗑️ Tugas dihapus.", true);
}

// Inisialisasi awal
renderTasks();