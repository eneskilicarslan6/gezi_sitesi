# Gezi Sitesi - Vantag Projesi / Travel Website - Vantag Project

*(Scroll down for English version / İngilizce sürümü için aşağı kaydırın)*

---

# 🇹🇷 Türkçe Eğitim ve Kurulum Kılavuzu

Bu proje, kullanıcıların ulaşım (araç kiralama vb.) ve konaklama (otel) seçeneklerini arayabileceği, aynı zamanda yapay zeka destekli bir asistanla seyahat planlaması yapabileceği kapsamlı bir gezi sitesidir.

## 👥 Ekip ve Katkıda Bulunanlar

Projeye emek veren ekip üyeleri ve görev dağılımları aşağıdaki gibidir:

- **Emir**: Backend - AI asistan kısmı (Yapay zeka asistanının arkadaki temel yönetimi ve işleyişi).
- **Burak**: Backend - AI entegrasyonu (Otel ve araçların internetten aranıp bulunması, verilerin çekilmesi).
- **Enes & Halil**: Frontend (Kullanıcı arayüzü) kısmının geliştirilmesi, tasarımların ve animasyonların kodlanması.
- **Esma**: Veritabanı - Projenin ihtiyaç duyduğu SQL şemalarının ve tabloların hazırlanması.
- **Nurefşan**: QA/Tester & DB Desteği - Projede nerelerde hatalar olduğunun adım adım kontrol edilip raporlanması ve veritabanı kısmında Esma'ya yardım.
- **Mustafa**: Raporlama - Proje raporunun baştan sona yazılması ve dokümantasyonunun yapılması.

---

## 🛠️ Kullanılan Teknolojiler

**Frontend**
- **React.js & Vite**: Hızlı ve modern bileşen tabanlı UI geliştirme.
- **Zustand**: Hafif ve hızlı global durum (state) yönetimi.
- **React Router Dom**: Sayfalar arası yönlendirmeler ve SPA yapısı.
- **Framer Motion, GSAP & Anime.js**: Uygulama içi dinamik geçişler ve akıcı animasyonlar.
- **Axios**: HTTP isteklerini yönetmek için.
- **Lucide React**: Modern ikon kütüphanesi.

**Backend**
- **Python (Flask)**: Hafif, esnek ve modüler backend API geliştirmesi.
- **Flask-CORS**: Frontend'den gelen isteklere izin verebilmek için.
- **Bcrypt & PyJWT**: Güvenli şifreleme, kimlik doğrulama ve token (JWT) bazlı oturum yönetimi.
- **Requests & python-dotenv**: Harici API'lara web istekleri atmak ve ortam değişkenlerini okumak için.

**Veritabanı**
- **SQLite3**: Disk üzerinde dosya tabanlı, hızlı veritabanı yönetimi.

---

## 🚀 Kurulum ve Çalıştırma Adımları

Projeyi bilgisayarınıza indirip çalıştırmak için aşağıdaki adımları sırasıyla uygulayın.

### 1. Dosyaları İndirin (Klonlayın)
Proje klasörüne girerek terminalinizi açın.

### 2. Veritabanını Ayağa Kaldırma
Öncelikle tabloların ve temel yapının oluşması için veritabanı inşa edilmelidir:
```bash
cd Database
python init_db.py
```
*Bu işlem Database klasörü altında `vantag.db` dosyasını oluşturacaktır.*

### 3. Backend Servislerini Başlatın
Backend tarafında tüm kütüphaneleri kurup, modülleri tek komutla çalıştırmanız gerekiyor.
```bash
# Backend dizinine dönün ve Python bağımlılıklarını yükleyin:
cd ../Backend
pip install -r auth_api/requirements.txt
pip install -r general_ai/requirements.txt
```

Artık tüm backend servislerini başlatmak için kök/backend dizininde şu komutu çalıştırın:
```bash
python run_all.py
```
*Bu komut; Auth API'yi, Arama API'sini ve AI Asistan API'sini paralelde çalıştıracaktır. (Durdurmak için CTRL+C tuş kombinasyonunu kullanabilirsiniz.)*

