"use client";

import { useEffect, useMemo, useState } from "react";

type Periodo =
  | "hoy"
  | "semana"
  | "mes"
  | "3meses"
  | "6meses"
  | "anio";

type Resumen = {
  ingresos: number;
  gastos: number;
  comisiones: number;
  gananciaNeta: number;
  atenciones: number;
  clientesNuevos: number;
  clientesRecurrentes: number;
  ticketPromedio: number;
  crecimientoIngresos: number;
  crecimientoAtenciones: number;
};

type Barbero = {
  id: string;
  nombre: string;
  ingresos: number;
  clientes: number;
  cortes: number;
  comisiones: number;
  fechaIngreso: string;
};

type Transaccion = {
  id: string;
  cliente: string;
  fecha: string;
  servicio: string;
  barbero: string;
  metodoPago: string;
  total: number;
};

type MetodoPago = {
  nombre: string;
  cantidad: number;
  monto: number;
  porcentaje: number;
};

type BarberoGrafico = {
  nombre: string;
  cantidad: number;
  porcentaje: number;
};

type Gasto = {
  id: string;
  nombre: string;
  monto: number;
  moneda: string;
  fecha: string;
  descripcion: string;
};

type FacturacionData = {
  resumen: Resumen;
  barberos: Barbero[];
  transacciones: Transaccion[];
  metodosPago: MetodoPago[];
  barberosGrafico: BarberoGrafico[];
  gastos: Gasto[];
};

const RESUMEN_VACIO: Resumen = {
  ingresos: 0,
  gastos: 0,
  comisiones: 0,
  gananciaNeta: 0,
  atenciones: 0,
  clientesNuevos: 0,
  clientesRecurrentes: 0,
  ticketPromedio: 0,
  crecimientoIngresos: 0,
  crecimientoAtenciones: 0,
};

const DATOS_VACIOS: FacturacionData = {
  resumen: RESUMEN_VACIO,
  barberos: [],
  transacciones: [],
  metodosPago: [],
  barberosGrafico: [],
  gastos: [],
};

const PERIODOS: {
  id: Periodo;
  label: string;
}[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Esta semana" },
  { id: "mes", label: "Este mes" },
  { id: "3meses", label: "Últimos 3 meses" },
  { id: "6meses", label: "Últimos 6 meses" },
  { id: "anio", label: "Este año" },
];

function dinero(valor: number) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  }).format(Number(valor || 0));
}

function numero(valor: number) {
  return new Intl.NumberFormat("es-BO").format(
    Number(valor || 0)
  );
}

