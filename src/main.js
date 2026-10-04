const allowedEmails = [
  "susanputra94@gmail.com",
  "gohpihan@gmail.com",
  "hello@pjsdc.com.my",
];

const app = document.querySelector("#app");
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const receiptFields = [
  ["date", "Date", "date"],
  ["receivedFrom", "Received from", "text"],
  ["paymentFor", "Being payment for", "text"],
  ["registration", "Registration", "text"],
  ["feesPerClass", "Fees per class", "text"],
  ["dob", "D.O.B.", "date"],
  ["commencing", "Class commencing on", "date"],
  ["tel", "Tel. no.", "tel"],
  ["weeks", "Total weeks", "number"],
  ["total", "Total amount (RM)", "number"],
  ["cashChq", "Cash / chq no.", "text"],
  ["bankTransfer", "Bank transfer", "text"],
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

function fieldMarkup([key, label, type]) {
  const attrs = type === "number" ? 'min="0" step="0.01"' : "";
  return `<label class="form-field"><span>${label}</span><input id="${key}" name="${key}" type="${type}" ${attrs} /></label>`;
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
      <section class="portal-intro"><div><div class="eyebrow">STAFF TOOL</div><h1>Official receipt generator</h1><p>Create a clear, professional payment receipt, then print or save it as a PDF.</p></div><div class="user-chip">${user.picture ? `<img src="${escapeHtml(user.picture)}" alt="" />` : ""}<span>${escapeHtml(user.name || user.email)}</span></div></section>
      <div class="workspace">
        <form id="receipt-form" class="editor-card">
          <div class="card-heading"><h2>Receipt details</h2><p>Fields marked with an asterisk are included in the receipt.</p></div>
          <div class="form-grid">${receiptFields.map(fieldMarkup).join("")}</div>
          <div class="form-actions"><button type="button" id="clear-form" class="secondary-button">Clear</button><button type="submit" class="primary-button">Update receipt</button></div>
        </form>
        <section class="preview-area"><div class="preview-toolbar"><span>Live preview</span><button id="print-receipt" class="primary-button">Print / Save PDF</button></div><div id="receipt-preview" class="receipt-paper"></div></section>
      </div>
    </main>`;

  document.querySelector("#sign-out").addEventListener("click", () => { sessionStorage.removeItem("edceteraStaffUser"); window.google?.accounts?.id?.disableAutoSelect(); showLogin(); });
  document.querySelector("#receipt-form").addEventListener("submit", (event) => { event.preventDefault(); renderReceipt(new FormData(event.currentTarget)); });
  document.querySelector("#clear-form").addEventListener("click", () => { document.querySelector("#receipt-form").reset(); renderReceipt(new FormData(document.querySelector("#receipt-form"))); });
  document.querySelector("#print-receipt").addEventListener("click", () => window.print());
  renderReceipt(new FormData(document.querySelector("#receipt-form")));
}

function line(label, value, modifier = "") { return `<div class="receipt-line ${modifier}"><span>${label}</span><strong>${escapeHtml(value || " ")}</strong></div>`; }
function renderReceipt(data) {
  const value = (name) => data.get(name)?.trim() || "";
  document.querySelector("#receipt-preview").innerHTML = `
    <div class="receipt-head"><div class="logo-frame receipt-logo"><img src="/edcetera-logo.png" alt="EdCetera" /></div><div class="receipt-title"><h2>OFFICIAL RECEIPT</h2><p>PJ SPEECH &amp; DRAMA CENTRE SDN BHD</p><small>199701016728 (432225-U)</small></div></div>
    <div class="company-contact">21 Jalan 19/29, 46300 Petaling Jaya, Selangor Darul Ehsan<br>Mobile: 016-588 7926 &nbsp;·&nbsp; Email: hello@pjsdc.com.my</div>
    <p class="receipt-alert">THIS RECEIPT MUST BE SHOWN TO THE CLASS TEACHER<br>ON THE FIRST LESSON OF THE TERM.</p>
    <div class="receipt-lines">
      ${line("Date", formatDate(value("date")))}
      ${line("Received from", value("receivedFrom"))}
      ${line("Being payment for", value("paymentFor"))}
      <div class="receipt-two-column">${line("Registration", value("registration"))}${line("Fees per class", value("feesPerClass"))}</div>
      <div class="receipt-two-column">${line("D.O.B.", formatDate(value("dob")))}${line("Class commencing on", formatDate(value("commencing")))}</div>
      <div class="receipt-two-column">${line("Tel. no.", value("tel"))}${line("Total weeks", value("weeks"))}</div>
      <div class="receipt-two-column">${line("Total amount RM", value("total"))}${line("Cash / chq no.", value("cashChq"))}</div>
      ${line("Bank transfer", value("bankTransfer"))}
    </div>
    <div class="receipt-footer">for PJ SPEECH &amp; DRAMA CENTRE SDN BHD</div>`;
}

getUser() ? showPortal() : showLogin();
