"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

type UserRole = "super_admin" | "admin" | "barbero";

interface Usuario {
  rol: UserRole;
  nombre?: string;
  nombreCompleto?: string;
  barberiaId?: string;
  barberiaNombre?: string;
  email?: string;
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // LOGIN NO USA SIDEBAR
    if (pathname === "/login") {
      setCargando(false);
      return;
    }

    const cargarUsuario = () => {
      const datos = sessionStorage.getItem("nexos_usuario");

      if (!datos) {
        setUsuario(null);
        setCargando(false);

        // Si no hay sesión, volver al login
        router.replace("/login");
        return;
      }

      try {
        const usuarioGuardado = JSON.parse(datos);

        const rolValido =
          usuarioGuardado?.rol === "super_admin" ||
          usuarioGuardado?.rol === "admin" ||
          usuarioGuardado?.rol === "barbero";

        if (!rolValido) {
          sessionStorage.removeItem("nexos_usuario");
          setUsuario(null);
          setCargando(false);
          router.replace("/login");
          return;
        }

        setUsuario({
          rol: usuarioGuardado.rol,
          nombre: usuarioGuardado.nombre || "",
          nombreCompleto:
            usuarioGuardado.nombreCompleto ||
            usuarioGuardado.nombre ||
            "",
          barberiaId: usuarioGuardado.barberiaId || "",
          barberiaNombre:
            usuarioGuardado.barberiaNombre ||
            usuarioGuardado.barberia ||
            "",
          email: usuarioGuardado.email || "",
        });

        setCargando(false);
      } catch (error) {
        console.error(
          "Error leyendo sesión del usuario:",
          error
        );

        sessionStorage.removeItem("nexos_usuario");
        setUsuario(null);
        setCargando(false);
        router.replace("/login");
      }
    };

    cargarUsuario();
  }, [pathname, router]);

  // Cerrar menú móvil al cambiar de página
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // LOGIN
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Cargando sesión
  if (cargando) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020914",
          color: "#ffffff",
        }}
      >
        Cargando...
      </div>
    );
  }

  // Sin sesión
  if (!usuario) {
    return null;
  }

  return (
    <div className="app-shell">

      {/* BOTÓN MENÚ MÓVIL */}
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Abrir menú"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* SIDEBAR */}
      <Sidebar
        role={usuario.rol}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* CONTENIDO */}
      <main className="app-content">
        {children}
      </main>

    </div>
  );
}