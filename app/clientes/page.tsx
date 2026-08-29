"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";

// =========================================================
// TIPOS
// =========================================================

type BarberoCliente = {
  id: string;
  nombre: string;
  rangoEdad: string;
};

type HistorialCliente = {
  idBarbero: string;
  fecha: string;
  barbero: string;
  servicio: string;
  monto: number;
  metodoPago: string;
};

type Cliente = {
  ID_CLIENTE: string;
  ID_BARBERIA: string;
  NOMBRE: string;
  TELEFONO: string;
  RANGO_EDAD: string;
  PRIMERA_ATENCION: string;
  ULTIMA_ATENCION: string;
  TOTAL_VISITAS: number;
  TOTAL_GASTADO: number;
  BARBEROS: BarberoCliente[];
  HISTORIAL: HistorialCliente[];
};

// =========================================================
// NORMALIZAR TEXTO
// =========================================================

const normalizarTexto = (valor: unknown) => {
  return String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

// =========================================================
// COMPONENTE
// =========================================================

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // =======================================================
  // BUSCADOR
  // =======================================================

  const [busqueda, setBusqueda] = useState("");

  // =======================================================
  // FILTROS
  // =======================================================

  const [filtroEdad, setFiltroEdad] =
    useState("todos");

  const [filtroBarbero, setFiltroBarbero] =
    useState("todos");

  const [filtroVisitas, setFiltroVisitas] =
    useState("todos");

  const [filtroGasto, setFiltroGasto] =
    useState("todos");

  // =======================================================
  // ORDEN
  // =======================================================

  const [orden, setOrden] =
    useState("nombre-az");

  // =======================================================
  // CLIENTE SELECCIONADO
  // =======================================================

  const [
    clienteSeleccionado,
    setClienteSeleccionado,
  ] = useState<Cliente | null>(null);

  // =======================================================
  // OBTENER USUARIO
  // =======================================================

  const obtenerUsuario = () => {
    try {
      /*
       * El sistema utiliza sessionStorage.
       * Dejamos localStorage como respaldo.
       */

      const datosSession =
        sessionStorage.getItem(
          "nexos_usuario"
        );

      const datosLocal =
        localStorage.getItem(
          "nexos_usuario"
        );

      const datos =
        datosSession || datosLocal;

      if (!datos) {
        return null;
      }

      return JSON.parse(datos);
    } catch (error) {
      console.error(
        "ERROR LEYENDO USUARIO:",
        error
      );

      return null;
    }
  };

  // =======================================================
  // BARBERÍA ACTUAL
  // =======================================================

  const obtenerBarberiaId = () => {
    const usuario =
      obtenerUsuario();

    if (!usuario) {
      return "";
    }

    return String(
      usuario?.ID_BARBERIA ||
        usuario?.barberiaId ||
        usuario?.BARBERIA_ID ||
        usuario?.BARBERIAID ||
        ""
    ).trim();
  };

  // =======================================================
  // CARGAR CLIENTES
  // =======================================================

  const cargarClientes = async () => {
    try {
      setLoading(true);
      setError("");

      const barberiaId =
        obtenerBarberiaId();

      if (!barberiaId) {
        throw new Error(
          "No se pudo identificar la barbería."
        );
      }

      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        throw new Error(
          "No hay una sesión de Firebase iniciada."
        );
      }

      const token = await firebaseUser.getIdToken();

      const response =
        await fetch(
          `/clientes/api?barberiaId=${encodeURIComponent(
            barberiaId
          )}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token}`,
            },
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
            "No se pudieron cargar los clientes."
        );
      }

      const clientesRecibidos =
        Array.isArray(
          data.clientes
        )
          ? data.clientes
          : [];

      // ===================================================
      // NORMALIZAR RESPUESTA
      // ===================================================

      const clientesNormalizados =
        clientesRecibidos.map(
          (cliente: any) => ({
            ID_CLIENTE:
              String(
                cliente.ID_CLIENTE ??
                  ""
              ),

            ID_BARBERIA:
              String(
                cliente.ID_BARBERIA ??
                  ""
              ),

            NOMBRE:
              String(
                cliente.NOMBRE ??
                  ""
              ),

            TELEFONO:
              String(
                cliente.TELEFONO ??
                  ""
              ),

            RANGO_EDAD:
              String(
                cliente.RANGO_EDAD ??
                  ""
              ),

            PRIMERA_ATENCION:
              String(
                cliente.PRIMERA_ATENCION ??
                  ""
              ),

            ULTIMA_ATENCION:
              String(
                cliente.ULTIMA_ATENCION ??
                  ""
              ),

            TOTAL_VISITAS:
              Number(
                cliente.TOTAL_VISITAS ??
                  0
              ),

            TOTAL_GASTADO:
              Number(
                cliente.TOTAL_GASTADO ??
                  0
              ),

            // =============================================
            // BARBEROS
            // =============================================

            BARBEROS:
              Array.isArray(
                cliente.BARBEROS
              )
                ? cliente.BARBEROS.map(
                    (barbero: any) => ({
                      id: String(
                        barbero.id ??
                          barbero.ID_BARBERO ??
                          ""
                      ),

                      nombre:
                        String(
                          barbero.nombre ??
                            barbero.BARBERO ??
                            ""
                        ),

                      rangoEdad:
                        String(
                          barbero.rangoEdad ??
                            barbero.RANGO_EDAD ??
                            "Sin registrar"
                        ),
                    })
                  )
                : [],

            // =============================================
            // HISTORIAL
            // =============================================

            HISTORIAL:
              Array.isArray(
                cliente.HISTORIAL
              )
                ? cliente.HISTORIAL.map(
                    (atencion: any) => ({
                      idBarbero:
                        String(
                          atencion.idBarbero ??
                            atencion.ID_BARBERO ??
                            ""
                        ),

                      fecha:
                        String(
                          atencion.fecha ??
                            atencion.FECHA ??
                            ""
                        ),

                      barbero:
                        String(
                          atencion.barbero ??
                            atencion.BARBERO ??
                            ""
                        ),

                      servicio:
                        String(
                          atencion.servicio ??
                            atencion.SERVICIO ??
                            ""
                        ),

                      monto:
                        Number(
                          atencion.monto ??
                            atencion.MONTO ??
                            0
                        ),

                      metodoPago:
                        String(
                          atencion.metodoPago ??
                            atencion.METODO_PAGO ??
                            ""
                        ),
                    })
                  )
                : [],
          })
        );

      setClientes(
        clientesNormalizados
      );
    } catch (err: any) {
      console.error(
        "ERROR CARGANDO CLIENTES:",
        err
      );

      setError(
        err?.message ||
          "No se pudieron cargar los clientes."
      );

      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  // =======================================================
  // CARGAR AL INICIAR
  // =======================================================

  useEffect(() => {
    cargarClientes();
  }, []);

  // =======================================================
  // LISTA DE BARBEROS
  // =======================================================

  const barberosDisponibles =
    useMemo(() => {
      const mapa =
        new Map<
          string,
          BarberoCliente
        >();

      clientes.forEach(
        (cliente) => {
          cliente.BARBEROS?.forEach(
            (barbero) => {
              const id =
                String(
                  barbero.id || ""
                ).trim();

              const nombre =
                String(
                  barbero.nombre || ""
                ).trim();

              const key =
                id ||
                `NOMBRE:${nombre}`;

              if (
                nombre &&
                !mapa.has(key)
              ) {
                mapa.set(
                  key,
                  barbero
                );
              }
            }
          );
        }
      );

      return Array.from(
        mapa.entries()
      ).sort(
        ([, a], [, b]) =>
          a.nombre.localeCompare(
            b.nombre
          )
      );
    }, [clientes]);

  // =======================================================
  // FILTRO + ORDEN + BUSCADOR
  // =======================================================

  const clientesFiltrados =
    useMemo(() => {
      let resultado =
        [...clientes];

      // ===================================================
      // BUSCADOR
      // ===================================================

      const termino =
        normalizarTexto(
          busqueda
        );

      if (termino) {
        resultado =
          resultado.filter(
            (cliente) => {
              // -------------------------------------------
              // CLIENTE
              // -------------------------------------------

              const nombreCliente =
                normalizarTexto(
                  cliente.NOMBRE
                );

              const telefonoCliente =
                normalizarTexto(
                  cliente.TELEFONO
                );

              const idCliente =
                normalizarTexto(
                  cliente.ID_CLIENTE
                );

              // -------------------------------------------
              // BARBEROS DE LA LISTA
              // -------------------------------------------

              const coincideBarbero =
                cliente.BARBEROS?.some(
                  (barbero) => {
                    const nombreBarbero =
                      normalizarTexto(
                        barbero.nombre
                      );

                    const idBarbero =
                      normalizarTexto(
                        barbero.id
                      );

                    return (
                      nombreBarbero.includes(
                        termino
                      ) ||
                      idBarbero.includes(
                        termino
                      )
                    );
                  }
                );

              // -------------------------------------------
              // BARBEROS DEL HISTORIAL
              // -------------------------------------------

              const coincideHistorial =
                cliente.HISTORIAL?.some(
                  (atencion) => {
                    const nombreBarbero =
                      normalizarTexto(
                        atencion.barbero
                      );

                    const idBarbero =
                      normalizarTexto(
                        atencion.idBarbero
                      );

                    return (
                      nombreBarbero.includes(
                        termino
                      ) ||
                      idBarbero.includes(
                        termino
                      )
                    );
                  }
                );

              return (
                nombreCliente.includes(
                  termino
                ) ||
                telefonoCliente.includes(
                  termino
                ) ||
                idCliente.includes(
                  termino
                ) ||
                coincideBarbero ||
                coincideHistorial
              );
            }
          );
      }

      // ===================================================
      // EDAD
      // ===================================================

      if (
        filtroEdad !== "todos"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.RANGO_EDAD
                .trim()
                .toLowerCase() ===
              filtroEdad
                .trim()
                .toLowerCase()
          );
      }

      // ===================================================
      // BARBERO
      // ===================================================

      if (
        filtroBarbero !==
        "todos"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.BARBEROS?.some(
                (barbero) => {
                  const id =
                    String(
                      barbero.id ||
                        ""
                    ).trim();

                  const nombre =
                    String(
                      barbero.nombre ||
                        ""
                    ).trim();

                  if (
                    id &&
                    id ===
                      filtroBarbero
                  ) {
                    return true;
                  }

                  if (
                    filtroBarbero.startsWith(
                      "NOMBRE:"
                    )
                  ) {
                    return (
                      `NOMBRE:${nombre}` ===
                      filtroBarbero
                    );
                  }

                  return false;
                }
              ) ||
              cliente.HISTORIAL?.some(
                (atencion) => {
                  const id =
                    String(
                      atencion.idBarbero ||
                        ""
                    ).trim();

                  const nombre =
                    String(
                      atencion.barbero ||
                        ""
                    ).trim();

                  if (
                    id &&
                    id ===
                      filtroBarbero
                  ) {
                    return true;
                  }

                  if (
                    filtroBarbero.startsWith(
                      "NOMBRE:"
                    )
                  ) {
                    return (
                      `NOMBRE:${nombre}` ===
                      filtroBarbero
                    );
                  }

                  return false;
                }
              )
          );
      }

      // ===================================================
      // VISITAS
      // ===================================================

      if (
        filtroVisitas ===
        "1"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.TOTAL_VISITAS ===
              1
          );
      }

      if (
        filtroVisitas ===
        "2-5"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.TOTAL_VISITAS >=
                2 &&
              cliente.TOTAL_VISITAS <=
                5
          );
      }

      if (
        filtroVisitas ===
        "6-10"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.TOTAL_VISITAS >=
                6 &&
              cliente.TOTAL_VISITAS <=
                10
          );
      }

      if (
        filtroVisitas ===
        "10+"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.TOTAL_VISITAS >
              10
          );
      }

      // ===================================================
      // GASTO
      // ===================================================

      if (
        filtroGasto ===
        "0-100"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.TOTAL_GASTADO >=
                0 &&
              cliente.TOTAL_GASTADO <=
                100
          );
      }

      if (
        filtroGasto ===
        "101-300"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.TOTAL_GASTADO >=
                101 &&
              cliente.TOTAL_GASTADO <=
                300
          );
      }

      if (
        filtroGasto ===
        "301-500"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.TOTAL_GASTADO >=
                301 &&
              cliente.TOTAL_GASTADO <=
                500
          );
      }

      if (
        filtroGasto ===
        "500+"
      ) {
        resultado =
          resultado.filter(
            (cliente) =>
              cliente.TOTAL_GASTADO >
              500
          );
      }

      // ===================================================
      // ORDEN
      // ===================================================

      resultado.sort(
        (a, b) => {
          switch (orden) {
            case "nombre-az":
              return a.NOMBRE.localeCompare(
                b.NOMBRE
              );

            case "nombre-za":
              return b.NOMBRE.localeCompare(
                a.NOMBRE
              );

            case "reciente":
              return (
                new Date(
                  b.ULTIMA_ATENCION
                ).getTime() -
                new Date(
                  a.ULTIMA_ATENCION
                ).getTime()
              );

            case "antigua":
              return (
                new Date(
                  a.ULTIMA_ATENCION
                ).getTime() -
                new Date(
                  b.ULTIMA_ATENCION
                ).getTime()
              );

            case "mayor-gasto":
              return (
                b.TOTAL_GASTADO -
                a.TOTAL_GASTADO
              );

            case "menor-gasto":
              return (
                a.TOTAL_GASTADO -
                b.TOTAL_GASTADO
              );

            case "mas-visitas":
              return (
                b.TOTAL_VISITAS -
                a.TOTAL_VISITAS
              );

            case "menos-visitas":
              return (
                a.TOTAL_VISITAS -
                b.TOTAL_VISITAS
              );

            default:
              return 0;
          }
        }
      );

      return resultado;
    }, [
      clientes,
      busqueda,
      filtroEdad,
      filtroBarbero,
      filtroVisitas,
      filtroGasto,
      orden,
    ]);

  // =======================================================
  // TABLA — MÁXIMO 10 CLIENTES
  // =======================================================

  const clientesTabla =
    useMemo(() => {
      return clientesFiltrados.slice(
        0,
        10
      );
    }, [clientesFiltrados]);

  // =======================================================
  // OBTENER ÚLTIMOS 3 BARBEROS
  // =======================================================

  const obtenerUltimosTresBarberos = (
    cliente: Cliente
  ) => {
    /*
     * Primero usamos HISTORIAL porque ahí
     * tenemos la fecha real de atención.
     *
     * De esta manera podemos saber cuáles
     * fueron los últimos barberos que
     * realmente atendieron al cliente.
     */

    const historialOrdenado =
      [...(cliente.HISTORIAL || [])]
        .filter(
          (atencion) =>
            atencion.barbero ||
            atencion.idBarbero
        )
        .sort(
          (a, b) =>
            new Date(
              b.fecha
            ).getTime() -
            new Date(
              a.fecha
            ).getTime()
        );

    const resultado: BarberoCliente[] =
      [];

    const vistos =
      new Set<string>();

    // ===================================================
    // PRIMERO: HISTORIAL
    // ===================================================

    for (
      const atencion of historialOrdenado
    ) {
      const id =
        String(
          atencion.idBarbero ||
            ""
        ).trim();

      const nombre =
        String(
          atencion.barbero ||
            ""
        ).trim();

      if (
        !id &&
        !nombre
      ) {
        continue;
      }

      /*
       * Si existe ID usamos ID.
       * Si no existe usamos el nombre.
       */

      const clave =
        id ||
        `NOMBRE:${normalizarTexto(
          nombre
        )}`;

      if (
        vistos.has(clave)
      ) {
        continue;
      }

      vistos.add(clave);

      resultado.push({
        id,
        nombre:
          nombre ||
          "Barbero sin nombre",
        rangoEdad:
          "Sin registrar",
      });

      if (
        resultado.length >= 3
      ) {
        break;
      }
    }

    // ===================================================
    // RESPALDO: BARBEROS
    // ===================================================

    if (
      resultado.length < 3
    ) {
      for (
        const barbero of
          cliente.BARBEROS || []
      ) {
        const id =
          String(
            barbero.id || ""
          ).trim();

        const nombre =
          String(
            barbero.nombre ||
              ""
          ).trim();

        if (
          !id &&
          !nombre
        ) {
          continue;
        }

        const clave =
          id ||
          `NOMBRE:${normalizarTexto(
            nombre
          )}`;

        if (
          vistos.has(clave)
        ) {
          continue;
        }

        vistos.add(clave);

        resultado.push({
          id,
          nombre:
            nombre ||
            "Barbero sin nombre",
          rangoEdad:
            barbero.rangoEdad ||
            "Sin registrar",
        });

        if (
          resultado.length >= 3
        ) {
          break;
        }
      }
    }

    return resultado.slice(
      0,
      3
    );
  };

  // =======================================================
  // FORMATEAR FECHA
  // =======================================================

  const formatearFecha = (
    fecha: string
  ) => {
    if (!fecha) {
      return "Sin registro";
    }

    const fechaObj =
      new Date(fecha);

    if (
      Number.isNaN(
        fechaObj.getTime()
      )
    ) {
      return fecha;
    }

    return fechaObj.toLocaleDateString(
      "es-BO",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  };

  // =======================================================
  // FORMATEAR DINERO
  // =======================================================

  const formatearDinero = (
    cantidad: number
  ) => {
    return `Bs ${Number(
      cantidad || 0
    ).toLocaleString(
      "es-BO",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  // =======================================================
  // LIMPIAR FILTROS
  // =======================================================

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEdad("todos");
    setFiltroBarbero("todos");
    setFiltroVisitas("todos");
    setFiltroGasto("todos");
    setOrden("nombre-az");
  };

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <main className="clientes-page">

      {/* =================================================
          ENCABEZADO
      ================================================= */}

      <section className="clientes-header">

        <div>
          <h1>Clientes</h1>

          <p>
            Gestiona y consulta la información
            de tus clientes.
          </p>
        </div>

        <button
          type="button"
          className="clientes-refresh-button"
          onClick={cargarClientes}
          disabled={loading}
        >
          {loading
            ? "Cargando..."
            : "Actualizar"}
        </button>

      </section>

      {/* =================================================
          BUSCADOR
      ================================================= */}

      <section className="clientes-search">

        <div className="clientes-search-box">

          <span className="clientes-search-icon">
            
          </span>

          <input
            type="search"
            value={busqueda}
            onChange={(e) =>
              setBusqueda(
                e.target.value
              )
            }
            placeholder="Buscar cliente, teléfono o barbero..."
            aria-label="Buscar cliente, teléfono o barbero"
          />

          {busqueda && (
            <button
              type="button"
              className="clientes-search-clear"
              onClick={() =>
                setBusqueda("")
              }
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}

        </div>

      </section>

      {/* =================================================
          FILTROS
      ================================================= */}

      <section className="clientes-filters">

        {/* EDAD */}

        <div className="clientes-filter">

          <label>
            CATEGORÍA DE EDAD
          </label>

          <select
            value={filtroEdad}
            onChange={(e) =>
              setFiltroEdad(
                e.target.value
              )
            }
          >

            <option value="todos">
              Todas las edades
            </option>

            {Array.from(
              new Set(
                clientes
                  .map(
                    (cliente) =>
                      cliente.RANGO_EDAD
                  )
                  .filter(Boolean)
              )
            )
              .sort()
              .map((edad) => (

                <option
                  key={edad}
                  value={edad}
                >
                  {edad}
                </option>

              ))}

          </select>

        </div>

        {/* BARBERO */}

        <div className="clientes-filter">

          <label>
            BARBERO
          </label>

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

            {barberosDisponibles.map(
              ([key, barbero]) => (

                <option
                  key={key}
                  value={key}
                >
                  {barbero.nombre}
                </option>

              )
            )}

          </select>

        </div>

        {/* VISITAS */}

        <div className="clientes-filter">

          <label>
            VISITAS
          </label>

          <select
            value={filtroVisitas}
            onChange={(e) =>
              setFiltroVisitas(
                e.target.value
              )
            }
          >

            <option value="todos">
              Todas
            </option>

            <option value="1">
              1 visita
            </option>

            <option value="2-5">
              2 - 5 visitas
            </option>

            <option value="6-10">
              6 - 10 visitas
            </option>

            <option value="10+">
              Más de 10
            </option>

          </select>

        </div>

        {/* GASTO */}

        <div className="clientes-filter">

          <label>
            GASTO
          </label>

          <select
            value={filtroGasto}
            onChange={(e) =>
              setFiltroGasto(
                e.target.value
              )
            }
          >

            <option value="todos">
              Todo
            </option>

            <option value="0-100">
              Bs 0 - 100
            </option>

            <option value="101-300">
              Bs 101 - 300
            </option>

            <option value="301-500">
              Bs 301 - 500
            </option>

            <option value="500+">
              Más de Bs 500
            </option>

          </select>

        </div>

        {/* ORDENAR */}

        <div className="clientes-filter">

          <label>
            ORDENAR POR
          </label>

          <select
            value={orden}
            onChange={(e) =>
              setOrden(
                e.target.value
              )
            }
          >

            <option value="nombre-az">
              Nombre A - Z
            </option>

            <option value="nombre-za">
              Nombre Z - A
            </option>

            <option value="reciente">
              Actividad más reciente
            </option>

            <option value="antigua">
              Actividad más antigua
            </option>

            <option value="mayor-gasto">
              Mayor gasto
            </option>

            <option value="menor-gasto">
              Menor gasto
            </option>

            <option value="mas-visitas">
              Más visitas
            </option>

            <option value="menos-visitas">
              Menos visitas
            </option>

          </select>

        </div>

        {/* LIMPIAR */}

        <button
          type="button"
          className="clientes-clear-button"
          onClick={limpiarFiltros}
        >
          Limpiar filtros
        </button>

      </section>

      {/* =================================================
          RESUMEN
      ================================================= */}

      <section className="clientes-summary">

        <div className="clientes-summary-card">

          <span>
            CLIENTES
          </span>

          <strong>
            {clientes.length}
          </strong>

        </div>

        <div className="clientes-summary-card">

          <span>
            MOSTRANDO
          </span>

          <strong>
            {clientesTabla.length}
          </strong>

        </div>

        <div className="clientes-summary-card">

          <span>
            VISITAS
          </span>

          <strong>
            {clientesFiltrados.reduce(
              (
                total,
                cliente
              ) =>
                total +
                cliente.TOTAL_VISITAS,
              0
            )}
          </strong>

        </div>

        <div className="clientes-summary-card">

          <span>
            INGRESO TOTAL
          </span>

          <strong>
            {formatearDinero(
              clientesFiltrados.reduce(
                (
                  total,
                  cliente
                ) =>
                  total +
                  cliente.TOTAL_GASTADO,
                0
              )
            )}
          </strong>

        </div>

      </section>

      {/* =================================================
          INDICADOR DE LÍMITE
      ================================================= */}

      {!loading &&
        !error &&
        clientesFiltrados.length > 10 && (
          <div className="clientes-limit-info">
            Mostrando los primeros 10 clientes de{" "}
            {clientesFiltrados.length} resultados.
          </div>
        )}

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <section className="clientes-error">

          <strong>
            Error
          </strong>

          <p>
            {error}
          </p>

          <button
            type="button"
            onClick={cargarClientes}
          >
            Intentar nuevamente
          </button>

        </section>
      )}

      {/* =================================================
          CARGANDO
      ================================================= */}

      {loading &&
        !error && (
          <section className="clientes-loading">

            <div className="clientes-loading-icon">
              ...
            </div>

            <p>
              Cargando clientes...
            </p>

          </section>
        )}

      {/* =================================================
          SIN CLIENTES
      ================================================= */}

      {!loading &&
        !error &&
        clientes.length === 0 && (
          <section className="clientes-empty">

            <div className="clientes-empty-icon">
              👤
            </div>

            <h2>
              No hay clientes registrados
            </h2>

            <p>
              Los clientes aparecerán
              automáticamente cuando
              registres una atención.
            </p>

          </section>
        )}

      {/* =================================================
          SIN RESULTADOS
      ================================================= */}

      {!loading &&
        !error &&
        clientes.length > 0 &&
        clientesFiltrados.length === 0 && (
          <section className="clientes-empty">

            <div className="clientes-empty-icon">
              🔍
            </div>

            <h2>
              No se encontraron clientes
            </h2>

            <p>
              Prueba cambiando los filtros
              o el término de búsqueda.
            </p>

            <button
              type="button"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </button>

          </section>
        )}

      {/* =================================================
          TABLA
      ================================================= */}

      {!loading &&
        !error &&
        clientesTabla.length > 0 && (

          <section className="clientes-table-container">

            <table className="clientes-table">

              <thead>

                <tr>

                  <th>
                    CLIENTE
                  </th>

                  <th>
                    TELÉFONO
                  </th>

                  <th>
                    EDAD
                  </th>

                  <th>
                    VISITAS
                  </th>

                  <th>
                    TOTAL GASTADO
                  </th>

                  <th>
                    ÚLTIMA VISITA
                  </th>

                </tr>

              </thead>

              <tbody>

                {clientesTabla.map(
                  (cliente) => (

                    <tr
                      key={
                        cliente.ID_CLIENTE
                      }
                      onClick={() =>
                        setClienteSeleccionado(
                          cliente
                        )
                      }
                    >

                      <td>

                        <div className="cliente-table-name">

                          <div className="cliente-avatar">

                            {cliente.NOMBRE
                              .charAt(0)
                              .toUpperCase()}

                          </div>

                          <div>

                            <strong>
                              {cliente.NOMBRE}
                            </strong>

                            <small>
                              {
                                cliente.ID_CLIENTE
                              }
                            </small>

                          </div>

                        </div>

                      </td>

                      <td>
                        {cliente.TELEFONO}
                      </td>

                      <td>
                        {cliente.RANGO_EDAD ||
                          "Sin registrar"}
                      </td>

                      <td>
                        {cliente.TOTAL_VISITAS}
                      </td>

                      <td>
                        {formatearDinero(
                          cliente.TOTAL_GASTADO
                        )}
                      </td>

                      <td>
                        {formatearFecha(
                          cliente.ULTIMA_ATENCION
                        )}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </section>

        )}

      {/* =================================================
          TARJETA / MODAL
      ================================================= */}

      {clienteSeleccionado && (

        <div
          className="cliente-modal-overlay"
          onClick={() =>
            setClienteSeleccionado(
              null
            )
          }
        >

          <div
            className="cliente-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* CERRAR */}

            <button
              type="button"
              className="cliente-modal-close"
              onClick={() =>
                setClienteSeleccionado(
                  null
                )
              }
            >
              ×
            </button>

            {/* =========================================
                CABECERA
            ========================================= */}

            <div className="cliente-modal-header">

              <div className="cliente-modal-avatar">

                {clienteSeleccionado.NOMBRE
                  .charAt(0)
                  .toUpperCase()}

              </div>

              <div>

                <h2>
                  {
                    clienteSeleccionado.NOMBRE
                  }
                </h2>

                <p>
                  Cliente desde{" "}
                  {formatearFecha(
                    clienteSeleccionado.PRIMERA_ATENCION
                  )}
                </p>

              </div>

            </div>

            {/* =========================================
                INFORMACIÓN
            ========================================= */}

            <div className="cliente-modal-info">

              <div>

                <span>
                  TELÉFONO
                </span>

                <strong>
                  {
                    clienteSeleccionado.TELEFONO
                  }
                </strong>

              </div>

              <div>

                <span>
                  RANGO DE EDAD
                </span>

                <strong>
                  {
                    clienteSeleccionado.RANGO_EDAD ||
                    "Sin registrar"
                  }
                </strong>

              </div>

              <div>

                <span>
                  VISITAS
                </span>

                <strong>
                  {
                    clienteSeleccionado.TOTAL_VISITAS
                  }
                </strong>

              </div>

              <div>

                <span>
                  TOTAL GASTADO
                </span>

                <strong>
                  {formatearDinero(
                    clienteSeleccionado.TOTAL_GASTADO
                  )}
                </strong>

              </div>

              <div>

                <span>
                  CLIENTE DESDE
                </span>

                <strong>
                  {formatearFecha(
                    clienteSeleccionado.PRIMERA_ATENCION
                  )}
                </strong>

              </div>

              <div>

                <span>
                  ÚLTIMA VISITA
                </span>

                <strong>
                  {formatearFecha(
                    clienteSeleccionado.ULTIMA_ATENCION
                  )}
                </strong>

              </div>

            </div>

            {/* =========================================
                ÚLTIMOS 3 BARBEROS
            ========================================= */}

            <div className="cliente-modal-section">

              <div className="cliente-section-heading">

                <div>

                  <h3>
                    BARBEROS QUE LO ATENDIERON
                  </h3>

                  <p>
                    Últimos 3 barberos
                  </p>

                </div>

              </div>

              {(() => {
                const ultimosBarberos =
                  obtenerUltimosTresBarberos(
                    clienteSeleccionado
                  );

                return ultimosBarberos.length >
                  0 ? (

                  <div className="cliente-barberos-list">

                    {ultimosBarberos.map(
                      (
                        barbero,
                        index
                      ) => (

                        <div
                          className="cliente-barbero-item"
                          key={
                            barbero.id ||
                            barbero.nombre ||
                            index
                          }
                        >

                          <div className="cliente-barbero-avatar">

                            {barbero.nombre
                              .charAt(0)
                              .toUpperCase()}

                          </div>

                          <div className="cliente-barbero-info">

                            <strong>
                              {
                                barbero.nombre
                              }
                            </strong>

                            <span>
                              {barbero.id
                                ? `ID: ${barbero.id}`
                                : "Barbero registrado"}
                            </span>

                          </div>

                          <div className="cliente-barbero-position">
                            #{index + 1}
                          </div>

                        </div>

                      )
                    )}

                  </div>

                ) : (

                  <p className="cliente-no-data">
                    No hay información de barberos.
                  </p>

                );
              })()}

            </div>

            {/* =========================================
                HISTORIAL
            ========================================= */}

            <div className="cliente-modal-section">

              <h3>
                ÚLTIMAS ATENCIONES
              </h3>

              {clienteSeleccionado.HISTORIAL?.length >
              0 ? (

                <div className="cliente-history">

                  {clienteSeleccionado.HISTORIAL
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(
                          b.fecha
                        ).getTime() -
                        new Date(
                          a.fecha
                        ).getTime()
                    )
                    .slice(0, 10)
                    .map(
                      (
                        atencion,
                        index
                      ) => (

                        <div
                          className="cliente-history-row"
                          key={`${atencion.fecha}-${index}`}
                        >

                          <div>

                            <strong>
                              {
                                atencion.servicio
                              }
                            </strong>

                            <span>
                              {
                                atencion.barbero ||
                                "Sin barbero registrado"
                              }
                            </span>

                          </div>

                          <div>

                            <strong>
                              {formatearDinero(
                                atencion.monto
                              )}
                            </strong>

                            <span>
                              {
                                atencion.metodoPago ||
                                "Sin registro"
                              }
                            </span>

                          </div>

                          <time>
                            {formatearFecha(
                              atencion.fecha
                            )}
                          </time>

                        </div>

                      )
                    )}

                </div>

              ) : (

                <p className="cliente-no-data">
                  No hay historial disponible.
                </p>

              )}

            </div>

          </div>

        </div>

      )}

    </main>
  );
}