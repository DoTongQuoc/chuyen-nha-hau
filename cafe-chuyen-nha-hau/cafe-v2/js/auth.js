import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const loginScreen = document.getElementById("login-screen");
const appShell    = document.getElementById("app-shell");

onAuthStateChanged(auth, user => {
  if (user) {
    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("app:ready"));
  } else {
    appShell.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }
});

document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const errEl  = document.getElementById("login-error");
  const btn    = e.target.querySelector("button[type=submit]");
  const email  = document.getElementById("login-email").value.trim();
  const pass   = document.getElementById("login-password").value;
  errEl.textContent = "";
  btn.disabled = true; btn.textContent = "Đang đăng nhập...";
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch {
    errEl.textContent = "Sai email hoặc mật khẩu.";
  } finally {
    btn.disabled = false; btn.textContent = "Đăng nhập";
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));
