export type HelpItem = {
  id: string;
  title: string;
  content: string;
};

export type HelpSection = {
  id: string;
  heading: string;
  items: HelpItem[];
};

export const helpSections: HelpSection[] = [
  {
    id: "about-skd-tutor",
    heading: "1. Tentang Tutor SKD CPNS",
    items: [
      {
        id: "what-is-skd-tutor",
        title: "Apa itu Tutor SKD CPNS berbasis AI?",
        content:
          "Tutor SKD CPNS adalah platform pembelajaran interaktif berbasis AI dan RAG (Retrieval-Augmented Generation) yang dirancang khusus untuk membantu calon peserta seleksi CPNS menguasai materi Seleksi Kompetensi Dasar (SKD) sesuai standar PermenPAN-RB dan BKN.",
      },
      {
        id: "covered-subjects",
        title: "Materi apa saja yang diujikan dalam SKD?",
        content:
          "SKD terdiri dari 3 sub-tes utama: (1) Tes Wawasan Kebangsaan (TWK) meliputi Nasionalisme, Integritas, Bela Negara, dan Pilar Negara; (2) Tes Inteligensia Umum (TIU) meliputi Kemampuan Verbal (Silogisme, Analogi), Kemampuan Numerik (Deret, Pecahan, Soal Cerita), dan Kemampuan Figural; (3) Tes Karakteristik Pribadi (TKP) meliputi Pelayanan Publik, Jejaring Kerja, Sosial Budaya, TIK, Profesionalisme, dan Anti Radikalisme.",
      },
      {
        id: "ai-learning-advantages",
        title: "Apa keunggulan berlatih dengan tutor AI ini?",
        content:
          "Tutor AI menyajikan latihan soal bergaya HOTS (Higher Order Thinking Skills) lengkap dengan opsi pilihan ganda A–E, penguncian kunci jawaban anti-bocor hingga Anda memilih jawaban, serta pembahasan mendalam dan rasional rubrik penilaian yang transparan.",
      },
    ],
  },
  {
    id: "interactive-quizzes",
    heading: "2. Cara Latihan Soal Interaktif",
    items: [
      {
        id: "how-to-request-quiz",
        title: "Bagaimana cara meminta soal latihan di chat?",
        content:
          "Anda dapat mengetikkan permintaan langsung seperti 'Berikan 1 soal latihan TWK HOTS' atau 'Minta soal TIU Silogisme'. Anda juga dapat mengklik tombol ikon lampu (Saran) di kolom chat untuk memilih salah satu prompt cepat yang tersedia.",
      },
      {
        id: "answering-questions",
        title: "Bagaimana cara menjawab soal yang diberikan?",
        content:
          "Setiap soal latihan disajikan dalam kartu soal interaktif dengan tombol opsi A, B, C, D, dan E. Anda cukup mengklik huruf pilihan Anda pada kartu soal, atau mengetikkan jawaban Anda di kolom chat (misalnya: 'Jawaban saya C').",
      },
      {
        id: "turn-based-eval",
        title: "Mengapa kunci jawaban tidak langsung diberitahukan?",
        content:
          "Untuk mensimulasikan ujian CAT BKN yang sesungguhnya, sistem mengunci kunci jawaban dan nilai rubrik di server hingga Anda menentukan pilihan. Setelah Anda menjawab, sistem mengevaluasi ketepatan jawaban Anda dan membuka pembahasan lengkap.",
      },
    ],
  },
  {
    id: "scoring-and-passing-grades",
    heading: "3. Sistem Skor & Target Passing Grade BKN",
    items: [
      {
        id: "twk-tiu-scoring",
        title: "Bagaimana sistem penilaian TWK dan TIU?",
        content:
          "Pada TWK (30 soal) dan TIU (35 soal), jawaban benar bernilai +5 poin dan jawaban salah atau kosong bernilai 0 poin (tidak ada sistem minus). Passing grade resmi formasi umum: TWK minimal 65 poin (minimal 13 soal benar) dan TIU minimal 80 poin (minimal 16 soal benar).",
      },
      {
        id: "tkp-rubric-scoring",
        title: "Bagaimana sistem penilaian bertingkat pada TKP?",
        content:
          "Pada TKP (45 soal), tidak ada jawaban benar mutlak bernilai nol. Seluruh opsi (A–E) memiliki bobot nilai bergradasi dari 1 hingga 5 poin sesuai keselarasan nilai ASN BerAKHLAK. Passing grade resmi formasi umum TKP adalah minimal 166 poin.",
      },
      {
        id: "cumulative-target",
        title: "Berapa target skor total SKD yang aman?",
        content:
          "Total skor maksimal SKD adalah 550 (TWK 150 + TIU 175 + TKP 225). Peserta disarankan menargetkan total skor di atas 400–450 poin untuk memastikan lolos pemeringkatan perangkingan 3 kali formasi menuju tahap SKB.",
      },
    ],
  },
  {
    id: "history-and-evaluation",
    heading: "4. Evaluasi & Riwayat Soal di /quiz-history",
    items: [
      {
        id: "chat-quiz-drawer",
        title: "Bagaimana melihat rekap soal pada sesi percakapan aktif?",
        content:
          "Di bagian atas ruang chat, terdapat tombol 'Soal di Chat' yang membuka slide-over drawer berisi seluruh soal dalam sesi aktif, status penyelesaian, serta total perolehan skor Anda.",
      },
      {
        id: "quiz-history-dashboard",
        title: "Apa fungsi halaman Riwayat Latihan SKD (/quiz-history)?",
        content:
          "Halaman Riwayat Latihan SKD menampilkan dashboard komprehensif berupa grafik akurasi per kategori, perbandingan skor dengan passing grade resmi BKN, filter status terjawab/belum, serta riwayat kartu soal beserta penjelasan rubrik.",
      },
      {
        id: "review-explanations",
        title: "Apakah saya bisa meninjau ulang pembahasan soal lama?",
        content:
          "Ya. Pada kartu soal yang sudah dijawab, Anda dapat mengklik 'Lihat Pembahasan & Rasional Rubrik' untuk membaca ulasan mendalam konsep dan rasional pembobotan poin.",
      },
    ],
  },
  {
    id: "account-and-privacy",
    heading: "5. Akun, Mode Tamu, & Privasi Data",
    items: [
      {
        id: "guest-mode",
        title: "Apakah saya bisa mencoba tanpa login (Mode Tamu)?",
        content:
          "Ya. Pengguna tamu dapat langsung mencoba latihan interaktif di chat dan melihat riwayat latihan di perangkat yang sama selama 24 jam.",
      },
      {
        id: "save-permanently",
        title: "Bagaimana agar riwayat latihan tersimpan permanen?",
        content:
          "Dengan membuat akun dan login, seluruh riwayat percakapan dan statistik latihan soal Anda akan tersimpan secara aman dan permanen di database akun Anda.",
      },
      {
        id: "feedback-and-support",
        title: "Bagaimana cara menyampaikan masukan atau kendala teknis?",
        content:
          "Jika Anda menemukan kendala teknis atau saran materi soal, silakan sampaikan melalui tim pengembang atau administrator platform belajar.",
      },
    ],
  },
];