function porcentaje(valor: number) {
  const n = Number(valor || 0);

  if (n === 0) return "0.0%";

  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fechaCorta(fecha: string) {
  if (!fecha) return "—";

  const d = new Date(fecha);

  if (Number.isNaN(d.getTime())) {
    return fecha;
  }

  return d.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function crearGradienteDonut(
  metodos: MetodoPago[]
) {
  if (!metodos.length) {
    return "conic-gradient(#152b3a 0deg 360deg)";
  }

  const colores = [
    "#08c4df",
    "#1685a4",
    "#315b72",
    "#607989",
    "#8fa6b4",
    "#3ab7c8",
  ];

  let acumulado = 0;

  const partes = metodos.map(
    (item, index) => {
      const porcentajeItem = Number(
        item.porcentaje || 0
      );

      const inicio = acumulado;

      acumulado += porcentajeItem;

      const fin = acumulado;

      return `${
        colores[index % colores.length]
      } ${inicio}% ${fin}%`;
    }
  );

  return `conic-gradient(${partes.join(", ")})`;
}

export default function FacturacionPage() {
  const [periodo, setPeriodo] =
    useState<Periodo>("mes");

  const [data, setData] =
    useState<FacturacionData>(
      DATOS_VACIOS
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [barberiaId, setBarberiaId] =
    useState("");

  const [usuarioId, setUsuarioId] =
    useState("");

  const [barberoId, setBarberoId] =
    useState("");

  const [esAdmin, setEsAdmin] =
    useState(false);

  const [modalGasto, setModalGasto] =
    useState(false);

  const [guardandoGasto, setGuardandoGasto] =
    useState(false);

  const [gastoForm, setGastoForm] =
    useState({
      nombre: "",
      monto: "",
      moneda: "BOB",
      fecha: new Date()
        .toISOString()
        .slice(0, 10),
      descripcion: "",
    });

  /*
   * =====================================================
   * CARGAR USUARIO
   * =====================================================
   */

  useEffect(() => {
    try {
      const datos =
        sessionStorage.getItem(
          "nexos_usuario"
        );

      if (!datos) {
        setError(
          "No se encontró la sesión del usuario."
        );
        setLoading(false);
        return;
      }

      const usuario = JSON.parse(datos);

      const idBarberia =
        usuario?.ID_BARBERIA ||
        usuario?.id_barberia ||
        usuario?.barberiaId ||
        "";

      const idUsuario =
        usuario?.ID_USUARIO ||
        usuario?.id_usuario ||
        usuario?.usuarioId ||
        "";

      const idBarbero =
        usuario?.ID_BARBERO ||
        usuario?.id_barbero ||
        usuario?.barberoId ||
        "";

      const rol = String(
        usuario?.ROL ||
          usuario?.rol ||
          ""
      ).toLowerCase();

      setBarberiaId(idBarberia);
      setUsuarioId(idUsuario);
      setBarberoId(idBarbero);

      setEsAdmin(
        rol === "admin" ||
        rol === "super_admin"
      );
    } catch (err) {
      console.error(
        "Error leyendo nexos_usuario:",
        err
      );

      setError(
        "No se pudo identificar al usuario."
      );

      setLoading(false);
    }
  }, []);

  /*
   * =====================================================
   * CARGAR DATOS
   * =====================================================
   */

  const cargarDatos = async (
    periodoActual = periodo
  ) => {
    if (!barberiaId) return;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      params.set(
        "periodo",
        periodoActual
      );

      params.set(
        "idBarberia",
        barberiaId
      );

      params.set(
        "rol",
        esAdmin ? "admin" : "barbero"
      );

      if (!esAdmin && barberoId) {
        params.set(
          "idBarbero",
          barberoId
        );
      }

      const response = await fetch(
        `/facturacion/api?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      const texto =
        await response.text();

      if (!response.ok) {
        throw new Error(
          `La API respondió ${response.status}. ${
            texto.slice(0, 180) ||
            "Error desconocido"
          }`
        );
      }

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        throw new Error(
          `La API no devolvió JSON. ${
            texto.slice(0, 180)
          }`
        );
      }

      const resultado =
        JSON.parse(texto);

      if (!resultado.ok) {
        throw new Error(
          resultado.error ||
            "No se pudieron cargar los datos."
        );
      }

      setData({
        ...DATOS_VACIOS,

        resumen: {
          ...RESUMEN_VACIO,
          ...(resultado.resumen || {}),
        },

        barberos:
          Array.isArray(
            resultado.barberos
          )
            ? resultado.barberos
            : [],

        transacciones:
          Array.isArray(
            resultado.transacciones
          )
            ? resultado.transacciones
            : [],

        metodosPago:
          Array.isArray(
            resultado.metodosPago
          )
            ? resultado.metodosPago
            : [],

        barberosGrafico:
          Array.isArray(
            resultado.barberosGrafico
          )
            ? resultado.barberosGrafico
            : [],

        gastos:
          Array.isArray(
            resultado.gastos
          )
            ? resultado.gastos
            : [],
      });
    } catch (err) {
      console.error(
        "ERROR FACTURACION:",
        err
      );

      setData(DATOS_VACIOS);

      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los datos."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!barberiaId) return;

    cargarDatos(periodo);
  }, [
    periodo,
    barberiaId,
    esAdmin,
    barberoId,
  ]);

  /*
   * =====================================================
   * GASTOS
   * =====================================================
   */

  const abrirModalGasto = () => {
    setGastoForm({
      nombre: "",
      monto: "",
      moneda: "BOB",
      fecha: new Date()
        .toISOString()
        .slice(0, 10),
      descripcion: "",
    });

    setModalGasto(true);
  };

  const guardarGasto = async () => {
    if (!gastoForm.nombre.trim()) {
      alert(
        "Ingresa el nombre del gasto."
      );
      return;
    }

    const monto =
      Number(gastoForm.monto);

    if (!monto || monto <= 0) {
      alert(
        "Ingresa un monto válido."
      );
      return;
    }

    if (!barberiaId) {
      alert(
        "No se pudo identificar la barbería."
      );
      return;
    }

    try {
      setGuardandoGasto(true);

      const response = await fetch(
        "/facturacion/api",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            accion: "agregar_gasto",

            idBarberia:
              barberiaId,

            idUsuario:
              usuarioId,

            rol:
              esAdmin ? "admin" : "barbero",

            nombre:
              gastoForm.nombre.trim(),

            monto,

            moneda: "BOB",

            fecha:
              gastoForm.fecha,

            descripcion:
              gastoForm.descripcion.trim(),
          }),
        }
      );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      const texto =
        await response.text();

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        throw new Error(
          "La API de gastos no devolvió JSON."
        );
      }

      const resultado =
        JSON.parse(texto);

      if (
        !response.ok ||
        !resultado.ok
      ) {
        throw new Error(
          resultado.error ||
            "No se pudo registrar el gasto."
        );
      }

      setGastoForm({
        nombre: "",
        monto: "",
        moneda: "BOB",
        fecha: new Date()
          .toISOString()
          .slice(0, 10),
        descripcion: "",
      });

      setModalGasto(false);

      await cargarDatos(periodo);
    } catch (err) {
      console.error(
        "Error al guardar gasto:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "No se pudo registrar el gasto."
      );
    } finally {
      setGuardandoGasto(false);
    }
  };

  /*
   * =====================================================
   * DATOS PARA GRÁFICOS
   * =====================================================
   */

  const totalMetodos = useMemo(() => {
    return data.metodosPago.reduce(
      (total, item) =>
        total +
        Number(item.monto || 0),
      0
    );
  }, [data.metodosPago]);

  const maxBarbero = useMemo(() => {
    return Math.max(
      1,
      ...data.barberosGrafico.map(
        (item) =>
          Number(
            item.cantidad || 0
          )
      )
    );
  }, [data.barberosGrafico]);

  const resumen = data.resumen;

  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <main className="facturacion-page">

      {/* HEADER */}

      <header className="facturacion-header">
        <div>
          <span className="facturacion-eyebrow">
            FACTURACIÓN
          </span>

          <h1>
            Facturación
          </h1>

          <p>
            Analiza los ingresos,
            gastos y rendimiento
            de tu barbería.
          </p>
        </div>

        <div className="facturacion-header-actions">

          <button
            type="button"
            className="facturacion-btn facturacion-btn-secondary"
            onClick={() =>
              cargarDatos(periodo)
            }
            disabled={loading}
          >
            {loading
              ? "Actualizando..."
              : "Actualizar"}
          </button>

          {esAdmin && (
            <button
              type="button"
              className="facturacion-btn facturacion-btn-primary"
              onClick={
                abrirModalGasto
              }
            >
              + Agregar gasto
            </button>
          )}
        </div>
      </header>

      {/* PERIODOS */}

      <section className="facturacion-periodos">

        <div>
          <span className="section-label">
            PERÍODO
          </span>

          <div className="periodos-buttons">
            {PERIODOS.map(
              (item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`periodo-btn ${
                    periodo === item.id
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setPeriodo(
                      item.id
                    )
                  }
                >
                  {item.label}
                </button>
              )
            )}
          </div>
        </div>

        <div className="facturacion-fecha">
          <span className="section-label">
            PERÍODO ACTUAL
          </span>

          <strong>
            {
              PERIODOS.find(
                (item) =>
                  item.id ===
                  periodo
              )?.label
            }
          </strong>
        </div>

      </section>

      {/* ERROR */}

      {error && (
        <section className="facturacion-error">

          <div>
            <strong>
              No se pudieron cargar
              los datos
            </strong>

            <p>{error}</p>
          </div>

          <button
            type="button"
            className="facturacion-btn facturacion-btn-secondary"
            onClick={() =>
              cargarDatos(periodo)
            }
          >
            Intentar nuevamente
          </button>

        </section>
      )}

      {/* LOADING */}

      {loading && !error && (
        <div className="facturacion-loading">
          <div className="loading-spinner" />
          <span>
            Cargando información...
          </span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* =================================================
              RESUMEN ADMIN
          ================================================= */}

          {esAdmin && (
            <section className="facturacion-summary-grid">

              <article className="facturacion-card income">
                <span>
                  INGRESOS
                </span>

                <strong>
                  {dinero(
                    resumen.ingresos
                  )}
                </strong>

                <small
                  className={
                    resumen.crecimientoIngresos >=
                    0
                      ? "positive"
                      : "negative"
                  }
                >
                  {porcentaje(
                    resumen.crecimientoIngresos
                  )}
                  {" "}vs período anterior
                </small>
              </article>

              <article className="facturacion-card expense">
                <span>
                  GASTOS
                </span>

                <strong>
                  {dinero(
                    resumen.gastos
                  )}
                </strong>

                <small>
                  Gastos de administración
                </small>
              </article>

              <article className="facturacion-card commission">
                <span>
                  COMISIONES
                </span>

                <strong>
                  {dinero(
                    resumen.comisiones
                  )}
                </strong>

                <small>
                  Comisiones generadas
                </small>
              </article>

              <article className="facturacion-card profit">
                <span>
                  GANANCIA NETA
                </span>

                <strong>
                  {dinero(
                    resumen.gananciaNeta
                  )}
                </strong>

                <small>
                  Ingresos − gastos − comisiones
                </small>
              </article>

            </section>
          )}

          {/* =================================================
              INDICADORES
          ================================================= */}

          <section className="facturacion-metrics-grid">

            <article className="metric-card">
              <div className="metric-icon">
                Bs
              </div>

              <div>
                <span>
                  TICKET PROMEDIO
                </span>

                <strong>
                  {dinero(
                    resumen.ticketPromedio
                  )}
                </strong>
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-icon">
                N
              </div>

              <div>
                <span>
                  CLIENTES NUEVOS
                </span>

                <strong>
                  {numero(
                    resumen.clientesNuevos
                  )}
                </strong>

                <small>
                  Primera visita histórica
                </small>
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-icon">
                R
              </div>

              <div>
                <span>
                  CLIENTES RECURRENTES
                </span>

                <strong>
                  {numero(
                    resumen.clientesRecurrentes
                  )}
                </strong>

                <small>
                  Ya habían visitado antes
                </small>
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-icon">
                ✂
              </div>

              <div>
                <span>
                  ATENCIONES
                </span>

                <strong>
                  {numero(
                    resumen.atenciones
                  )}
                </strong>

                <small
                  className={
                    resumen.crecimientoAtenciones >=
                    0
                      ? "positive"
                      : "negative"
                  }
                >
                  {porcentaje(
                    resumen.crecimientoAtenciones
                  )}
                  {" "}vs anterior
                </small>
              </div>
            </article>

          </section>

          {/* =================================================
              ANÁLISIS
          ================================================= */}

          <section className="facturacion-section">

            <div className="section-heading">

              <div>
                <span className="section-label">
                  ANÁLISIS
                </span>

                <h2>
                  Ingresos del período
                </h2>

                <p>
                  Resumen económico
                  según el período
                  seleccionado.
                </p>
              </div>

              <div className="section-total">
                <span>
                  TOTAL
                </span>

                <strong>
                  {dinero(
                    resumen.ingresos
                  )}
                </strong>
              </div>

            </div>

            <div className="period-analysis">

              <div className="analysis-item">
                <span>
                  Ingresos
                </span>

                <strong>
                  {dinero(
                    resumen.ingresos
                  )}
                </strong>
              </div>

              <div className="analysis-item">
                <span>
                  Atenciones
                </span>

                <strong>
                  {numero(
                    resumen.atenciones
                  )}
                </strong>
              </div>

              <div className="analysis-item">
                <span>
                  Ticket promedio
                </span>

                <strong>
                  {dinero(
                    resumen.ticketPromedio
                  )}
                </strong>
              </div>

              <div className="analysis-item">
                <span>
                  Comparación
                </span>

                <strong
                  className={
                    resumen.crecimientoIngresos >=
                    0
                      ? "positive"
                      : "negative"
                  }
                >
                  {porcentaje(
                    resumen.crecimientoIngresos
                  )}
                </strong>
              </div>

            </div>

          </section>

          {/* =================================================
              GRÁFICOS
          ================================================= */}

          <section className="facturacion-charts-grid">

            {/* MÉTODOS DE PAGO */}

            <article className="chart-card">

              <div className="section-heading compact">
                <div>
                  <span className="section-label">
                    PAGOS
                  </span>

                  <h2>
                    Método de pago más usado
                  </h2>

                  <p>
                    Distribución de pagos
                    del período.
                  </p>
                </div>
              </div>

              {data.metodosPago.length ===
              0 ? (
                <div className="empty-chart">
                  <span>
                    ◎
                  </span>

                  <p>
                    No hay pagos
                    registrados.
                  </p>
                </div>
              ) : (
                <div className="donut-layout">

                  <div
                    className="donut-chart"
                    style={{
                      background:
                        crearGradienteDonut(
                          data.metodosPago
                        ),
                    }}
                  >
                    <div className="donut-center">
                      <strong>
                        {dinero(
                          totalMetodos
                        )}
                      </strong>

                      <span>
                        Total
                      </span>
                    </div>
                  </div>

                  <div className="chart-legend">

                    {data.metodosPago.map(
                      (item) => (
                        <div
                          className="legend-row"
                          key={
                            item.nombre
                          }
                        >
                          <div>
                            <span className="legend-dot" />

                            <span>
                              {
                                item.nombre
                              }
                            </span>
                          </div>

                          <strong>
                            {Number(
                              item.porcentaje ||
                                0
                            ).toFixed(0)}
                            %
                          </strong>
                        </div>
                      )
                    )}

                  </div>

                </div>
              )}

            </article>

            {/* BARBEROS */}

            <article className="chart-card">

              <div className="section-heading compact">

                <div>
                  <span className="section-label">
                    RENDIMIENTO
                  </span>

                  <h2>
                    Cortes por barbero
                  </h2>

                  <p>
                    Quién realizó más
                    atenciones.
                  </p>
                </div>

              </div>

              {data.barberosGrafico.length ===
              0 ? (
                <div className="empty-chart">
                  <span>
                    ✂
                  </span>

                  <p>
                    No hay atenciones.
                  </p>
                </div>
              ) : (
                <div className="bar-chart">

                  {data.barberosGrafico.map(
                    (item) => (
                      <div
                        className="bar-chart-row"
                        key={
                          item.nombre
                        }
                      >
                        <div className="bar-chart-info">
                          <span>
                            {item.nombre}
                          </span>

                          <strong>
                            {
                              item.cantidad
                            }
                          </strong>
                        </div>

                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${
                                (Number(
                                  item.cantidad ||
                                    0
                                ) /
                                  maxBarbero) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  )}

                </div>
              )}

            </article>

          </section>

          {/* =================================================
              TABLA BARBEROS
          ================================================= */}

          <section className="facturacion-section">

            <div className="section-heading">

              <div>
                <span className="section-label">
                  RENDIMIENTO
                </span>

                <h2>
                  Ingresos por barbero
                </h2>

                <p>
                  Rendimiento durante
                  el período seleccionado.
                </p>
              </div>

            </div>

            <div className="facturacion-table-wrapper">

              <table className="facturacion-table">

                <thead>
                  <tr>
                    <th>
                      BARBERO
                    </th>

                    <th>
                      INGRESO TOTAL
                    </th>

                    <th>
                      CLIENTES ATENDIDOS
                    </th>

                    <th>
                      CORTES
                    </th>

                    <th>
                      COMISIONES
                    </th>

                    <th>
                      FECHA DE INGRESO
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {data.barberos.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="table-empty"
                      >
                        No hay barberos
                        registrados.
                      </td>
                    </tr>
                  ) : (
                    data.barberos.map(
                      (barbero) => (
                        <tr
                          key={
                            barbero.id
                          }
                        >
                          <td>
                            <div className="barbero-cell">

                              <div className="avatar-small">
                                {barbero.nombre
                                  ?.charAt(
                                    0
                                  )
                                  ?.toUpperCase() ||
                                  "B"}
                              </div>

                              <strong>
                                {
                                  barbero.nombre
                                }
                              </strong>

                            </div>
                          </td>

                          <td>
                            {dinero(
                              barbero.ingresos
                            )}
                          </td>

                          <td>
                            {numero(
                              barbero.clientes
                            )}
                          </td>

                          <td>
                            {numero(
                              barbero.cortes
                            )}
                          </td>

                          <td className="negative">
                            {dinero(
                              barbero.comisiones
                            )}
                          </td>

                          <td>
                            {fechaCorta(
                              barbero.fechaIngreso
                            )}
                          </td>

                        </tr>
                      )
                    )
                  )}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              TRANSACCIONES
          ================================================= */}

          <section className="facturacion-section">

            <div className="section-heading">

              <div>
                <span className="section-label">
                  MOVIMIENTOS
                </span>

                <h2>
                  Transacciones recientes
                </h2>

                <p>
                  Últimos 10 movimientos
                  económicos.
                </p>
              </div>

              <span className="limit-badge">
                MÁXIMO 10
              </span>

            </div>

            <div className="facturacion-table-wrapper">

              <table className="facturacion-table">

                <thead>
                  <tr>
                    <th>
                      CLIENTE
                    </th>

                    <th>
                      FECHA
                    </th>

                    <th>
                      SERVICIO
                    </th>

                    <th>
                      BARBERO
                    </th>

                    <th>
                      MÉTODO DE PAGO
                    </th>

                    <th>
                      TOTAL PAGADO
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {data.transacciones.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="table-empty"
                      >
                        No hay transacciones.
                      </td>
                    </tr>
                  ) : (
                    data.transacciones
                      .slice(0, 10)
                      .map((tx) => (
                        <tr
                          key={tx.id}
                        >
                          <td>
                            <strong>
                              {
                                tx.cliente
                              }
                            </strong>
                          </td>

                          <td>
                            {fechaCorta(
                              tx.fecha
                            )}
                          </td>

                          <td>
                            {
                              tx.servicio
                            }
                          </td>

                          <td>
                            {
                              tx.barbero
                            }
                          </td>

                          <td>
                            <span className="payment-badge">
                              {
                                tx.metodoPago
                              }
                            </span>
                          </td>

                          <td>
                            <strong>
                              {dinero(
                                tx.total
                              )}
                            </strong>
                          </td>
                        </tr>
                      ))
                  )}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              GASTOS SOLO ADMIN
          ================================================= */}

          {esAdmin && (
            <section className="facturacion-section">

              <div className="section-heading">

                <div>
                  <span className="section-label">
                    ADMINISTRACIÓN
                  </span>

                  <h2>
                    Gastos registrados
                  </h2>

                  <p>
                    Gastos ingresados por
                    administración.
                  </p>
                </div>

                <button
                  type="button"
                  className="facturacion-btn facturacion-btn-primary"
                  onClick={
                    abrirModalGasto
                  }
                >
                  + Agregar gasto
                </button>

              </div>

              <div className="facturacion-table-wrapper">

                <table className="facturacion-table">

                  <thead>
                    <tr>
                      <th>
                        NOMBRE
                      </th>

                      <th>
                        MONTO
                      </th>

                      <th>
                        MONEDA
                      </th>

                      <th>
                        FECHA
                      </th>

                      <th>
                        DESCRIPCIÓN
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {data.gastos.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="table-empty"
                        >
                          No hay gastos
                          registrados.
                        </td>
                      </tr>
                    ) : (
                      data.gastos.map(
                        (gasto) => (
                          <tr
                            key={
                              gasto.id
                            }
                          >
                            <td>
                              <strong>
                                {
                                  gasto.nombre
                                }
                              </strong>
                            </td>

                            <td className="negative">
                              -
                              {dinero(
                                gasto.monto
                              )}
                            </td>

                            <td>
                              BOB
                            </td>

                            <td>
                              {fechaCorta(
                                gasto.fecha
                              )}
                            </td>

                            <td>
                              {
                                gasto.descripcion ||
                                "—"
                              }
                            </td>
                          </tr>
                        )
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </section>
          )}

        </>
      )}

      {/* =====================================================
          MODAL GASTO
      ===================================================== */}

      {modalGasto && esAdmin && (
        <div
          className="facturacion-modal-overlay"
          onMouseDown={(e) => {
            if (
              e.target ===
              e.currentTarget
            ) {
              setModalGasto(false);
            }
          }}
        >

          <div className="facturacion-modal">

            <div className="modal-header">

              <div>
                <span className="section-label">
                  ADMINISTRACIÓN
                </span>

                <h2>
                  Agregar gasto
                </h2>

                <p>
                  Registra un gasto de
                  la barbería.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setModalGasto(false)
                }
              >
                ×
              </button>

            </div>

            <div className="modal-form">

              <label>
                <span>
                  Nombre del gasto
                </span>

                <input
                  type="text"
                  placeholder="Ej. Pago alquiler"
                  value={
                    gastoForm.nombre
                  }
                  onChange={(e) =>
                    setGastoForm({
                      ...gastoForm,
                      nombre:
                        e.target.value,
                    })
                  }
                />
              </label>

              <div className="form-grid">

                <label>
                  <span>
                    Monto
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="1600"
                    value={
                      gastoForm.monto
                    }
                    onChange={(e) =>
                      setGastoForm({
                        ...gastoForm,
                        monto:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>
                    Moneda
                  </span>

                  <select
                    value="BOB"
                    disabled
                  >
                    <option value="BOB">
                      BOB - Bolivianos
                    </option>
                  </select>
                </label>

              </div>

              <label>
                <span>
                  Fecha
                </span>

                <input
                  type="date"
                  value={
                    gastoForm.fecha
                  }
                  onChange={(e) =>
                    setGastoForm({
                      ...gastoForm,
                      fecha:
                        e.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Descripción
                </span>

                <textarea
                  rows={3}
                  placeholder="Descripción opcional"
                  value={
                    gastoForm.descripcion
                  }
                  onChange={(e) =>
                    setGastoForm({
                      ...gastoForm,
                      descripcion:
                        e.target.value,
                    })
                  }
                />
              </label>

            </div>

            <div className="modal-actions">

              <button
                type="button"
                className="facturacion-btn facturacion-btn-secondary"
                onClick={() =>
                  setModalGasto(false)
                }
                disabled={
                  guardandoGasto
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="facturacion-btn facturacion-btn-primary"
                onClick={
                  guardarGasto
                }
                disabled={
                  guardandoGasto
                }
              >
                {guardandoGasto
                  ? "Guardando..."
                  : "Guardar gasto"}
              </button>

            </div>

          </div>

        </div>
      )}

    </main>
  );
}