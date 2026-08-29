"use client";

import { useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzy30IX72zaTLLG8v3R0IbWg2suir_lgA_VDzZ8O2vC9RdiPLxMvQvH7vz7jwL46_BGIw/exec";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // CARGAR PERFIL DEL USUARIO
  // =========================================================

  const cargarPerfilUsuario = async (uid: string) => {
    const url =
      `${API_URL}?action=usuario&uid=${encodeURIComponent(uid)}&t=${Date.now()}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo conectar con el servidor.");
    }

    const data = await response.json();

    // DEBUG
    console.log("RESPUESTA COMPLETA DE GOOGLE SHEETS:", data);
    console.log("USUARIO RECIBIDO:", data?.usuario);

    if (!data?.ok || !data?.usuario) {
      throw new Error(
        data?.error || "El usuario no está registrado en el sistema."
      );
    }

    const usuario = data.usuario;

    // =========================================================
    // NORMALIZAR ESTADO
    // =========================================================

    const estadoUsuario = String(
      usuario.estado ??
        usuario.ESTADO ??
        ""
    )
      .trim()
      .toLowerCase();

    console.log("ESTADO RECIBIDO:", estadoUsuario);

    if (!estadoUsuario) {
      throw new Error(
        "El usuario fue encontrado, pero no se recibió el campo ESTADO."
      );
    }

    if (estadoUsuario !== "activo") {
      throw new Error("Este usuario está inactivo.");
    }

    // =========================================================
    // NORMALIZAR ROL
    // =========================================================

    const rolUsuario = String(
      usuario.rol ??
        usuario.ROL ??
        ""
    )
      .trim()
      .toLowerCase();

    if (!rolUsuario) {
      throw new Error(
        "El usuario fue encontrado, pero no se recibió el campo ROL."
      );
    }

    // =========================================================
    // GUARDAR SESIÓN
    // =========================================================

    const usuarioSesion = {
      ...usuario,

      uid:
        usuario.uid ??
        usuario.UID ??
        uid,

      nombre:
        usuario.nombre ??
        usuario.NOMBRE ??
        "",

      correo:
        usuario.correo ??
        usuario.CORREO ??
        "",

      rol: rolUsuario,

      barberiaId:
        usuario.barberiaId ??
        usuario.ID_BARBERIA ??
        "",

      estado: estadoUsuario,
    };

    console.log(
      "USUARIO FINAL DE SESIÓN:",
      usuarioSesion
    );

    sessionStorage.setItem(
      "nexos_usuario",
      JSON.stringify(usuarioSesion)
    );

    return usuarioSesion;
  };

  // =========================================================
  // LOGIN CORREO + CONTRASEÑA
  // =========================================================

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    sessionStorage.removeItem("nexos_usuario");

    try {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      console.log(
        "FIREBASE UID:",
        credential.user.uid
      );

      const usuario =
        await cargarPerfilUsuario(
          credential.user.uid
        );

      console.log(
        "LOGIN CORRECTO:",
        usuario
      );

      // =====================================================
      // REDIRECCIÓN AL DASHBOARD REAL
      // =====================================================

      window.location.href = "/dashboard";

    } catch (err: any) {
      console.error(
        "ERROR LOGIN:",
        err
      );

      setError(
        err?.message ||
          "No se pudo iniciar sesión."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LOGIN CON GOOGLE
  // =========================================================

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");

    sessionStorage.removeItem("nexos_usuario");

    try {
      const provider =
        new GoogleAuthProvider();

      const credential =
        await signInWithPopup(
          auth,
          provider
        );

      console.log(
        "FIREBASE UID GOOGLE:",
        credential.user.uid
      );

      const usuario =
        await cargarPerfilUsuario(
          credential.user.uid
        );

      console.log(
        "LOGIN GOOGLE CORRECTO:",
        usuario
      );

      // =====================================================
      // REDIRECCIÓN AL DASHBOARD REAL
      // =====================================================

      window.location.href = "/dashboard";

    } catch (err: any) {
      console.error(
        "ERROR GOOGLE FIREBASE:",
        err
      );

      setError(
        err?.message ||
          "No se pudo iniciar sesión con Google."
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  // =========================================================
  // INTERFAZ
  // =========================================================

  return (
    <main className="login-page">

      <div className="background-grid" />

      <div className="glow glow-one" />

      <div className="glow glow-two" />

      <div className="particle particle-1" />
      <div className="particle particle-2" />
      <div className="particle particle-3" />
      <div className="particle particle-4" />

      <section className="login-wrapper">

        <div className="login-card">

          <div className="card-line" />

          <div className="brand">

            <span>
              NEXOS
            </span>

            <span className="brand-accent">
              {" "}BARBER
            </span>

          </div>

          <div className="brand-dot" />

          <h1>
            Bienvenido
          </h1>

          <p className="login-subtitle">
            Inicia sesión para continuar
          </p>

          <form onSubmit={handleLogin}>

            <div className="input-group">

              <label>
                Correo electrónico
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  ✉
                </span>

                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                />

              </div>

            </div>

            <div className="input-group">

              <label>
                Contraseña
              </label>

              <div className="input-wrapper">

                <span className="input-icon">
                  ●
                </span>

                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  required
                />

              </div>

            </div>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={
                loading ||
                googleLoading
              }
            >

              <span>
                {loading
                  ? "Ingresando..."
                  : "Iniciar sesión"}
              </span>

              {!loading && (
                <span className="button-arrow">
                  →
                </span>
              )}

            </button>

          </form>

          <div className="divider">

            <span>
              o continuar con
            </span>

          </div>

          <button
            className="google-button"
            type="button"
            onClick={handleGoogleLogin}
            disabled={
              loading ||
              googleLoading
            }
          >

            <span className="google-icon">
              G
            </span>

            <span>
              {googleLoading
                ? "Conectando..."
                : "Continuar con Google"}
            </span>

          </button>

          <p className="security-text">
            Acceso seguro para usuarios autorizados
          </p>

        </div>

      </section>

    </main>
  );
}