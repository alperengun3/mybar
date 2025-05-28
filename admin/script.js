const creds = {
  'admin':  { pwd:'full123!',  role:'admin'   },
  'editor': { pwd:'editor789',  role:'editor' },
  'ziyaretci': { pwd:'guest123',  role:'ziyaretci' }
};

const loginModal     = document.getElementById('loginModal');
const loginForm      = document.getElementById('loginForm');
const loginError     = document.getElementById('loginError');
const logoutBtn      = document.getElementById('logoutBtn');
const adminContainer = document.getElementById('adminContainer');
const kategoriSelect = document.getElementById('kategori');
const urunForm       = document.getElementById('urunForm');
const aramaInput     = document.getElementById('arama');
const urunListesi    = document.getElementById('urunListesi');

let userRole   = null;
let currentCategory = localStorage.getItem('adminCurrentCategory') || kategoriSelect.value;

const arkaPlanlar = {
  kokteyl:      'images/kokteyl-bg.jpg',
  bira:         'images/bira-bg.jpg',
  sarap:        'images/sarap-bg.jpg',
  viski:        'images/viski-bg.jpg',
  votka:        'images/votka-bg.jpg',
  alkolsuz:     'images/alkolsuz-bg.jpg',
  atistirmalik: 'images/atistirmalik-bg.jpg'
};
function setBackground(cat){
  document.body.style.backgroundImage = `url('${arkaPlanlar[cat]}')`;
}

function showLogin(){
  loginModal.classList.remove('hidden');
  adminContainer.style.display='none';
}
function showAdmin(){
  loginModal.classList.add('hidden');
  adminContainer.style.display='block';
}

window.addEventListener('DOMContentLoaded', ()=>{
  const savedRole = localStorage.getItem('userRole');
  if(savedRole && Object.values(creds).some(c=>c.role===savedRole)){
    userRole = savedRole;
    currentCategory = localStorage.getItem('adminCurrentCategory') || currentCategory;
    kategoriSelect.value = currentCategory;
    showAdmin();
    listeleUrunler();
  } else {
    showLogin();
  }
});

loginForm.addEventListener('submit', e=>{
  e.preventDefault();
  const u = document.getElementById('usernameInput').value;
  const p = document.getElementById('passwordInput').value;
  if(creds[u] && creds[u].pwd === p){
    userRole = creds[u].role;
    localStorage.setItem('userRole', userRole);
    localStorage.setItem('adminCurrentCategory', currentCategory);
    loginError.style.display = 'none';
    showAdmin();
    listeleUrunler();
  } else {
    loginError.style.display = 'block';
  }
});

logoutBtn.addEventListener('click', ()=>{
  userRole = null;
  localStorage.removeItem('userRole');
  loginForm.reset();
  loginError.style.display='none';
  showLogin();
});

kategoriSelect.addEventListener('change', ()=>{
  currentCategory = kategoriSelect.value;
  localStorage.setItem('adminCurrentCategory', currentCategory);
  listeleUrunler();
});

urunForm.addEventListener('submit', e=>{
  e.preventDefault();
  if(userRole !== 'admin'){
    return alert('Bu yetkiyle ürün ekleyemezsiniz, admine danışın...');
  }
  const isim     = e.target.isim.value.trim();
  const fiyat    = parseFloat(e.target.fiyat.value);
  const aciklama = e.target.aciklama.value.trim();
  fetch(`http://localhost:8081/menu/${currentCategory}`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ isim, fiyat, aciklama })
  })
    .then(r=>r.json())
    .then(d=>{ alert(d.mesaj); urunForm.reset(); listeleUrunler(); })
    .catch(console.error);
});

aramaInput.addEventListener('input', listeleUrunler);

function listeleUrunler(){
  setBackground(currentCategory);
  const q = aramaInput.value.toLowerCase();
  urunListesi.innerHTML = '';

  fetch(`http://localhost:8081/menu/${currentCategory}`)
    .then(r=>r.json())
    .then(data=>{
      data.filter(u=>u.isim.toLowerCase().includes(q))
          .forEach(urun=>{
        const li = document.createElement('li');
        li.className = 'blur-box';
        li.innerHTML = `
          <div>
            <div class="baslik-fiyat">
              <span class="isim">${urun.isim}</span>
              <span class="fiyat">${urun.fiyat.toFixed(2)} ₺</span>
            </div>
            ${ (urun.aciklama) 
               ? `<div class="description">${urun.aciklama}</div>`
               : ''
            }
          </div>
          <div class="buttons">
            <input type="number" id="sira-${urun.id}" value="${urun.sira}">
            <button data-id="${urun.id}" class="btn-sira">Sıra Kaydet</button>
            <button data-isim="${urun.isim}" data-fiyat="${urun.fiyat}"
                    data-aciklama="${urun.aciklama||''}" class="btn-guncelle">
              Güncelle
            </button>
            <button data-isim="${urun.isim}" class="btn-sil">Sil</button>
          </div>
        `;
        urunListesi.appendChild(li);

        li.querySelector('.btn-sira').addEventListener('click', ()=>{
          if(['ziyaretci','editor','admin'].includes(userRole)){
            const id = +li.querySelector('.btn-sira').dataset.id;
            const s = +document.getElementById(`sira-${id}`).value;
            fetch('http://localhost:8081/sira-degistir',{
              method:'PUT',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({ kategori:currentCategory, id, sira:s })
            })
            .then(r=>r.json())
            .then(d=>{ alert(d.mesaj); listeleUrunler(); })
            .catch(e=>alert('Sıra kaydetme hatası:'+e));
          } else alert('Bu yetkiyle sıra değiştiremezsiniz, admine danışın...');
        });

        li.querySelector('.btn-guncelle').addEventListener('click', evt=>{
          if(['editor','admin'].includes(userRole)){
            const btn = evt.currentTarget;
            const isim0 = btn.dataset.isim;
            const f0    = btn.dataset.fiyat;
            const a0    = btn.dataset.aciklama;
            const yeniF = prompt(`${isim0} için yeni fiyat:`, f0);
            const yeniA = userRole==='admin'
                        ? prompt(`${isim0} için yeni açıklama:`, a0)
                        : a0;
            if(yeniF!==null){
              fetch(`http://localhost:8081/menu/${currentCategory}`,{
                method:'PUT',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify([{ isim:isim0, fiyat:+yeniF, aciklama:yeniA }])
              })
              .then(r=>r.json())
              .then(d=>{ alert(d.mesaj); listeleUrunler(); })
              .catch(console.error);
            }
          } else alert('Bu yetkiyle güncelleme yapamazsınız, admine danışın...');
        });

        li.querySelector('.btn-sil').addEventListener('click', ()=>{
          if(userRole==='admin'){
            const isim0 = li.querySelector('.btn-sil').dataset.isim;
            fetch(`http://localhost:8081/menu/${currentCategory}`,{
              method:'DELETE',
              headers:{'Content-Type':'application/json'},
              body:JSON.stringify({ isim:isim0 })
            })
            .then(r=>r.json())
            .then(d=>{ alert(d.mesaj); listeleUrunler(); })
            .catch(console.error);
          } else alert('Bu yetkiyle silemezsiniz, admine danışın...');
        });

      });
    })
    .catch(console.error);
}
