const supabaseConfig = window.MANGO_FITNESS_SUPABASE;
const supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);

function setMessage(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
}

function resetRedirectUrl() {
  return new URL("reset-password.html", window.location.href).href.replace(/[#?].*$/, "");
}

async function initLoginPage(options) {
  const email = document.getElementById(options.emailId);
  const password = document.getElementById(options.passwordId);
  const signIn = document.getElementById(options.signInBtnId);
  const forgot = document.getElementById(options.forgotBtnId);
  const signOut = document.getElementById(options.signOutBtnId);
  const authCard = document.getElementById(options.authCardId);
  const dashboard = document.getElementById(options.dashboardId);

  function showSignedIn(userEmail) {
    if (authCard) authCard.classList.add("hidden");
    if (dashboard) dashboard.classList.remove("hidden");
    setMessage(options.dashboardMessageId, `Signed in as ${userEmail || "your account"}.`);
  }

  function showSignedOut() {
    if (authCard) authCard.classList.remove("hidden");
    if (dashboard) dashboard.classList.add("hidden");
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (sessionData.session?.user) showSignedIn(sessionData.session.user.email);
  else showSignedOut();

  signIn?.addEventListener("click", async () => {
    setMessage(options.messageId, "");
    const userEmail = email.value.trim();
    const userPassword = password.value;
    if (!userEmail || !userPassword) return setMessage(options.messageId, "Enter your email and password.");

    signIn.disabled = true;
    signIn.textContent = "Signing in...";
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: userEmail, password: userPassword });
    signIn.disabled = false;
    signIn.textContent = "Sign In";

    if (error) return setMessage(options.messageId, error.message || "Could not sign in.");
    showSignedIn(data.user?.email || userEmail);
  });

  forgot?.addEventListener("click", async () => {
    setMessage(options.messageId, "");
    const userEmail = email.value.trim();
    if (!userEmail) return setMessage(options.messageId, "Enter your email first, then tap Forgot Password.");

    forgot.disabled = true;
    forgot.textContent = "Sending...";
    const { error } = await supabaseClient.auth.resetPasswordForEmail(userEmail, { redirectTo: resetRedirectUrl() });
    forgot.disabled = false;
    forgot.textContent = "Forgot Password";

    if (error) return setMessage(options.messageId, error.message || "Could not send reset email.");
    setMessage(options.messageId, "Password reset email sent. Check your inbox.");
  });

  signOut?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    showSignedOut();
  });
}

async function initResetPasswordPage() {
  const save = document.getElementById("savePasswordBtn");
  const newPassword = document.getElementById("newPassword");
  const confirmPassword = document.getElementById("confirmPassword");

  save?.addEventListener("click", async () => {
    setMessage("resetMessage", "");
    const pass = newPassword.value;
    const confirm = confirmPassword.value;
    if (!pass || pass.length < 8) return setMessage("resetMessage", "Password must be at least 8 characters.");
    if (pass !== confirm) return setMessage("resetMessage", "Passwords do not match.");

    save.disabled = true;
    save.textContent = "Saving...";
    const { error } = await supabaseClient.auth.updateUser({ password: pass });
    save.disabled = false;
    save.textContent = "Save Password";

    if (error) return setMessage("resetMessage", error.message || "Could not save password.");
    setMessage("resetMessage", "Password saved. You can sign in now.");
  });
}
