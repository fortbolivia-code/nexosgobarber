"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Periodo = "dia" | "semana" | "mes" | "3meses" | "6meses" | "anio";

interface Usuario {
  nombre?: string;
  nombreCompleto?: string;
  email?: string;
  rol?: string;
  ROL?: string;
  barberia?: string;
  barberiaId?: string;
  ID_BARBERIA?: string;
  id_barberia?: string;
  ID_USUARIO?: string;
  id_usuario?: string;
  ID_BARBERO?: string;
  id_barbero?: string;
  estado?: string;
  uid?: string;
  UID?: string;
  AUTH_UID?: string;
  authUid?: string;
  barberoId?: string;
}

interface Reserva {
  id: string;
  fecha: string;
  hora: string;
  cliente: string;
  barbero: string;
  idBarbero: string;
  estado: string;
}

interface DashboardData {
  ok: boolean;
  periodo: Periodo;
  nombreBarberia: string;
  resumen: {
    ingresos: number;
    reservas: number;
    clientes: number;
    clientesNuevos: number;
    barberos: number;
    barberosActivos: number;
    crecimientoIngresos: number;
    crecimientoReservas: number;
    crecimientoClientes: number;
    ingresosBrutos: number;
    gastos: number;
    comisiones: number;
    ingresosNetos: number;
  };
  ingresos: { nombre: string; valor: number }[];
  reservas: { nombre: string; valor: number }[];
  diasClientes: { nombre: string; valor: number; atenciones: number }[];
  horasAtencion: { nombre: string; valor: number }[];
  rendimientoBarberos: {
    nombre: string;
    porcentaje: number;
    ingresos: number;
    atenciones: number;
  }[];
  proximasReservas: Reserva[];
  actividades: {
    icono: string;
    titulo: string;
    descripcion: string;
    tiempo: string;
  }[];
}

const coloresPie = ["#00d9e8", "#53d6ad", "#334155"];

const etiquetasPeriodo: Record<Periodo, string> = {
  dia: "Hoy",
  semana: "Esta semana",
  mes: "Este mes",
  "3meses": "Últimos 3 meses",
  "6meses": "Últimos 6 meses",
  anio: "Este año",
};