### 4. Frontend Uygulamasını Başlatın
Yeniden yeni bir terminal penceresi açın (Backend arka planda çalışmaya devam etsin).

```bash
cd Frontend

# Paketleri yükleme işlemi için:
npm install

# Geliştirme sunucusunu başlatmak için:
npm run dev
```

Terminalde çıkan `http://localhost:5173/` veya benzeri Vite URL'sine tıklayarak projeyi tarayıcınızda görüntüleyebilirsiniz!

## 📁 Proje Yapısı Özeti
- **/Frontend**: React.js kodlarının, bileşenlerin, CSS'lerin ve UI katmanının bulunduğu önyüz.
- **/Backend**: Python tabanlı Auth (kayıt/giriş) API'si, Genel Yapay Zeka botu ve Arama (Otel/Araç bulucu) mikro servisleri.
- **/Database**: Gerekli `schema.sql` (Veritabanı şeması) ve başlangıç `init_db.py` kodları.

---
---

# 🇬🇧 English Documentation & Setup Guide

This project is a comprehensive travel website where users can search for transportation (car rental, etc.) and accommodation (hotel) options, while simultaneously planning their trips with an AI-supported travel assistant.

## 👥 Meet the Team & Contributions

The team members who put effort into the project and their role distributions are as follows:

- **Emir**: Backend - AI assistant core (Basic management and background operation of the AI assistant).
- **Burak**: Backend - AI integration (Searching the internet for hotels and vehicles, fetching data).
- **Enes & Halil**: Frontend (Developing the User Interface), coding the UI designs and animations.
- **Esma**: Database - Preparation of SQL schemas and tables needed for the project.
- **Nurefşan**: QA/Tester & DB Support - Step-by-step bug checking, reporting issues, and helping Esma on the database side.
- **Mustafa**: Reporting - Writing the full project report from scratch and documenting the process.

---

## 🛠️ Technologies Used

**Frontend**
- **React.js & Vite**: Fast and modern component-based UI development.
- **Zustand**: Lightweight global state management.
- **React Router Dom**: Client-side routing for SPA architecture.
- **Framer Motion, GSAP & Anime.js**: Fluid UI animations and dynamic transitions.
- **Axios**: Handling HTTP requests.
- **Lucide React**: Modern icon library.

**Backend**
- **Python (Flask)**: Lightweight, flexible, and modular backend APIs.
- **Flask-CORS**: Cross-Origin Resource Sharing for frontend access.
- **Bcrypt & PyJWT**: Secure hashing, authentication, and JWT-based session management.
- **Requests & python-dotenv**: Making outbound API requests and managing environment variables.

**Database**
- **SQLite3**: Disk-based, fast, and local database engine.

---

## 🚀 Setup and Run Instructions

Follow the steps below sequentially to install and run the project locally.

### 1. Download (Clone) the Repository
Open your terminal in the main project folder.

### 2. Initialize the Database
First, the database schema must be initialized to create the tables:
```bash
cd Database
python init_db.py
```
*This command will create the `vantag.db` file inside the Database folder.*

### 3. Start the Backend Services
Install the necessary Python dependencies and start the backend microservices.
```bash
# Go to the Backend directory and install dependencies:
cd ../Backend
pip install -r auth_api/requirements.txt
pip install -r general_ai/requirements.txt
```

Now, run the following command in the `/Backend` directory to spin up all services:
```bash
python run_all.py
```
*This spins up the Auth API, Search API, and AI Assistant API in parallel. (Press CTRL+C to terminate.)*

### 4. Start the Frontend Application
Open a new separate terminal window (while the Backend continues to run in the background).

```bash
cd Frontend

# Install NPM packages:
npm install

# Start the Vite development server:
npm run dev
```

Click on the Vite URL (like `http://localhost:5173/`) popping up in the terminal to view the project in your browser!

## 📁 Project Structure Summary
- **/Frontend**: The UI layer containing React.js code, components, CSS files.
- **/Backend**: Python-based Auth API, General AI chat bot, and Search (Hotel/Vehicle) microservices.
- **/Database**: Necessary `schema.sql` and the initialization file `init_db.py`.
