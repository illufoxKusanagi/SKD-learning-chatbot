import {
  checkRagDataSchema,
  insertRagData,
  testDatabaseConnection,
} from "@/lib/db/index";
import { generateEmbedding } from "@/lib/services/ai/embeddings.service";
import { NextRequest, NextResponse } from "next/server";

// Your existing ragDataToInsert array - keeping it exactly as is
const ragDataToInsert = [
  {
    content: "Ir. Tontro Pahlawanto menjabat sebagai Sekretaris Daerah.",
    data: {
      type: "pejabat",
      name: "Tontro Pahlawanto",
      first_degree: "Ir.",
      last_degree: "",
      position: "Sekretaris Daerah",
      unit: "Sekretariat Daerah",
    },
    embedding: [],
  },
  {
    content:
      "Mohamad Hadi Sutikno, S.Sos, M.Si menjabat sebagai Kepala Badan Pendapatan Daerah.",
    data: {
      type: "pejabat",
      name: "Mohamad Hadi Sutikno",
      first_degree: "",
      last_degree: "S.Sos, M.Si",
      position: "Kepala Badan",
      unit: "Badan Pendapatan Daerah",
    },
    embedding: [],
  },
  {
    content:
      "Sodik Hery Purnomo, S.Si menjabat sebagai Asisten Perekonomian dan Pembangunan.",
    data: {
      type: "pejabat",
      name: "Sodik Hery Purnomo",
      first_degree: "",
      last_degree: "S.Si",
      position: "Asisten",
      unit: "Asisten Perekonomian dan Pembangunan",
    },
    embedding: [],
  },
  {
    content:
      "Kurnia Aminulloh, SH menjabat sebagai Kepala Badan Perencanaan Pembangunan Daerah.",
    data: {
      type: "pejabat",
      name: "Kurnia Aminulloh",
      first_degree: "",
      last_degree: "SH",
      position: "Kepala Badan",
      unit: "Badan Perencanaan Pembangunan Daerah",
    },
    embedding: [],
  },
  {
    content:
      "Anang Sulistijono, S.Sos., M.Si menjabat sebagai Kepala Dinas Pariwisata, Pemuda dan Olah Raga.",
    data: {
      type: "pejabat",
      name: "Anang Sulistijono",
      first_degree: "",
      last_degree: "S.Sos., M.Si",
      position: "Kepala Dinas",
      unit: "Dinas Pariwisata, Pemuda dan Olah Raga",
    },
    embedding: [],
  },
  {
    content:
      "Indra Setyawan, SE, M.Si menjabat sebagai Kepala Dinas Perdagangan, Koperasi, dan Usaha Mikro.",
    data: {
      type: "pejabat",
      name: "Indra Setyawan",
      first_degree: "",
      last_degree: "SE, M.Si",
      position: "Kepala Dinas",
      unit: "Dinas Perdagangan, Koperasi, dan Usaha Mikro",
    },
    embedding: [],
  },
  {
    content:
      "Dra. Siti Zubaidah, M.H menjabat sebagai Kepala Dinas Pendidikan dan Kebudayaan.",
    data: {
      type: "pejabat",
      name: "Siti Zubaidah",
      first_degree: "Dra.",
      last_degree: "M.H",
      position: "Kepala Dinas",
      unit: "Dinas Pendidikan dan Kebudayaan",
    },
    embedding: [],
  },
  {
    content: "Joko Lelono, AP, M.H menjabat sebagai Inspektur.",
    data: {
      type: "pejabat",
      name: "Joko Lelono",
      first_degree: "",
      last_degree: "AP, M.H",
      position: "Inspektur",
      unit: "Inspektorat Daerah",
    },
    embedding: [],
  },
  {
    content: "Yudi Hartono, S.Sos, MM menjabat sebagai Sekretaris DPRD.",
    data: {
      type: "pejabat",
      name: "Yudi Hartono",
      first_degree: "",
      last_degree: "S.Sos, MM",
      position: "Sekretaris DPRD",
      unit: "DPRD Kabupaten Madiun",
    },
    embedding: [],
  },
  {
    content:
      "Drs. Sawung Rehtomo, M.Si menjabat sebagai Kepala Dinas Komunikasi dan Informatika.",
    data: {
      type: "pejabat",
      name: "Sawung Rehtomo",
      first_degree: "Drs.",
      last_degree: "M.Si",
      position: "Kepala Dinas",
      unit: "Dinas Komunikasi dan Informatika",
    },
    embedding: [],
  },
  {
    content: "Supriyadi, AP., M.Si menjabat sebagai Kepala Dinas Perhubungan.",
    data: {
      type: "pejabat",
      name: "Supriyadi",
      first_degree: "",
      last_degree: "AP., M.Si",
      position: "Kepala Dinas",
      unit: "Dinas Perhubungan",
    },
    embedding: [],
  },
  {
    content:
      "Arik Krisdiananto, S.STP., M.H. menjabat sebagai Kepala Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu.",
    data: {
      type: "pejabat",
      name: "Arik Krisdiananto",
      first_degree: "",
      last_degree: "S.STP., M.H.",
      position: "Kepala Dinas",
      unit: "Dinas Penanaman Modal dan Pelayanan Terpadu Satu Pintu",
    },
    embedding: [],
  },
  {
    content:
      "Didik Harianto, S.Sos, MM menjabat sebagai Kepala Satuan Polisi Pamong Praja.",
    data: {
      type: "pejabat",
      name: "Didik Harianto",
      first_degree: "",
      last_degree: "S.Sos, MM",
      position: "Kepala Satuan",
      unit: "Satuan Polisi Pamong Praja",
    },
    embedding: [],
  },
  {
    content:
      "Ir. Soedjiono, MT menjabat sebagai Asisten Pemerintahan Dan Kesejahteraan Rakyat.",
    data: {
      type: "pejabat",
      name: "Soedjiono",
      first_degree: "Ir.",
      last_degree: "MT",
      position: "Asisten",
      unit: "Asisten Pemerintahan Dan Kesejahteraan Rakyat",
    },
    embedding: [],
  },
  {
    content:
      "Suryanto, SE., M.Si menjabat sebagai Kepala Dinas Pengendalian Penduduk dan Keluarga Berencana, Pemberdayaan Perempuan dan Perlindungan Anak.",
    data: {
      type: "pejabat",
      name: "Suryanto",
      first_degree: "",
      last_degree: "SE., M.Si",
      position: "Kepala Dinas",
      unit: "Dinas Pengendalian Penduduk dan Keluarga Berencana, Pemberdayaan Perempuan dan Perlindungan Anak",
    },
    embedding: [],
  },
  {
    content:
      "Heru Kuncoro, S.Sos, M.Si menjabat sebagai Kepala Badan Kepegawaian dan Pengembangan Sumber Daya Manusia.",
    data: {
      type: "pejabat",
      name: "Heru Kuncoro",
      first_degree: "",
      last_degree: "S.Sos, M.Si",
      position: "Kepala Badan",
      unit: "Badan Kepegawaian dan Pengembangan Sumber Daya Manusia",
    },
    embedding: [],
  },
  {
    content:
      "Drs. Hendro Suwondo, M.Pd menjabat sebagai Staf Ahli Bidang Kemasyarakatan dan Sumber Daya Manusia.",
    data: {
      type: "pejabat",
      name: "Hendro Suwondo",
      first_degree: "Drs.",
      last_degree: "M.Pd",
      position: "Staf Ahli",
      unit: "Staf Ahli Bidang Kemasyarakatan dan Sumber Daya Manusia",
    },
    embedding: [],
  },
  {
    content:
      "Mashudi, S.Sos, M.Si menjabat sebagai Kepala Badan Kesatuan Bangsa dan Politik.",
    data: {
      type: "pejabat",
      name: "Mashudi",
      first_degree: "",
      last_degree: "S.Sos, M.Si",
      position: "Kepala Badan",
      unit: "Badan Kesatuan Bangsa dan Politik",
    },
    embedding: [],
  },
  {
    content:
      "Puji Rahmawati, S.Sos., M.Si menjabat sebagai Staf Ahli Bidang Ekonomi Pembangunan Dan Keuangan.",
    data: {
      type: "pejabat",
      name: "Puji Rahmawati",
      first_degree: "",
      last_degree: "S.Sos., M.Si",
      position: "Staf Ahli",
      unit: "Staf Ahli Bidang Ekonomi Pembangunan Dan Keuangan",
    },
    embedding: [],
  },
  {
    content:
      "Yohanes Cahyono, S.Sos., M.Si menjabat sebagai Staf Ahli Bidang Pemerintahan Hukum Dan Politik.",
    data: {
      type: "pejabat",
      name: "Yohanes Cahyono",
      first_degree: "",
      last_degree: "S.Sos., M.Si",
      position: "Staf Ahli",
      unit: "Staf Ahli Bidang Pemerintahan Hukum Dan Politik",
    },
    embedding: [],
  },
  {
    content: "Achmad Romadhon, SH menjabat sebagai Asisten Administrasi Umum.",
    data: {
      type: "pejabat",
      name: "Achmad Romadhon",
      first_degree: "",
      last_degree: "SH",
      position: "Asisten",
      unit: "Asisten Administrasi Umum",
    },
    embedding: [],
  },
  {
    content:
      "Muhamad Zahrowi, AP menjabat sebagai Kepala Dinas Lingkungan Hidup.",
    data: {
      type: "pejabat",
      name: "Muhamad Zahrowi",
      first_degree: "",
      last_degree: "AP",
      position: "Kepala Dinas",
      unit: "Dinas Lingkungan Hidup",
    },
    embedding: [],
  },
  {
    content: "Imam Nurwedi, S.Sos menjabat sebagai Kepala Dinas Tenaga Kerja.",
    data: {
      type: "pejabat",
      name: "Imam Nurwedi",
      first_degree: "",
      last_degree: "S.Sos",
      position: "Kepala Dinas",
      unit: "Dinas Tenaga Kerja",
    },
    embedding: [],
  },
  {
    content:
      "Drs. Supriadi, S.Sos menjabat sebagai Kepala Dinas Pemberdayaan Masyarakat dan Desa.",
    data: {
      type: "pejabat",
      name: "Supriadi",
      first_degree: "Drs.",
      last_degree: "S.Sos",
      position: "Kepala Dinas",
      unit: "Dinas Pemberdayaan Masyarakat dan Desa",
    },
    embedding: [],
  },
  {
    content:
      "Paryoto, SP menjabat sebagai Kepala Dinas Ketahanan Pangan dan Peternakan.",
    data: {
      type: "pejabat",
      name: "Paryoto",
      first_degree: "",
      last_degree: "SP",
      position: "Kepala Dinas",
      unit: "Dinas Ketahanan Pangan dan Peternakan",
    },
    embedding: [],
  },
  {
    content:
      "Ir. Gunawi menjabat sebagai Kepala Dinas Pekerjaan Umum dan Penataan Ruang.",
    data: {
      type: "pejabat",
      name: "Gunawi",
      first_degree: "Ir.",
      last_degree: "",
      position: "Kepala Dinas",
      unit: "Dinas Pekerjaan Umum dan Penataan Ruang",
    },
    embedding: [],
  },
  {
    content:
      "Hari Pitojo, ST menjabat sebagai Kepala Dinas Perumahan dan Kawasan Permukiman.",
    data: {
      type: "pejabat",
      name: "Hari Pitojo",
      first_degree: "",
      last_degree: "ST",
      position: "Kepala Dinas",
      unit: "Dinas Perumahan dan Kawasan Permukiman",
    },
    embedding: [],
  },
  {
    content:
      "Sigit Budiarto, S.Sos, M.Si menjabat sebagai Kepala Dinas Kependudukan dan Pencatatan Sipil.",
    data: {
      type: "pejabat",
      name: "Sigit Budiarto",
      first_degree: "",
      last_degree: "S.Sos, M.Si",
      position: "Kepala Dinas",
      unit: "Dinas Kependudukan dan Pencatatan Sipil",
    },
    embedding: [],
  },
  {
    content: "Agung Tri Widodo, S.KM menjabat sebagai Kepala Dinas Kesehatan.",
    data: {
      type: "pejabat",
      name: "Agung Tri Widodo",
      first_degree: "",
      last_degree: "S.KM",
      position: "Kepala Dinas",
      unit: "Dinas Kesehatan",
    },
    embedding: [],
  },
  {
    content:
      "Kus Hendrawan, SH, M.Si menjabat sebagai Kepala Dinas Perpustakaan dan Kearsipan.",
    data: {
      type: "pejabat",
      name: "Kus Hendrawan",
      first_degree: "",
      last_degree: "SH, M.Si",
      position: "Kepala Dinas",
      unit: "Dinas Perpustakaan dan Kearsipan",
    },
    embedding: [],
  },
  {
    content:
      "Suntoko, S.Sos., M.Si menjabat sebagai Kepala Badan Pengelolaan Keuangan dan Aset Daerah.",
    data: {
      type: "pejabat",
      name: "Suntoko",
      first_degree: "",
      last_degree: "S.Sos., M.Si",
      position: "Kepala Badan",
      unit: "Badan Pengelolaan Keuangan dan Aset Daerah",
    },
    embedding: [],
  },
  {
    content:
      "Sumanto, SP., MMA menjabat sebagai Kepala Dinas Pertanian dan Perikanan.",
    data: {
      type: "pejabat",
      name: "Sumanto",
      first_degree: "",
      last_degree: "SP., MMA",
      position: "Kepala Dinas",
      unit: "Dinas Pertanian dan Perikanan",
    },
    embedding: [],
  },
  {
    content: "Drs. Agung Budiarto menjabat sebagai Plt. Kepala Dinas Sosisl.",
    data: {
      type: "pejabat",
      name: "Agung Budiarto",
      first_degree: "Drs.",
      last_degree: "",
      position: "Plt. Kepala Dinas",
      unit: "Dinas Sosisl",
    },
    embedding: [],
  },
  {
    content:
      "Boby Saktia Putra Lubis, ST menjabat sebagai Kepala Pelaksana Badan Penanggulangan Bencana.",
    data: {
      type: "pejabat",
      name: "Boby Saktia Putra Lubis",
      first_degree: "",
      last_degree: "ST",
      position: "Kepala Pelaksana",
      unit: "Badan Penanggulangan Bencana",
    },
    embedding: [],
  },
  {
    content:
      "Junaidi, S.Sos, M.Si menjabat sebagai Kepala Bagian Administrasi Pembangunan.",
    data: {
      type: "pejabat",
      name: "Junaidi",
      first_degree: "",
      last_degree: "S.Sos, M.Si",
      position: "Kepala Bagian",
      unit: "Bagian Administrasi Pembangunan",
    },
    embedding: [],
  },
  {
    content: "Alif Margianto, SH., M.Hum menjabat sebagai Kepala Bagian Hukum.",
    data: {
      type: "pejabat",
      name: "Alif Margianto",
      first_degree: "",
      last_degree: "SH., M.Hum",
      position: "Kepala Bagian",
      unit: "Bagian Hukum",
    },
    embedding: [],
  },
  {
    content:
      "Mohammad Jazuli, SE menjabat sebagai Kepala Bagian Kesejahteraan Rakyat.",
    data: {
      type: "pejabat",
      name: "Mohammad Jazuli",
      first_degree: "",
      last_degree: "SE",
      position: "Kepala Bagian",
      unit: "Bagian Kesejahteraan Rakyat",
    },
    embedding: [],
  },
  {
    content:
      "Sri Diana Dewi Kusumaningrum, SH. M.Si menjabat sebagai Kepala Bagian Organisasi.",
    data: {
      type: "pejabat",
      name: "Sri Diana Dewi Kusumaningrum",
      first_degree: "",
      last_degree: "SH. M.Si",
      position: "Kepala Bagian",
      unit: "Bagian Organisasi",
    },
    embedding: [],
  },
  {
    content:
      "R. Ndaru Kendaryanto, ST, MM menjabat sebagai Kepala Bagian Pemerintahan.",
    data: {
      type: "pejabat",
      name: "R. Ndaru Kendaryanto",
      first_degree: "",
      last_degree: "ST, MM",
      position: "Kepala Bagian",
      unit: "Bagian Pemerintahan",
    },
    embedding: [],
  },
  {
    content:
      "A. Heru Sulaksono, ST., MM menjabat sebagai Kepala Bagian Pengadaan Barang/Jasa.",
    data: {
      type: "pejabat",
      name: "A. Heru Sulaksono",
      first_degree: "",
      last_degree: "ST., MM",
      position: "Kepala Bagian",
      unit: "Bagian Pengadaan Barang/Jasa",
    },
    embedding: [],
  },
  {
    content:
      "Puji Satriyo, SE., M.Si menjabat sebagai Kepala Bagian Perekonomian dan Sumber Daya Alam.",
    data: {
      type: "pejabat",
      name: "Puji Satriyo",
      first_degree: "",
      last_degree: "SE., M.Si",
      position: "Kepala Bagian",
      unit: "Bagian Perekonomian dan Sumber Daya Alam",
    },
    embedding: [],
  },
  {
    content:
      "Toni Eko Prasetyo, SE., M.Si menjabat sebagai Kepala Bagian Protokol dan Komunikasi Pimpinan.",
    data: {
      type: "pejabat",
      name: "Toni Eko Prasetyo",
      first_degree: "",
      last_degree: "SE., M.Si",
      position: "Kepala Bagian",
      unit: "Bagian Protokol dan Komunikasi Pimpinan",
    },
    embedding: [],
  },
  {
    content: "Eryk Sanjaya, AP menjabat sebagai Kepala Bagian Umum.",
    data: {
      type: "pejabat",
      name: "Eryk Sanjaya",
      first_degree: "",
      last_degree: "AP",
      position: "Kepala Bagian",
      unit: "Bagian Umum",
    },
    embedding: [],
  },
  {
    content: "Bibit Purwanto, S.Sos, M.Si menjabat sebagai Camat Mejayan.",
    data: {
      type: "pejabat",
      name: "Bibit Purwanto",
      first_degree: "",
      last_degree: "S.Sos, M.Si",
      position: "Camat",
      unit: "Kecamatan Mejayan",
    },
    embedding: [],
  },
  {
    content: "Tarji, S.STP, M.H menjabat sebagai Camat Dagangan.",
    data: {
      type: "pejabat",
      name: "Tarji",
      first_degree: "",
      last_degree: "S.STP, M.H",
      position: "Camat",
      unit: "Kecamatan Dagangan",
    },
    embedding: [],
  },
  {
    content: "Heri Kurniawan, S.STP, M.Si menjabat sebagai Camat Wonoasri.",
    data: {
      type: "pejabat",
      name: "Heri Kurniawan",
      first_degree: "",
      last_degree: "S.STP, M.Si",
      position: "Camat",
      unit: "Kecamatan Wonoasri",
    },
    embedding: [],
  },
  {
    content: "Tarnu Ashidiq, S.Ag., M.Si menjabat sebagai Camat Kebonsari.",
    data: {
      type: "pejabat",
      name: "Tarnu Ashidiq",
      first_degree: "",
      last_degree: "S.Ag., M.Si",
      position: "Camat",
      unit: "Kecamatan Kebonsari",
    },
    embedding: [],
  },
  {
    content: "Hariono, S.Sos, M.Si menjabat sebagai Camat Madiun.",
    data: {
      type: "pejabat",
      name: "Hariono",
      first_degree: "",
      last_degree: "S.Sos, M.Si",
      position: "Camat",
      unit: "Kecamatan Madiun",
    },
    embedding: [],
  },
  {
    content: "Hery Fajar Nugroho, S.Sos, M.Si menjabat sebagai Camat Dolopo.",
    data: {
      type: "pejabat",
      name: "Hery Fajar Nugroho",
      first_degree: "",
      last_degree: "S.Sos, M.Si",
      position: "Camat",
      unit: "Kecamatan Dolopo",
    },
    embedding: [],
  },
  {
    content:
      "Basudewo Aji Pamungkas, SE.M.Si menjabat sebagai Camat Pilangkenceng.",
    data: {
      type: "pejabat",
      name: "Basudewo Aji Pamungkas",
      first_degree: "",
      last_degree: "SE.M.Si",
      position: "Camat",
      unit: "Kecamatan Pilangkenceng",
    },
    embedding: [],
  },
  {
    content: "Alviantoro, S.STP.M.H menjabat sebagai Camat Kare.",
    data: {
      type: "pejabat",
      name: "Alviantoro",
      first_degree: "",
      last_degree: "S.STP.M.H",
      position: "Camat",
      unit: "Kecamatan Kare",
    },
    embedding: [],
  },
  {
    content: "Muhammad Sholeh, S.Sos. M.si menjabat sebagai Camat Sawahan.",
    data: {
      type: "pejabat",
      name: "Muhammad Sholeh",
      first_degree: "",
      last_degree: "S.Sos. M.si",
      position: "Camat",
      unit: "Kecamatan Sawahan",
    },
    embedding: [],
  },
  {
    content: "Drs. Eko Suwartono menjabat sebagai Camat Wungu.",
    data: {
      type: "pejabat",
      name: "Eko Suwartono",
      first_degree: "Drs.",
      last_degree: "",
      position: "Camat",
      unit: "Kecamatan Wungu",
    },
    embedding: [],
  },
  {
    content: "Djoko Susilo, S.Sos menjabat sebagai Camat Gemarang.",
    data: {
      type: "pejabat",
      name: "Djoko Susilo",
      first_degree: "",
      last_degree: "S.Sos",
      position: "Camat",
      unit: "Kecamatan Gemarang",
    },
    embedding: [],
  },
  {
    content: "Raswiyanto, SH menjabat sebagai Camat Jiwan.",
    data: {
      type: "pejabat",
      name: "Raswiyanto",
      first_degree: "",
      last_degree: "SH",
      position: "Camat",
      unit: "Kecamatan Jiwan",
    },
    embedding: [],
  },
  {
    content: "Aksin Muharom, S.Sos menjabat sebagai Camat Balerejo.",
    data: {
      type: "pejabat",
      name: "Aksin Muharom",
      first_degree: "",
      last_degree: "S.Sos",
      position: "Camat",
      unit: "Kecamatan Balerejo",
    },
    embedding: [],
  },
  {
    content: "Dodi Setiawan, S.IP, MH menjabat sebagai Camat Saradan.",
    data: {
      type: "pejabat",
      name: "Dodi Setiawan",
      first_degree: "",
      last_degree: "S.IP, MH",
      position: "Camat",
      unit: "Kecamatan Saradan",
    },
    embedding: [],
  },
  {
    content: "Puguh Wijayanto, S.STP menjabat sebagai Camat Geger.",
    data: {
      type: "pejabat",
      name: "Puguh Wijayanto",
      first_degree: "",
      last_degree: "S.STP",
      position: "Camat",
      unit: "Kecamatan Geger",
    },
    embedding: [],
  },
];

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 Starting RAG data insertion process...");

    // Edited Here: Test database connection first
    const connectionTest = await testDatabaseConnection();
    if (!connectionTest) {
      return NextResponse.json(
        {
          status: "error",
          message: "Database connection failed",
        },
        { status: 500 }
      );
    }

    console.log("✅ Database connection successful");

    // Edited Here: Fixed the embedding generation with proper async/await handling
    const processedData = [];

    console.log(`📊 Processing ${ragDataToInsert.length} records...`);

    for (let i = 0; i < ragDataToInsert.length; i++) {
      const item = ragDataToInsert[i];
      console.log(
        `🔄 Processing item ${i + 1}/${
          ragDataToInsert.length
        }: "${item.content.substring(0, 50)}..."`
      );

      try {
        const embedding = await generateEmbedding(item.content);

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          throw new Error(
            `Failed to generate embedding for item ${
              i + 1
            } - empty or invalid result`
          );
        }

        // Edited Here: Ensure all embedding values are proper numbers
        const embeddingArray = embedding.map((e, idx) => {
          const num = typeof e === "number" ? e : parseFloat(e.toString());
          if (isNaN(num)) {
            throw new Error(
              `Invalid embedding value at index ${idx} for item ${i + 1}`
            );
          }
          return num;
        });
        if (embeddingArray.length !== 768) {
          throw new Error(
            `Embedding dimension mismatch for item ${
              i + 1
            }: expected 768, got ${embeddingArray.length}`
          );
        }

        processedData.push({
          content: item.content,
          data: item.data,
          embedding: embeddingArray,
        });

        console.log(
          `✅ Generated embedding for item ${i + 1} (dimensions: ${
            embeddingArray.length
          })`
        );

        // Edited Here: Add a small delay to avoid rate limiting
        if (i < ragDataToInsert.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
        }
      } catch (embeddingError) {
        console.error(
          `❌ Failed to generate embedding for item ${i + 1}:`,
          embeddingError
        );
        return NextResponse.json(
          {
            status: "error",
            message: `Failed to generate embedding for item ${i + 1}`,
            error:
              embeddingError instanceof Error
                ? embeddingError.message
                : "Unknown embedding error",
            itemContent: item.content.substring(0, 100),
          },
          { status: 500 }
        );
      }
    }

    console.log(
      "🎯 All embeddings generated successfully, inserting into database..."
    );

    // Edited Here: Insert all processed data into the database
    const result = await insertRagData(processedData);

    if (result.success) {
      console.log(`✅ Successfully inserted ${result.count} records`);
      return NextResponse.json({
        status: "success",
        message: `${result.count} records inserted successfully.`,
        count: result.count,
        processed: processedData.length,
      });
    } else {
      console.error("❌ Database insertion failed:", result.error);
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to insert data into the database.",
          error: result.error,
          details: result.details,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Unexpected error in RAG data route:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "An unexpected error occurred.",
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// Edited Here: Enhanced GET method for better debugging
export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Testing RAG data route...");

    const connectionTest = await testDatabaseConnection();
    const schema = await checkRagDataSchema();

    // Edited Here: Test embedding generation with a sample
    let embeddingTest = null;
    try {
      embeddingTest = await generateEmbedding("Test content for embedding");
      console.log(
        "✅ Embedding test successful, dimensions:",
        embeddingTest?.length
      );
    } catch (embeddingError) {
      console.error("❌ Embedding test failed:", embeddingError);
    }

    return NextResponse.json({
      message: "RAG data route is working",
      database_connected: connectionTest,
      schema: schema,
      records_to_insert: ragDataToInsert.length,
      embedding_test: {
        success: !!embeddingTest,
        dimensions: embeddingTest?.length || 0,
        sample: embeddingTest?.slice(0, 5) || [],
      },
    });
  } catch (error) {
    console.error("❌ GET route error:", error);
    return NextResponse.json(
      {
        error: "Failed to test route",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