function money(value: number) {
  return `Bs ${Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function trendClass(value: number) {
  return value >= 0 ? "dashboard-positive" : "dashboard-negative";
}

function initials(name: string) {
  return name.charAt(0).toUpperCase() || "N";
}

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [barberoSeleccionado, setBarberoSeleccionado] = useState("todos");
  const [barberosFiltro, setBarberosFiltro] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [datos, setDatos] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("nexos_usuario");
    if (!raw) {
      setError("No se encontró la sesión del usuario.");
      setLoading(false);
      return;
    }

    try {
      setUsuario(JSON.parse(raw));
    } catch (err) {
      console.error("Error leyendo usuario:", err);
      setError("No se pudo leer la sesión.");
      setLoading(false);
    }
  }, []);

  const idBarberia =
    usuario?.ID_BARBERIA ||
    usuario?.id_barberia ||
    usuario?.barberiaId ||
    "";

  const rol = String(
    usuario?.ROL || usuario?.rol || "admin"
  ).trim().toLowerCase();

  const idBarberoSesion =
    usuario?.ID_BARBERO ||
    usuario?.id_barbero ||
    usuario?.barberoId ||
    "";

  const uidSesion =
    usuario?.uid ||
    usuario?.UID ||
    usuario?.AUTH_UID ||
    usuario?.authUid ||
    "";

  useEffect(() => {
    if (!idBarberia) return;

    const cargarBarberos = async () => {
      try {
        const response = await fetch(
          `/dashboard/api?accion=barberos&idBarberia=${encodeURIComponent(idBarberia)}`,
          { cache: "no-store" }
        );
        const data = await response.json();
        if (response.ok && data.ok) {
          setBarberosFiltro(Array.isArray(data.barberos) ? data.barberos : []);
        }
      } catch (err) {
        console.error("Error cargando barberos:", err);
      }
    };

    cargarBarberos();
  }, [idBarberia]);

  const cargarDashboard = async () => {
    if (!idBarberia) return;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        idBarberia,
        rol,
        periodo,
        idBarbero:
          rol === "barbero"
            ? idBarberoSesion
            : barberoSeleccionado !== "todos"
            ? barberoSeleccionado
            : "",
        uid: rol === "barbero" ? uidSesion : "",
      });

      const response = await fetch(`/dashboard/api?${params.toString()}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo cargar el dashboard.");
      }

      setDatos(data);
    } catch (err) {
      console.error("ERROR DASHBOARD:", err);
      setError(err instanceof Error ? err.message : "Error cargando dashboard.");
      setDatos(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, [idBarberia, rol, idBarberoSesion, uidSesion, periodo, barberoSeleccionado]);

  const nombreUsuario =
    usuario?.nombreCompleto || usuario?.nombre || "Usuario";

  const nombreBarberia =
    datos?.nombreBarberia ||
    usuario?.barberia ||
    usuario?.barberiaId ||
    "BARBERÍA";

  const textoRol =
    rol === "super_admin"
      ? "Super administrador"
      : rol === "barbero"
      ? "Barbero"
      : "Administrador";

  const totalIngresos = datos?.resumen.ingresos || 0;
  const totalReservas = datos?.resumen.reservas || 0;
  const totalClientes = datos?.resumen.clientes || 0;
  const totalBarberos = datos?.resumen.barberos || 0;

  const reservasPie = useMemo(
    () => datos?.reservas || [],
    [datos]
  );

  return (
    <div className="dashboard-page">
      <style>{`
@media (max-width: 900px) { .dashboard-finance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
@media (max-width: 600px) { .dashboard-finance-grid { grid-template-columns: 1fr !important; } }
`}</style>
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <div className="dashboard-eyebrow">NEXOS BARBER</div>

          <h1 className="dashboard-title">
            Bienvenido, {nombreUsuario}
          </h1>

          <p className="dashboard-subtitle">
            Datos reales de {nombreBarberia} según la información registrada.
          </p>
        </div>

        <div className="dashboard-user-card">
          <div className="dashboard-user-avatar">
            {initials(nombreUsuario)}
          </div>

          <div className="dashboard-user-info">
            <strong>{nombreUsuario}</strong>
            <span>{textoRol}</span>
          </div>
        </div>
      </header>

      <section className="dashboard-filter-section">
        <div>
          <span className="dashboard-filter-label">PERÍODO</span>
          <p className="dashboard-filter-description">
            Visualizando {etiquetasPeriodo[periodo].toLowerCase()}
          </p>
        </div>

        <div className="dashboard-period-filter">
          <label htmlFor="barbero-filter">BARBERO</label>

          <select
            id="barbero-filter"
            className="dashboard-barbero-select"
            value={rol === "barbero" ? idBarberoSesion : barberoSeleccionado}
            onChange={(event) => setBarberoSeleccionado(event.target.value)}
            disabled={rol === "barbero"}
          >
            {rol !== "barbero" && <option value="todos">Todos los barberos</option>}
            {(rol === "barbero"
              ? barberosFiltro.filter((barbero) => barbero.id === idBarberoSesion)
              : barberosFiltro
            ).map((barbero) => (
              <option key={barbero.id} value={barbero.id}>
                {barbero.nombre}
              </option>
            ))}
          </select>

          {Object.entries(etiquetasPeriodo).map(([key, label]) => (
            <button
              key={key}
              className={periodo === key ? "active" : ""}
              onClick={() => setPeriodo(key as Periodo)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-info-grid">
        <div className="dashboard-info-card">
          <span>BARBERÍA</span>
          <strong>{nombreBarberia}</strong>
        </div>

        <div className="dashboard-info-card">
          <span>ROL</span>
          <strong>{textoRol}</strong>
        </div>

        <div className="dashboard-info-card dashboard-status-card">
          <span>ESTADO</span>
          <strong>
            <i />
            {usuario?.estado || "Activo"}
          </strong>
        </div>
      </section>

      {error && (
        <section className="dashboard-error">
          <strong>Error al cargar dashboard</strong>
          <p>{error}</p>
          <button onClick={cargarDashboard}>Reintentar</button>
        </section>
      )}

      {loading ? (
        <div className="dashboard-loading">Cargando datos reales...</div>
      ) : datos ? (
        <>
          <section className="dashboard-metrics">
            <div className="dashboard-metric-card">
              <div className="dashboard-metric-top">
                <span>INGRESOS</span>
                <div className="dashboard-metric-icon">$</div>
              </div>
              <strong>{money(totalIngresos)}</strong>
              <div className="dashboard-metric-bottom">
                <span className={trendClass(datos.resumen.crecimientoIngresos)}>
                  {formatPercent(datos.resumen.crecimientoIngresos)}
                </span>
                <small>vs. período anterior</small>
              </div>
            </div>

            <div className="dashboard-metric-card">
              <div className="dashboard-metric-top">
                <span>RESERVAS</span>
                <div className="dashboard-metric-icon">◷</div>
              </div>
              <strong>{totalReservas}</strong>
              <div className="dashboard-metric-bottom">
                <span className={trendClass(datos.resumen.crecimientoReservas)}>
                  {formatPercent(datos.resumen.crecimientoReservas)}
                </span>
                <small>vs. período anterior</small>
              </div>
            </div>

            <div className="dashboard-metric-card">
              <div className="dashboard-metric-top">
                <span>CLIENTES</span>
                <div className="dashboard-metric-icon">♙</div>
              </div>
              <strong>{totalClientes}</strong>
              <div className="dashboard-metric-bottom">
                <span className={trendClass(datos.resumen.crecimientoClientes)}>
                  {formatPercent(datos.resumen.crecimientoClientes)}
                </span>
                <small>{datos.resumen.clientesNuevos} nuevos en el período</small>
              </div>
            </div>

            <div className="dashboard-metric-card">
              <div className="dashboard-metric-top">
                <span>BARBEROS</span>
                <div className="dashboard-metric-icon">✂</div>
              </div>
              <strong>{totalBarberos}</strong>
              <div className="dashboard-metric-bottom">
                <span className="dashboard-active">
                  ● {datos.resumen.barberosActivos} activos
                </span>
                <small>equipo actual</small>
              </div>
            </div>
          </section>

          <section
            className="dashboard-finance-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <div className="dashboard-metric-card">
              <div className="dashboard-metric-top"><span>INGRESO BRUTO</span><div className="dashboard-metric-icon">$</div></div>
              <strong>{money(datos.resumen.ingresosBrutos)}</strong>
              <div className="dashboard-metric-bottom"><small>Total cobrado por atenciones</small></div>
            </div>
            <div className="dashboard-metric-card">
              <div className="dashboard-metric-top"><span>GASTOS</span><div className="dashboard-metric-icon">−</div></div>
              <strong>{money(datos.resumen.gastos)}</strong>
              <div className="dashboard-metric-bottom"><small>Gastos registrados</small></div>
            </div>
            <div className="dashboard-metric-card">
              <div className="dashboard-metric-top"><span>COMISIONES</span><div className="dashboard-metric-icon">%</div></div>
              <strong>{money(datos.resumen.comisiones)}</strong>
              <div className="dashboard-metric-bottom"><small>Comisiones de barberos</small></div>
            </div>
            <div className="dashboard-metric-card">
              <div className="dashboard-metric-top"><span>INGRESO NETO</span><div className="dashboard-metric-icon">↗</div></div>
              <strong>{money(datos.resumen.ingresosNetos)}</strong>
              <div className="dashboard-metric-bottom"><small>Bruto − gastos − comisiones</small></div>
            </div>
          </section>

          <section className="dashboard-charts-grid">
            <div className="dashboard-panel dashboard-income-panel">
              <div className="dashboard-panel-header">
                <div>
                  <span className="dashboard-panel-eyebrow">RENDIMIENTO</span>
                  <h2>Ingresos reales</h2>
                  <p>Evolución durante {etiquetasPeriodo[periodo].toLowerCase()}</p>
                </div>
                <div className="dashboard-panel-total">
                  <strong>{money(totalIngresos)}</strong>
                  <span>Total</span>
                </div>
              </div>

              <div className="dashboard-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={datos.ingresos}>
                    <defs>
                      <linearGradient
                        id="dashboardIncomeGradientReal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#00d9e8" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#00d9e8" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke="#17243a" vertical={false} />
                    <XAxis dataKey="nombre" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#0b1424",
                        border: "1px solid #20314a",
                        borderRadius: "12px",
                        color: "#fff",
                      }}
                      formatter={(value) => [money(Number(value)), "Ingresos"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#00d9e8"
                      strokeWidth={3}
                      fill="url(#dashboardIncomeGradientReal)"
                      activeDot={{
                        r: 6,
                        stroke: "#00d9e8",
                        strokeWidth: 3,
                        fill: "#06101d",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-panel dashboard-reservation-panel">
              <div className="dashboard-panel-header">
                <div>
                  <span className="dashboard-panel-eyebrow">RESERVAS</span>
                  <h2>Reservas del período</h2>
                  <p>Comparación entre reservas atendidas y programadas</p>
                </div>
                <div className="dashboard-panel-total">
                  <strong>{totalReservas}</strong>
                  <span>Reservas</span>
                </div>
              </div>

              <div className="dashboard-pie-wrapper">
                <div className="dashboard-pie-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reservasPie}
                        dataKey="valor"
                        nameKey="nombre"
                        cx="50%"
                        cy="50%"
                        innerRadius="62%"
                        outerRadius="82%"
                        paddingAngle={4}
                      >
                        {reservasPie.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={coloresPie[index % coloresPie.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#0b1424",
                          border: "1px solid #20314a",
                          borderRadius: "12px",
                          color: "#fff",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="dashboard-pie-center">
                    <strong>{totalReservas}</strong>
                    <span>Total</span>
                  </div>
                </div>

                <div className="dashboard-pie-legend">
                  {reservasPie.map((item, index) => (
                    <div className="dashboard-legend-item" key={item.nombre}>
                      <span>
                        <i
                          style={{
                            background:
                              coloresPie[index % coloresPie.length],
                          }}
                        />
                        {item.nombre}
                      </span>
                      <strong>{item.valor}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-lower-grid">
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <div>
                  <span className="dashboard-panel-eyebrow">EQUIPO</span>
                  <h2>Rendimiento de barberos</h2>
                  <p>Participación por cantidad de atenciones en el período</p>
                </div>
                <div className="dashboard-panel-total">
                  <strong>{datos.rendimientoBarberos.reduce((s, b) => s + b.atenciones, 0)}</strong>
                  <span>Atenciones</span>
                </div>
              </div>

              <div style={{ height: 300, position: "relative" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datos.rendimientoBarberos}
                      dataKey="atenciones"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="76%"
                      paddingAngle={3}
                    >
                      {datos.rendimientoBarberos.map((_, index) => (
                        <Cell
                          key={`barbero-pie-${index}`}
                          fill={coloresPie[index % coloresPie.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#0b1424",
                        border: "1px solid #20314a",
                        borderRadius: "12px",
                        color: "#fff",
                      }}
                      formatter={(value, _name, item) => {
                        const data = item?.payload as DashboardData["rendimientoBarberos"][number] | undefined;
                        return [
                          `${Number(value || 0)} atenciones · ${money(data?.ingresos || 0)}`,
                          data?.nombre || "Barbero",
                        ];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dashboard-pie-center">
                  <strong>{datos.rendimientoBarberos.reduce((s, b) => s + b.atenciones, 0)}</strong>
                  <span>Total</span>
                </div>
              </div>

              <div className="dashboard-pie-legend" style={{ marginTop: 8 }}>
                {datos.rendimientoBarberos.length === 0 ? (
                  <div className="dashboard-empty-state">No hay atenciones registradas en este período.</div>
                ) : (
                  datos.rendimientoBarberos.map((item, index) => (
                    <div className="dashboard-legend-item" key={item.nombre}>
                      <span>
                        <i style={{ background: coloresPie[index % coloresPie.length] }} />
                        {item.nombre}
                      </span>
                      <strong>{item.atenciones}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <div>
                  <span className="dashboard-panel-eyebrow">AGENDA</span>
                  <h2>Próximas reservas</h2>
                  <p>Reservas reales próximas a la fecha actual</p>
                </div>

                <button
                  className="dashboard-view-all"
                  onClick={() => (window.location.href = "/reservas")}
                >
                  Ver todas →
                </button>
              </div>

              <div className="dashboard-reservations-list">
                {datos.proximasReservas.length === 0 ? (
                  <div className="dashboard-empty-state">
                    No hay reservas próximas registradas.
                  </div>
                ) : (
                  datos.proximasReservas.map((reserva) => (
                    <div className="dashboard-reservation-row" key={reserva.id}>
                      <div className="dashboard-reservation-time">{reserva.hora}</div>
                      <div className="dashboard-reservation-main">
                        <strong>{reserva.cliente}</strong>
                        <span>{fechaLegible(reserva.fecha)} · {reserva.barbero}</span>
                      </div>
                      <div className="dashboard-reservation-status confirmed">{reserva.estado}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="dashboard-charts-grid" style={{ marginTop: 18 }}>
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <div>
                  <span className="dashboard-panel-eyebrow">CLIENTES</span>
                  <h2>Atenciones por día</h2>
                  <p>Clientes atendidos según el día de la semana</p>
                </div>
              </div>
              <div className="dashboard-chart" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={datos.diasClientes}
                    margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid stroke="#17243a" vertical={false} />
                    <XAxis
                      dataKey="nombre"
                      stroke="#64748b"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#8da0b8", fontSize: 13, fontWeight: 600 }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(0,217,232,0.06)" }}
                      contentStyle={{
                        background: "#0b1424",
                        border: "1px solid #20314a",
                        borderRadius: "12px",
                        color: "#fff",
                      }}
                      formatter={(value) => [
                        `${Number(value || 0)} atenciones`,
                        "Clientes atendidos",
                      ]}
                    />
                    <Bar
                      dataKey="atenciones"
                      fill="#00d9e8"
                      radius={[7, 7, 0, 0]}
                      maxBarSize={54}
                    >
                      <LabelList
                        dataKey="atenciones"
                        position="top"
                        fill="#dce8f2"
                        fontSize={13}
                        fontWeight={700}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <div>
                  <span className="dashboard-panel-eyebrow">HORARIOS</span>
                  <h2>Horas con más atención</h2>
                  <p>Horarios donde más servicios se realizaron</p>
                </div>
              </div>
              <div className="dashboard-chart" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={datos.horasAtencion}>
                    <CartesianGrid stroke="#17243a" vertical={false} />
                    <XAxis dataKey="nombre" stroke="#64748b" tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#0b1424", border: "1px solid #20314a", borderRadius: "12px", color: "#fff" }}
                      formatter={(value) => [Number(value || 0), "Atenciones"]}
                    />
                    <Area type="monotone" dataKey="valor" stroke="#00d9e8" strokeWidth={3} fill="rgba(0,217,232,0.12)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
          <section className="dashboard-panel dashboard-activity-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="dashboard-panel-eyebrow">ACTIVIDAD</span>
                <h2>Actividad reciente</h2>
                <p>Movimientos reales registrados en el sistema</p>
              </div>
            </div>

            <div className="dashboard-activity-list">
              {datos.actividades.length === 0 ? (
                <div className="dashboard-empty-state">
                  No hay actividad registrada todavía.
                </div>
              ) : (
                datos.actividades.map((actividad, index) => (
                  <div
                    className="dashboard-activity-item"
                    key={`${actividad.titulo}-${actividad.tiempo}-${index}`}
                  >
                    <div className="dashboard-activity-icon">{actividad.icono}</div>
                    <div className="dashboard-activity-content">
                      <strong>{actividad.titulo}</strong>
                      <span>{actividad.descripcion}</span>
                    </div>
                    <time>{actividad.tiempo}</time>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function fechaLegible(value: string) {
  const [y, m, d] = String(value || "").split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
  });
}
