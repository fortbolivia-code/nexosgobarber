"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useState } from "react";

type UserRole = "super_admin" | "admin" | "barbero";

interface SidebarProps {
  role: UserRole;
}

export default function Sidebar({ role }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);

  // =========================================================
  // MENÚ SEGÚN ROL
  // =========================================================

  const menus = {
    super_admin: [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: "⌂",
      },
      {
        name: "Barberías",
        path: "/barberias",
        icon: "▦",
      },
      {
        name: "Clientes",
        path: "/clientes",
        icon: "♙",
      },
      {
        name: "Barberos",
        path: "/barberos",
        icon: "✂",
      },
      {
        name: "Reservas",
        path: "/reservas",
        icon: "◷",
      },
      {
        name: "Facturación",
        path: "/facturacion",
        icon: "$",
      },
      {
        name: "Atención / Pagos",
        path: "/atencion-pagos",
        icon: "▥",
      },
    ],

    admin: [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: "⌂",
      },
      {
        name: "Clientes",
        path: "/clientes",
        icon: "♙",
      },
      {
        name: "Barberos",
        path: "/barberos",
        icon: "✂",
      },
      {
        name: "Reservas",
        path: "/reservas",
        icon: "◷",
      },
      {
        name: "Facturación",
        path: "/facturacion",
        icon: "$",
      },
      {
        name: "Atención / Pagos",
        path: "/atencion-pagos",
        icon: "▥",
      },
    ],

    barbero: [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: "⌂",
      },
      {
        name: "Mis clientes",
        path: "/clientes",
        icon: "♙",
      },
      {
        name: "Mis reservas",
        path: "/reservas",
        icon: "◷",
      },
      {
        name: "Atención / Pagos",
        path: "/atencion-pagos",
        icon: "▥",
      },
    ],
  };

  const menu = menus[role];

  // =========================================================
  // NAVEGACIÓN
  // =========================================================

  const navigate = (path: string) => {
    setMobileOpen(false);
    router.push(path);
  };

  // =========================================================
  // CERRAR SESIÓN
  // =========================================================

  const handleLogout = async () => {
    setMobileOpen(false);

    await signOut(auth);

    sessionStorage.removeItem("nexos_usuario");

    router.replace("/login");
  };

  // =========================================================
  // INTERFAZ
  // =========================================================

  return (
    <>
      {/* =====================================================
          BOTÓN HAMBURGUESA - SOLO MÓVIL
      ===================================================== */}

      <button
        className="mobile-menu-button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {/* =====================================================
          OVERLAY MÓVIL
      ===================================================== */}

      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`sidebar ${
          mobileOpen ? "mobile-open" : ""
        }`}
      >
        {/* ===================================================
            BOTÓN CERRAR MÓVIL
        =================================================== */}

        <button
          className="mobile-close-button"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          ×
        </button>

        {/* ===================================================
            LOGO
        =================================================== */}

        <div className="sidebar-brand">
          <span>NEXOS</span>
          <span className="brand-accent">
            {" "}BARBER
          </span>
        </div>

        {/* ===================================================
            ESTADO DEL SISTEMA
        =================================================== */}

        <div className="sidebar-status">
          <span className="status-dot" />
          Sistema activo
        </div>

        <div className="sidebar-divider" />

        {/* ===================================================
            MENÚ PRINCIPAL
        =================================================== */}

        <nav className="sidebar-nav">

          <p className="sidebar-section-title">
            MENÚ PRINCIPAL
          </p>

          {menu.map((item) => {

            const active =
              pathname === item.path ||
              pathname.startsWith(
                `${item.path}/`
              );

            return (
              <button
                key={item.path}
                className={`nav-item ${
                  active ? "active" : ""
                }`}
                onClick={() =>
                  navigate(item.path)
                }
              >
                <span className="nav-icon">
                  {item.icon}
                </span>

                <span className="nav-label">
                  {item.name}
                </span>

                {active && (
                  <span className="nav-active-line" />
                )}
              </button>
            );
          })}

        </nav>

        {/* ===================================================
            PARTE INFERIOR
        =================================================== */}

        <div className="sidebar-bottom">

          {/* =================================================
              CONFIGURACIÓN

              SOLO:
              - super_admin
              - admin
          ================================================= */}

          {(role === "super_admin" ||
            role === "admin") && (
            <button
              className={`nav-item ${
                pathname === "/configuracion"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                navigate("/configuracion")
              }
            >
              <span className="nav-icon">
                ⚙
              </span>

              <span className="nav-label">
                Configuración
              </span>
            </button>
          )}

          {/* =================================================
              CERRAR SESIÓN
          ================================================= */}

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            <span className="nav-icon">
              ↪
            </span>

            <span>
              Cerrar sesión
            </span>
          </button>

        </div>
      </aside>
    </>
  );
}