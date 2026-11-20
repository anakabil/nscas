# 17. Draf Terjemahan Inggris Isi Instrumen Versi 1

Dokumen ini menyertai draf terjemahan bahasa Inggris isi instrumen NS-SCML-1.0, yaitu nama 18 karakteristik, 90 pernyataan berjenjang, serta nama 7 dimensi dan 21 butir skala iklim keselamatan. Draf disusun Trustie pada 20 November 2026 sebagai tugas di luar fase (`PROMPTS.md`) dan menunggu telaah Nusa Safety. Isinya ada di `seed/terjemahan-instrumen-en-draf.json`. Teks sumber tetap `seed/instrumen-karakteristik-v1.json` dan `seed/skala-iklim-draf.json`.

## 1. Status dan dampaknya pada aplikasi

Draf ini belum berlaku. Selama kolom bahasa Inggris pada basis data masih kosong, responden yang memilih bahasa Inggris melihat antarmuka berbahasa Inggris, tetapi pernyataan survei tetap berbahasa Indonesia dengan catatan "The survey statements are currently available in Indonesian." Perilaku ini sudah ada sejak fase R3 dan tidak diubah.

Draf baru dapat diterapkan setelah bagian `approval` pada berkas diisi (nama penelaah dan tanggal persetujuan). Perintah penerapan menolak draf yang belum disetujui (bagian 6).

## 2. Dasar metode

Belum ada pedoman nasional yang khusus mengatur penerjemahan instrumen survei, sehingga draf ini mengacu pada pedoman internasional yang lazim dipakai untuk adaptasi kuesioner lintas bahasa: pedoman International Test Commission (2018), pedoman adaptasi lintas budaya Beaton dan kawan-kawan (2000), dan prinsip praktik baik ISPOR (Wild dkk., 2005). Ketiganya sepakat bahwa yang dicari adalah kesetaraan makna, bukan kesamaan kata, dan bahwa satu terjemahan maju belum cukup untuk instrumen yang hasilnya akan dibandingkan.

Pegangan yang dipakai dalam draf:

1. Makna setiap pernyataan berjenjang dijaga agar jenjangnya tetap dapat dibedakan. Kata kunci pembeda tingkat, misalnya "seadanya", "terjadwal", "secara terencana", dan "secara mandiri", diterjemahkan dengan padanan yang sama kuatnya.
2. Kalimat dibuat sederhana untuk pembaca yang bahasa Inggrisnya bukan bahasa ibu. Ungkapan kiasan diganti makna harfiahnya (contoh pada bagian 4).
3. Butir skala iklim yang berarah balik tetap berarah balik, sehingga penskoran terbalik pada mesin penilaian berlaku sama untuk kedua bahasa.
4. Ejaan Inggris Britania, mengikuti teks antarmuka bahasa Inggris yang sudah ada ("behaviour", "organisation").
5. Nama dimensi iklim mengikuti nama dimensi NOSACQ-50 dalam bahasa Inggris (Kines dkk., 2011), karena dimensi sumbernya memang mengacu ke sana. Butirnya tetap karya Nusa Safety dan tidak menyalin butir asli NOSACQ-50.
6. Tidak ada kriteria skema sertifikasi Safety Culture Ladder yang disalin (aturan 8 `CLAUDE.md`). Yang diterjemahkan hanya pernyataan karya Nusa Safety.

## 3. Tahapan telaah

| No | Tahap | Pelaksana | Status |
|---|---|---|---|
| 1 | Terjemahan maju pertama | Trustie | Selesai, draf ini |
| 2 | Terjemahan maju kedua secara terpisah, lalu rekonsiliasi kedua versi | Penerjemah atau ahli K3 berbahasa Inggris yang ditunjuk Nusa Safety | Belum |
| 3 | Terjemahan balik ke bahasa Indonesia oleh penerjemah yang tidak melihat teks sumber, lalu dibandingkan dengan teks sumber | Penerjemah independen | Belum |
| 4 | Telaah panel ahli: ahli K3, asesor, dan penerjemah memutuskan setiap butir yang berbeda makna | Nusa Safety | Belum |
| 5 | Wawancara kognitif dengan 5 sampai 8 calon responden berbahasa Inggris: setiap orang diminta menjelaskan dengan kata-katanya sendiri arti pernyataan yang dibacanya | Asesor Nusa Safety | Belum |
| 6 | Persetujuan: isi `approval.approvedBy`, `approval.approvedOn`, dan bila ada `approval.backTranslatedBy` serta `approval.notes` | Nusa Safety | Belum |
| 7 | Penerapan ke basis data dengan perintah pada bagian 6 | Pengelola sistem | Belum |

Tahap 2 dapat dilewati bila sumber daya terbatas, tetapi tahap 3, 4, dan 5 sebaiknya tetap dilakukan sebelum versi Inggris dipakai pada klien. Wawancara kognitif dengan jumlah kecil sudah cukup untuk menemukan kalimat yang dipahami berbeda (Willis, 2005; Wild dkk., 2005).

