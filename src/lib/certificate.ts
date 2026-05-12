export interface CertificateData {
  documentTitle: string;
  awardTitle: string;
  recipientName: string;
  tournamentName: string;
  seasonLabel: string;
  awardedOn: string;
  citation: string;
  signedBy: string;
  accentColor: string;
  recipientImage?: string;
}

interface CertificateDefaultsInput {
  place: 1 | 2 | 3;
  recipientName: string;
  tournamentName: string;
  persistent?: boolean;
  priorSeasonCount?: number;
  accentColor?: string;
  recipientImage?: string;
}

const CERT_WIDTH = 1684;
const CERT_HEIGHT = 1191;
const PDF_WIDTH = 842;
const PDF_HEIGHT = 595;

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function wrapText(value: string, maxChars: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0];

  for (const word of words.slice(1)) {
    const next = `${current} ${word}`;
    if (next.length <= maxChars) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  lines.push(current);
  return lines;
}

function fitFontSize(value: string, base: number, min: number, freeChars: number) {
  if (value.length <= freeChars) return base;
  return Math.max(min, base - (value.length - freeChars) * 1.35);
}

function formatDateLabel(value: string) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function dateInputValue(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function initialsFor(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "PL";
}

export function buildCertificateDefaults(input: CertificateDefaultsInput): CertificateData {
  const seasonNumber = (input.priorSeasonCount ?? 0) + 1;
  const seasonLabel = input.persistent ? `Season ${seasonNumber}` : "";
  const documentTitle = input.place === 1 ? "Certificate of Victory" : "Certificate of Achievement";
  const awardTitle = input.place === 1 ? "1st Place" : input.place === 2 ? "2nd Place" : "3rd Place";
  const eventName = seasonLabel ? `${input.tournamentName} ${seasonLabel}` : input.tournamentName;
  const citation =
    input.place === 1
      ? `For winning ${eventName} and finishing at the top of the field.`
      : input.place === 2
        ? `For earning 2nd place in ${eventName} with a strong performance throughout the tournament.`
        : `For securing 3rd place in ${eventName} and standing out across the event.`;

  return {
    documentTitle,
    awardTitle,
    recipientName: input.recipientName,
    tournamentName: input.tournamentName,
    seasonLabel,
    awardedOn: dateInputValue(),
    citation,
    signedBy: "Pit Lane Race Control",
    accentColor: input.accentColor ?? "#b8860b",
    recipientImage: input.recipientImage,
  };
}

function createCertificateSvg(data: CertificateData) {
  const accent = escapeXml(data.accentColor || "#b8860b");
  const documentTitle = escapeXml(data.documentTitle || "Certificate of Achievement");
  const title = escapeXml(data.awardTitle || "Champion");
  const recipient = escapeXml(data.recipientName || "Unknown Champion");
  const eventName = escapeXml(data.tournamentName || "Untitled Tournament");
  const seasonLabel = escapeXml(data.seasonLabel || "");
  const citationLines = wrapText(data.citation || "", 54);
  const signedBy = escapeXml(data.signedBy || "");
  const dateLabel = escapeXml(formatDateLabel(data.awardedOn));
  const recipientFontSize = fitFontSize(data.recipientName || "", 92, 58, 18);
  const eventFontSize = fitFontSize(data.tournamentName || "", 42, 28, 28);
  const initials = escapeXml(initialsFor(data.recipientName));
  const visualMarkup = data.recipientImage
    ? `<image href="${escapeXml(data.recipientImage)}" x="1168" y="246" width="252" height="252" preserveAspectRatio="xMidYMid slice" clip-path="url(#portraitClip)" />`
    : `
      <circle cx="1294" cy="372" r="118" fill="${accent}" opacity="0.14" />
      <text x="1294" y="397" text-anchor="middle" font-size="96" font-weight="700" fill="${accent}" font-family="Georgia, 'Times New Roman', serif">${initials}</text>
    `;

  const citationMarkup =
    citationLines.length > 0
      ? citationLines
          .slice(0, 3)
          .map(
            (line, idx) =>
              `<text x="172" y="${650 + idx * 42}" font-size="30" fill="#4c4c4c" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">${escapeXml(line)}</text>`,
          )
          .join("")
      : "";

  const signedByMarkup = signedBy
    ? `
      <line x1="1040" y1="918" x2="1460" y2="918" stroke="#b9b0a2" stroke-width="2" />
      <text x="1040" y="885" font-size="24" fill="#6e6456" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">Verified by</text>
      <text x="1040" y="952" font-size="28" fill="#1f1f1f" font-family="Georgia, 'Times New Roman', serif">${signedBy}</text>
    `
    : "";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${CERT_WIDTH}" height="${CERT_HEIGHT}" viewBox="0 0 ${CERT_WIDTH} ${CERT_HEIGHT}">
      <defs>
        <linearGradient id="paper" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8f3e8" />
          <stop offset="100%" stop-color="#efe5d4" />
        </linearGradient>
        <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.10" />
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.02" />
        </linearGradient>
        <clipPath id="portraitClip">
          <circle cx="1294" cy="372" r="118" />
        </clipPath>
      </defs>

      <rect width="${CERT_WIDTH}" height="${CERT_HEIGHT}" fill="url(#paper)" />
      <rect x="46" y="46" width="${CERT_WIDTH - 92}" height="${CERT_HEIGHT - 92}" rx="24" fill="none" stroke="${accent}" stroke-width="8" />
      <rect x="78" y="78" width="${CERT_WIDTH - 156}" height="${CERT_HEIGHT - 156}" rx="18" fill="none" stroke="#d9c8a8" stroke-width="2" />
      <path d="M0 0h${CERT_WIDTH}v240H0z" fill="url(#shine)" />
      <circle cx="1365" cy="226" r="170" fill="${accent}" opacity="0.07" />
      <circle cx="118" cy="1058" r="210" fill="${accent}" opacity="0.05" />

      <text x="172" y="182" font-size="24" letter-spacing="6" fill="${accent}" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">PIT LANE</text>
      <text x="172" y="238" font-size="66" font-weight="700" fill="#241f17" font-family="Georgia, 'Times New Roman', serif">${documentTitle}</text>
      <text x="172" y="290" font-size="24" fill="#6e6456" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">Issued for verified tournament results</text>

      <text x="172" y="418" font-size="28" letter-spacing="4" fill="${accent}" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">AWARDED TO</text>
      <text x="172" y="520" font-size="${recipientFontSize}" font-weight="700" fill="#1f1f1f" font-family="Georgia, 'Times New Roman', serif">${recipient}</text>
      <text x="172" y="580" font-size="32" fill="#6e6456" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">${title}</text>
      ${citationMarkup}

      <rect x="172" y="742" width="742" height="128" rx="26" fill="#fffaf1" stroke="#e6d7bd" stroke-width="2" />
      <text x="210" y="792" font-size="22" letter-spacing="3" fill="${accent}" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">TOURNAMENT</text>
      <text x="210" y="842" font-size="${eventFontSize}" font-weight="700" fill="#1f1f1f" font-family="Georgia, 'Times New Roman', serif">${eventName}</text>

      <rect x="960" y="742" width="262" height="128" rx="26" fill="#fffaf1" stroke="#e6d7bd" stroke-width="2" />
      <text x="998" y="792" font-size="22" letter-spacing="3" fill="${accent}" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">DATE</text>
      <text x="998" y="842" font-size="30" font-weight="700" fill="#1f1f1f" font-family="Georgia, 'Times New Roman', serif">${dateLabel}</text>

      ${
        seasonLabel
          ? `
            <rect x="1240" y="116" width="218" height="62" rx="31" fill="${accent}" />
            <text x="1349" y="156" text-anchor="middle" font-size="24" font-weight="700" fill="#fffaf1" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">${seasonLabel}</text>
          `
          : ""
      }

      <circle cx="1294" cy="372" r="124" fill="#fffaf1" stroke="${accent}" stroke-width="6" />
      ${visualMarkup}

      <line x1="172" y1="918" x2="548" y2="918" stroke="#b9b0a2" stroke-width="2" />
      <text x="172" y="885" font-size="24" fill="#6e6456" font-family="'Trebuchet MS', 'Segoe UI', sans-serif">Issued on</text>
      <text x="172" y="952" font-size="28" fill="#1f1f1f" font-family="Georgia, 'Times New Roman', serif">${dateLabel}</text>
      ${signedByMarkup}
    </svg>
  `;
}

export function createCertificatePreviewUrl(data: CertificateData) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(createCertificateSvg(data))}`;
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function svgToJpegBytes(data: CertificateData) {
  const svg = createCertificateSvg(data);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not render certificate preview."));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = CERT_WIDTH;
    canvas.height = CERT_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare certificate canvas.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.96);
    const base64 = jpegDataUrl.split(",", 2)[1];
    if (!base64) throw new Error("Could not encode certificate JPEG.");
    return base64ToBytes(base64);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function combineBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function createPdfFromJpeg(jpegBytes: Uint8Array) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let offset = 0;

  const pushString = (value: string) => {
    const bytes = encoder.encode(value);
    chunks.push(bytes);
    offset += bytes.length;
  };

  const pushBytes = (value: Uint8Array) => {
    chunks.push(value);
    offset += value.length;
  };

  const beginObject = (id: number) => {
    offsets[id] = offset;
    pushString(`${id} 0 obj\n`);
  };

  pushString("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");

  beginObject(1);
  pushString("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  beginObject(2);
  pushString("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  beginObject(3);
  pushString(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n`,
  );

  beginObject(4);
  pushString(
    `<< /Type /XObject /Subtype /Image /Width ${CERT_WIDTH} /Height ${CERT_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  pushBytes(jpegBytes);
  pushString("\nendstream\nendobj\n");

  const content = `q\n${PDF_WIDTH} 0 0 ${PDF_HEIGHT} 0 0 cm\n/Im0 Do\nQ\n`;
  beginObject(5);
  pushString(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);

  const xrefStart = offset;
  pushString("xref\n0 6\n");
  pushString("0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) {
    pushString(`${offsets[i].toString().padStart(10, "0")} 00000 n \n`);
  }
  pushString("trailer\n");
  pushString("<< /Size 6 /Root 1 0 R >>\n");
  pushString(`startxref\n${xrefStart}\n%%EOF`);

  return new Blob([combineBytes(chunks)], { type: "application/pdf" });
}

export async function createCertificatePdf(data: CertificateData) {
  const jpegBytes = await svgToJpegBytes(data);
  return createPdfFromJpeg(jpegBytes);
}

export function certificateFilename(data: CertificateData) {
  const tournament = slugify(data.tournamentName || "tournament");
  const award = slugify(data.awardTitle || "certificate");
  const recipient = slugify(data.recipientName || "champion");
  return `pitlane-certificate-${tournament}-${award}-${recipient}.pdf`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
