export interface SkdKnowledgeEntry {
  externalId: string;
  title: string;
  category: "TWK" | "TIU" | "TKP" | "GENERAL";
  subtopic: string;
  docType: "kisi_kisi_rubrik" | "rumus_trik_cepat" | "contoh_soal_hots";
  scoringRule: "binary_5_0" | "scale_1_to_5" | "info";
  content: string;
  quizPayload?: {
    category: "TWK" | "TIU" | "TKP";
    subtopic: string;
    questionStem: string;
    options: { A: string; B: string; C: string; D: string; E: string };
    correctOption: "A" | "B" | "C" | "D" | "E";
    scoringRubric: { A: number; B: number; C: number; D: number; E: number };
    rubricRationale: string;
  };
}

export const SKD_KNOWLEDGE_BASE: SkdKnowledgeEntry[] = [
  // ==========================================
  // 1. GENERAL OVERVIEW & PASSING GRADE
  // ==========================================
  {
    externalId: "skd-gen-overview",
    title: "Ketentuan Resmi SKD CPNS, Ambang Batas (Passing Grade) & Pembobotan Skor",
    category: "GENERAL",
    subtopic: "Passing Grade & Regulasi KepmenPANRB",
    docType: "kisi_kisi_rubrik",
    scoringRule: "info",
    content: `Ketentuan Resmi Seleksi Kompetensi Dasar (SKD) Pengadaan CPNS Berdasarkan Keputusan Menteri PANRB:
1. Komposisi Soal & Durasi Waktu:
   - Jumlah total soal: 110 butir soal.
   - Durasi ujian Computer Assisted Test (CAT): 100 menit (130 menit khusus bagi pelamar penyandang disabilitas sensorik netra).
   - Rincian jumlah soal per materi:
     a. Tes Wawasan Kebangsaan (TWK): 30 butir soal.
     b. Tes Inteligensia Umum (TIU): 35 butir soal.
     c. Tes Karakteristik Pribadi (TKP): 45 butir soal.

2. Aturan Pembobotan Nilai (Scoring Scheme):
   - TWK: Jawaban benar bernilai 5 (lima), jawaban salah atau tidak menjawab bernilai 0 (nol). Nilai maksimal = 150.
   - TIU: Jawaban benar bernilai 5 (lima), jawaban salah atau tidak menjawab bernilai 0 (nol). Nilai maksimal = 175.
   - TKP: Menggunakan sistem skala bergradasi 1 sampai 5 untuk setiap opsi (tidak ada nilai 0 jika dijawab). Jika tidak menjawab bernilai 0. Nilai maksimal = 225.
   - Nilai kumulatif tertinggi SKD = 150 + 175 + 225 = 550.

3. Nilai Ambang Batas (Passing Grade) Penetapan Formasi Umum:
   - TWK: Minimal 65.
   - TIU: Minimal 80.
   - TKP: Minimal 166.
   Kelulusan SKD mensyaratkan peserta memenuhi seluruh ambang batas ketiga subtes secara simultan, bukan hanya nilai total kumulatif.

4. Ambang Batas Formasi Khusus:
   - Lulusan Terbaik (Cumlaude): Nilai kumulatif SKD minimal 311, dan nilai TIU minimal 85.
   - Penyandang Disabilitas: Nilai kumulatif SKD minimal 286, dan nilai TIU minimal 60.
   - Diaspora: Nilai kumulatif SKD minimal 311, dan nilai TIU minimal 85.
   - Putra/Putri Wilayah Papua & Daerah Tertinggal: Nilai kumulatif SKD minimal 286, dan nilai TIU minimal 60.`,
  },

  // ==========================================
  // 2. TWK KISI-KISI & INDIKATOR PENALARAN
  // ==========================================
  {
    externalId: "skd-twk-nasionalisme",
    title: "TWK: Kisi-Kisi Nasionalisme, Integritas ASN & Anti-Korupsi",
    category: "TWK",
    subtopic: "Nasionalisme dan Integritas ASN",
    docType: "kisi_kisi_rubrik",
    scoringRule: "info",
    content: `Panduan Materi Penalaran TWK CPNS - Nasionalisme dan Integritas:
1. Nasionalisme:
   - Definisi: Sikap mental dan komitmen kebangsaan yang menempatkan kesetiaan tertinggi kepada bangsa dan negara di atas kepentingan pribadi, kelompok, kedaerahan, atau golongan.
   - Indikator Sikap Nasionalisme:
     a. Cinta tanah air dan bangga menggunakan produk dalam negeri.
     b. Menjaga persatuan dan kesatuan serta kedaulatan bangsa.
     c. Rela berkorban untuk kepentingan bangsa.
     d. Mengakui persamaan derajat, hak, dan kewajiban setiap manusia.
   - Perbedaan Nasionalisme vs Chauvinisme:
     * Nasionalisme Positif: Menghargai kedaulatan bangsa sendiri tanpa merendahkan peradaban atau kedaulatan bangsa lain.
     * Chauvinisme (Nasionalisme Sempit): Fanatisme buta yang mengagungkan bangsa sendiri secara berlebihan dan merendahkan bangsa lain secara agresif.

2. Integritas ASN:
   - Definisi: Kepatuhan konsisten terhadap prinsip moral, nilai etika kejujuran, dan kode perilaku profesi ASN dalam situasi apa pun.
   - 9 Nilai Integritas Anti-Korupsi (KPK):
     1) Jujur: Lurus hati, tidak curang, dan menyampaikan kebenaran fakta objektif.
     2) Peduli: Peka dan tanggap terhadap kesulitan masyarakat serta lingkungan kerja.
     3) Mandiri: Tidak bergantung pada bantuan yang berpotensi memicu konflik kepentingan.
     4) Disiplin: Patuh pada aturan, tepat waktu, dan tertib administrasi/SOP.
     5) Tanggung Jawab: Siap menanggung konsekuensi atas pekerjaan yang diemban.
     6) Kerja Keras: Gigih dan bersungguh-sungguh menyelesaikan target pelayanan.
     7) Sederhana: Hidup wajar, bersahaja, tidak pamer kekayaan (flexing), dan hemat.
     8) Berani: Tegas menolak gratifikasi, melaporkan kecurangan, dan membela kebenaran.
     9) Adil: Tidak memihak (imparsial), objektif, dan memperlakukan setiap orang setara.
   - Batasan Gratifikasi: Pemberian dalam arti luas (uang, barang, diskon, komisi, fasilitas tiket) yang berhubungan dengan jabatan dan berlawanan dengan kewajiban pegawai negeri. Wajib dilaporkan ke UPG/KPK maksimal 30 hari kerja.`,
  },
  {
    externalId: "skd-twk-pilar-pancasila-uud",
    title: "TWK: Pilar Negara - Pancasila (Butir Pengamalan) & UUD NRI 1945",
    category: "TWK",
    subtopic: "Pancasila dan UUD NRI 1945",
    docType: "kisi_kisi_rubrik",
    scoringRule: "info",
    content: `Panduan Materi Penalaran TWK CPNS - Pancasila & UUD NRI 1945:
1. Pengamalan Sila-Sila Pancasila dalam Studi Kasus:
   - Sila 1 (Ketuhanan Yang Maha Esa): Toleransi antar-umat beragama, kebebasan beribadah, tidak memaksakan agama/kepercayaan kepada orang lain, membina kerukunan hidup.
   - Sila 2 (Kemanusiaan yang Adil dan Beradab): Mengakui persamaan derajat, hak asasi, tenggang rasa, menjunjung tinggi nilai kemanusiaan, membela kebenaran/keadilan, perlindungan kelompok rentan/lansia/disabilitas.
   - Sila 3 (Persatuan Indonesia): Menempatkan persatuan di atas kepentingan pribadi/golongan, rela berkorban demi negara, cinta tanah air, bangga bertanah air Indonesia, memelihara ketertiban dunia.
   - Sila 4 (Kerakyatan yang Dipimpin oleh Hikmat Kebijaksanaan dalam Permusyawaratan/Perwakilan): Mengutamakan musyawarah untuk mufakat, tidak memaksakan kehendak pada orang lain, menghormati keputusan bersama, iktikad baik melaksanakan keputusan.
   - Sila 5 (Keadilan Sosial bagi Seluruh Rakyat Indonesia): Mengembangkan perbuatan luhur mencerminkan kekeluargaan dan gotong royong, adil terhadap sesama, menghormati hak orang lain, menjaga keseimbangan hak dan kewajiban, suka menolong, suka bekerja keras, menghargai hasil karya orang lain, tidak bergaya hidup mewah atau merugikan kepentingan umum.
   - Trik Pembeda Sila 2 vs Sila 5: Sila 2 menekankan perlakuan martabat kemanusiaan dan empati adab antar-individu; Sila 5 menekankan keadilan distributif sosial, hak ekonomi, fasilitas publik, gotong royong, dan kesejahteraan bersama.

2. Struktur dan Pasal Krusial UUD NRI 1945 (Pasca Amandemen I-IV):
   - Amandemen: Berlangsung 4 tahap (1999, 2000, 2001, 2002).
   - Hak Asasi Manusia (Pasal 28A s.d. 28J):
     * Non-Derogable Rights (Pasal 28I ayat 1): Hak yang tidak dapat dikurangi dalam keadaan apa pun: hak untuk hidup, hak untuk tidak disiksa, hak kemerdekaan pikiran dan hati nurani, hak beragama, hak untuk tidak diperbudak, hak untuk diakui sebagai pribadi di hadapan hukum, hak untuk tidak dituntut atas dasar hukum yang berlaku surut.
     * Pembatasan HAM (Pasal 28J ayat 2): Penjaminan hak orang lain dan pertimbangan moral, nilai-nilai agama, keamanan, dan ketertiban umum melalui undang-undang.
   - Pertahanan dan Keamanan Negara (Pasal 30):
     * Ayat (1): Tiap-tiap warga negara berhak dan wajib ikut serta dalam usaha pertahanan dan keamanan negara.
     * Ayat (2): Sistem pertahanan dan keamanan rakyat semesta (Sishankamrata) dengan TNI dan Polri sebagai kekuatan utama, dan rakyat sebagai kekuatan pendukung.
   - Bela Negara (Pasal 27 ayat 3): Setiap warga negara berhak dan wajib ikut serta dalam upaya pembelaan negara.`,
  },
  {
    externalId: "skd-twk-nkri-bhinneka-bahasa",
    title: "TWK: Pilar Negara - NKRI, Bhinneka Tunggal Ika & Tata Bahasa Baku (EYD V)",
    category: "TWK",
    subtopic: "NKRI, Bhinneka Tunggal Ika, dan Bahasa Indonesia",
    docType: "kisi_kisi_rubrik",
    scoringRule: "info",
    content: `Panduan Materi Penalaran TWK CPNS - NKRI, Kebinekaan & Bahasa Negara:
1. Negara Kesatuan Republik Indonesia (NKRI):
   - Bentuk Negara: Kesatuan dengan prinsip otonomi daerah yang luas, nyata, dan bertanggung jawab (Pasal 1 ayat 1 dan Pasal 18 UUD 1945).
   - Unsur Terbentuknya Negara:
     a. Konstitutif: Wilayah tertentu (daratan, lautan, udara), Rakyat, Pemerintah yang berdaulat.
     b. Deklaratif: Pengakuan dari negara lain (de facto dan de jure).
   - Wawasan Nusantara: Cara pandang bangsa Indonesia tentang diri dan lingkungannya yang serba beragam dan bernilai strategis dengan mengutamakan persatuan bangsa dan kesatuan wilayah.

2. Bhinneka Tunggal Ika:
   - Asal Usul: Kakawin Sutasoma gubahan Mpu Tantular pada masa Kerajaan Majapahit abad ke-14. Frasa lengkap: "Bhinneka Tunggal Ika Tan Hana Dharma Mangrwa" (Berbeda-beda tetapi tetap satu jua, tidak ada kebenaran yang mendua).
   - Makna dalam Konteks Modern: Kesatuan dalam keberagaman suku, etnis, agama, bahasa daerah, dan tradisi nusantara tanpa diskriminasi.

3. Bahasa Negara & Kaidah Ejaan Bahasa Indonesia (EYD V):
   - Landasan Hukum: Pasal 36 UUD 1945 dan UU No. 24 Tahun 2009 tentang Bendera, Bahasa, dan Lambang Negara serta Lagu Kebangsaan.
   - Prinsip Kalimat Efektif:
     a. Kesepadanan Struktur: Memiliki subjek dan predikat yang jelas, tidak membiarkan kata depan mendahului subjek (misal: "Untuk semua pegawai harus hadir" [SALAH] -> "Semua pegawai harus hadir" [BENAR]).
     b. Keparalelan Bentuk: Bentuk kata yang digunakan harus konsisten (misal: "tahap perencanaan, pelaksanaan, dan penutupan" [BENAR], bukan "perencanaan, melaksanakan, dan penutupan").
     c. Kehematan Kata: Menghindari pleonasme atau pemborosan (misal: "agar supaya" [SALAH], "sangat banyak sekali" [SALAH]).
     d. Kelogisan Nalar: Masuk akal (misal: "Waktu dan tempat kami persilakan" [SALAH] -> "Bapak Bupati kami persilakan" [BENAR]).
   - Contoh Kata Baku vs Tidak Baku:
     * Analisis (baku) vs Analisa (tidak baku)
     * Praktik (baku) vs Praktek (tidak baku)
     * Kualitas (baku) vs Kwalitas (tidak baku)
     * Mengubah (baku) vs Merubah (tidak baku)
     * Antrean (baku) vs Antrian (tidak baku)
     * Efektif (baku) vs Efektip (tidak baku)`,
  },

  // ==========================================
  // 3. TIU RUMUS & TRIK CEPAT
  // ==========================================
  {
    externalId: "skd-tiu-verbal",
    title: "TIU: Logika Penalaran Verbal - Analogi, Silogisme Formal & Analitis",
    category: "TIU",
    subtopic: "Penalaran Verbal dan Silogisme",
    docType: "rumus_trik_cepat",
    scoringRule: "info",
    content: `Rumus dan Trik Cepat TIU Penalaran Verbal CPNS:
1. Hubungan Kata / Analogi Verbal:
   - Metode Kalimat Penghubung Spesifik: Buat hubungan fungsional yang ketat antara kata A dan B, lalu terapkan pola persis ke pasangan pilihan jawaban C dan D.
   - Perhatikan Arah Hubungan: Jangan membalik subjek dan objek (jika A adalah alat dari B, jangan memilih pilihan di mana C adalah produk dari D).

2. Kaidah Silogisme & Logika Matematika:
   - Modus Ponens:
     Premis 1: p -> q
     Premis 2: p
     Konklusi: q
   - Modus Tollens:
     Premis 1: p -> q
     Premis 2: ~q
     Konklusi: ~p
   - Silogisme Hipotetis:
     Premis 1: p -> q
     Premis 2: q -> r
     Konklusi: p -> r
   - Ekuivalensi Implikasi Penting:
     (p -> q) ekuivalen dengan (~q -> ~p) ekuivalen dengan (~p v q).
   - Kaidah Kuantor Universal vs Partikular:
     * Kuantor Universal: "Semua", "Setiap", "Seluruh".
     * Kuantor Partikular: "Beberapa", "Sebagian", "Sementara", "Ada".
     * Aturan 1: Premis Universal + Premis Partikular -> Kesimpulan PASTI PARTIKULAR (menggunakan kata "sebagian" atau "beberapa").
     * Aturan 2: Premis Positif + Premis Negatif -> Kesimpulan PASTI NEGATIF (menggunakan kata "tidak" atau "bukan").
     * Aturan 3: Jika kedua premis partikular ("sebagian" + "sebagian"), maka TIDAK DAPAT DITARIK KESIMPULAN yang pasti.

3. Penalaran Analitis (Urutan & Posisi):
   - Buat sketsa tabel atau garis urutan langsung di kertas buram.
   - Urutkan syarat mutlak terlebih dahulu (misal: "A tepat di samping B" atau "C duduk di ujung kiri").
   - Tandai kondisi negatif (misal: "D tidak boleh di samping E").
   - Eliminasi pilihan jawaban yang melanggar salah satu petunjuk soal secara langsung.`,
  },
  {
    externalId: "skd-tiu-numerik-deret",
    title: "TIU: Deret Angka, Pola Barisan Bilangan & Larik Bertingkat",
    category: "TIU",
    subtopic: "Deret Angka dan Pola Bilangan",
    docType: "rumus_trik_cepat",
    scoringRule: "info",
    content: `Trik Mengidentifikasi dan Menyelesaikan Deret Angka TIU CPNS:
1. Karakteristik Pola Deret:
   - Pola 1 Larik Sederhana:
     Periksa selisih antar-angka yang berdekatan. Jika naik/turun stabil (+a, -b, x c, :d), polanya aritmatika atau geometri.
   - Pola Bertingkat (Tingkat 2 atau 3):
     Jika selisih pertama tidak beraturan (+2, +5, +10, +17), periksa selisih dari selisih tersebut (+3, +5, +7 -> deret ganjil bertingkat).
   - Pola 2 Larik (Lompat 1 Angka):
     Cirinya: Nilai angka naik turun bergantian (misal: 3, 20, 6, 25, 9, 30). Pisahkan menjadi dua deret:
     * Deret ganjil (posisi 1, 3, 5): 3, 6, 9 (tambah 3).
     * Deret genap (posisi 2, 4, 6): 20, 25, 30 (tambah 5).
   - Pola 3 Larik (Lompat 2 Angka):
     Jika deret memiliki lebih dari 8 angka dan fluktuasi tajam.
   - Pola Fibonacci:
     Setiap suku merupakan penjumlahan dari 2 suku sebelumnya (contoh: 2, 3, 5, 8, 13, 21, ...).
   - Pola Pangkat dan Kuadrat:
     Hafalkan kuadrat sempurna dasar: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225.
     Hafalkan pangkat tiga: 1, 8, 27, 64, 125, 216, 343, 512, 729, 1000.
     Variasi: n^2 - 1, n^2 + 1, n^3 - 1.`,
  },
  {
    externalId: "skd-tiu-numerik-aritmatika",
    title: "TIU: Aritmatika Kuantitatif - Perbandingan Berbalik Nilai & Kecepatan-Jarak-Waktu",
    category: "TIU",
    subtopic: "Aritmatika Sosial dan Perbandingan",
    docType: "rumus_trik_cepat",
    scoringRule: "info",
    content: `Rumus Esensial Kemampuan Numerik TIU CPNS:
1. Perbandingan Senilai vs Berbalik Nilai:
   - Perbandingan Senilai (Variabel searah):
     Rumus: A1 / B1 = A2 / B2  =>  A1 * B2 = A2 * B1
     Contoh: Bensin vs Jarak tempuh, Jumlah barang vs Harga total.
   - Perbandingan Berbalik Nilai (Variabel berlawanan):
     Rumus: A1 * B1 = A2 * B2
     Contoh: Jumlah pekerja vs Lama waktu pengerjaan, Kecepatan vs Waktu tempuh.

2. Kasus Proyek Terhenti (Tambahan Pekerja):
   - Rumus Beban Kerja Total = Jumlah Pekerja Awal (P1) * Total Hari Rencana (H1).
   - Jika setelah bekerja selama h1 hari, proyek berhenti selama h2 hari karena kendala, maka:
     Sisa Hari Efektif (H_sisa) = H1 - h1 - h2.
     Beban Kerja Tersisa = P1 * (H1 - h1).
     Total Pekerja Dibutuhkan (P_baru) = Beban Kerja Tersisa / H_sisa.
     Tambahan Pekerja yang Dibutuhkan = P_baru - P1.
   - Rumus Cepat Tambahan Pekerja:
     Delta P = (P1 * Hari Terhenti) / Sisa Hari Efektif.

3. Kecepatan, Jarak, dan Waktu:
   - Rumus Dasar: Jarak (S) = Kecepatan (v) * Waktu (t).
   - Berpapasan (Berangkat Bersamaan, Berlawanan Arah):
     t_temu = S_total / (v1 + v2).
   - Berpapasan dengan Waktu Berangkat Berbeda:
     Hitung jarak yang telah ditempuh orang pertama terlebih dahulu: Delta S = v1 * Delta t.
     Sisa Jarak = S_total - Delta S.
     t_temu_setelah_orang_kedua_berangkat = Sisa Jarak / (v1 + v2).
   - Menyusul (Berangkat Searah, Waktu Berbeda):
     Delta S = v1 * Selisih Waktu.
     t_susul = Delta S / (v2 - v1), dengan syarat v2 > v1.`,
  },

  // ==========================================
  // 4. TKP MATRIKS RUBRIK SKOR 5–1
  // ==========================================
  {
    externalId: "skd-tkp-rubrik-berakhlak-1",
    title: "TKP: Matriks Rubrik Skor 5-1 BerAKHLAK (Pelayanan Publik, Jejaring Kerja, Sosial Budaya)",
    category: "TKP",
    subtopic: "Rubrik Skor BerAKHLAK Bagian 1",
    docType: "kisi_kisi_rubrik",
    scoringRule: "scale_1_to_5",
    content: `Matriks Gradasi Skor 5 sampai 1 Tes Karakteristik Pribadi (TKP) Berdasarkan Core Values ASN BerAKHLAK:
1. Aspek Pelayanan Publik (Berorientasi Pelayanan):
   - Skor 5: Proaktif, solutif, ramah, melayani melebihi ekspektasi standar SOP tanpa diskriminasi, mendahulukan kelompok rentan tanpa melanggar hukum.
   - Skor 4: Melayani sesuai SOP dengan sopan dan menyelesaikan urusan pemohon dengan tuntas pada jam kerja.
   - Skor 3: Menyampaikan syarat dan prosedur normatif, namun pasif menunggu inisiatif masyarakat/pemohon.
   - Skor 2: Melayani secara kaku, menunjukkan keengganan ketika ada situasi darurat atau di luar kebiasaan.
   - Skor 1: Menolak melayani, bersikap arogan, melempar tanggung jawab kepada orang lain, atau menelantarkan pemohon layanan.

2. Aspek Jejaring Kerja (Kolaboratif & Harmonis):
   - Skor 5: Membuka komunikasi positif, aktif mengajak sinergi lintas bidang/instansi, membangun kemitraan yang saling memberdayakan demi target organisasi.
   - Skor 4: Bersedia bekerja sama dan membagi peran ketika diminta atau ditugaskan pimpinan secara jelas.
   - Skor 3: Bekerja dalam batas timnya sendiri, menjaga hubungan sopan namun pasif menjalin kontak lintas sektor.
   - Skor 2: Enggan membagi informasi penting dengan rekan tim, cenderung bekerja sendiri (silo mentality).
   - Skor 1: Bersikap eksklusif, memicu konflik atau persaingan tidak sehat di internal, menolak kerja sama.

3. Aspek Sosial Budaya (Adaptif & Harmonis):
   - Skor 5: Terbuka dan menghargai keragaman suku, agama, ras, dan adat; cepat beradaptasi dengan lingkungan baru; mampu menjadi perekat pemersatu ketika ada friksi sosial.
   - Skor 4: Menghormati perbedaan norma dan budaya setempat serta tidak mencampuri keyakinan orang lain.
   - Skor 3: Menerima keberagaman sebatas formalitas, cenderung bergaul nyaman hanya dengan kelompok yang sepemikiran.
   - Skor 2: Bersikap pasif dan canggung ketika ditempatkan di lingkungan berbeda latar belakang budaya.
   - Skor 1: Bersikap etnosentris, rasis, mengutamakan primordialisme, atau memaksakan budaya sendiri kepada orang lain.`,
  },
  {
    externalId: "skd-tkp-rubrik-berakhlak-2",
    title: "TKP: Matriks Rubrik Skor 5-1 BerAKHLAK (TIK, Profesionalisme, Anti-Radikalisme)",
    category: "TKP",
    subtopic: "Rubrik Skor BerAKHLAK Bagian 2",
    docType: "kisi_kisi_rubrik",
    scoringRule: "scale_1_to_5",
    content: `Matriks Gradasi Skor 5 sampai 1 Tes Karakteristik Pribadi (TKP) Berdasarkan Core Values ASN BerAKHLAK:
1. Aspek Teknologi Informasi dan Komunikasi (TIK - Adaptif & Kompeten):
   - Skor 5: Proaktif mempelajari dan memanfaatkan sistem teknologi digital guna meningkatkan efisiensi kerja, menjaga keamanan data sensitif, dan mengedukasi rekan kerja yang kesulitan adaptasi teknologi.
   - Skor 4: Cepat menguasai dan menggunakan aplikasi kerja digital yang telah diwajibkan oleh instansi.
   - Skor 3: Menggunakan teknologi sebatas rutinitas dasar, kurang tertarik mengeksplorasi fitur optimalisasi.
   - Skor 2: Ragu-ragu dan lambat beralih dari cara manual ke sistem digital, sering memerlukan bantuan orang lain.
   - Skor 1: Menolak modernisasi teknologi, mengabaikan keamanan data, atau menyebarkan hoaks dan informasi palsu di dunia maya.

2. Aspek Profesionalisme (Akuntabel & Loyal):
   - Skor 5: Fokus menuntaskan tugas pokok kedinasan dengan kualitas mutu prima meski berada di bawah tekanan batas waktu ketat atau gangguan urusan pribadi; bertanggung jawab penuh atas hasil kerja.
   - Skor 4: Menyelesaikan tugas tepat waktu dan sesuai target perjanjian kinerja yang ditentukan.
   - Skor 3: Mengerjakan tugas seadanya asal gugur kewajiban administratif.
   - Skor 2: Menunda pekerjaan karena mengutamakan kenyamanan diri atau terdistraksi masalah personal.
   - Skor 1: Meninggalkan tugas kedinasan tanpa izin, menyalahgunakan wewenang atau fasilitas kantor demi kepentingan pribadi.

3. Aspek Anti-Radikalisme (Loyal pada Ideologi Pancasila & NKRI):
   - Skor 5: Berpegang teguh pada konsensus Pancasila dan UUD 1945, tenang dan bijak memverifikasi fakta atas isu provokatif, mengedukasi rekan kerja dengan toleransi, serta melaporkan potensi intoleransi ekstrem ke saluran resmi/pimpinan.
   - Skor 4: Menolak paham radikal dan menolak ajakan yang bertentangan dengan ideologi negara secara personal.
   - Skor 3: Mengabaikan penyebaran narasi radikal di sekitarnya karena merasa bukan urusannya selama tidak mengancam diri sendiri.
   - Skor 2: Mudah terpancing emosi dan terhasut kabar bohong/konten provokatif bernuansa radikal.
   - Skor 1: Mendukung, membenarkan, atau ikut menyebarluaskan narasi kekerasan, kebencian SARA, atau tindakan ekstremis anti-pancasila.`,
  },

  // ==========================================
  // 5. VERIFIED BENCHMARK HOTS QUESTIONS (12 SOAL)
  // ==========================================

  // --- TWK 1: Pancasila Sila 2 vs Sila 5 ---
  {
    externalId: "skd-twk-hots-01",
    title: "Benchmark Soal HOTS TWK 1: Pengamalan Pancasila pada Layanan Publik Bansos",
    category: "TWK",
    subtopic: "Pengamalan Sila-Sila Pancasila",
    docType: "contoh_soal_hots",
    scoringRule: "binary_5_0",
    content: `Studi Kasus HOTS TWK Pengamalan Nilai Pancasila:
Dalam pelaksanaan penyaluran bantuan sosial bagi korban bencana banjir di suatu kecamatan, ratusan warga mengantre berjam-jam di bawah terik matahari. Seorang nenek lanjut usia yang berjalan memakai tongkat dan seorang ibu hamil terlihat kelelahan dalam barisan antrean. Petugas posko tetap bersikeras mengharuskan keduanya mengantre dari nomor urut paling belakang demi alasan kesamaan hak dan keadilan antrean bagi semua warga.

Tindakan petugas posko tersebut bertentangan dengan pengamalan nilai Pancasila, khususnya:
A. Sila Pertama, karena petugas tidak menunjukkan rasa belas kasih yang diajarkan oleh ajaran agama manapun.
B. Sila Ketiga, karena perlakuan tersebut dapat memicu keributan dan merusak persatuan warga di lokasi bencana.
C. Sila Keempat, karena petugas mengambil keputusan sepihak tanpa memusyawarahkan prosedur antrean bersama warga.
D. Sila Kelima, karena petugas telah berlaku curang dan tidak membagikan bantuan pangan secara seimbang kepada fakir miskin.
E. Sila Kedua, karena petugas mengabaikan perlakuan manusiawi yang adil dan beradab sesuai harkat dan martabat kemanusiaan terhadap kelompok rentan.`,
    quizPayload: {
      category: "TWK",
      subtopic: "Pengamalan Sila Pancasila",
      questionStem: `Dalam pelaksanaan penyaluran bantuan sosial bencana banjir di suatu kecamatan, ratusan warga mengantre berjam-jam di bawah terik matahari. Seorang nenek lanjut usia bertongkat dan ibu hamil tampak kelelahan dalam barisan panjang. Petugas posko tetap bersikeras mewajibkan keduanya mengantre dari nomor urut belakang dengan dalih persamaan hak dan keadilan antrean bagi semua warga.\n\nTindakan petugas tersebut bertentangan dengan pengamalan nilai Pancasila, khususnya...`,
      options: {
        A: "Sila Pertama, karena petugas tidak menunjukkan belas kasih sebagaimana tuntunan nilai-nilai keagamaan",
        B: "Sila Ketiga, karena ketiadaan empati dapat menyulut gesekan sosial yang meretakkan persatuan antar-warga",
        C: "Sila Keempat, karena penentuan aturan antrean dilakukan secara otoriter tanpa permusyawaratan mufakat",
        D: "Sila Kelima, karena petugas gagal mewujudkan keadilan sosial dalam distribusi sembako bagi seluruh rakyat",
        E: "Sila Kedua, karena mengabaikan perlakuan adil dan beradab yang menghargai martabat manusiawi bagi kelompok rentan",
      },
      correctOption: "E",
      scoringRubric: { A: 0, B: 0, C: 0, D: 0, E: 5 },
      rubricRationale: `Jawaban Benar adalah E (Sila Kedua).
Pembahasan:
- Sila Kedua Pancasila berbunyi "Kemanusiaan yang Adil dan Beradab", memiliki butir pengamalan: mengakui persamaan derajat, hak, dan kewajiban asasi setiap manusia tanpa membeda-bedakan, menjunjung tinggi nilai kemanusiaan, serta memperlakukan manusia sesuai harkat dan martabatnya. Dalam administrasi publik modern, memberikan fasilitas/jalur khusus bagi kelompok rentan (lansia, ibu hamil, disabilitas) adalah perwujudan adab kemanusiaan yang beradab (affirmative action).
- Pilihan D salah karena Sila Kelima menekankan pada hak keadilan sosial masyarakat secara menyeluruh (distribusi ekonomi, fasilitas publik, gotong royong). Menolak memberi prioritas pada lansia yang kepanasan adalah bentuk ketiadaan tenggang rasa kemanusiaan (Sila Ke-2).`,
    },
  },

  // --- TWK 2: UUD 1945 Non-Derogable Rights ---
  {
    externalId: "skd-twk-hots-02",
    title: "Benchmark Soal HOTS TWK 2: Hak Asasi Manusia yang Tidak Dapat Dikurangi (Non-Derogable Rights)",
    category: "TWK",
    subtopic: "UUD NRI 1945 Pasal HAM",
    docType: "contoh_soal_hots",
    scoringRule: "binary_5_0",
    content: `Soal HOTS TWK Ketatanegaraan UUD NRI 1945:
Pada saat suatu negara berada dalam kondisi darurat militer atau bahaya krisis nasional, pemerintah berwenang melakukan pembatasan terhadap sebagian hak asasi warga negara demi menjaga keselamatan bangsa. Namun demikian, UUD NRI 1945 Pasal 28I ayat (1) menegaskan adanya kelompok hak asasi yang sama sekali tidak dapat dikurangi dalam keadaan apa pun (non-derogable rights).

Manakah di antara kelompok hak berikut yang seluruhnya tergolong sebagai hak asasi yang tidak dapat dikurangi dalam keadaan apa pun menurut Pasal 28I ayat (1)?
A. Hak untuk hidup, hak kemerdekaan berserikat, hak untuk tidak disiksa, dan hak mendapatkan pekerjaan yang layak.
B. Hak untuk hidup, hak atas kepemilikan pribadi, hak beragama, dan hak mengeluarkan pendapat di muka umum.
C. Hak untuk hidup, hak tidak disiksa, hak kemerdekaan pikiran dan hati nurani, hak beragama, dan hak tidak diperbudak.
D. Hak kebebasan berkumpul, hak tidak dituntut atas hukum yang berlaku surut, hak memilih tempat tinggal, dan hak bersuara.
E. Hak memilih kewarganegaraan, hak mendapatkan pendidikan gratis, hak atas jaminan sosial, dan hak beragama.`,
    quizPayload: {
      category: "TWK",
      subtopic: "UUD NRI 1945 - Hak Asasi Manusia",
      questionStem: `Dalam kondisi darurat negara atau krisis hukum, pemerintah memiliki wewenang membatasi sebagian hak asasi warga negara demi keselamatan umum. Berdasarkan Pasal 28I ayat (1) UUD NRI 1945, manakah kelompok hak yang seluruhnya termasuk non-derogable rights (hak asasi yang tidak dapat dikurangi dalam keadaan apa pun)?`,
      options: {
        A: "Hak untuk hidup, hak berserikat dan berkumpul, hak tidak disiksa, serta hak memperoleh pekerjaan layak",
        B: "Hak atas kepemilikan harta pribadi, hak beragama, hak untuk hidup, dan hak bebas mengeluarkan pendapat",
        C: "Hak untuk hidup, hak tidak disiksa, hak kemerdekaan pikiran dan hati nurani, hak beragama, serta hak tidak diperbudak",
        D: "Hak kebebasan bergerak, hak tidak dituntut berdasarkan hukum berlaku surut, serta hak mendapat pendidikan",
        E: "Hak memilih kewarganegaraan, hak memperoleh jaminan sosial, hak untuk hidup, dan hak menyampaikan aspirasi",
      },
      correctOption: "C",
      scoringRubric: { A: 0, B: 0, C: 5, D: 0, E: 0 },
      rubricRationale: `Jawaban Benar adalah C.
Pembahasan:
Berdasarkan Pasal 28I ayat (1) UUD NRI 1945, terdapat 7 (tujuh) hak yang secara tegas dikategorikan sebagai hak asasi manusia yang tidak dapat dikurangi dalam keadaan apa pun (non-derogable rights):
1. Hak untuk hidup,
2. Hak untuk tidak disiksa,
3. Hak kemerdekaan pikiran dan hati nurani,
4. Hak beragama,
5. Hak untuk tidak diperbudak,
6. Hak untuk diakui sebagai pribadi di hadapan hukum,
7. Hak untuk tidak dituntut atas dasar hukum yang berlaku surut (non-retroaktif).
Hak berserikat, berkumpul, mengeluarkan pendapat, hak atas kepemilikan, dan pekerjaan adalah derogable rights yang dapat dibatasi berdasarkan Pasal 28J ayat (2) demi ketertiban umum dan moralitas.`,
    },
  },

  // --- TWK 3: Bela Negara Rela Berkorban ---
  {
    externalId: "skd-twk-hots-03",
    title: "Benchmark Soal HOTS TWK 3: Nilai-Nilai Bela Negara dalam Penugasan Krisis Kesehatan",
    category: "TWK",
    subtopic: "Bela Negara dan Patriotisme",
    docType: "contoh_soal_hots",
    scoringRule: "binary_5_0",
    content: `Soal HOTS TWK Bela Negara:
Seorang dokter aparatur sipil negara yang bertugas di balai penelitian kementerian diminta secara mendadak untuk memimpin tim respons cepat penanganan wabah penyakit menular di pulau terluar perbatasan negara menjelang masa cuti libur akhir tahun. Penugasan tersebut mengharuskannya membatalkan rencana berkumpul bersama keluarga yang telah dirancang berbulan-bulan, serta menghadapi risiko tinggi tertular penyakit di wilayah dengan fasilitas logistik yang serba terbatas. Tanpa ragu, dokter tersebut menerima surat tugas dan langsung bertolak ke lokasi demi mencegah meluasnya penularan wabah ke wilayah nusantara lainnya.

Tindakan dokter tersebut merupakan manifestasi konkret dari nilai dasar Bela Negara:
A. Cinta Tanah Air, ditunjukkan dengan kepedulian mendalam terhadap kelestarian lingkungan dan geografi kepulauan nusantara.
B. Rela Berkorban untuk Bangsa dan Negara, ditunjukkan dengan kesediaan mengorbankan waktu, tenaga, dan kepentingan pribadi demi keselamatan masyarakat dan integritas bangsa.
C. Kesadaran Berbangsa dan Bernegara, ditunjukkan dengan kepatuhan hierarkis mutlak terhadap perintah pimpinan tanpa pertimbangan rasional.
D. Setia pada Pancasila sebagai Ideologi Negara, ditunjukkan dengan mengimplementasikan sila musyawarah dalam rapat kerja satgas penanganan penyakit.
E. Kemampuan Awal Bela Negara, ditunjukkan semata-mata oleh kemampuan fisik jasmani dalam menempuh perjalanan laut yang menantang.`,
    quizPayload: {
      category: "TWK",
      subtopic: "Nilai Dasar Bela Negara",
      questionStem: `Seorang dokter ASN di kementerian secara sukarela menerima penugasan mendadak memimpin tim penanganan wabah di pulau terpencil perbatasan pada libur akhir tahun. Ia rela membatalkan rencana liburan bersama keluarga dan mengambil risiko kesehatan demi menyelamatkan warga perbatasan dari ancaman epidemi. Sikap dokter ASN tersebut merupakan manifestasi nilai dasar Bela Negara yaitu...`,
      options: {
        A: "Cinta Tanah Air, yang terwujud dalam penjagaan kedaulatan batas teritorial darat dan laut kepulauan",
        B: "Rela Berkorban untuk Bangsa dan Negara, dengan mengutamakan keselamatan publik di atas kepentingan personal",
        C: "Kesadaran Berbangsa dan Bernegara, yang dibuktikan lewat kepatuhan administratif pada instruksi birokrasi",
        D: "Setia pada Pancasila sebagai Ideologi Negara, melalui penerapan musyawarah kerja penanganan bencana",
        E: "Kemampuan Awal Bela Negara, yang didasarkan pada ketahanan fisik menghadapi rintangan geografis alam",
      },
      correctOption: "B",
      scoringRubric: { A: 0, B: 5, C: 0, D: 0, E: 0 },
      rubricRationale: `Jawaban Benar adalah B (Rela Berkorban untuk Bangsa dan Negara).
Pembahasan:
Berdasarkan UU No. 23 Tahun 2019 tentang Pengelolaan Sumber Daya Nasional untuk Pertahanan Negara, terdapat 5 Nilai Dasar Bela Negara:
1. Cinta Tanah Air
2. Kesadaran Berbangsa dan Bernegara
3. Setia pada Pancasila sebagai Ideologi Negara
4. Rela Berkorban untuk Bangsa dan Negara
5. Kemampuan Awal Bela Negara
Indikator "Rela Berkorban untuk Bangsa dan Negara" meliputi: bersedia mengorbankan waktu, tenaga, pikiran, dan materi untuk kemajuan bangsa; siap membela bangsa dan negara dari berbagai macam ancaman; serta mendahulukan kepentingan bangsa di atas kepentingan pribadi/golongan. Dokter tersebut rela melepaskan hak libur dan menempuh risiko demi menyelamatkan warga negara.`,
    },
  },

  // --- TWK 4: Integritas ASN Gratifikasi ---
  {
    externalId: "skd-twk-hots-04",
    title: "Benchmark Soal HOTS TWK 4: Integritas Penolakan Gratifikasi dan Benturan Kepentingan",
    category: "TWK",
    subtopic: "Integritas dan Anti Korupsi",
    docType: "contoh_soal_hots",
    scoringRule: "binary_5_0",
    content: `Soal HOTS TWK Integritas ASN:
Rudi adalah pejabat pembuat komitmen (PPK) pada pengadaan perangkat server teknologi informasi di sebuah instansi pemerintah. Setelah penetapan pemenang lelang dilakukan sesuai prosedur e-katalog, pimpinan perusahaan rekanan pemenang tender datang ke ruang kerja Rudi dan menyerahkan sebuah amplop tebal berisi voucher belanja senilai 25 juta rupiah dengan alasan sebagai ungkapan rasa syukur dan tali silaturahmi tanpa pamrih apa pun.

Tindakan yang paling mencerminkan integritas tinggi dan kepatuhan hukum bagi Rudi adalah:
A. Menerima voucher tersebut kemudian menyumbangkannya ke panti asuhan di dekat kantor agar uang tersebut membawa berkah bagi masyarakat membutuhkan.
B. Menolak pemberian tersebut secara santun namun tegas saat itu juga, menjelaskan bahwa ASN dilarang menerima gratifikasi terkait jabatan, serta mencatat kejadian tersebut untuk dilaporkan ke Unit Pengendalian Gratifikasi (UPG).
C. Menerima voucher belanja tersebut untuk sementara waktu demi menjaga hubungan baik dengan vendor, lalu menyerahkannya ke pimpinan instansi untuk dibagikan saat perayaan hari besar.
D. Meminta vendor mengganti voucher belanja tersebut menjadi peralatan kantor yang dapat dimanfaatkan oleh seluruh pegawai di ruang kerja.
E. Menolak voucher tersebut dan langsung membatalkan kontrak pemenang lelang secara sepihak di hari yang sama tanpa proses verifikasi.`,
    quizPayload: {
      category: "TWK",
      subtopic: "Integritas dan Anti-Korupsi",
      questionStem: `Rudi adalah Pejabat Pembuat Komitmen (PPK) pengadaan server di instansi pemerintah. Setelah tender selesai sesuai aturan, direktur vendor pemenang bertamu dan memberikan voucher belanja senilai 25 juta rupiah sebagai 'tali silaturahmi dan tanda terima kasih' tanpa syarat apapun. Tindakan Rudi yang paling mencerminkan integritas ASN berintegritas adalah...`,
      options: {
        A: "Menerima voucher tersebut lalu mendonasikannya ke yayasan sosial agar bermanfaat bagi kaum duafa",
        B: "Menolak tegas dan santun di awal, mengedukasi aturan larangan gratifikasi, serta mencatatnya ke UPG instansi",
        C: "Menerima demi menjaga relasi kemitraan, kemudian menyerahkannya kepada pimpinan untuk dibagikan ke staf",
        D: "Meminta vendor mengubah pemberian voucher menjadi barang inventaris operasional kantor unit kerja",
        E: "Menolak langsung seketika itu juga dan membatalkan hasil kontrak pengadaan secara sepihak hari itu juga",
      },
      correctOption: "B",
      scoringRubric: { A: 0, B: 5, C: 0, D: 0, E: 0 },
      rubricRationale: `Jawaban Benar adalah B.
Pembahasan:
- Berdasarkan UU No. 31 Tahun 1999 jo UU No. 20 Tahun 2001 Pasal 12B, gratifikasi yang diberikan kepada pegawai negeri atau penyelenggara negara yang berhubungan dengan jabatannya dan berlawanan dengan kewajibannya dianggap suap.
- Nilai integritas "Berani" dan "Jujur" menuntut ASN untuk menolak secara tegas dan santun pada kesempatan pertama setiap pemberian yang berhubungan dengan jabatan.
- Apabila penolakan langsung dilakukan, peristiwa tetap perlu dicatat/dilaporkan kepada Unit Pengendalian Gratifikasi (UPG) instansi sebagai wujud transparansi dan akuntabilitas dinas.
- Mengalihkan pemberian ke panti asuhan (A) atau inventaris (D) tetap melanggar prinsip anti-gratifikasi karena hakikat pemberian bermasalah tidak boleh diterima sejak awal.`,
    },
  },

  // --- TIU 1: Silogisme Kuantor ---
  {
    externalId: "skd-tiu-hots-01",
    title: "Benchmark Soal HOTS TIU 1: Silogisme Kuantor Logis Kategori Pegawai dan Beasiswa",
    category: "TIU",
    subtopic: "Silogisme Logika Formal",
    docType: "contoh_soal_hots",
    scoringRule: "binary_5_0",
    content: `Soal HOTS TIU Silogisme & Logika Kuantor:
Perhatikan premis-premis berikut:
1. Semua pegawai berprestasi di instansi Pelita mendapatkan fasilitas beasiswa pascasarjana ke luar negeri.
2. Sebagian pegawai di instansi Pelita yang mendapatkan fasilitas beasiswa pascasarjana ke luar negeri fasih berbahasa Prancis.
3. Doni adalah salah satu pegawai berprestasi di instansi Pelita.

Kesimpulan yang paling tepat dan sah secara logika adalah:
A. Doni pasti mendapatkan fasilitas beasiswa pascasarjana ke luar negeri, namun belum tentu fasih berbahasa Prancis.
B. Doni pasti fasih berbahasa Prancis karena ia merupakan pegawai berprestasi di instansi Pelita.
C. Semua pegawai instansi Pelita yang fasih berbahasa Prancis adalah pegawai berprestasi seperti Doni.
D. Doni tidak mendapatkan beasiswa pascasarjana jika ia belum menguasai bahasa Prancis.
E. Sebagian pegawai berprestasi seperti Doni tidak diperbolehkan belajar bahasa Prancis.`,
    quizPayload: {
      category: "TIU",
      subtopic: "Silogisme dan Penarikan Kesimpulan",
      questionStem: `Diberikan premis-premis berikut:\n1. Semua pegawai berprestasi di instansi Pelita mendapatkan beasiswa pascasarjana ke luar negeri.\n2. Sebagian pegawai di instansi Pelita yang mendapatkan beasiswa pascasarjana ke luar negeri fasih berbahasa Prancis.\n3. Doni adalah pegawai berprestasi di instansi Pelita.\n\nKesimpulan yang paling tepat dan sah secara logika adalah...`,
      options: {
        A: "Doni dipastikan mendapatkan beasiswa pascasarjana, namun belum tentu fasih berbahasa Prancis",
        B: "Doni dipastikan fasih berbahasa Prancis karena merupakan pegawai berprestasi di instansi Pelita",
        C: "Semua pegawai instansi Pelita yang fasih berbahasa Prancis adalah pegawai berprestasi seperti Doni",
        D: "Doni tidak berhak menerima beasiswa pascasarjana selama ia belum menguasai bahasa Prancis",
        E: "Sebagian pegawai yang berprestasi seperti Doni dilarang mempelajari bahasa Prancis",
      },
      correctOption: "A",
      scoringRubric: { A: 5, B: 0, C: 0, D: 0, E: 0 },
      rubricRationale: `Jawaban Benar adalah A.
Pembahasan:
- Premis 1: Pegawai berprestasi -> Mendapat beasiswa (Universal / Semua).
- Premis 3: Doni adalah pegawai berprestasi.
  Berdasarkan Modus Ponens dari Premis 1 & 3: Doni PASTI mendapatkan beasiswa pascasarjana ke luar negeri.
- Premis 2: Sebagian peraih beasiswa fasih berbahasa Prancis (Partikular / Sebagian).
  Karena premis menggunakan kuantor "sebagian", anggota kelompok beasiswa yang fasih bahasa Prancis hanyalah himpunan bagian (subset). Maka bagi Doni secara individual, ia MUNGKIN fasih atau MUNGKIN TIDAK fasih (belum tentu).
- Oleh karena itu, kesimpulan yang valid adalah Doni dipastikan mendapat beasiswa, namun belum tentu fasih berbahasa Prancis.`,
    },
  },

  // --- TIU 2: Penalaran Analitis Meja Bundar ---
  {
    externalId: "skd-tiu-hots-02",
    title: "Benchmark Soal HOTS TIU 2: Penalaran Analitis Posisi Duduk 6 Delegasi Meja Melingkar",
    category: "TIU",
    subtopic: "Penalaran Analitis Posisi Duduk",
    docType: "contoh_soal_hots",
    scoringRule: "binary_5_0",
    content: `Soal HOTS TIU Penalaran Analitis:
Enam orang diplomat (P, Q, R, S, T, dan U) mengadakan pertemuan bilateral dan duduk mengelilingi meja bundar dengan enam kursi berjarak sama:
1. P duduk tepat berhadapan dengan R.
2. Q duduk tepat di sebelah kiri P.
3. T duduk tepat di sebelah kiri R.
4. S duduk tepat di sebelah kanan P.

Siapakah diplomat yang duduk tepat berhadapan dengan Q?
A. S
B. T
C. U
D. R
E. P`,
    quizPayload: {
      category: "TIU",
      subtopic: "Penalaran Analitis Urutan Posisi",
      questionStem: `Enam diplomat (P, Q, R, S, T, U) duduk melingkar mengelilingi meja bundar dengan 6 kursi berjarak sama:\n- P duduk tepat berhadapan dengan R.\n- Q duduk tepat di sebelah kiri P.\n- T duduk tepat di sebelah kiri R.\n- S duduk tepat di sebelah kanan P.\n\nSiapakah diplomat yang duduk tepat berhadapan dengan Q?`,
      options: {
        A: "Diplomat S",
        B: "Diplomat T",
        C: "Diplomat U",
        D: "Diplomat R",
        E: "Diplomat P",
      },
      correctOption: "B",
      scoringRubric: { A: 0, B: 5, C: 0, D: 0, E: 0 },
      rubricRationale: `Jawaban Benar adalah B (Diplomat T).
Pembahasan:
Misalkan 6 kursi melingkar diberi nomor urut 1 s.d. 6 searah jarum jam:
1. Letakkan P pada Kursi 1 (menghadap ke pusat meja).
   - Kursi di hadapan P adalah Kursi 4, maka R menempati Kursi 4.
2. Q duduk tepat di sebelah kiri P. Menghadap pusat meja dari Kursi 1, arah kiri adalah Kursi 2. Maka Q berada di Kursi 2.
3. T duduk tepat di sebelah kiri R. Menghadap pusat meja dari Kursi 4, arah kiri adalah Kursi 5. Maka T berada di Kursi 5.
4. S duduk tepat di sebelah kanan P. Menghadap pusat meja dari Kursi 1, arah kanan adalah Kursi 6. Maka S berada di Kursi 6.
5. Kursi 3 yang tersisa di antara Q dan R otomatis ditempati oleh diplomat U.

Susunan melingkar lengkap (1: P, 2: Q, 3: U, 4: R, 5: T, 6: S):
- Kursi 1 (P) berhadapan dengan Kursi 4 (R).
- Kursi 2 (Q) berhadapan dengan Kursi 5 (T).
- Kursi 6 (S) berhadapan dengan Kursi 3 (U).

Maka diplomat yang duduk tepat berhadapan dengan Q adalah Diplomat T.`,
    },
  },

  // --- TIU 3: Proyek Terhenti Cuaca Buruk ---
  {
    externalId: "skd-tiu-hots-03",
    title: "Benchmark Soal HOTS TIU 3: Aritmatika Perbandingan Berbalik Nilai Pekerja Tambahan",
    category: "TIU",
    subtopic: "Aritmatika Sosial Proyek Terhenti",
    docType: "contoh_soal_hots",
    scoringRule: "binary_5_0",
    content: `Soal HOTS TIU Kemampuan Numerik:
Sebuah proyek pembangunan jembatan ditargetkan selesai dalam waktu 40 hari oleh 24 pekerja terampil. Setelah pekerjaan berlangsung selama 15 hari, proyek terpaksa dihentikan selama 5 hari akibat banjir lahar hujan di sungai. Jika setiap pekerja memiliki kemampuan kerja yang sama dan proyek harus selesai tepat waktu sesuai jadwal semula, berapakah jumlah pekerja tambahan yang harus direkrut oleh kontraktor?
A. 4 orang
B. 6 orang
C. 8 orang
D. 10 orang
E. 12 orang`,
    quizPayload: {
      category: "TIU",
      subtopic: "Perbandingan Berbalik Nilai",
      questionStem: `Sebuah proyek jembatan direncanakan selesai dalam waktu 40 hari dengan 24 pekerja. Setelah 15 hari berjalan, pekerjaan terhenti selama 5 hari karena banjir bandang. Agar proyek dapat diselesaikan tepat waktu sesuai jadwal semula, berapa tambahan pekerja yang harus ditambah?`,
      options: {
        A: "4 pekerja",
        B: "6 pekerja",
        C: "8 pekerja",
        D: "10 pekerja",
        E: "12 pekerja",
      },
      correctOption: "B",
      scoringRubric: { A: 0, B: 5, C: 0, D: 0, E: 0 },
      rubricRationale: `Jawaban Benar adalah B (6 pekerja).
Pembahasan:
Metode Beban Kerja (Orang-Hari):
- Sisa hari normal setelah 15 hari = 40 - 15 = 25 hari.
- Beban pekerjaan tersisa yang harus diselesaikan:
  Beban Sisa = 24 pekerja x 25 hari = 600 orang-hari.
- Karena pekerjaan terhenti selama 5 hari, sisa hari efektif yang tersedia:
  Sisa Hari Efektif = 25 hari - 5 hari = 20 hari.
- Total pekerja yang dibutuhkan agar selesai dalam 20 hari:
  P_total = 600 / 20 = 30 pekerja.
- Tambahan pekerja yang dibutuhkan:
  Tambahan = P_total - Pekerja Awal = 30 - 24 = 6 pekerja.

Metode Rumus Cepat:
Delta P = (P_awal x Hari Libur) / Sisa Hari Efektif
Delta P = (24 x 5) / 20 = 120 / 20 = 6 pekerja.`,
    },
  },

  // --- TIU 4: Deret Angka Kombinasi Larik Bertingkat ---
  {
    externalId: "skd-tiu-hots-04",
    title: "Benchmark Soal HOTS TIU 4: Deret Angka Pola Larik Gandeng Geometri dan Kuadrat",
    category: "TIU",
    subtopic: "Deret Angka Kombinasi Dua Larik",
    docType: "contoh_soal_hots",
    scoringRule: "binary_5_0",
    content: `Soal HOTS TIU Deret Angka:
Tentukan dua bilangan berikutnya pada barisan angka berikut:
4, 7, 9, 14, 16, 28, 25, 56, ..., ...
A. 36 dan 84
B. 32 dan 112
C. 30 dan 98
D. 36 dan 112
E. 49 dan 112`,
    quizPayload: {
      category: "TIU",
      subtopic: "Pola Bilangan dan Deret Angka",
      questionStem: `Tentukan dua angka berikutnya dari barisan angka berikut:\n4, 7, 9, 14, 16, 28, 25, 56, ..., ...`,
      options: {
        A: "36 dan 84",
        B: "32 dan 112",
        C: "30 dan 98",
        D: "36 dan 112",
        E: "49 dan 112",
      },
      correctOption: "D",
      scoringRubric: { A: 0, B: 0, C: 0, D: 5, E: 0 },
      rubricRationale: `Jawaban Benar adalah D (36 dan 112).
Pembahasan:
Deret ini merupakan gabungan 2 larik yang saling berselang-seling:
- Larik Ganjil (posisi ke-1, 3, 5, 7, 9):
  4, 9, 16, 25, ...
  Pola: Bilangan kuadrat berturut-turut:
  2^2 = 4
  3^2 = 9
  4^2 = 16
  5^2 = 25
  Suku ke-9 berikutnya adalah 6^2 = 36.
- Larik Genap (posisi ke-2, 4, 6, 8, 10):
  7, 14, 28, 56, ...
  Pola: Barisan geometri dengan rasio dikalikan 2 (x2):
  7 x 2 = 14
  14 x 2 = 28
  28 x 2 = 56
  Suku ke-10 berikutnya adalah 56 x 2 = 112.
Maka dua angka berikutnya adalah 36 dan 112.`,
    },
  },

  // --- TKP 1: Pelayanan Publik Lansia Jam Istirahat ---
  {
    externalId: "skd-tkp-hots-01",
    title: "Benchmark Soal HOTS TKP 1: Pelayanan Publik Lansia Menjelang Jam Istirahat Kantor",
    category: "TKP",
    subtopic: "Pelayanan Publik Ramah Kelompok Rentan",
    docType: "contoh_soal_hots",
    scoringRule: "scale_1_to_5",
    content: `Soal HOTS TKP Pelayanan Publik:
Anda adalah petugas loket pelayanan berkas di kantor Badan Kepegawaian Daerah. Lima menit sebelum loket ditutup untuk jam istirahat siang, seorang warga lanjut usia datang tergesa-gesa dengan nafas tersengal membawa map permohonan santunan pensiun almarhum suaminya. Rekan-rekan kerja Anda di loket sebelah sudah mulai menutup tirai loket dan beranjak keluar kantor untuk makan siang.

Bagaimana sikap terbaik yang Anda ambil dalam situasi tersebut?
A. Mempersilakan warga lansia tersebut duduk dengan ramah, menunda istirahat siang Anda sejenak untuk memeriksa kelengkapan berkas, menjelaskan bagian yang perlu dilengkapi dengan sabar, dan membantu jika ada formulir yang membingungkan.
B. Menjelaskan dengan sopan bahwa jam istirahat kantor sudah tiba, namun tetap meluangkan waktu 2-3 menit memeriksa syarat utama agar saat loket buka kembali pukul 13.00 berkas sudah siap diproses.
C. Menyarankan warga lansia tersebut untuk beristirahat di ruang tunggu berpendingin udara dan kembali tepat pukul 13.00 saat loket buka kembali agar pelayanan dapat berjalan tenang dan optimal.
D. Menerima berkas apa adanya tanpa diperiksa detail terlebih dahulu agar sang nenek bisa segera pulang, lalu berjanji akan memeriksanya setelah makan siang.
E. Mengarahkan warga tersebut untuk membaca lembar petunjuk persyaratan di dinding depan dan meminta bantuan petugas keamanan jika ada yang belum dimengerti.`,
    quizPayload: {
      category: "TKP",
      subtopic: "Pelayanan Publik",
      questionStem: `Anda adalah staf loket pelayanan terpadu. Lima menit sebelum jam istirahat siang, seorang warga lanjut usia datang tergesa-gesa dengan nafas tersengal membawa berkas santunan pensiun. Rekan-rekan kerja Anda sudah mulai menutup loket untuk makan siang. Sikap yang Anda ambil adalah...`,
      options: {
        A: "Menyapa ramah, menunda istirahat sejenak untuk memeriksa berkas, menjelaskan dengan sabar bagian yang kurang, serta membantu mengisi formulir",
        B: "Menjelaskan jam istirahat telah tiba, namun tetap membantu memeriksa syarat utama agar saat loket buka jam 13.00 berkas sudah siap",
        C: "Meminta warga lansia menunggu dengan nyaman di ruang ber-AC dan memintanya kembali pukul 13.00 sesuai jam operasional resmi",
        D: "Menerima berkas sekilas tanpa dicek agar warga bisa pulang, lalu memeriksanya setelah selesai makan siang",
        E: "Mengarahkan warga lansia tersebut membaca poster syarat di dinding loket dan meminta bantuan satpam",
      },
      correctOption: "A",
      scoringRubric: { A: 5, B: 4, C: 3, D: 2, E: 1 },
      rubricRationale: `Rubrik Penilaian Skor 1 s.d. 5 Aspek Pelayanan Publik:
- Skor 5 (Opsi A): Menunjukkan Core Value ASN Berorientasi Pelayanan paripurna. Pegawai proaktif, berempati tinggi pada lansia (kelompok rentan), rela menunda kepentingan pribadi sesaat demi menyelesaikan kebutuhan pemohon secara solutif dan tuntas.
- Skor 4 (Opsi B): Tetap membantu mengecek berkas utama sebelum istirahat sehingga pemohon mendapat kejelasan awal, namun belum menuntaskan proses verifikasi penuh.
- Skor 3 (Opsi C): Menjalankan SOP jam kerja secara normatif dan sopan menyediakan ruang tunggu, namun kurang memiliki kepekaan ekstra terhadap kondisi fisik lansia.
- Skor 2 (Opsi D): Mengambil jalan pintas yang berisiko merugikan masyarakat jika berkas yang diterima ternyata salah atau kurang saat pemohon sudah terlanjur pulang.
- Skor 1 (Opsi E): Menolak tanggung jawab pelayanan dan melempar tugas ke pihak lain (satpam/poster dinding).`,
    },
  },

  // --- TKP 2: Profesionalisme Sistem Lambat LPJ ---
  {
    externalId: "skd-tkp-hots-02",
    title: "Benchmark Soal HOTS TKP 2: Profesionalisme Menghadapi Gangguan Sistem Menjelang Batas Waktu",
    category: "TKP",
    subtopic: "Profesionalisme dan Kinerja Bertekanan",
    docType: "contoh_soal_hots",
    scoringRule: "scale_1_to_5",
    content: `Soal HOTS TKP Profesionalisme ASN:
Instansi tempat Anda bekerja menetapkan batas akhir pengunggahan laporan realisasi anggaran triwulan hari ini pukul 17.00 WIB. Kegagalan pelaporan tepat waktu akan memotong poin kinerja seluruh direktorat. Tepat pukul 13.30, server sistem pelaporan terpusat mengalami beban puncak dan kelambatan ekstrem sehingga halaman pengisian berulang kali gagal dimuat. Di saat yang sama, atasan Anda terus menanyakan kemajuan data.

Tindakan yang paling mencerminkan profesionalisme tinggi adalah:
A. Tetap tenang, berkoordinasi segera dengan admin IT pengelola server untuk mengetahui estimasi waktu perbaikan, sembari menyusun dan memvalidasi seluruh data secara offline pada lembar kerja terstruktur sehingga siap diunggah seketika sistem kembali normal.
B. Terus mencoba melakukan refresh halaman sistem berkala setiap beberapa menit sembari menginput data sedikit demi sedikit hingga berhasil.
C. Menghadap atasan secara langsung untuk menjelaskan kendala teknis kelambatan server dan meminta arahan apakah batas waktu pelaporan dapat diperpanjang ke kementerian keuangan.
D. Mengajak rekan-rekan satu tim istirahat sejenak sambil menunggu traffic server mereda pada sore hari menjelang batas waktu penutupan.
E. Menuliskan keluhan di grup media sosial internal mengenai buruknya infrastruktur server instansi yang selalu tumbang saat tenggat waktu.`,
    quizPayload: {
      category: "TKP",
      subtopic: "Profesionalisme Kerja",
      questionStem: `Hari ini adalah batas akhir pelaporan anggaran pukul 17.00 WIB. Pukul 13.30, server pusat instansi mendadak lambat ekstrem dan sulit diakses karena overload. Atasan mendesak laporan segera rampung. Tindakan Anda yang paling tepat adalah...`,
      options: {
        A: "Tetap tenang, mengecek status IT, dan memvalidasi data secara offline pada spreadsheet agar langsung disinkronkan saat server pulih",
        B: "Terus me-refresh browser secara berkala dan menginput data perlahan-lahan di tengah kelambatan sistem",
        C: "Menghadap pimpinan menjelaskan kendala server dan menyarankan meminta perpanjangan tenggat waktu resmi",
        D: "Mengajak tim berhenti sementara waktu sambil menunggu lalu lintas server mereda di sore hari",
        E: "Mengeluhkan buruknya keandalan server kementerian di grup koordinasi kantor dan menunggu arahan atasan",
      },
      correctOption: "A",
      scoringRubric: { A: 5, B: 4, C: 3, D: 2, E: 1 },
      rubricRationale: `Rubrik Penilaian Skor 1 s.d. 5 Aspek Profesionalisme:
- Skor 5 (Opsi A): Menunjukkan Core Value "Akuntabel" dan "Kompeten". Pegawai tidak panik, berorientasi hasil, mencari alternatif cerdas dan efisien (bekerja offline terstruktur) sehingga pekerjaan selesai tepat waktu begitu hambatan teknis teratasi.
- Skor 4 (Opsi B): Menunjukkan kegigihan dan ketahanan kerja, namun kurang efisien karena terus membebani server yang sedang lambat.
- Skor 3 (Opsi C): Bersikap transparan melapor ke atasan, tetapi pasif karena langsung mencari jalan keluar berupa perpanjangan waktu tanpa upaya maksimal terlebih dahulu.
- Skor 2 (Opsi D): Menyerah pada situasi hambatan dan memilih menunda pekerjaan dengan risiko kegagalan tenggat waktu yang fatal.
- Skor 1 (Opsi E): Reaktif, menyebarkan aura negatif di lingkungan kerja, dan tidak memberikan solusi produktif sedikit pun.`,
    },
  },

  // --- TKP 3: Anti-Radikalisme Pesan Intoleran di WhatsApp Grup ---
  {
    externalId: "skd-tkp-hots-03",
    title: "Benchmark Soal HOTS TKP 3: Moderasi Beragama dan Anti-Radikalisme di Lingkungan Kerja ASN",
    category: "TKP",
    subtopic: "Anti-Radikalisme dan Moderasi Beragama",
    docType: "contoh_soal_hots",
    scoringRule: "scale_1_to_5",
    content: `Soal HOTS TKP Anti-Radikalisme:
Di grup obrolan informal instansi yang beranggotakan rekan-rekan satu kantor, seorang rekan kerja menyebarkan tautan video berdurasi singkat yang berisi narasi provokatif menuduh kelompok keagamaan tertentu mengendalikan birokrasi pemerintahan dan menyerukan aksi pemboikotan terhadap program kerja rekan yang berbeda keyakinan. Beberapa anggota grup mulai menunjukkan persetujuan dan suasana menjadi canggung.

Bagaimana sikap Anda sebagai seorang ASN yang menjunjung tinggi kebhinekaan dan nilai Pancasila?
A. Mengingatkan secara terbuka di dalam grup dengan kalimat santun namun tegas bahwa ASN memiliki kode etik netralitas dan kewajiban menjaga persatuan bangsa, serta memverifikasi fakta bahwa isi video tersebut hoaks guna meredam perpecahan.
B. Mengirimkan pesan pribadi (japri) kepada rekan pengunggah video untuk mengingatkannya agar menghapus kiriman tersebut demi menjaga keharmonisan hubungan kerja.
C. Melaporkan tangkapan layar percakapan tersebut langsung kepada bagian Pengawasan Internal/Inspektorat tanpa perlu menegur rekan di grup obrolan.
D. Memilih diam dan tidak ikut campur dalam perdebatan obrolan grup agar tidak menciptakan konflik personal dengan rekan kerja.
E. Menyerang balik rekan pengunggah video di grup tersebut dengan kata-kata keras agar ia merasa jera dan dipermalukan.`,
    quizPayload: {
      category: "TKP",
      subtopic: "Jejaring Kerja dan Anti-Radikalisme",
      questionStem: `Di grup percakapan internal unit kerja, seorang rekan menyebarkan konten video intoleran bernada kebencian terhadap kelompok agama tertentu dan mengajak memboikot kerja sama. Beberapa anggota tampak mulai terprovokasi. Sikap Anda adalah...`,
      options: {
        A: "Mengingatkan santun tapi tegas di grup tentang netralitas ASN dan kebinekaan, serta meluruskan fakta konten agar suasana kondusif",
        B: "Menghubungi rekan penyebar via pesan pribadi untuk mengingatkan secara halus agar menghapus video dari grup",
        C: "Mengambil tangkapan layar dan langsung melaporkannya ke tim pengawas disiplin/Inspektorat tanpa komunikasi di grup",
        D: "Memilih tidak berkomentar dan mengabaikan agar tidak terlibat perselisihan pribadi antar rekan kantor",
        E: "Membalas pesan tersebut dengan nada emosional di grup untuk mempermalukan rekan penyebar konten kebencian",
      },
      correctOption: "A",
      scoringRubric: { A: 5, B: 4, C: 3, D: 2, E: 1 },
      rubricRationale: `Rubrik Penilaian Skor 1 s.d. 5 Aspek Anti-Radikalisme & Harmonis:
- Skor 5 (Opsi A): ASN berani bersikap lugas meredam bibit polarisasi di ranah publik grup, mengedepankan edukasi etika netralitas ASN dan klarifikasi objektif dengan kepala dingin. Mencegah eskalasi secara langsung di hadapan publik yang terlanjur melihat konten.
- Skor 4 (Opsi B): Berusaha menyelesaikan masalah secara interpersonal (japri) untuk menjaga perasaan rekan, namun kurang efektif dalam meluruskan persepsi anggota grup lain yang sudah terlanjur menonton.
- Skor 3 (Opsi C): Memilih jalur birokrasi formal, namun terkesan mencari aman dan ketiadaan inisiatif langsung mengendalikan dinamika di tingkat tim.
- Skor 2 (Opsi D): Bersikap abai (apatis) terhadap penyebaran narasi radikal dan intoleransi yang mengancam persatuan.
- Skor 1 (Opsi E): Reaktif emosional, melanggar etika komunikasi santun, dan justru memperkeruh suasana kerja.`,
    },
  },

  // --- TKP 4: TIK & Pendampingan Rekan Senior ---
  {
    externalId: "skd-tkp-hots-04",
    title: "Benchmark Soal HOTS TKP 4: Pemanfaatan TIK dan Pendampingan Adaptasi Digital Rekan Kerja",
    category: "TKP",
    subtopic: "Literasi Digital dan Kolaborasi TIK",
    docType: "contoh_soal_hots",
    scoringRule: "scale_1_to_5",
    content: `Soal HOTS TKP Teknologi Informasi dan Komunikasi (TIK):
Kementerian Anda meluncurkan aplikasi digital terpadu untuk pengarsipan dan tanda tangan elektronik berbasis kecerdasan buatan. Sebagian besar pegawai muda cepat menguasai aplikasi tersebut, namun beberapa pegawai senior merasa kesulitan, mengeluhkan sistem yang rumit, dan tetap bersikeras mencetak dokumen fisik secara manual. Hal ini menyebabkan integrasi basis data instansi menjadi terhambat.

Tindakan apa yang paling tepat Anda lakukan?
A. Berinisiatif meluangkan waktu membuat panduan ringkas langkah-demi-langkah disertai tangkapan layar, lalu mendampingi rekan senior secara sabar dalam mempraktikkannya hingga mereka merasa percaya diri menggunakan aplikasi digital tersebut.
B. Mengusulkan kepada pimpinan kantor agar mengadakan sesi pelatihan penyegaran resmi khusus bagi pegawai yang masih mengalami kendala operasional sistem.
C. Mengambil alih seluruh dokumen milik pegawai senior dan menginputkannya sendiri ke dalam aplikasi digital demi mengejar target integrasi data kementerian.
D. Memberitahu pegawai senior bahwa cara manual sudah tidak diakui kementerian dan meminta mereka segera membiasakan diri secara mandiri.
E. Membiarkan situasi tersebut sampai pimpinan instansi sendiri yang menegur dan memberikan sanksi bagi pegawai yang belum beralih ke aplikasi baru.`,
    quizPayload: {
      category: "TKP",
      subtopic: "Pemanfaatan TIK dan Adaptabilitas",
      questionStem: `Instansi menerapkan sistem arsip digital baru. Pegawai senior kesulitan beradaptasi dan tetap memakai kertas manual sehingga sinkronisasi basis data instansi tersendat. Sebagai rekan kerja yang menguasai teknologi, sikap terbaik Anda adalah...`,
      options: {
        A: "Meluangkan waktu membuat panduan praktis bergambar dan mendampingi rekan senior dengan sabar sampai mandiri mengoperasikannya",
        B: "Mengusulkan kepada atasan agar diselenggarakan workshop pendampingan khusus bagi pegawai yang belum mahir sistem",
        C: "Mengerjakan seluruh penginputan dokumen rekan senior ke sistem agar target laporan instansi segera rampung",
        D: "Menegaskan kepada rekan senior bahwa cara lama sudah dilarang dan meminta mereka belajar sendiri",
        E: "Membiarkan hal tersebut hingga atasan melakukan audit berkala dan menegur pihak yang belum patuh",
      },
      correctOption: "A",
      scoringRubric: { A: 5, B: 4, C: 3, D: 2, E: 1 },
      rubricRationale: `Rubrik Penilaian Skor 1 s.d. 5 Aspek TIK & Kolaboratif:
- Skor 5 (Opsi A): Sinergi sempurna antara Core Values "Adaptif" (TIK) dan "Kolaboratif/Harmonis". Pegawai tidak hanya menguasai teknologi secara individual, tetapi menggerakkan kapabilitas tim melalui transfer pengetahuan yang suportif, sabar, dan memberdayakan rekan senior.
- Skor 4 (Opsi B): Solutif secara manajerial melalui usulan pelatihan terstruktur, namun masih membutuhkan waktu birokrasi dan ketiadaan tindakan inisiatif cepat langsung di lapangan.
- Skor 3 (Opsi C): Menuntaskan target jangka pendek, tetapi menimbulkan ketergantungan dan tidak memecahkan akar masalah kapabilitas digital rekan kerja.
- Skor 2 (Opsi D): Benar secara substansi regulasi, tetapi kaku, tidak empatik, dan tidak memberikan bantuan praktis.
- Skor 1 (Opsi E): Apatis, tidak peduli terhadap kinerja tim, dan menunggu rekan kerja terkena masalah/sanksi.`,
    },
  },
];