## 4. Keputusan istilah dan butir yang perlu perhatian

### 4.1 Daftar istilah

| Istilah sumber | Padanan dalam draf | Catatan |
|---|---|---|
| K3 | OSH (occupational safety and health) | Sama dengan teks antarmuka bahasa Inggris |
| unit K3, petugas K3 | OSH unit, OSH officers | |
| P2K3 | OSH committee (P2K3) | Singkatan asli dipertahankan agar dikenali di Indonesia |
| SMKK | Construction Safety Management System (SMKK) | |
| penyedia jasa | contractors | Dari sudut pandang kontraktor utama |
| mitra kerja, mitra rantai pasok | work partners, supply chain partners | |
| pemilik pekerjaan | project owner | |
| pelaksana lapangan | site supervisors | Perlu dikonfirmasi, lihat 4.2 |
| kejadian nyaris celaka | near miss | |
| sinyal lemah | weak signals | |
| indikator utama, indikator tertinggal | leading indicators, lagging indicators | Perlu dikonfirmasi, lihat 4.2 |
| izin kerja | work permit | |
| analisis keselamatan pekerjaan | job safety analysis | |
| pertemuan keselamatan pagi | morning safety briefing | |
| atasan | superiors | |
| Ragu-ragu (skala 3) | Not sure | Label skala sudah ada di teks antarmuka sejak R3 |

### 4.2 Butir yang perlu diputuskan penelaah

| Butir | Pilihan dalam draf | Hal yang perlu diputuskan |
|---|---|---|
| K1.1 tingkat 4 | "both corrects and praises behaviour in person" untuk "menegur sekaligus mengapresiasi perilaku secara langsung" | Apakah perlu ditegaskan perilaku tidak aman dan perilaku aman |
| K3.2 tingkat 4 | "part of the assessment for each position" untuk "bagian penilaian jabatan" | Yang dimaksud penilaian kinerja tahunan atau uji kompetensi jabatan |
| K3.3 tingkat 2 | "mainly reacts to problems as they arise" untuk kiasan "berperan sebagai pemadam" | Kiasan diganti makna harfiah agar mudah dipahami pembaca bukan penutur asli |
| K4.1 tingkat 4 | "site supervisors" untuk "pelaksana lapangan" | Apakah yang dimaksud jabatan pelaksana atau seluruh pekerja yang menjalankan pekerjaan |
| K5.1 tingkat 4 | "Reports are made often and voluntarily" untuk "Pelaporan berjalan tinggi dan sukarela" | Kalimat sumber disusun ulang agar wajar dalam bahasa Inggris |
| K5.2 tingkat 2 | "the conclusion that a person made a mistake" untuk "kesimpulan kesalahan manusia" | Istilah teknis "human error" dihindari agar dipahami pekerja |
| K6.2 tingkat 4 | "Leading and lagging indicators" untuk "Indikator utama dan indikator tertinggal" | "Indikator utama" ditafsirkan sebagai indikator awal (leading); konfirmasi maksud sumber |
| KT.1 tingkat 3 | Nama Permen PUPR 10/2021 diterjemahkan, RKK dan RMPK ditulis lengkap | Apakah nomor peraturan cukup tanpa judul lengkap |
| D4.3 (berarah balik) | "the job of the OSH officers only" | Pertahankan arah negatif |

## 5. Pengaruh pada analisis data

Setiap jawaban survei menyimpan bahasa yang dipakai (`survey_responses.language`). Dua hal perlu dijaga setelah versi Inggris dipakai:

1. Kesetaraan. Bila jawaban berbahasa Inggris cukup banyak, bandingkan sebaran jawaban per butir antara kedua bahasa sebelum hasilnya digabung, sesuai anjuran pedoman International Test Commission (2018) tentang bukti kesetaraan antarversi. Bila jumlahnya sedikit, laporan menyebut bahwa kesetaraan antarbahasa belum diuji.
2. Anonimitas. Responden berbahasa Inggris pada satu unit bisa sangat sedikit, misalnya tenaga kerja asing pada proyek kerja sama operasi. Hasil tidak boleh dipecah menurut bahasa pada tingkat unit atau strata, dan aturan sel kurang dari 5 responden (aturan 3 `CLAUDE.md`) tetap berlaku untuk setiap pemecahan. Saat ini dasbor, ekspor, dan laporan tidak memecah hasil menurut bahasa.

## 6. Cara menerapkan setelah disetujui

```bash
# Pemeriksaan kelengkapan saja; tidak mengubah basis data
php artisan nscas:instrument-translation seed/terjemahan-instrumen-en-draf.json

# Penerapan, setelah bagian approval diisi
php artisan nscas:instrument-translation seed/terjemahan-instrumen-en-draf.json --apply
```

Aturan perintah ini:

1. Berkas harus memuat tepat semua teks versi instrumen yang dituju, tanpa teks kosong, tanpa kode yang tidak dikenal, dan tanpa tanda pisah panjang. Pemeriksaan ada di `App\Domain\Instrument\TranslationCoverage`.
2. Penerapan ditolak bila `approval.approvedBy` atau `approval.approvedOn` kosong.
3. Hanya kolom bahasa Inggris yang masih kosong yang diisi. Teks bahasa Indonesia dan teks Inggris yang sudah ada tidak pernah diubah. Perbaikan kalimat setelah penerapan dilakukan lewat versi instrumen baru, karena versi yang sudah dipakai asesmen tidak diubah (docs/02).
4. Penerapan tercatat di jejak audit dengan kode `instrument.translation_applied`, berisi jumlah teks yang diisi, nama penelaah, tanggal persetujuan, dan sidik SHA-256 berkas.
5. Bila ada asesmen dengan versi ini yang sedang mengumpulkan data, perintah memberi peringatan, karena responden berbahasa Inggris yang mengisi sesudahnya akan melihat teks Inggris. Sebaiknya penerapan dilakukan sebelum masa survei dimulai.

Tes: `tests/Unit/Domain/Instrument/TranslationCoverageTest.php` dan `tests/Feature/Setup/InstrumentTranslationTest.php`. Tes fitur memastikan draf mencakup seluruh 136 teks versi 1, draf yang belum disetujui ditolak, dan teks yang sudah ada tidak ditimpa.

## 7. Lampiran: teks berdampingan untuk penelaah

Tabel ini dibuat dari berkas JSON pada 20 November 2026 untuk memudahkan telaah. Bila berbeda, berkas JSON yang berlaku.

### A. Karakteristik dan pernyataan berjenjang

#### K1.1 Perhatian dan keteladanan manajemen

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Perhatian dan keteladanan manajemen | Management attention and leading by example |
| Tingkat 1 | Manajemen tidak membicarakan keselamatan kecuali bila ada tuntutan dari pihak luar. | Management does not talk about safety unless an outside party demands it. |
| Tingkat 2 | Manajemen membicarakan keselamatan terutama setelah terjadi insiden atau temuan pemeriksaan. | Management talks about safety mainly after an incident or an inspection finding. |
| Tingkat 3 | Manajemen membahas keselamatan secara terjadwal dalam rapat dan menuntut kepatuhan terhadap aturan yang telah ditetapkan. | Management discusses safety in scheduled meetings and demands compliance with the rules that have been set. |
| Tingkat 4 | Manajemen hadir di lapangan secara terencana, menegur sekaligus mengapresiasi perilaku secara langsung, dan menjadikan keselamatan sebagai pertimbangan tetap dalam pengambilan keputusan. | Management visits the site as planned, both corrects and praises behaviour in person, and treats safety as a standing consideration in decision-making. |
| Tingkat 5 | Keteladanan manajemen konsisten di seluruh lini, keputusan bisnis ditunda atau diubah bila berisiko terhadap keselamatan, dan hal itu diakui oleh pekerja maupun mitra rantai pasok. | Management sets a consistent example at every level, business decisions are postponed or changed when they put safety at risk, and this is recognised by workers and supply chain partners. |

#### K1.2 Keterlibatan pekerja

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Keterlibatan pekerja | Worker involvement |
| Tingkat 1 | Pekerja tidak dilibatkan dan menganggap keselamatan sepenuhnya urusan unit K3. | Workers are not involved and see safety as entirely the job of the OSH unit. |
| Tingkat 2 | Pekerja dilibatkan secara insidental, umumnya hanya setelah terjadi kejadian. | Workers are involved only now and then, usually only after something has happened. |
| Tingkat 3 | Pekerja dilibatkan melalui forum formal seperti P2K3 dan pertemuan keselamatan terjadwal. | Workers are involved through formal forums, such as the OSH committee (P2K3) and scheduled safety meetings. |
| Tingkat 4 | Pekerja aktif mengusulkan perbaikan, terlibat menyusun analisis risiko pekerjaannya, dan usulannya ditindaklanjuti disertai umpan balik. | Workers actively propose improvements and help prepare the risk analysis for their own work, and their proposals are acted on with feedback. |
| Tingkat 5 | Pekerja memiliki kepemilikan penuh atas keselamatan pekerjaannya serta saling mengingatkan lintas jabatan dan lintas perusahaan tanpa merasa canggung. | Workers take full ownership of the safety of their own work and remind one another across job levels and across companies without feeling awkward. |

#### K1.3 Penghargaan dan konsekuensi

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Penghargaan dan konsekuensi | Recognition and consequences |
| Tingkat 1 | Tidak ada mekanisme penghargaan maupun konsekuensi yang terkait dengan perilaku keselamatan. | There is no recognition or consequence linked to safety behaviour. |
| Tingkat 2 | Konsekuensi diberikan secara reaktif dan cenderung menyalahkan individu setelah insiden. | Consequences are given reactively and tend to blame individuals after an incident. |
| Tingkat 3 | Terdapat aturan penghargaan dan sanksi yang tertulis serta diterapkan secara administratif. | There are written rules on recognition and sanctions, and they are applied administratively. |
| Tingkat 4 | Penghargaan diberikan atas perilaku proaktif seperti pelaporan bahaya dan penghentian pekerjaan tidak aman, dengan kriteria yang diketahui pekerja. | Recognition is given for proactive behaviour, such as reporting hazards and stopping unsafe work, using criteria that workers know. |
| Tingkat 5 | Penghargaan dan konsekuensi diterapkan adil dan konsisten sampai ke penyedia jasa, serta terbukti membentuk perilaku yang diinginkan. | Recognition and consequences are applied fairly and consistently, including to contractors, and have been shown to shape the desired behaviour. |

