const API_BASE = "";

const loginModal     = document.getElementById('loginModal');
const loginForm      = document.getElementById('loginForm');
const loginError     = document.getElementById('loginError');
const logoutBtn      = document.getElementById('logoutBtn');
const adminContainer = document.getElementById('adminContainer');
const kategoriSelect = document.getElementById('kategori');
const urunForm       = document.getElementById('urunForm');
const aramaInput     = document.getElementById('arama');
const urunListesi    = document.getElementById('urunListesi');

let userRole    = null;
let currentCategory;

const arkaPlanlar = {
  kokteyl:      "/admin/images/kokteyl-bg.jpg",
  bira:         "/admin/images/bira-bg.jpg",
  sarap:        "/admin/images/sarap-bg.jpg",
  viski:        "/admin/images/viski-bg.jpg",
  votka:        "/admin/images/votka-bg.jpg",
  alkolsuz:     "/admin/images/alkolsuz-bg.jpg",
  atistirmalik: "/admin/images/atistirmalik-bg.jpg"
};

function setBackground(cat) {
  document.body.style.backgroundImage = `url('${arkaPlanlar[cat]}')`;
}
function showLogin(){
  loginModal.classList.remove('hidden');
  adminContainer.style.display = 'none';
}
function showAdmin(){
  loginModal.classList.add('hidden');
  adminContainer.style.display = 'block';
}

window.addEventListener('DOMContentLoaded', () => {
  const savedRole = localStorage.getItem('userRole');
  if (savedRole) {
    userRole = savedRole;
    currentCategory = localStorage.getItem('adminCurrentCategory') || kategoriSelect.value;
    kategoriSelect.value = currentCategory;
    showAdmin();
    listeleUrunler();
  } else {
    showLogin();
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const u = document.getElementById('usernameInput').value.trim();
  const p = document.getElementById('passwordInput').value.trim();

  if (!u || !p) {
    loginError.textContent = "Kullanıcı adı ve şifre boş olamaz.";
    loginError.style.display = "block";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });

    if (res.ok) {
      const data = await res.json();
      userRole = data.role;
      localStorage.setItem('userRole', userRole);
      localStorage.setItem('adminCurrentCategory', kategoriSelect.value);

      loginError.style.display = 'none';
      showAdmin();
      listeleUrunler();
    } else if (res.status === 401) {
      loginError.textContent = "Kullanıcı adı veya şifre yanlış.";
      loginError.style.display = "block";
    } else {
      loginError.textContent = `Sunucu hatası: ${res.status}`;
      loginError.style.display = "block";
    }
  } catch (err) {
    console.error(err);
    loginError.textContent = "Sunucuya ulaşılamadı.";
    loginError.style.display = "block";
  }
});

logoutBtn.addEventListener('click', () => {
  userRole = null;
  localStorage.removeItem('userRole');
  loginForm.reset();
  loginError.style.display = 'none';
  showLogin();
});

kategoriSelect.addEventListener('change', () => {
  currentCategory = kategoriSelect.value;
  localStorage.setItem('adminCurrentCategory', currentCategory);
  listeleUrunler();
});

