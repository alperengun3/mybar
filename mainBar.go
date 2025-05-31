package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

type Urun struct {
	ID       int     `json:"id"`
	Isim     string  `json:"isim"`
	Fiyat    float64 `json:"fiyat"`
	Sira     int     `json:"sira"`
	Aciklama string  `json:"aciklama"`
}

type Mesaj struct {
	Mesaj string `json:"mesaj"`
}

var creds = map[string]struct {
	Pwd  string
	Role string
}{
	"admin":     {Pwd: "full123!", Role: "admin"},
	"editor":    {Pwd: "editor789", Role: "editor"},
	"ziyaretci": {Pwd: "guest123", Role: "ziyaretci"},
}

var db *sql.DB

func applyCORS(w http.ResponseWriter, r *http.Request) bool {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return true
	}
	return false
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if applyCORS(w, r) {
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Sadece POST destekleniyor", http.StatusMethodNotAllowed)
		return
	}

	var loginData struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&loginData); err != nil {
		http.Error(w, "Geçersiz JSON", http.StatusBadRequest)
		return
	}

	if info, ok := creds[loginData.Username]; ok {
		if info.Pwd == loginData.Password {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(struct {
				Role string `json:"role"`
			}{Role: info.Role})
			return
		}
	}

	http.Error(w, "Kullanıcı adı veya şifre yanlış", http.StatusUnauthorized)
}

func siraDegistirHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("→ /sira-degistir called")
	if applyCORS(w, r) {
		return
	}

	type Req struct {
		Kategori string `json:"kategori"`
		ID       int    `json:"id"`
		YeniSira int    `json:"sira"`
	}
	var req Req
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Geçersiz JSON", http.StatusBadRequest)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "Veritabanı hatası", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var eski int
	if err := tx.QueryRow(
		"SELECT sira FROM urunler WHERE id = ? AND kategori = ?",
		req.ID, req.Kategori,
	).Scan(&eski); err != nil {
		http.Error(w, "Ürün bulunamadı", http.StatusNotFound)
		return
	}

	if req.YeniSira < eski {
		_, err = tx.Exec(`
			UPDATE urunler SET sira = sira + 1
			 WHERE kategori = ? AND sira >= ? AND sira < ? AND id != ?
		`, req.Kategori, req.YeniSira, eski, req.ID)
	} else if req.YeniSira > eski {
		_, err = tx.Exec(`
			UPDATE urunler SET sira = sira - 1
			 WHERE kategori = ? AND sira > ? AND sira <= ? AND id != ?
		`, req.Kategori, eski, req.YeniSira, req.ID)
	} else {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Mesaj{Mesaj: "Zaten o sırada"})
		return
	}
	if err != nil {
		http.Error(w, "Sıra kaydırılamadı", http.StatusInternalServerError)
		return
	}

	if _, err := tx.Exec(
		"UPDATE urunler SET sira = ? WHERE id = ?",
		req.YeniSira, req.ID,
	); err != nil {
		http.Error(w, "Yeni sıra atanamadı", http.StatusInternalServerError)
		return
	}

	tx.Commit()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Mesaj{Mesaj: "Sıra başarıyla güncellendi"})
}

func menuHandler(w http.ResponseWriter, r *http.Request) {
	if applyCORS(w, r) {
		return
	}

	kategori := strings.TrimPrefix(r.URL.Path, "/menu/")

	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query(
			`SELECT id, isim, fiyat, sira, aciklama
			   FROM urunler
			  WHERE kategori = ?
		   ORDER BY sira ASC`,
			kategori,
		)
		if err != nil {
			http.Error(w, "Veritabanı hatası", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var urunler []Urun
		for rows.Next() {
			var u Urun
			if err := rows.Scan(&u.ID, &u.Isim, &u.Fiyat, &u.Sira, &u.Aciklama); err != nil {
				http.Error(w, "Veri okunamadı", http.StatusInternalServerError)
				return
			}
			urunler = append(urunler, u)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(urunler)

	case http.MethodPost:
		var tek Urun
		if err := json.NewDecoder(r.Body).Decode(&tek); err != nil {
			http.Error(w, "Geçersiz JSON", http.StatusBadRequest)
			return
		}

		var maxSira int
		if err := db.QueryRow(
			"SELECT IFNULL(MAX(sira),0)+1 FROM urunler WHERE kategori = ?",
			kategori,
		).Scan(&maxSira); err != nil {
			http.Error(w, "Sıra alınamadı", http.StatusInternalServerError)
			return
		}

		_, err := db.Exec(
			"INSERT INTO urunler (kategori, isim, fiyat, sira, aciklama) VALUES (?, ?, ?, ?, ?)",
			kategori, tek.Isim, tek.Fiyat, maxSira, tek.Aciklama,
		)
		if err != nil {
			http.Error(w, "Veritabanına eklenemedi", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Mesaj{Mesaj: "Ürün başarıyla eklendi"})

	case http.MethodPut:
		var u Urun
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			http.Error(w, "Geçersiz JSON", http.StatusBadRequest)
			return
		}

		res, err := db.Exec(
			`UPDATE urunler
			    SET fiyat = ?, aciklama = ?
			  WHERE id = ? AND kategori = ?`,
			u.Fiyat, u.Aciklama, u.ID, kategori,
		)
		if err != nil {
			http.Error(w, "Güncelleme hatası", http.StatusInternalServerError)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			http.Error(w, "Ürün bulunamadı veya güncellenemedi", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Mesaj{Mesaj: "Ürün başarıyla güncellendi"})

	case http.MethodDelete:
		var s struct {
			ID int `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
			http.Error(w, "Geçersiz JSON", http.StatusBadRequest)
			return
		}

		res, err := db.Exec(
			"DELETE FROM urunler WHERE id = ? AND kategori = ?",
			s.ID, kategori,
		)
		if err != nil {
			http.Error(w, "Silme hatası", http.StatusInternalServerError)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			http.Error(w, "Ürün bulunamadı", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(Mesaj{Mesaj: "Ürün başarıyla silindi"})

	default:
		http.Error(w, "Yöntem desteklenmiyor", http.StatusMethodNotAllowed)
	}
}

func main() {
	var err error
	db, err = sql.Open("sqlite3", "./veritabani-bar.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	_, _ = db.Exec(`
    CREATE TABLE IF NOT EXISTS urunler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kategori TEXT,
      isim TEXT,
      fiyat REAL,
      sira INTEGER DEFAULT 0,
      aciklama TEXT DEFAULT ''
    );`)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	log.Printf("Sunucu port %s üzerinde çalışıyor\n", port)

	http.HandleFunc("/login", loginHandler)

	http.HandleFunc("/menu/", menuHandler)
	http.HandleFunc("/sira-degistir", siraDegistirHandler)

	log.Fatal(http.ListenAndServe(":"+port, nil))
}