#### K2.1 Penyebab kecelakaan dan pembelajaran organisasi

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Penyebab kecelakaan dan pembelajaran organisasi | Accident causes and organisational learning |
| Tingkat 1 | Penyebab kecelakaan dianggap sebagai kelalaian pekerja atau faktor nasib. | Accidents are seen as the result of worker carelessness or bad luck. |
| Tingkat 2 | Penyebab dicari setelah kejadian dan umumnya berhenti pada penyebab langsung. | Causes are looked for after an event, and the search usually stops at the immediate cause. |
| Tingkat 3 | Investigasi menggunakan metode baku dan mengidentifikasi penyebab dasar pada tingkat sistem. | Investigations use a standard method and identify underlying causes at the system level. |
| Tingkat 4 | Analisis penyebab mencakup faktor organisasi dan keputusan manajemen, hasilnya mengubah kebijakan dan proses kerja. | Cause analysis covers organisational factors and management decisions, and the results change policies and work processes. |
| Tingkat 5 | Organisasi belajar dari kejadian nyaris celaka, sinyal lemah, dan pengalaman pihak lain di industri sejenis, sebelum kerugian terjadi. | The organisation learns from near misses, weak signals, and the experience of others in similar industries, before losses occur. |

#### K2.2 Keselamatan dalam strategi, profitabilitas, dan keberlanjutan

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Keselamatan dalam strategi, profitabilitas, dan keberlanjutan | Safety in strategy, profitability, and sustainability |
| Tingkat 1 | Keselamatan dipandang sebagai beban biaya yang menghambat produksi. | Safety is seen as a cost that holds back production. |
| Tingkat 2 | Anggaran keselamatan disediakan seadanya dan bertambah hanya setelah kejadian besar. | The safety budget is kept to a bare minimum and increases only after a major event. |
| Tingkat 3 | Keselamatan masuk dalam rencana kerja dan anggaran tahunan dengan sasaran yang terukur. | Safety is included in the annual work plan and budget, with measurable targets. |
| Tingkat 4 | Investasi keselamatan direncanakan berbasis risiko dan dievaluasi manfaatnya terhadap kinerja proyek. | Safety investment is planned on the basis of risk, and its benefit to project performance is evaluated. |
| Tingkat 5 | Keselamatan menjadi bagian strategi bisnis dan penilaian kelayakan proyek, sekaligus menjadi pembeda dalam memenangkan pekerjaan. | Safety is part of business strategy and project feasibility assessment, and it also helps the company win work. |

#### K3.1 Pengelolaan penyedia jasa dan subkontraktor

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Pengelolaan penyedia jasa dan subkontraktor | Management of contractors and subcontractors |
| Tingkat 1 | Penyedia jasa dipilih hanya berdasarkan harga dan kinerja keselamatannya tidak ditanyakan. | Contractors are chosen on price alone, and nobody asks about their safety performance. |
| Tingkat 2 | Persyaratan keselamatan dicantumkan dalam kontrak namun tidak diverifikasi di lapangan. | Safety requirements are written into contracts but are not checked on site. |
| Tingkat 3 | Prakualifikasi keselamatan dilakukan dan kinerja penyedia jasa dipantau secara berkala. | Safety prequalification is carried out, and contractor performance is monitored regularly. |
| Tingkat 4 | Kinerja keselamatan menjadi kriteria pemilihan dan evaluasi berulang, penyedia jasa dibina agar meningkat. | Safety performance is a criterion for selection and for repeated evaluation, and contractors are coached to improve. |
| Tingkat 5 | Penyedia jasa diperlakukan sebagai bagian dari satu budaya, terlibat dalam perencanaan risiko dan pembelajaran bersama. | Contractors are treated as part of one shared culture and take part in risk planning and in learning together. |

#### K3.2 Kompetensi dan pelatihan

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Kompetensi dan pelatihan | Competence and training |
| Tingkat 1 | Pelatihan keselamatan tidak diselenggarakan atau hanya untuk memenuhi formalitas dokumen. | Safety training is not held, or is held only as a paperwork formality. |
| Tingkat 2 | Pelatihan diberikan setelah ada temuan pemeriksaan atau tuntutan regulasi. | Training is given after an inspection finding or when regulations require it. |
| Tingkat 3 | Terdapat matriks kompetensi dan program pelatihan tahunan yang dijalankan. | There is a competence matrix and an annual training programme, and it is carried out. |
| Tingkat 4 | Efektivitas pelatihan dievaluasi sampai pada perubahan perilaku di tempat kerja, dan kompetensi keselamatan menjadi bagian penilaian jabatan. | Training is evaluated down to changes in behaviour at work, and safety competence is part of the assessment for each position. |
| Tingkat 5 | Pengembangan kompetensi berjalan berkelanjutan, mencakup keterampilan kepemimpinan keselamatan bagi seluruh lini dan mitra kerja. | Competence development is continuous and includes safety leadership skills for every level and for work partners. |

