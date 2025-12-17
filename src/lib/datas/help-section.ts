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
    id: "getting-started",
    heading: "1. Memulai (Getting Started)",
    items: [
      {
        id: "how-to-use",
        title: "Bagaimana cara menggunakan aplikasi ini?",
        content:
          "Buka halaman utama dan ketikkan pertanyaan Anda pada kolom chat, lalu tekan tombol kirim atau tekan Enter. Chatbot akan mencoba menjawab berdasarkan informasi yang terdapat di database.",
      },
      {
        id: "main-purpose",
        title: "Apa fungsi utama dari aplikasi ini?",
        content:
          "Aplikasi ini berfungsi sebagai portal informasi resmi Kabupaten Madiun yang memungkinkan pengguna mencari jawaban dari dokumen dan data yang telah diindeks oleh sistem (RAG).",
      },
      {
        id: "supported-browsers",
        title: "Browser dan perangkat yang didukung",
        content:
          "Aplikasi ini bekerja di browser modern seperti Chrome, Firefox, Edge, dan Safari. Untuk pengalaman terbaik, gunakan versi browser terbaru dan koneksi internet stabil.",
      },
      {
        id: "no-account-needed",
        title: "Apakah perlu membuat akun?",
        content:
          "Untuk sebagian besar fitur dasar (mencari informasi via chatbot), akun tidak diperlukan. Beberapa fitur lanjutan atau pencatatan histori mungkin memerlukan autentikasi di masa mendatang.",
      },
    ],
  },
  {
    id: "chatbot-features",
    heading: "2. Menggunakan Fitur Chatbot",
    items: [
      {
        id: "ask-chatbot",
        title: "Bagaimana cara bertanya kepada chatbot?",
        content:
          "Anda cukup menuliskan pertanyaan secara jelas dan spesifik. Hindari pertanyaan berlapis; jika perlu, pisahkan menjadi beberapa pertanyaan agar hasil lebih akurat.",
      },
      {
        id: "rag-explanation",
        title: "Apa itu RAG (Retrieval-Augmented Generation)?",
        content:
          "RAG adalah metode yang menggabungkan sistem pencarian dokumen (retrieval) dengan model bahasa (generation). Sistem mengambil cuplikan relevan dari sumber internal, lalu model menghasilkan jawaban berdasarkan konteks tersebut.",
      },
      {
        id: "language-rules",
        title: "Bahasa apa yang harus digunakan?",
        content:
          "Gunakan Bahasa Indonesia. Jika pengguna memakai Bahasa Inggris, sistem akan meminta pengguna beralih ke Bahasa Indonesia sesuai aturan sistem.",
      },
      {
        id: "examples-and-tips",
        title: "Contoh pertanyaan yang baik",
        content:
          'Contoh: "Apa persyaratan mendapatkan bantuan X di Kabupaten Madiun tahun 2024?" Lebih spesifik => lebih relevan. Sertakan nama program, tahun, atau lokasi bila perlu.',
      },
    ],
  },
  {
    id: "bot-workings",
    heading: "3. Cara Kerja Chatbot & Sumber Informasi",
    items: [
      {
        id: "sources",
        title: "Dari mana chatbot mengambil informasinya?",
        content:
          "Chatbot mengambil informasi dari dokumen, peraturan, dan data internal yang telah diindeks ke dalam database RAG. Sistem tidak melakukan penelusuran web langsung; jawaban dihasilkan oleh model AI berdasarkan sumber internal tersebut.",
      },
      {
        id: "update-frequency",
        title: "Seberapa sering data diperbarui?",
        content:
          "Frekuensi pembaruan tergantung pada proses pengindeksan internal. Untuk pembaruan penting (mis. peraturan baru), admin perlu menjalankan proses re-ingest agar data terbaru tersedia.",
      },
      {
        id: "accuracy-and-limits",
        title: "Seberapa akurat jawaban chatbot?",
        content:
          "Akurasi bergantung pada ketersediaan dan kualitas data di konteks. Jika informasi tidak ada atau tidak cukup, chatbot akan menyatakan bahwa data tidak ditemukan dan tidak boleh mengarang jawaban.",
      },
      {
        id: "privacy",
        title: "Bagaimana privasi data pengguna dijaga?",
        content:
          "Sistem hanya menyimpan riwayat percakapan sesuai kebijakan aplikasi. Data sensitif sebaiknya tidak dibagikan di chat. Admin bertanggung jawab atas konfigurasi penyimpanan dan kebijakan privasi.",
      },
    ],
  },
  {
    id: "access-technical",
    heading: "4. Akses & Kendala Teknis",
    items: [
      {
        id: "login-issues",
        title: "Jika mengalami masalah akses atau login",
        content:
          "Periksa koneksi internet, bersihkan cache browser, dan coba muat ulang halaman. Jika masih bermasalah, catat pesan error dan hubungi tim support.",
      },
      {
        id: "report-bug",
        title: "Bagaimana melaporkan bug atau kesalahan konten?",
        content:
          "Laporkan lewat email support atau formulir kontak yang disediakan. Sertakan deskripsi masalah, langkah reproduksi, dan screenshot bila perlu.",
      },
      {
        id: "attachments-and-uploads",
        title: "Apakah bisa mengunggah dokumen untuk dicari?",
        content:
          "Saat ini unggah dokumen hanya tersedia untuk admin. Untuk menambah dokumen publik, hubungi administrator agar dokumen diindeks ke sistem.",
      },
    ],
  },
  {
    id: "other",
    heading: "5. Lainnya",
    items: [
      {
        id: "contact-support",
        title: "Kontak dan dukungan",
        content:
          "Untuk bantuan lebih lanjut, kirim email ke ariefsatria2409@gmail.com atau gunakan formulir kontak pada halaman 'Hubungi Kami'.",
      },
      {
        id: "feedback",
        title: "Memberi masukan atau saran",
        content:
          "Masukan sangat dihargai untuk meningkatkan kualitas data dan layanan. Silakan kirim saran melalui email atau formulir umpan balik di situs.",
      },
      {
        id: "terms",
        title: "Syarat penggunaan dan kebijakan",
        content:
          "Gunakan layanan sesuai peraturan yang berlaku. Untuk informasi lebih lanjut mengenai kebijakan penggunaan data, hubungi admin atau lihat dokumen kebijakan yang tersedia.",
      },
    ],
  },
];
