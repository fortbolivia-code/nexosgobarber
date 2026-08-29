"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";

type Barbero = {
  UID?: string;
  ID_BARBERO?: string;
  ID_BARBERIA?: string;
  NOMBRE?: string;
  NOMBRE_COMPLETO?: string;
  TELEFONO?: string;
  ESTADO?: string;
  COMISION?: string | number;
  CLIENTES_ATENDIDOS?: string | number;
  SERVICIOS_REALIZADOS?: string | number;
  INGRESOS?: string | number;
  COMISIONES?: string | number;
};

type Servicio = {
  ID_SERVICIO?: string;
  ID_BARBERIA?: string;
  NOMBRE?: string;
  DESCRIPCION?: string;
  ESTADO?: string;
};

type Estadisticas = {
  clientes: number;
  servicios: number;
  ingresos: number;
  comisiones: number;
};

const emptyStats: Estadisticas = {
  clientes: 0,
  servicios: 0,
  ingresos: 0,
  comisiones: 0,
};

export default function BarberosPage() {
  const [barberos, setBarberos] = useState<Barbero[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [filtroServicio, setFiltroServicio] = useState("todos");

  const [stats, setStats] =
    useState<Estadisticas>(emptyStats);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [mostrarBarbero, setMostrarBarbero] =
    useState(false);

  const [mostrarServicio, setMostrarServicio] =
    useState(false);

  // =========================================================
  // MODAL DE ÉXITO
  // =========================================================

  const [modalExito, setModalExito] = useState<{
    mostrar: boolean;
    uid: string;
  }>({
    mostrar: false,
    uid: "",
  });

  // =========================================================
  // FILTROS
  // =========================================================

  const [filtroPeriodo, setFiltroPeriodo] =
    useState("mes");

  const [filtroBarbero, setFiltroBarbero] =
    useState("todos");

  // =========================================================
  // NUEVO SERVICIO
  // =========================================================

  const [nuevoServicio, setNuevoServicio] = useState({
    nombre: "",
    descripcion: "",
  });

  // =========================================================
  // NUEVO BARBERO
  // =========================================================

  const [nuevoBarbero, setNuevoBarbero] =
    useState({
      nombre: "",
      telefono: "",
      cedula: "",
      direccion: "",
      fechaNacimiento: "",
      fechaIngreso: "",
      comision: "50",
      email: "",
      password: "",
      confirmarPassword: "",
    });

  const [mostrarPassword, setMostrarPassword] =
    useState(false);

  const [mostrarConfirmarPassword, setMostrarConfirmarPassword] =
    useState(false);

  // =========================================================
  // TOKEN
  // =========================================================

  async function getToken() {
    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "No hay una sesión iniciada."
      );
    }

    return await user.getIdToken();
  }

  // =========================================================
  // CARGAR DATOS
  // =========================================================

  async function cargarDatos(
    periodo = filtroPeriodo
  ) {
    try {
      setLoading(true);

      const token = await getToken();

      const response = await fetch(
        `/barberos/api?periodo=${encodeURIComponent(
          periodo
        )}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            "No se pudieron cargar los datos."
        );
      }

      setBarberos(
        data.barberos || []
      );

      setServicios(
        data.servicios || []
      );

      setStats(
        data.estadisticas ||
          emptyStats
      );
    } catch (error) {
      console.error(error);

      setBarberos([]);
      setServicios([]);
      setStats(emptyStats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos(filtroPeriodo);
  }, [filtroPeriodo]);

  // =========================================================
  // BARBEROS FILTRADOS
  // =========================================================

  const barberosFiltrados =
    useMemo(() => {
      return barberos.filter(
        (barbero) => {
          const id =
            barbero.UID ||
            barbero.ID_BARBERO ||
            barbero.NOMBRE_COMPLETO ||
            barbero.NOMBRE ||
            "";

          return (
            filtroBarbero === "todos" ||
            id === filtroBarbero
          );
        }
      );
    }, [
      barberos,
      filtroBarbero,
    ]);


  // =========================================================
  // SERVICIOS FILTRADOS
  // =========================================================

  const serviciosFiltrados = useMemo(() => {
    if (filtroServicio === "todos") {
      return servicios;
    }

    const filtro = filtroServicio.trim().toLowerCase();

    return servicios.filter((servicio) =>
      String(servicio.NOMBRE || "")
        .trim()
        .toLowerCase() === filtro
    );
  }, [servicios, filtroServicio]);


  // =========================================================
  // BARBEROS ACTIVOS
  // =========================================================

  const activos =
    barberos.filter(
      (barbero) =>
        String(
          barbero.ESTADO || ""
        ).toLowerCase() ===
        "activo"
    ).length;

  // =========================================================
  // CONVERTIR A NÚMERO
  // =========================================================

  const numero = (
    valor: unknown
  ) => {
    const n = Number(valor);

    return Number.isFinite(n)
      ? n
      : 0;
  };

 // =========================================================
// CREAR SERVICIO
// =========================================================

async function crearServicio(e: React.FormEvent) {
  e.preventDefault();

  if (!nuevoServicio.nombre.trim()) {
    alert("Escribe el nombre del servicio.");
    return;
  }

  try {
    setSaving(true);

    const token = await getToken();

    // Obtener automáticamente el ID de la barbería
    const barberiaId =
      barberos.find(
        (barbero) =>
          String(barbero.ID_BARBERIA || "").trim() !== ""
      )?.ID_BARBERIA || "";

    if (!barberiaId) {
      alert(
        "No se pudo identificar la barbería."
      );
      return;
    }

    const response = await fetch(
      "/servicios/api",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body: JSON.stringify({
          nombre:
            nuevoServicio.nombre.trim(),

          descripcion:
            nuevoServicio.descripcion.trim(),

          barberiaId:
            String(barberiaId).trim(),
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
          "No se pudo crear el servicio."
      );
    }

    setNuevoServicio({
      nombre: "",
      descripcion: "",
    });

    setMostrarServicio(false);

    await cargarDatos();

  } catch (error: any) {

    console.error(
      "ERROR AL CREAR SERVICIO:",
      error
    );

    alert(
      error?.message ||
        "Error al crear servicio."
    );

  } finally {
    setSaving(false);
  }
}

  // =========================================================
  // CREAR BARBERO
  // =========================================================

  async function crearBarbero(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (
      !nuevoBarbero.nombre.trim() ||
      !nuevoBarbero.email.trim() ||
      !nuevoBarbero.password
    ) {
      alert(
        "Completa nombre, correo y contraseña."
      );
      return;
    }

    if (
      nuevoBarbero.password.length < 6
    ) {
      alert(
        "La contraseña debe tener al menos 6 caracteres."
      );
      return;
    }

    if (
      nuevoBarbero.password !==
      nuevoBarbero.confirmarPassword
    ) {
      alert(
        "Las contraseñas no coinciden."
      );
      return;
    }

    try {
      setSaving(true);

      const token =
        await getToken();

      const response =
        await fetch(
          "/barberos/api",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              accion:
                "crear_barbero",

              nombre:
                nuevoBarbero.nombre.trim(),

              telefono:
                nuevoBarbero.telefono.trim(),

              cedula:
                nuevoBarbero.cedula.trim(),

              direccion:
                nuevoBarbero.direccion.trim(),

              fechaNacimiento:
                nuevoBarbero.fechaNacimiento,

              fechaIngreso:
                nuevoBarbero.fechaIngreso,

              comision:
                nuevoBarbero.comision,

              email:
                nuevoBarbero.email.trim(),

              password:
                nuevoBarbero.password,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.ok
      ) {
        throw new Error(
          data.error ||
            "No se pudo crear el barbero."
        );
      }

      // =====================================================
      // LIMPIAR FORMULARIO
      // =====================================================

      setNuevoBarbero({
        nombre: "",
        telefono: "",
        cedula: "",
        direccion: "",
        fechaNacimiento: "",
        fechaIngreso: "",
        comision: "50",
        email: "",
        password: "",
        confirmarPassword: "",
      });

      setMostrarPassword(false);
      setMostrarConfirmarPassword(false);

      // =====================================================
      // CERRAR MODAL DE CREACIÓN
      // =====================================================

      setMostrarBarbero(false);

      // =====================================================
      // MOSTRAR MODAL DE ÉXITO
      // =====================================================

      setModalExito({
        mostrar: true,
        uid: data.uid || "",
      });

      // =====================================================
      // RECARGAR DATOS
      // =====================================================

      await cargarDatos();
    } catch (error: any) {
      console.error(error);

      alert(
        error.message ||
          "Error al crear barbero."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="barberos-page">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="barberos-header">

        <div>
          <span className="eyebrow">
            EQUIPO
          </span>

          <h1>
            Barberos
          </h1>

          <p>
            Administra el equipo, accesos,
            servicios y rendimiento de tus
            barberos.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() =>
            setMostrarBarbero(true)
          }
        >
          <span>＋</span>
          Crear barbero
        </button>

      </div>

      {/* =====================================================
          ESTADÍSTICAS GENERALES
          ===================================================== */}

      <section className="stats-grid">

        <StatCard
          icon="✂"
          title="Total barberos"
          value={barberos.length}
          subtitle="Registrados"
        />

        <StatCard
          icon="●"
          title="Barberos activos"
          value={activos}
          subtitle="Actualmente activos"
        />

        <StatCard
          icon="♙"
          title="Clientes atendidos"
          value={stats.clientes}
          subtitle="Total registrado"
        />

        <StatCard
          icon="▣"
          title="Servicios realizados"
          value={stats.servicios}
          subtitle="Total realizado"
        />

        <StatCard
          icon="Bs"
          title="Ingresos generados"
          value={`Bs ${stats.ingresos.toFixed(
            2
          )}`}
          subtitle="Total cobrado"
        />

        <StatCard
          icon="%"
          title="Comisiones"
          value={`Bs ${stats.comisiones.toFixed(
            2
          )}`}
          subtitle="Total generado"
        />

      </section>

      {/* =====================================================
          FILTROS DE RENDIMIENTO
          ===================================================== */}

      <section className="filters-card">

        <div className="filters-info">

          <span className="filter-label">
            FILTRAR RENDIMIENTO
          </span>

          <h2>
            Seleccion Rango de tiempo y Barbero
          </h2>

        </div>

        <div className="filters">

          {/* PERIODO */}

          <select
            value={filtroPeriodo}
            onChange={(e) =>
              setFiltroPeriodo(
                e.target.value
              )
            }
          >
            <option value="dia">
              Hoy
            </option>

            <option value="semana">
              Esta semana
            </option>

            <option value="mes">
              Este mes
            </option>

            <option value="3meses">
              Últimos 3 meses
            </option>

            <option value="12meses">
              Últimos 12 meses
            </option>
          </select>

          {/* BARBERO */}

          <select
            value={filtroBarbero}
            onChange={(e) =>
              setFiltroBarbero(
                e.target.value
              )
            }
          >

            <option value="todos">
              Todos los barberos
            </option>

            {barberos.map(
              (
                barbero,
                index
              ) => {

                const id =
                  barbero.UID ||
                  barbero.ID_BARBERO ||
                  barbero.NOMBRE_COMPLETO ||
                  `barbero-${index}`;

                return (
                  <option
                    key={id}
                    value={id}
                  >
                    {barbero.NOMBRE_COMPLETO ||
                      barbero.NOMBRE ||
                      "Barbero sin nombre"}
                  </option>
                );
              }
            )}

          </select>

        </div>

      </section>

      {/* =====================================================
          RENDIMIENTO DE BARBEROS
          ===================================================== */}

      <section className="performance-section">

        <div className="performance-heading">

          <span className="performance-eyebrow">
            EQUIPO DE TRABAJO
          </span>

          <h2 className="performance-title">
            Rendimiento de barberos
          </h2>

          <p className="performance-subtitle">
            Consulta clientes, servicios,
            ingresos y comisión generada.
          </p>

        </div>

        {loading ? (

          <div className="performance-empty">

            <div className="empty-icon">
              ⌛
            </div>

            <h3>
              Cargando información...
            </h3>

          </div>

        ) : barberosFiltrados.length === 0 ? (

          <div className="performance-empty">

            <div className="empty-icon">
              ✂
            </div>

            <h3>
              Aún no hay barberos
            </h3>

            <p>
              Los datos de rendimiento
              aparecerán aquí cuando
              registres atenciones y pagos.
            </p>

            <button
              className="primary-button"
              onClick={() =>
                setMostrarBarbero(true)
              }
            >
              Crear primer barbero
            </button>

          </div>

        ) : (

          <div className="barberos-grid">

            {barberosFiltrados.map(
              (
                barbero,
                index
              ) => {

                const clientes =
                  numero(
                    barbero.CLIENTES_ATENDIDOS
                  );

                const serviciosRealizados =
                  numero(
                    barbero.SERVICIOS_REALIZADOS
                  );

                const ingresos =
                  numero(
                    barbero.INGRESOS
                  );

                const comisiones =
                  numero(
                    barbero.COMISIONES
                  );

                return (

                  <article
                    className="barbero-card"
                    key={
                      barbero.UID ||
                      barbero.ID_BARBERO ||
                      `barbero-card-${index}`
                    }
                  >

                    <div className="barbero-top">

                      <div className="avatar">
                        {(
                          barbero.NOMBRE_COMPLETO ||
                          barbero.NOMBRE ||
                          "B"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="barbero-name">

                        <h3>
                          {barbero.NOMBRE_COMPLETO ||
                            barbero.NOMBRE ||
                            "Barbero"}
                        </h3>

                        <span
                          className={`status ${
                            String(
                              barbero.ESTADO ||
                                ""
                            ).toLowerCase() ===
                            "activo"
                              ? "active"
                              : "inactive"
                          }`}
                        >

                          <i />

                          {barbero.ESTADO ||
                            "Sin estado"}

                        </span>

                      </div>

                    </div>

                    <div className="performance-grid">

                      <Performance
                        label="Clientes atendidos"
                        value={clientes}
                      />

                      <Performance
                        label="Servicios realizados"
                        value={
                          serviciosRealizados
                        }
                      />

                      <Performance
                        label="Ingresos"
                        value={`Bs ${ingresos.toFixed(
                          2
                        )}`}
                      />

                      <Performance
                        label="Comisión"
                        value={`Bs ${comisiones.toFixed(
                          2
                        )}`}
                      />

                    </div>

                    <div className="barbero-footer">

                      <span>
                        Comisión configurada:{" "}
                        <strong>
                          {numero(
                            barbero.COMISION
                          )}
                          %
                        </strong>
                      </span>

                      <span>
                        Rendimiento:{" "}
                        <strong>

                          {clientes > 0
                            ? serviciosRealizados /
                                clientes >=
                              1
                              ? "Alto"
                              : "Normal"
                            : "Sin datos"}

                        </strong>
                      </span>

                    </div>

                  </article>

                );
              }
            )}

          </div>

        )}

      </section>

      {/* =====================================================
          SERVICIOS
          ===================================================== */}

      <section className="section services-section">

        <div className="section-heading services-heading">

          <div>

            <span className="eyebrow">
              CATÁLOGO
            </span>

            <h2>
              Servicios
            </h2>

            <p>
              Define los servicios disponibles
              para tus clientes.
            </p>

          </div>

          <button
            className="primary-button services-create-button"
            onClick={() =>
              setMostrarServicio(true)
            }
          >
            ＋ Nuevo servicio
          </button>

        </div>

        {/* FILTRO DE SERVICIOS */}

<div className="services-toolbar">

  <div className="services-filter">

    <span>
      SERVICIO
    </span>

    <select
      value={filtroServicio}
      onChange={(e) =>
        setFiltroServicio(e.target.value)
      }
    >

      <option value="todos">
        Todos los servicios
      </option>

      {Array.from(
        new Set(
          servicios
            .map((servicio) =>
              String(servicio.NOMBRE || "").trim()
            )
            .filter(Boolean)
        )
      ).map((nombre) => (

        <option
          key={nombre}
          value={nombre}
        >
          {nombre}
        </option>

      ))}

    </select>

  </div>

</div>

{serviciosFiltrados.length === 0 ? (

  <div className="services-empty">

    <div className="empty-icon small">
      ✂
    </div>

    <div>

      <h3>
        {servicios.length === 0
          ? "No hay servicios registrados"
          : "No se encontró el servicio"}
      </h3>

      <p>
        {servicios.length === 0
          ? "Crea tu primer servicio para comenzar."
          : "Prueba seleccionando otro servicio."}
      </p>

    </div>

    {servicios.length === 0 && (

      <button
        className="primary-button"
        onClick={() =>
          setMostrarServicio(true)
        }
      >
        ＋ Crear servicio
      </button>

    )}

  </div>

) : (

  <div className="services-list">

    {serviciosFiltrados.map(
      (
        servicio,
        index
      ) => (

        <div
          className="service-row"
          key={
            servicio.ID_SERVICIO ||
            `${servicio.NOMBRE}-${index}`
          }
        >

          <div className="service-icon">
            ✂
          </div>

          <div className="service-info">

            <h3>
              {servicio.NOMBRE ||
                "Servicio"}
            </h3>

            <p>
              {servicio.DESCRIPCION ||
                "Sin descripción"}
            </p>

          </div>

          <span className="service-status">
            {servicio.ESTADO ||
              "Activo"}
          </span>

        </div>

      )
    )}

  </div>

)}

      </section>

      {/* =====================================================
          MODAL CREAR BARBERO
          ===================================================== */}

      {mostrarBarbero && (

        <div
          className="modal-overlay"
          onMouseDown={() =>
            setMostrarBarbero(false)
          }
        >

          <div
            className="modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="eyebrow">
                  NUEVO BARBERO
                </span>

                <h2>
                  Crear barbero
                </h2>

                <p>
                  El acceso se creará
                  inmediatamente en Firebase.
                </p>

              </div>

              <button
                type="button"
                className="close-button"
                onClick={() =>
                  setMostrarBarbero(false)
                }
              >
                ×
              </button>

            </div>

            <form
              onSubmit={crearBarbero}
            >

              {/* DATOS PERSONALES */}

              <div className="form-section">

                <span className="form-number">
                  01
                </span>

                <div>

                  <h3>
                    Datos personales
                  </h3>

                  <p>
                    Información básica del
                    barbero.
                  </p>

                </div>

              </div>

              <div className="form-grid">

                <Field
                  label="Nombre completo"
                  value={
                    nuevoBarbero.nombre
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      nombre: value,
                    })
                  }
                  placeholder="Ej. Carlos Mendoza"
                  required
                />

                <Field
                  label="Teléfono"
                  value={
                    nuevoBarbero.telefono
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      telefono: value,
                    })
                  }
                  placeholder="Ej. 70000000"
                />

                <Field
                  label="Cédula"
                  value={
                    nuevoBarbero.cedula
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      cedula: value,
                    })
                  }
                  placeholder="Ej. 1234567"
                />

                <Field
                  label="Dirección"
                  value={
                    nuevoBarbero.direccion
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      direccion: value,
                    })
                  }
                  placeholder="Dirección"
                />

                <Field
                  label="Fecha de nacimiento"
                  type="date"
                  value={
                    nuevoBarbero.fechaNacimiento
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      fechaNacimiento:
                        value,
                    })
                  }
                />

                <Field
                  label="Fecha de ingreso"
                  type="date"
                  value={
                    nuevoBarbero.fechaIngreso
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      fechaIngreso: value,
                    })
                  }
                />

              </div>

              {/* DATOS LABORALES */}

              <div className="form-section">

                <span className="form-number">
                  02
                </span>

                <div>

                  <h3>
                    Datos laborales
                  </h3>

                  <p>
                    Configuración del trabajo
                    y comisión.
                  </p>

                </div>

              </div>

              <div className="form-grid">

                <Field
                  label="Porcentaje de comisión"
                  type="number"
                  value={
                    nuevoBarbero.comision
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      comision: value,
                    })
                  }
                  placeholder="50"
                />

                <div className="field">

                  <label>
                    Estado
                  </label>

                  <div className="readonly-field">

                    <span className="green-dot" />

                    Activo

                  </div>

                </div>

              </div>

              {/* DATOS DE ACCESO */}

              <div className="form-section">

                <span className="form-number">
                  03
                </span>

                <div>

                  <h3>
                    Datos de acceso
                  </h3>

                  <p>
                    El barbero utilizará estos
                    datos para iniciar sesión.
                  </p>

                </div>

              </div>

              <div className="form-grid">

                <Field
                  label="Correo electrónico"
                  type="email"
                  value={
                    nuevoBarbero.email
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      email: value,
                    })
                  }
                  placeholder="barbero@gmail.com"
                  required
                />

                <PasswordField
                  label="Contraseña"
                  value={nuevoBarbero.password}
                  visible={mostrarPassword}
                  onToggle={() =>
                    setMostrarPassword((actual) => !actual)
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      password: value,
                    })
                  }
                  placeholder="Mínimo 6 caracteres"
                  required
                />

                <PasswordField
                  label="Repetir contraseña"
                  value={nuevoBarbero.confirmarPassword}
                  visible={mostrarConfirmarPassword}
                  onToggle={() =>
                    setMostrarConfirmarPassword((actual) => !actual)
                  }
                  onChange={(value) =>
                    setNuevoBarbero({
                      ...nuevoBarbero,
                      confirmarPassword: value,
                    })
                  }
                  placeholder="Repite la contraseña"
                  required
                  error={
                    nuevoBarbero.confirmarPassword.length > 0 &&
                    nuevoBarbero.password !==
                      nuevoBarbero.confirmarPassword
                  }
                />

              </div>

              <div className="modal-footer">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    setMostrarBarbero(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Creando..."
                    : "Crear barbero"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================
          MODAL ÉXITO - BARBERO CREADO
          ===================================================== */}

      {modalExito.mostrar && (

        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "rgba(0, 0, 0, 0.72)",
            backdropFilter:
              "blur(8px)",
            padding: "20px",
          }}
          onMouseDown={() =>
            setModalExito({
              mostrar: false,
              uid: "",
            })
          }
        >

          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              background: "#071018",
              border:
                "1px solid rgba(0, 212, 255, 0.25)",
              borderRadius: "24px",
              padding: "36px",
              boxShadow:
                "0 25px 80px rgba(0, 0, 0, 0.55)",
              color: "#fff",
            }}
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "22px",
                background:
                  "rgba(34, 197, 94, 0.12)",
                border:
                  "1px solid rgba(34, 197, 94, 0.3)",
                color: "#4ade80",
                fontSize: "30px",
                fontWeight: 700,
              }}
            >
              ✓
            </div>

            <span
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing:
                  "0.14em",
                color: "#4ade80",
                marginBottom: "8px",
              }}
            >
              OPERACIÓN COMPLETADA
            </span>

            <h2
              style={{
                margin:
                  "0 0 10px",
                fontSize: "28px",
                fontWeight: 700,
                color: "#fff",
              }}
            >
              Barbero creado correctamente
            </h2>

            <p
              style={{
                margin:
                  "0 0 24px",
                color: "#94a3b8",
                lineHeight: 1.6,
              }}
            >
              La cuenta del barbero
              fue creada y registrada
              correctamente en el sistema.
            </p>

            <div
              style={{
                background: "#0d1720",
                border:
                  "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "14px",
                padding: "16px",
                marginBottom:
                  "24px",
              }}
            >

              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing:
                    "0.1em",
                  color: "#64748b",
                  marginBottom:
                    "7px",
                }}
              >
                UID DE FIREBASE
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#e2e8f0",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                  wordBreak:
                    "break-all",
                }}
              >
                {modalExito.uid}
              </div>

            </div>

            <button
              type="button"
              onClick={() =>
                setModalExito({
                  mostrar: false,
                  uid: "",
                })
              }
              style={{
                width: "100%",
                border: "none",
                borderRadius: "12px",
                padding:
                  "14px 18px",
                background: "#00a9c7",
                color: "#fff",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Continuar
            </button>

          </div>

        </div>

      )}

      {/* =====================================================
          MODAL CREAR SERVICIO
          ===================================================== */}

      {mostrarServicio && (

        <div
          className="modal-overlay"
          onMouseDown={() =>
            setMostrarServicio(false)
          }
        >

          <div
            className="modal service-modal"
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="eyebrow">
                  NUEVO SERVICIO
                </span>

                <h2>
                  Crear servicio
                </h2>

                <p>
                  Registra un nuevo servicio
                  para que esté disponible
                  en Atención / Pagos.
                </p>

              </div>

              <button
                type="button"
                className="close-button"
                onClick={() =>
                  setMostrarServicio(false)
                }
                aria-label="Cerrar"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={crearServicio}
            >

              {/* NOMBRE */}

              <div className="field">

                <label htmlFor="servicio-nombre">
                  Nombre del servicio{" "}
                  <span>
                    *
                  </span>
                </label>

                <input
                  id="servicio-nombre"
                  type="text"
                  value={
                    nuevoServicio.nombre
                  }
                  onChange={(e) =>
                    setNuevoServicio({
                      ...nuevoServicio,
                      nombre:
                        e.target.value,
                    })
                  }
                  placeholder="Ej. Corte clásico"
                  required
                />

              </div>

              

              {/* DESCRIPCIÓN */}

              <div className="field">

                <label htmlFor="servicio-descripcion">
                  Descripción
                </label>

                <textarea
                  id="servicio-descripcion"
                  value={
                    nuevoServicio.descripcion
                  }
                  onChange={(e) =>
                    setNuevoServicio({
                      ...nuevoServicio,
                      descripcion:
                        e.target.value,
                    })
                  }
                  placeholder="Describe brevemente el servicio..."
                  rows={4}
                />

              </div>

              {/* AVISO */}

              <div className="price-notice">

                <span className="price-notice-icon">
                  ✓
                </span>

                <div>

                  <strong>
                    El precio se define en
                    Atención / Pagos
                  </strong>

                  <p>
                    Aquí solo registramos el
                    servicio. El precio se
                    establecerá cuando se
                    realice el cobro.
                  </p>

                </div>

              </div>

              {/* BOTONES */}

              <div className="modal-footer">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    setMostrarServicio(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Guardando..."
                    : "Crear servicio"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </main>
  );
}

// =========================================================
// STAT CARD
// =========================================================

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: string;
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (

    <div className="stat-card">

      <div className="stat-icon">
        {icon}
      </div>

      <div>

        <div className="stat-title">
          {title}
        </div>

        <div className="stat-value">
          {value}
        </div>

        <div className="stat-subtitle">
          {subtitle}
        </div>

      </div>

    </div>
  );
}

// =========================================================
// PERFORMANCE
// =========================================================

function Performance({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (

    <div className="performance">

      <div className="performance-label">
        {label}
      </div>

      <div className="performance-value">
        {value}
      </div>

    </div>
  );
}

// =========================================================
// PASSWORD FIELD
// =========================================================

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
  required = false,
  error = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  visible: boolean;
  onToggle: () => void;
  required?: boolean;
  error?: boolean;
}) {
  return (
    <div className="field">
      <label>
        {label}{" "}
        {required && <span>*</span>}
      </label>

      <div
        style={{
          position: "relative",
          width: "100%",
        }}
      >
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) =>
            onChange(e.target.value)
          }
          placeholder={placeholder}
          required={required}
          aria-invalid={error}
          style={{
            width: "100%",
            paddingRight: "48px",
            borderColor: error
              ? "#ef7c8a"
              : undefined,
          }}
        />

        <button
          type="button"
          onClick={onToggle}
          aria-label={
            visible
              ? "Ocultar contraseña"
              : "Mostrar contraseña"
          }
          title={
            visible
              ? "Ocultar contraseña"
              : "Mostrar contraseña"
          }
          style={{
            position: "absolute",
            top: "50%",
            right: "12px",
            transform: "translateY(-50%)",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            color: "#9eb6c0",
            cursor: "pointer",
            borderRadius: "8px",
            padding: 0,
            fontSize: "18px",
          }}
        >
          {visible ? "◉" : "◌"}
        </button>
      </div>

      {error && (
        <small
          style={{
            display: "block",
            marginTop: "7px",
            color: "#ef7c8a",
            fontSize: "11px",
          }}
        >
          Las contraseñas no coinciden.
        </small>
      )}
    </div>
  );
}

// =========================================================
// FIELD
// =========================================================

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (

    <div className="field">

      <label>

        {label}{" "}

        {required && (
          <span>
            *
          </span>
        )}

      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder={placeholder}
        required={required}
      />

    </div>
  );
}