#### K3.3 Fungsi dan kedudukan unit K3

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Fungsi dan kedudukan unit K3 | Role and position of the OSH unit |
| Tingkat 1 | Tidak ada personel K3 yang kompeten atau perannya semata administratif. | There are no competent OSH staff, or their role is purely administrative. |
| Tingkat 2 | Unit K3 ada namun berperan sebagai pemadam atas masalah yang muncul. | An OSH unit exists but mainly reacts to problems as they arise. |
| Tingkat 3 | Unit K3 memiliki personel bersertifikat dengan tugas dan wewenang yang jelas. | The OSH unit has certified staff with clear duties and authority. |
| Tingkat 4 | Unit K3 berperan sebagai mitra strategis lini operasi dan memiliki akses langsung kepada direksi. | The OSH unit acts as a strategic partner to line operations and has direct access to the board of directors. |
| Tingkat 5 | Peran keselamatan melekat pada lini operasi, sedangkan unit K3 berfungsi sebagai pusat keahlian dan pengembangan, bukan pemilik tunggal masalah keselamatan. | Safety is built into line operations, while the OSH unit serves as a centre of expertise and development rather than the sole owner of safety problems. |

#### K4.1 Perencanaan pekerjaan

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Perencanaan pekerjaan | Work planning |
| Tingkat 1 | Pekerjaan dimulai tanpa perencanaan keselamatan. | Work starts without any safety planning. |
| Tingkat 2 | Perencanaan keselamatan disusun untuk memenuhi persyaratan dokumen tender atau permintaan pemilik pekerjaan. | Safety planning is prepared to meet tender document requirements or at the request of the project owner. |
| Tingkat 3 | Analisis keselamatan pekerjaan disusun sebelum pekerjaan dimulai sesuai prosedur baku. | A job safety analysis is prepared before work starts, following the standard procedure. |
| Tingkat 4 | Perencanaan melibatkan pelaksana lapangan, ditinjau ulang ketika kondisi berubah, dan mempertimbangkan interaksi antarpekerjaan. | Planning involves site supervisors, is reviewed when conditions change, and takes into account how different work activities affect one another. |
| Tingkat 5 | Perencanaan keselamatan menyatu dengan perencanaan metode kerja dan jadwal, sehingga risiko dihilangkan sejak tahap desain dan rekayasa. | Safety planning is part of planning the work method and schedule, so that risks are removed from the design and engineering stage onwards. |

#### K4.2 Keselamatan tempat kerja

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Keselamatan tempat kerja | Workplace safety |
| Tingkat 1 | Kondisi tidak aman dibiarkan selama pekerjaan masih dapat berjalan. | Unsafe conditions are left as they are as long as the work can continue. |
| Tingkat 2 | Kondisi tidak aman diperbaiki setelah ditemukan pihak lain atau setelah terjadi insiden. | Unsafe conditions are fixed after someone else finds them or after an incident. |
| Tingkat 3 | Inspeksi tempat kerja dilakukan terjadwal dan temuannya ditindaklanjuti. | Workplace inspections are carried out on schedule, and the findings are followed up. |
| Tingkat 4 | Pekerja berwenang menghentikan pekerjaan tidak aman dan kewenangan itu benar-benar digunakan tanpa rasa takut. | Workers have the authority to stop unsafe work, and they actually use it without fear. |
| Tingkat 5 | Kondisi tempat kerja terjaga secara mandiri oleh pekerja dan mitra kerja, penyimpangan menjadi hal yang langka dan segera dikoreksi bersama. | Workers and work partners keep the workplace safe on their own initiative, deviations are rare, and they are corrected together straight away. |

#### K4.3 Prosedur dan kepatuhan

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Prosedur dan kepatuhan | Procedures and compliance |
| Tingkat 1 | Prosedur tidak tersedia atau tidak dikenal pekerja. | Procedures are not available or are not known to workers. |
| Tingkat 2 | Prosedur tersedia namun jarang digunakan dan tidak sesuai dengan praktik lapangan. | Procedures are available but are rarely used and do not match how work is done on site. |
| Tingkat 3 | Prosedur ditetapkan, disosialisasikan, dan kepatuhannya diperiksa. | Procedures are set, explained to workers, and checked for compliance. |
| Tingkat 4 | Prosedur ditinjau bersama penggunanya agar sesuai kondisi nyata, dan penyimpangan dianalisis untuk memperbaiki prosedur. | Procedures are reviewed with the people who use them so that they fit real conditions, and deviations are analysed to improve the procedures. |
| Tingkat 5 | Prosedur dipahami maksudnya, bukan sekadar dihafal, dan pekerja mampu mengambil keputusan yang aman ketika menghadapi situasi yang belum diatur. | Workers understand the purpose of procedures rather than just memorising them, and they can make safe decisions in situations that no procedure covers. |

