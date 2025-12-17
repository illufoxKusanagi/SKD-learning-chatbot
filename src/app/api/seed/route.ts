// Lokasi: app/api/seed/route.ts

import { db } from "@/lib/db/index";
import { ragData } from "@/lib/db/schema";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Impor data mentah Anda yang sudah lengkap dengan 'content' dan 'data'
// Pastikan path ini benar
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
  },
];

// --- Logika untuk Membuat Embedding ---
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not defined");
}
const genAI = new GoogleGenerativeAI(apiKey);

async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text.toLowerCase());
  return result.embedding.values;
}

// --- Handler untuk method POST ---
export async function POST() {
  try {
    console.log("Starting database seed process...");

    // Hapus data lama untuk memastikan tidak ada duplikasi
    await db.delete(ragData);
    console.log("Old data successfully deleted.");
    const dataWithEmbeddings = [];
    for (const item of ragDataToInsert) {
      console.log(
        `Generating embedding for: "${item.content.substring(0, 40)}..."`
      );
      const embedding = await generateEmbedding(item.content);
      dataWithEmbeddings.push({
        content: item.content,
        data: item.data,
        embedding: embedding, // <- Embedding yang sudah jadi
      });

      // Jeda singkat untuk menghindari rate limit API
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    // Langkah 3: Masukkan semua data yang sudah lengkap ke database
    console.log(
      `Inserting ${dataWithEmbeddings.length} records into the database...`
    );
    await db.insert(ragData).values(dataWithEmbeddings);

    console.log("✅ Database seeding completed successfully!");
    return NextResponse.json(
      {
        message: `${dataWithEmbeddings.length} records inserted successfully!`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    return NextResponse.json(
      { error: "Database seeding failed." },
      { status: 500 }
    );
  }
}
