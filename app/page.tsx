"use client";

import { useEffect, useState } from "react";

interface Usuario {
  nombre: string;
  correo: string;
  rol: "super_admin" | "admin" | "barbero";
  barberiaId: string;
}

export default function HomePage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    const datos = sessionStorage.getItem("nexos_usuario");

    if (!datos) return;

    try {
      setUsuario(JSON.parse(datos));
    } catch (error) {
      console.error("Error leyendo usuario:", error);
    }
  }, []);

  const nombre = usuario?.nombre || "Usuario";

  const rolTexto =
    usuario?.rol === "super_admin"
      ? "Super Administrador"
      : usuario?.rol === "admin"
      ? "Administrador"
      : "Barbero";

  return (
    <div className="dashboard-page">

      {/* HEADER */}
      <header className="dashboard-header">

        <div>
          <p className="dashboard-eyebrow">
            NEXOS BARBER
          </p>

          <h1 className="dashboard-title">
            Bienvenido, {nombre}
          </h1>

          <p className="dashboard-subtitle">
            Aquí tienes un resumen de la actividad de tu barbería.
          </p>
        </div>

        <div className="dashboard-user-badge">

          <div className="dashboard-user-avatar">
            {nombre.charAt(0).toUpperCase()}
          </div>

          <div>
            <strong>{nombre}</strong>
            <span>{rolTexto}</span>
          </div>

        </div>

      </header>


      {/* INFORMACIÓN DE BARBERÍA */}
      <section className="dashboard-info">

        <div className="dashboard-info-item">
          <span>BARBERÍA</span>
          <strong>
            {usuario?.barberiaId || "—"}
          </strong>
        </div>

        <div className="dashboard-info-item">
          <span>ROL</span>
          <strong>
            {rolTexto}
          </strong>
        </div>

        <div className="dashboard-info-item">
          <span>ESTADO</span>

          <strong className="dashboard-status">
            <i />
            Activo
          </strong>
        </div>

      </section>


      {/* ESTADÍSTICAS */}
      <section className="dashboard-stats">

        <article className="dashboard-card">

          <div className="dashboard-card-top">
            <span className="dashboard-card-label">
              CLIENTES
            </span>

            <span className="dashboard-card-icon">
              ♙
            </span>
          </div>

          <strong className="dashboard-card-value">
            0
          </strong>

          <p className="dashboard-card-description">
            Clientes registrados
          </p>

        </article>


        <article className="dashboard-card">

          <div className="dashboard-card-top">
            <span className="dashboard-card-label">
              RESERVAS
            </span>

            <span className="dashboard-card-icon">
              ◷
            </span>
          </div>

          <strong className="dashboard-card-value">
            0
          </strong>

          <p className="dashboard-card-description">
            Reservas para hoy
          </p>

        </article>


        <article className="dashboard-card">

          <div className="dashboard-card-top">
            <span className="dashboard-card-label">
              INGRESOS
            </span>

            <span className="dashboard-card-icon">
              $
            </span>
          </div>

          <strong className="dashboard-card-value">
            Bs 0
          </strong>

          <p className="dashboard-card-description">
            Ingresos del día
          </p>

        </article>


        <article className="dashboard-card">

          <div className="dashboard-card-top">
            <span className="dashboard-card-label">
              BARBEROS
            </span>

            <span className="dashboard-card-icon">
              ✂
            </span>
          </div>

          <strong className="dashboard-card-value">
            0
          </strong>

          <p className="dashboard-card-description">
            Barberos activos
          </p>

        </article>

      </section>


      {/* CONTENIDO PRINCIPAL */}
      <section className="dashboard-grid">

        {/* RESERVAS */}
        <div className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>
              <span className="dashboard-panel-eyebrow">
                AGENDA
              </span>

              <h2>
                Reservas de hoy
              </h2>
            </div>

            <button className="dashboard-panel-action">
              Ver todas →
            </button>

          </div>

          <div className="dashboard-empty">

            <div className="dashboard-empty-icon">
              ◷
            </div>

            <h3>
              No hay reservas todavía
            </h3>

            <p>
              Las reservas de hoy aparecerán aquí.
            </p>

          </div>

        </div>


        {/* ACTIVIDAD */}
        <div className="dashboard-panel">

          <div className="dashboard-panel-header">

            <div>
              <span className="dashboard-panel-eyebrow">
                ACTIVIDAD
              </span>

              <h2>
                Actividad reciente
              </h2>
            </div>

          </div>

          <div className="dashboard-empty">

            <div className="dashboard-empty-icon">
              ◌
            </div>

            <h3>
              Sin actividad reciente
            </h3>

            <p>
              Las operaciones aparecerán aquí.
            </p>

          </div>

        </div>

      </section>

    </div>
  );
}