#### K5.1 Pelaporan penyimpangan

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Pelaporan penyimpangan | Reporting of deviations |
| Tingkat 1 | Pelaporan tidak berjalan atau ditutupi karena takut disalahkan. | Reporting does not happen, or events are covered up for fear of being blamed. |
| Tingkat 2 | Hanya kejadian dengan kerugian nyata yang dilaporkan. | Only events with actual losses are reported. |
| Tingkat 3 | Terdapat sistem pelaporan resmi yang mencakup kejadian nyaris celaka dan kondisi tidak aman. | There is a formal reporting system that covers near misses and unsafe conditions. |
| Tingkat 4 | Pelaporan berjalan tinggi dan sukarela, pelapor memperoleh umpan balik dan tidak dikenai sanksi. | Reports are made often and voluntarily, and the people who report receive feedback and are not punished. |
| Tingkat 5 | Pelaporan dipandang sebagai kontribusi bernilai, mencakup sinyal lemah dan kesalahan sendiri, serta menjadi sumber utama perbaikan. | Reporting is seen as a valuable contribution, covers weak signals and one's own mistakes, and is a main source of improvement. |

#### K5.2 Investigasi dan tindak lanjut

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Investigasi dan tindak lanjut | Investigation and follow-up |
| Tingkat 1 | Kejadian tidak diinvestigasi. | Events are not investigated. |
| Tingkat 2 | Investigasi dilakukan seadanya dan berhenti pada kesimpulan kesalahan manusia. | Investigations are superficial and stop at the conclusion that a person made a mistake. |
| Tingkat 3 | Investigasi dilakukan dengan metode baku, tindakan perbaikan ditetapkan dan dipantau penyelesaiannya. | Investigations use a standard method, and corrective actions are set and tracked until they are completed. |
| Tingkat 4 | Efektivitas tindakan perbaikan diverifikasi di lapangan dan pembelajarannya disebarkan lintas proyek. | The effectiveness of corrective actions is checked on site, and the lessons are shared across projects. |
| Tingkat 5 | Pembelajaran dari kejadian mengubah standar, desain, dan cara kerja organisasi, serta dibagikan kepada mitra dan pelaku industri. | Lessons from events change the organisation's standards, designs, and ways of working, and are shared with partners and others in the industry. |

#### K5.3 Pengendalian harian dan komunikasi

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Pengendalian harian dan komunikasi | Daily control and communication |
| Tingkat 1 | Tidak ada komunikasi keselamatan yang terstruktur. | There is no structured safety communication. |
| Tingkat 2 | Komunikasi keselamatan bersifat satu arah dan seremonial. | Safety communication is one-way and ceremonial. |
| Tingkat 3 | Pertemuan keselamatan harian dan mingguan berjalan sesuai jadwal dengan materi yang telah ditetapkan. | Daily and weekly safety meetings run on schedule with set material. |
| Tingkat 4 | Komunikasi berlangsung dua arah, materi disesuaikan dengan risiko pekerjaan hari itu, dan masukan pekerja mengubah cara kerja. | Communication is two-way, the material is adjusted to the risks of that day's work, and workers' input changes how the work is done. |
| Tingkat 5 | Dialog keselamatan berlangsung wajar dalam pekerjaan sehari-hari, termasuk kepada atasan dan mitra kerja, tanpa memerlukan forum formal. | Conversations about safety happen naturally in daily work, including with superiors and work partners, without the need for a formal forum. |

#### K6.1 Audit dan tinjauan

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Audit dan tinjauan | Audit and review |
| Tingkat 1 | Tidak dilakukan audit keselamatan. | No safety audits are carried out. |
| Tingkat 2 | Audit dilakukan hanya bila diminta pemilik pekerjaan atau regulator. | Audits are carried out only when the project owner or the regulator asks for them. |
| Tingkat 3 | Audit internal terjadwal dilakukan terhadap pemenuhan sistem manajemen. | Scheduled internal audits of management system compliance are carried out. |
| Tingkat 4 | Audit mencakup perilaku dan kepemimpinan keselamatan, hasilnya dibahas dalam tinjauan manajemen dan menghasilkan keputusan. | Audits cover safety behaviour and leadership, and the results are discussed in management review and lead to decisions. |
| Tingkat 5 | Audit budaya dilakukan berkala atas inisiatif sendiri, hasilnya digunakan untuk menguji asumsi organisasi dan dibandingkan dengan praktik terbaik industri. | Culture audits are carried out regularly on the organisation's own initiative, and the results are used to test the organisation's assumptions and are compared with the best practice in the industry. |