urunForm.addEventListener('submit', e => {
  e.preventDefault();
  if (userRole !== 'admin') {
    alert('Bu yetkiyle ürün ekleyemezsiniz, admine danışın...');
    return;
  }

  const isim  = e.target.isim.value.trim();
  const fiyat = parseFloat(e.target.fiyat.value);
  const aciklama = e.target.aciklama.value.trim();

  fetch(`${API_BASE}/menu/${currentCategory}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isim, fiyat, aciklama })
  })
    .then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    })
    .then(d => {
      alert(d.mesaj);
      urunForm.reset();
      listeleUrunler();
    })
    .catch(e => alert('Ürün ekleme hatası: ' + e.message));
});

aramaInput.addEventListener('input', listeleUrunler);

function listeleUrunler(){
  setBackground(currentCategory);
  const q = aramaInput.value.toLowerCase();
  urunListesi.innerHTML = '';

  fetch(`${API_BASE}/menu/${currentCategory}`)
    .then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    })
    .then(data => {
      data
        .filter(u => u.isim.toLowerCase().includes(q))
        .forEach(urun => {
          const li = document.createElement('li');
          li.className = 'blur-box';
          li.innerHTML = `
            <div>
              <div class="baslik-fiyat">
                <span class="isim">${urun.isim}</span>
                <span class="fiyat">${urun.fiyat.toFixed(2)} ₺</span>
              </div>
              ${urun.aciklama ? `<div class="description">${urun.aciklama}</div>` : ''}
            </div>
            <div class="buttons">
              <input type="number" id="sira-${urun.id}" value="${urun.sira}">
              <button data-id="${urun.id}" class="btn-sira">Sıra Kaydet</button>
              <button data-id="${urun.id}"
                      data-isim="${urun.isim}"
                      data-fiyat="${urun.fiyat}"
                      data-aciklama="${urun.aciklama||''}"
                      class="btn-guncelle">Güncelle</button>
              <button data-id="${urun.id}" data-isim="${urun.isim}" class="btn-sil">Sil</button>
            </div>
          `;
          urunListesi.appendChild(li);

          // Sıra değiştir
          li.querySelector('.btn-sira').addEventListener('click', () => {
            if (['ziyaretci','editor','admin'].includes(userRole)) {
              const id = +li.querySelector('.btn-sira').dataset.id;
              const s  = +document.getElementById(`sira-${id}`).value;
              fetch(`${API_BASE}/sira-degistir`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kategori: currentCategory, id, sira: s })
              })
              .then(r => {
                if (!r.ok) throw new Error(`${r.status}`);
                return r.json();
              })
              .then(d => { alert(d.mesaj); listeleUrunler(); })
              .catch(e => alert('Sıra kaydetme hatası: ' + e.message));
            } else {
              alert('Bu yetkiyle sıra değiştiremezsiniz, admine danışın...');
            }
          });

          li.querySelector('.btn-guncelle').addEventListener('click', evt => {
            if (['editor','admin'].includes(userRole)) {
              const btn   = evt.currentTarget;
              const id    = +btn.dataset.id;
              const isim0 = btn.dataset.isim;
              const f0    = btn.dataset.fiyat;
              const a0    = btn.dataset.aciklama;
              const yeniF = prompt(`${isim0} için yeni fiyat:`, f0);
              const yeniA = userRole === 'admin'
                            ? prompt(`${isim0} için yeni açıklama:`, a0)
                            : a0;
              if (yeniF !== null) {
                fetch(`${API_BASE}/menu/${currentCategory}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id, isim: isim0, fiyat: +yeniF, aciklama: yeniA })
                })
                .then(r => {
                  if (!r.ok) throw new Error(`${r.status}`);
                  return r.json();
                })
                .then(d => { alert(d.mesaj); listeleUrunler(); })
                .catch(e => alert('Güncelleme hatası: ' + e.message));
              }
            } else {
              alert('Bu yetkiyle güncelleme yapamazsınız, admine danışın...');
            }
          });

          li.querySelector('.btn-sil').addEventListener('click', () => {
            if (userRole === 'admin') {
              const id    = +li.querySelector('.btn-sil').dataset.id;
              const isim0 = li.querySelector('.btn-sil').dataset.isim;
              fetch(`${API_BASE}/menu/${currentCategory}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isim: isim0 })
              })
              .then(r => {
                if (!r.ok) throw new Error(`${r.status}`);
                return r.json();
              })
              .then(d => { alert(d.mesaj); listeleUrunler(); })
              .catch(e => alert('Silme hatası: ' + e.message));
            } else {
              alert('Bu yetkiyle silemezsiniz, admine danışın...');
            }
          });

        });
    })
    .catch(e => alert('Ürün listeleme hatası: ' + e.message));
}
