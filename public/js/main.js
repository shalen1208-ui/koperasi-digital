/* ================================================
   KOPERASI DIGITAL - Global Shared JS
   ================================================ */

// Sidebar toggle
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar.classList.toggle('show');
  overlay.classList.toggle('show');
}

function closeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar.classList.remove('show');
  overlay.classList.remove('show');
}

// Auto close sidebar on desktop resize
window.addEventListener('resize', () => {
  if (window.innerWidth > 992) closeSidebar();
});

// Format rupiah
function rupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

// Status badge
function statusBadge(s) {
  const map = {
    pending: 'warning', disetujui: 'success',
    ditolak: 'danger', lunas: 'info',
    aktif: 'success', nonaktif: 'secondary',
    belum_bayar: 'warning', terlambat: 'danger'
  };
  return `<span class="badge bg-${map[s] || 'secondary'}">${s.replace('_', ' ')}</span>`;
}

// Logout
function logout() {
  Swal.fire({
    title: 'Logout?', text: 'Anda akan keluar dari sistem.',
    icon: 'question', showCancelButton: true,
    confirmButtonColor: '#dc3545', cancelButtonColor: '#6c757d',
    confirmButtonText: 'Ya, Logout', cancelButtonText: 'Batal'
  }).then(result => {
    if (result.isConfirmed) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
  });
}

// Load notifikasi
async function loadNotifikasi(token) {
  try {
    const res = await fetch('/api/notifikasi', { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const belumBaca = data.filter(n => !n.is_read).length;
    const badge = document.getElementById('notif-count');
    if (badge) {
      if (belumBaca > 0) { badge.textContent = belumBaca; badge.classList.remove('d-none'); }
      else badge.classList.add('d-none');
    }
    const list = document.getElementById('notif-list');
    if (list) {
      if (data.length === 0) {
        list.innerHTML = '<div class="notif-empty">Tidak ada notifikasi</div>';
      } else {
        list.innerHTML = data.slice(0, 8).map(n => `
          <div class="notif-item ${!n.is_read ? 'unread' : ''}">
            <div>${n.pesan}</div>
            <small class="text-muted">${new Date(n.created_at).toLocaleString('id-ID')}</small>
          </div>
        `).join('');
      }
    }
  } catch (err) { console.error(err); }
}

async function bacaSemua(token) {
  await fetch('/api/notifikasi/baca-semua', { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
  loadNotifikasi(token);
}

function toggleNotif() {
  document.getElementById('notif-dropdown')?.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.notif-btn') && !e.target.closest('.notif-dropdown')) {
    document.getElementById('notif-dropdown')?.classList.remove('show');
  }
});