#### K6.2 Tren dan statistik

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Tren dan statistik | Trends and statistics |
| Tingkat 1 | Data kecelakaan tidak dikumpulkan atau tidak akurat. | Accident data are not collected or are not accurate. |
| Tingkat 2 | Data dikumpulkan untuk pelaporan wajib tanpa dianalisis lebih lanjut. | Data are collected for mandatory reporting without further analysis. |
| Tingkat 3 | Indikator tertinggal dipantau dan dilaporkan secara berkala. | Lagging indicators are monitored and reported regularly. |
| Tingkat 4 | Indikator utama dan indikator tertinggal dianalisis bersama untuk memperkirakan dan mencegah kejadian. | Leading and lagging indicators are analysed together to anticipate and prevent events. |
| Tingkat 5 | Analisis data menjadi dasar pengambilan keputusan strategis sekaligus pengujian efektivitas program budaya keselamatan. | Data analysis is the basis for strategic decisions and for testing the effectiveness of safety culture programmes. |

#### KT.1 Integrasi Sistem Manajemen Keselamatan Konstruksi

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Integrasi Sistem Manajemen Keselamatan Konstruksi | Integration of the Construction Safety Management System (SMKK) |
| Tingkat 1 | Persyaratan SMKK tidak dipahami dan tidak diterapkan. | SMKK requirements are not understood and are not applied. |
| Tingkat 2 | Dokumen SMKK disusun untuk memenuhi persyaratan kontrak, penerapannya di lapangan terbatas. | SMKK documents are prepared to meet contract requirements, but they are applied on site only to a limited extent. |
| Tingkat 3 | Rencana keselamatan konstruksi dan rencana mutu pekerjaan konstruksi diterapkan sesuai Permen PUPR No. 10 Tahun 2021 dan diverifikasi berkala. | The construction safety plan and the construction work quality plan are applied in line with Minister of Public Works and Housing Regulation No. 10 of 2021 and are verified regularly. |
| Tingkat 4 | Penerapan SMKK terpadu dengan proses pengendalian proyek dan efektivitasnya dievaluasi. | SMKK is applied as part of the project control process, and its effectiveness is evaluated. |
| Tingkat 5 | SMKK menjadi cara kerja yang melekat, mendorong inovasi metode kerja yang lebih aman, dan menjadi rujukan bagi mitra rantai pasok. | SMKK is a built-in way of working, encourages innovation in safer work methods, and serves as a reference for supply chain partners. |

#### KT.2 Keselamatan psikososial dan keberanian menyuarakan pendapat

| Bagian | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Keselamatan psikososial dan keberanian menyuarakan pendapat | Psychosocial safety and speaking up |
| Tingkat 1 | Pekerja tidak berani menyampaikan keberatan atau kekhawatiran. | Workers do not dare to raise objections or concerns. |
| Tingkat 2 | Keberatan disampaikan hanya melalui jalur informal dan jarang ditindaklanjuti. | Objections are raised only through informal channels and are rarely followed up. |
| Tingkat 3 | Tersedia saluran resmi untuk menyampaikan keluhan dan kekhawatiran keselamatan. | There are formal channels for raising complaints and safety concerns. |
| Tingkat 4 | Manajemen aktif menanyakan kekhawatiran pekerja, sedangkan beban kerja dan tekanan jadwal dikelola sebagai faktor risiko. | Management actively asks workers about their concerns, while workload and schedule pressure are managed as risk factors. |
| Tingkat 5 | Keterbukaan menjadi norma, perbedaan pendapat mengenai keselamatan dihargai, dan tekanan produksi tidak pernah mengalahkan pertimbangan keselamatan. | Openness is the norm, differences of opinion about safety are valued, and production pressure never overrides safety. |

### B. Skala iklim keselamatan

Butir bertanda (B) adalah butir berarah balik; arah kalimat negatifnya dipertahankan dalam terjemahan.

#### D1 Prioritas, komitmen, dan kompetensi K3 manajemen

| Kode | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Prioritas, komitmen, dan kompetensi K3 manajemen | Management safety priority, commitment, and competence |
| D1.1 | Pimpinan di proyek saya tetap meminta pekerjaan dilakukan sesuai prosedur keselamatan walaupun jadwal sedang mendesak. | The leaders on my project still require work to follow safety procedures even when the schedule is tight. |
| D1.2 | Pimpinan di proyek saya memahami bahaya pekerjaan yang kami lakukan sehari-hari. | The leaders on my project understand the hazards of the work we do every day. |
| D1.3 (B) | Masalah keselamatan baru ditangani pimpinan setelah terjadi kecelakaan. | Safety problems are dealt with by the leaders only after an accident has happened. |

#### D2 Pemberdayaan K3 oleh manajemen

| Kode | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Pemberdayaan K3 oleh manajemen | Management safety empowerment |
| D2.1 | Pendapat saya tentang keselamatan didengar ketika pekerjaan direncanakan. | My opinion about safety is listened to when work is being planned. |
| D2.2 | Saya diberi wewenang menghentikan pekerjaan yang menurut saya tidak aman. | I am given the authority to stop work that I think is unsafe. |
| D2.3 (B) | Keputusan tentang keselamatan diambil tanpa melibatkan pekerja yang menjalankan pekerjaan. | Decisions about safety are made without involving the workers who do the work. |

#### D3 Keadilan manajemen dalam K3

