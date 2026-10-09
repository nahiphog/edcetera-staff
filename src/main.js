import { jsPDF } from "jspdf";

const allowedEmails = [
  "susanputra94@gmail.com",
  "gohpihan@gmail.com",
  "hello@pjsdc.com.my",
];

const app = document.querySelector("#app");
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let useGreyscaleLogo = false;

const receiptFields = [
  ["receiptNo", "Receipt no.", "text", "100601"],
  ["date", "Date", "date"],
  ["receivedFrom", "Received from", "text"],
  ["month", "Month", "text"],
  ["day", "Day", "text"],
  ["time", "Time", "text"],
  ["course", "Course", "text"],
  ["level", "Level", "text"],
  ["teacher", "Teacher", "text"],
  ["registration", "Registration", "text"],
  ["weeks", "Weeks", "number"],
  ["feesPerClass", "Fees per class", "text"],
  ["dob", "D.O.B.", "date"],
  ["total", "Total amount (RM)", "number"],
  ["commencing", "Class commencing on", "date"],
  ["cashChq", "Cash / chq no.", "text"],
  ["tel", "Tel. no.", "tel"],
  ["bankTransfer", "Bank transfer", "text"],
  ["authorisedBy", "Authorised by (above company footer)", "text"],
];

function decodeJwt(token) {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(decodeURIComponent(atob(base64).split("").map((char) => `%${("00" + char.charCodeAt(0).toString(16)).slice(-2)}`).join("")));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" })[char]);
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function showLogin(error = "") {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="logo-frame login-logo"><img src="/edcetera-logo.png" alt="EdCetera by PJ Speech and Drama Centre" /></div>
        <div class="eyebrow">INTERNAL PORTAL</div>
        <h1>Edcetera Staff</h1>
        <p>One secure place for the team to create and print official receipts.</p>
        <div id="google-button" class="google-button-wrap"></div>
        <p class="access-note">Access is limited to authorised Edcetera staff accounts.</p>
        ${error ? `<p class="auth-error" role="alert">${escapeHtml(error)}</p>` : ""}
        ${!googleClientId ? `<p class="setup-note">Google sign-in needs a client ID. Add it to <code>.env.local</code> using <code>VITE_GOOGLE_CLIENT_ID</code>.</p>` : ""}
      </section>
    </main>`;

  if (!googleClientId) return;
  const attachButton = () => {
    if (!window.google?.accounts?.id) return setTimeout(attachButton, 150);
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleLogin, auto_select: false });
    window.google.accounts.id.renderButton(document.querySelector("#google-button"), { theme: "outline", size: "large", width: 300, text: "signin_with", shape: "pill" });
  };
  attachButton();
}

function handleGoogleLogin(response) {
  try {
    const user = decodeJwt(response.credential);
    const email = user.email?.toLowerCase();
    if (!user.email_verified || !allowedEmails.includes(email)) {
      window.google?.accounts?.id?.disableAutoSelect();
      showLogin("This Google account is not authorised for Edcetera Staff.");
      return;
    }
    sessionStorage.setItem("edceteraStaffUser", JSON.stringify({ name: user.name, email, picture: user.picture }));
    showPortal();
  } catch {
    showLogin("We couldn't verify that sign-in. Please try again.");
  }
}

function getUser() {
  try { return JSON.parse(sessionStorage.getItem("edceteraStaffUser")); } catch { return null; }
}

function fieldMarkup([key, label, type, defaultValue = ""]) {
  const attrs = type === "number" ? 'min="0" step="0.01"' : "";
  return `<label class="form-field"><span>${label}</span><input id="${key}" name="${key}" type="${type}" value="${escapeHtml(defaultValue)}" ${attrs} /></label>`;
}

function showPortal() {
  const user = getUser();
  if (!user) return showLogin();
  app.innerHTML = `
    <header class="topbar">
      <a class="topbar-brand" href="https://edcetera-learn.lovable.app/" target="_blank" rel="noreferrer"><span class="logo-frame nav-logo"><img src="/edcetera-logo.png" alt="EdCetera" /></span></a>
      <nav><a href="https://edcetera-learn.lovable.app/" target="_blank" rel="noreferrer">Learning site ↗</a><button id="sign-out" class="text-button">Sign out</button></nav>
    </header>
    <main class="portal-shell">
      <section class="portal-intro"><div><div class="eyebrow">STAFF TOOL</div><h1>Official receipt generator</h1><p>Complete the digital receipt and download the matching two-page PDF.</p></div><div class="user-chip">${user.picture ? `<img src="${escapeHtml(user.picture)}" alt="" />` : ""}<span>${escapeHtml(user.name || user.email)}</span></div></section>
      <div class="workspace">
        <form id="receipt-form" class="editor-card">
          <div class="card-heading"><h2>Receipt details</h2><p>The download includes the official receipt and parent reminder page.</p></div>
          <div class="form-grid reference-form">${receiptFields.map(fieldMarkup).join("")}</div>
          <label class="notice-toggle"><input id="show-notice" name="showNotice" type="checkbox" checked /> Show the class-teacher reminder</label>
          <div class="form-actions"><button type="button" id="clear-form" class="secondary-button">Clear</button></div>
        </form>
        <section class="preview-area"><div class="preview-toolbar"><span>Live preview</span><div class="preview-actions"><button id="toggle-logo" class="secondary-button">Use greyscale logo</button><button id="download-receipt" class="primary-button">Download 2-page PDF</button></div></div><div id="receipt-preview" class="receipt-paper"></div></section>
      </div>
    </main>`;

  document.querySelector("#sign-out").addEventListener("click", () => { sessionStorage.removeItem("edceteraStaffUser"); window.google?.accounts?.id?.disableAutoSelect(); showLogin(); });
  document.querySelector("#receipt-form").addEventListener("input", (event) => renderReceipt(new FormData(event.currentTarget)));
  document.querySelector("#receipt-form").addEventListener("change", (event) => renderReceipt(new FormData(event.currentTarget)));
  document.querySelector("#clear-form").addEventListener("click", () => { document.querySelector("#receipt-form").reset(); document.querySelector("#receiptNo").value = "100601"; renderReceipt(new FormData(document.querySelector("#receipt-form"))); });
  document.querySelector("#toggle-logo").addEventListener("click", () => { useGreyscaleLogo = !useGreyscaleLogo; document.querySelector("#toggle-logo").textContent = useGreyscaleLogo ? "Use original logo" : "Use greyscale logo"; renderReceipt(new FormData(document.querySelector("#receipt-form"))); });
  document.querySelector("#download-receipt").addEventListener("click", () => downloadPdf(new FormData(document.querySelector("#receipt-form"))));
  renderReceipt(new FormData(document.querySelector("#receipt-form")));
}

function line(label, value, modifier = "") { return `<div class="receipt-line ${modifier}"><span>${label}</span><strong>${escapeHtml(value || " ")}</strong></div>`; }
function lineBefore(label, value) { return `<div class="receipt-line line-before"><strong>${escapeHtml(value || " ")}</strong><span>${label}</span></div>`; }
function renderReceipt(data) {
  const value = (name) => data.get(name)?.trim() || "";
  const logoMode = useGreyscaleLogo ? "logo-greyscale" : "";
  document.querySelector("#receipt-preview").innerHTML = `
    <div class="receipt-head"><div class="logo-frame receipt-logo ${logoMode}"><img src="/edcetera-logo.png" alt="EdCetera" /></div><div class="receipt-title"><h2>OFFICIAL RECEIPT <em><i>N<sup>o</sup></i> ${escapeHtml(value("receiptNo") || "—")}</em></h2><p>PJ SPEECH &amp; DRAMA CENTRE SDN BHD</p><small>199701016728 (432225-U)</small></div></div>
    <div class="company-contact">21 Jalan 19/29, 46300 Petaling Jaya, Selangor Darul Ehsan<br>Mobile: 016-588 7926 &nbsp;·&nbsp; Email: hello@pjsdc.com.my</div>
    ${data.get("showNotice") ? `<p class="receipt-alert">THIS RECEIPT MUST BE SHOWN TO THE CLASS TEACHER<br>ON THE FIRST LESSON OF THE TERM.</p>` : ""}
    <div class="receipt-lines">
      ${line("Date", formatDate(value("date")), "date-line")}
      ${line("<b>RECEIVED</b> from", value("receivedFrom"))}
      <div class="payment-session">${line("Being payment for", value("paymentFor"))}<div class="receipt-session-values">${["month", "day", "time", "course", "level", "teacher"].map((key) => `<span>${escapeHtml(value(key))}</span>`).join("")}</div><div class="receipt-label-row"><span>MONTH</span><span>DAY</span><span>TIME</span><span>COURSE</span><span>LEVEL</span><span>TEACHER</span></div></div>
      <div class="receipt-detail-block">
        <div class="receipt-two-column">${line("Registration", value("registration"))}${lineBefore("Weeks", value("weeks"))}</div>
        ${line("Fees per class", value("feesPerClass"))}
        <div class="receipt-two-column">${line("D.O.B.", formatDate(value("dob")))}${line("Total amount RM", value("total"))}</div>
        <div class="receipt-two-column class-row">${line("Class commencing on", formatDate(value("commencing")))}${line("Cash / chq no.", value("cashChq"))}</div>
        <div class="receipt-two-column">${line("Tel. no.", value("tel"))}${line("Bank transfer", value("bankTransfer"))}</div>
      </div>
    </div>
    <div class="receipt-signature-value">${escapeHtml(value("authorisedBy"))}</div><div class="receipt-signature-line" aria-hidden="true"><span>for PJ SPEECH &amp; DRAMA CENTRE SDN BHD</span></div><div class="receipt-footer">for PJ SPEECH &amp; DRAMA CENTRE SDN BHD</div>`;
}

function pdfLine(doc, label, value, x, y, width, isBold = true, fontSize = 7) {
  doc.setFont("helvetica", isBold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(40, 40, 40);
  doc.text(label, x, y);
  const start = x + doc.getTextWidth(label) + 2;
  doc.setFont("helvetica", "normal");
  doc.text(value || "", start, y);
  doc.setDrawColor(75, 75, 75);
  doc.setLineWidth(0.18);
  doc.line(start - 1, y + 1.2, x + width, y + 1.2);
  return start - 1;
}

function pdfReceivedLine(doc, value, x, y, width) {
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text("RECEIVED", x, y);
  const receivedWidth = doc.getTextWidth("RECEIVED");
  doc.setFont("helvetica", "normal");
  doc.text(" from", x + receivedWidth, y);
  const start = x + receivedWidth + doc.getTextWidth(" from") + 2;
  doc.text(value || "", start, y);
  doc.setDrawColor(75, 75, 75);
  doc.setLineWidth(0.18);
  doc.line(start - 1, y + 1.2, x + width, y + 1.2);
}

function pdfLineBefore(doc, label, value, x, y, width) {
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  const labelWidth = doc.getTextWidth(label);
  const lineEnd = x + width - labelWidth - 2;
  doc.setFont("helvetica", "normal");
  doc.text(value || "", x, y);
  doc.setDrawColor(75, 75, 75);
  doc.setLineWidth(0.18);
  doc.line(x, y + 1.2, lineEnd, y + 1.2);
  doc.setFont("helvetica", "bold");
  doc.text(label, x + width - labelWidth, y);
}

async function addPdfLogo(doc) {
  const image = new Image();
  image.src = "/edcetera-logo.png";
  try {
    await image.decode();
    if (!useGreyscaleLogo) {
      doc.addImage(image, "PNG", 9, 7, 49, 31);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const grey = Math.round((pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2]) / 3);
      pixels.data[index] = grey;
      pixels.data[index + 1] = grey;
      pixels.data[index + 2] = grey;
    }
    context.putImageData(pixels, 0, 0);
    doc.addImage(canvas, "PNG", 9, 7, 49, 31);
  } catch {
    // The company name in the header remains present if the image cannot load.
  }
}

async function addPolicyPageImage(doc) {
  const image = new Image();
  image.src = "/receipt-policy-2.png";
  await image.decode();
  doc.addImage(image, "PNG", 0, 0, 210, 145);
}

async function addReceiptPageImage(doc, data) {
  const image = new Image();
  image.src = "/receipt-template-1.png";
  await image.decode();
  doc.addImage(image, "PNG", 0, 0, 210, 145);

  const value = (name) => data.get(name)?.trim() || "";
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  const field = (name, x, y, width) => doc.text(value(name), x + width / 2, y, { align: "center" });
  field("date", 32, 54.5, 45);
  field("receivedFrom", 52, 65.5, 151);
  ["month", "day", "time", "course", "level", "teacher"].forEach((name, index) => {
    doc.setFontSize(7.5);
    doc.text(value(name), [52, 80, 104, 130, 154, 181][index], 75.5, { align: "left" });
  });
  doc.setFontSize(8);
  field("registration", 78, 91.5, 51);
  field("weeks", 135, 91.5, 54);
  field("feesPerClass", 80, 98.5, 123);
  field("dob", 62, 106.5, 67);
  field("total", 164, 106.5, 39);
  field("commencing", 87, 114.5, 42);
  field("cashChq", 160, 114.5, 43);
  field("tel", 66, 122.5, 63);
  field("bankTransfer", 164, 122.5, 39);
  field("authorisedBy", 130, 132, 73);

  if (!data.get("showNotice")) {
    doc.setFillColor(255, 255, 255);
    doc.rect(55, 38, 145, 12, "F");
  }
  doc.setFillColor(255, 255, 255);
  doc.rect(158, 6, 42, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(35, 35, 35);
  doc.text("N", 166, 12);
  doc.setFontSize(6);
  doc.text("o", 170.5, 8.8);
  doc.setTextColor(224, 73, 65);
  doc.setFontSize(10);
  doc.text(value("receiptNo") || "—", 174, 12);
}

function drawPolicySection(doc, title, paragraphs, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(37, 37, 37);
  doc.text(title, 18, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  paragraphs.forEach((paragraph) => {
    const lines = doc.splitTextToSize(paragraph, 173);
    doc.text(lines, 18, y);
    y += lines.length * 3.25 + 1.5;
  });
  return y + 2;
}

async function downloadPdf(data) {
  const value = (name) => data.get(name)?.trim() || "";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [210, 145] });
  await addReceiptPageImage(doc, data);

  doc.addPage([210, 145], "landscape");
  await addPolicyPageImage(doc);
  doc.save(`Receipt-${value("receiptNo") || "draft"}.pdf`);
}

getUser() ? showPortal() : showLogin();
