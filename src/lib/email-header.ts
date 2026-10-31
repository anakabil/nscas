// Kepala surel NSCAS (docs/11 V25). Gambar disisipkan sebagai lampiran inline (CID), tidak dimuat dari server:
// membuka surel tidak mengirim permintaan apa pun ke server NSCAS, sehingga tidak ada pencatatan kapan dan dari
// alamat IP mana undangan survei dibuka (sejalan dengan anonimitas responden, docs/02 bagian 4). Gambar juga tetap
// tampil walaupun server tidak dapat dijangkau dari internet.

export const EMAIL_HEADER_CID = "header@nscas";

/** Relatif terhadap direktori kerja aplikasi dan worker. */
export const EMAIL_HEADER_FILE = "public/illustrations/email-header.png";

/** Pita gelap di atas isi surel; hiasan, sehingga alt kosong. */
export function emailHeaderHtml(): string {
  return `<img src="cid:${EMAIL_HEADER_CID}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:8px;margin:0 0 20px">`;
}