| Kode | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Keadilan manajemen dalam K3 | Management safety justice |
| D3.1 | Pekerja yang melaporkan kesalahan atau kejadian nyaris celaka tidak disalahkan secara tidak adil. | Workers who report mistakes or near misses are not unfairly blamed. |
| D3.2 | Aturan keselamatan diberlakukan sama kepada pekerja sendiri dan pekerja penyedia jasa. | Safety rules are applied equally to our own workers and to contractors' workers. |
| D3.3 (B) | Saat terjadi kecelakaan, yang dicari lebih dulu adalah siapa yang salah. | When an accident happens, the first thing people look for is who is to blame. |

#### D4 Komitmen K3 pekerja

| Kode | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Komitmen K3 pekerja | Workers' safety commitment |
| D4.1 | Rekan kerja saya mengingatkan satu sama lain bila melihat cara kerja yang tidak aman. | My co-workers remind one another when they see an unsafe way of working. |
| D4.2 | Rekan kerja saya ikut aktif dalam kegiatan keselamatan, bukan sekadar hadir. | My co-workers take an active part in safety activities, not just attend them. |
| D4.3 (B) | Di tempat kerja saya, keselamatan dianggap urusan petugas K3 saja. | Where I work, safety is seen as the job of the OSH officers only. |

#### D5 Prioritas K3 pekerja dan penolakan terhadap risiko

| Kode | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Prioritas K3 pekerja dan penolakan terhadap risiko | Workers' safety priority and non-acceptance of risk |
| D5.1 | Di tempat kerja saya, mengambil jalan pintas yang berbahaya tidak dianggap wajar. | Where I work, taking dangerous shortcuts is not seen as normal. |
| D5.2 | Pekerja di sini lebih memilih menunda pekerjaan daripada bekerja dalam kondisi tidak aman. | Workers here would rather delay the work than work in unsafe conditions. |
| D5.3 (B) | Risiko kecil dianggap bagian biasa dari pekerjaan konstruksi. | Small risks are seen as a normal part of construction work. |

#### D6 Komunikasi, pembelajaran, dan kepercayaan pada kompetensi rekan

| Kode | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Komunikasi, pembelajaran, dan kepercayaan pada kompetensi rekan | Safety communication, learning, and trust in co-workers' safety competence |
| D6.1 | Pelajaran dari kejadian di proyek lain disampaikan kepada kami. | Lessons from incidents on other projects are passed on to us. |
| D6.2 | Saya percaya rekan kerja saya mampu bekerja dengan aman. | I trust that my co-workers are able to work safely. |
| D6.3 (B) | Pertemuan keselamatan pagi jarang membahas bahaya pekerjaan hari itu. | The morning safety briefing rarely discusses the hazards of that day's work. |

#### D7 Kepercayaan pada efektivitas sistem K3

| Kode | Bahasa Indonesia (sumber) | Draf bahasa Inggris |
|---|---|---|
| Nama | Kepercayaan pada efektivitas sistem K3 | Trust in the effectiveness of safety systems |
| D7.1 | Izin kerja dan analisis keselamatan pekerjaan benar-benar membantu mencegah kecelakaan. | Work permits and job safety analyses really help to prevent accidents. |
| D7.2 | Pemeriksaan keselamatan di lapangan menemukan masalah yang sesungguhnya. | Safety inspections on site find the real problems. |
| D7.3 (B) | Prosedur keselamatan lebih banyak untuk kelengkapan dokumen daripada untuk melindungi pekerja. | Safety procedures exist more to complete the paperwork than to protect workers. |

## 8. Referensi

Beaton, D. E., Bombardier, C., Guillemin, F., & Ferraz, M. B. (2000). Guidelines for the process of cross-cultural adaptation of self-report measures. *Spine, 25*(24), 3186-3191. https://doi.org/10.1097/00007632-200012150-00014

International Test Commission. (2018). ITC guidelines for translating and adapting tests (second edition). *International Journal of Testing, 18*(2), 101-134. https://doi.org/10.1080/15305058.2017.1398166

Kines, P., Lappalainen, J., Mikkelsen, K. L., Olsen, E., Pousette, A., Tharaldsen, J., Tómasson, K., & Törner, M. (2011). Nordic Safety Climate Questionnaire (NOSACQ-50): A new tool for diagnosing occupational safety climate. *International Journal of Industrial Ergonomics, 41*(6), 634-646. https://doi.org/10.1016/j.ergon.2011.08.004

Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Republik Indonesia Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi. (2021).

Wild, D., Grove, A., Martin, M., Eremenco, S., McElroy, S., Verjee-Lorenz, A., & Erikson, P. (2005). Principles of good practice for the translation and cultural adaptation process for patient-reported outcomes (PRO) measures: Report of the ISPOR Task Force for Translation and Cultural Adaptation. *Value in Health, 8*(2), 94-104. https://doi.org/10.1111/j.1524-4733.2005.04054.x

Willis, G. B. (2005). *Cognitive interviewing: A tool for improving questionnaire design*. SAGE Publications.
