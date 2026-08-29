"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";

type RangoEdad =
  | "Niño"
  | "Adolescente"
  | "Joven"
  | "Adulto"
  | "Adulto mayor";

type MetodoPago =
  | ""
  | "Banco"
  | "QR"
  | "Efectivo"
  | "Transferencia"
  | "Tigo Money"
  | "Yape"
  | "Altoke"
  | "Otro";

interface Cliente {
  id: string;
  telefono: string;
  nombre: string;
  rangoEdad: RangoEdad;
  primeraAtencion: string;
  ultimaAtencion: string;
  totalVisitas: number;
  totalGastado: number;
  estadoCliente: "Nuevo" | "Frecuente";
}

interface Servicio {
  id: string;
  nombre: string;
  precio: number;
  activo?: boolean;
}

interface Barbero {
  id: string;
  nombre: string;
  activo?: boolean;
  AUTH_UID?: string;
  UID?: string;
  ID_BARBERO?: string;
}

interface Usuario {
  nombre?: string;
  rol?: "super_admin" | "admin" | "barbero";
  barberoId?: string;
  ID_BARBERO?: string;
  AUTH_UID?: string;
  UID?: string;
  uid?: string;
  id?: string;
  ID_BARBERIA?: string;
  barberiaId?: string;
  BARBERIA_ID?: string;
  BARBERIAID?: string;
}

interface Atencion {
  id: string;
  clienteId: string;
  telefono: string;
  clienteNombre: string;
  rangoEdad: RangoEdad;
  barberoId: string;
  barberoNombre: string;
  servicioId: string;
  servicioNombre: string;
  pago: number;
  metodoPago: Exclude<MetodoPago, "">;
  fecha: string;
  origen: "Sin reserva" | "Reserva";
}

const RANGOS_EDAD: RangoEdad[] = [
  "Niño",
  "Adolescente",
  "Joven",
  "Adulto",
  "Adulto mayor",
];

const METODOS_PAGO: Exclude<MetodoPago, "">[] = [
  "Banco",
  "QR",
  "Efectivo",
  "Transferencia",
  "Tigo Money",
  "Yape",
  "Altoke",
  "Otro",
];

function obtenerFechaActual() {
  const ahora = new Date();

  return ahora.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function obtenerFechaISO() {
  return new Date().toISOString();
}

/*
 * ============================================================
 * VALIDACIONES
 * ============================================================
 */

/*
 * Teléfono:
 * SOLO números.
 */
function limpiarTelefono(valor: string) {
  return valor.replace(/\D/g, "");
}

/*
 * Nombre:
 * Solo letras, espacios, tildes, ñ y ü.
 */
function limpiarNombre(valor: string) {
  return valor.replace(
    /[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g,
    ""
  );
}

/*
 * Pago:
 * Solo números y un punto decimal.
 */
function limpiarPago(valor: string) {
  let resultado = valor.replace(/[^0-9.]/g, "");

  const partes = resultado.split(".");

  if (partes.length > 2) {
    resultado =
      partes[0] + "." + partes.slice(1).join("");
  }

  return resultado;
}

function normalizarTelefono(telefono: string) {
  return telefono.replace(/\D/g, "");
}

function obtenerBarberiaId(usuario: Usuario | null) {
  if (!usuario) return "";

  return String(
    usuario.ID_BARBERIA ||
      usuario.barberiaId ||
      usuario.BARBERIA_ID ||
      usuario.BARBERIAID ||
      ""
  ).trim();
}

async function getToken() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No hay una sesión iniciada.");
  }

  return user.getIdToken();
}

export default function AtencionPagosPage() {
  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  // ============================================================
  // CONTEXTO DE RESERVA
  // Si llegamos desde "Atender Reserva", estos datos se cargan
  // automáticamente y no se obliga al usuario a escribirlos otra vez.
  // ============================================================

  const [reservaContexto, setReservaContexto] = useState<{
    id: string;
    idCliente: string;
    idBarberia: string;
    idBarbero: string;
    barberoNombre: string;
    fecha: string;
    horaInicio: string;
    duracion: number;
  } | null>(null);

  const [barberoReserva, setBarberoReserva] =
    useState<Barbero | null>(null);

  const [cargandoClienteReserva, setCargandoClienteReserva] =
    useState(false);

  const [telefonoReservaContexto, setTelefonoReservaContexto] =
    useState("");

  const [telefono, setTelefono] =
    useState("");

  const [nombre, setNombre] =
    useState("");

  const [rangoEdad, setRangoEdad] =
    useState<RangoEdad | "">("");

  const [clienteEncontrado, setClienteEncontrado] =
    useState<Cliente | null>(null);

  const [barberos, setBarberos] =
    useState<Barbero[]>([]);

  const [servicios, setServicios] =
    useState<Servicio[]>([]);

  const [servicioId, setServicioId] =
    useState("");

  const [pago, setPago] =
    useState("");

  const [metodoPago, setMetodoPago] =
    useState<MetodoPago>("");

  const [origen, setOrigen] =
    useState<"Sin reserva" | "Reserva">(
      "Sin reserva"
    );

  const [mensaje, setMensaje] =
    useState("");

  const [tipoMensaje, setTipoMensaje] =
    useState<"success" | "error" | "">("");

  // Popup elegante de confirmación después de registrar una atención.
  const [mostrarExito, setMostrarExito] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  /*
   * ============================================================
   * CARGAR USUARIO
   * ============================================================
   */

  useEffect(() => {
    const datos =
      sessionStorage.getItem(
        "nexos_usuario"
      );

    if (!datos) return;

    try {
      const usuarioGuardado =
        JSON.parse(datos);

      setUsuario(usuarioGuardado);
    } catch (error) {
      console.error(
        "Error leyendo usuario:",
        error
      );
    }
  }, []);

  /*
   * ============================================================
   * CARGAR BARBEROS Y SERVICIOS
   * ============================================================
   */

  useEffect(() => {
    if (!usuario) return;

    const cargarDatos = async () => {
      try {
        const barberiaId = obtenerBarberiaId(usuario);

        if (!barberiaId) {
          console.error(
            "El usuario no tiene ID_BARBERIA."
          );
          setBarberos([]);
          setServicios([]);
          return;
        }

        /*
         * BARBEROS
         *
         * Por ahora se mantienen desde localStorage porque
         * la sección BARBEROS ya los guarda allí.
         */
        const barberosGuardados =
          localStorage.getItem("nexos_barberos");

        if (barberosGuardados) {
          try {
            const barberosJSON = JSON.parse(
              barberosGuardados
            );

            const barberosNormalizados: Barbero[] =
              (Array.isArray(barberosJSON)
                ? barberosJSON
                : []
              ).map((barbero: any) => ({
                id: String(
                  barbero.ID_BARBERO ||
                    barbero.id ||
                    ""
                ).trim(),
                nombre: String(
                  barbero.NOMBRE_COMPLETO ||
                    barbero.NOMBRE ||
                    barbero.nombre ||
                    ""
                ).trim(),
                AUTH_UID: String(
                  barbero.AUTH_UID ||
                    barbero.UID ||
                    ""
                ).trim(),
                UID: String(
                  barbero.UID ||
                    barbero.AUTH_UID ||
                    ""
                ).trim(),
                ID_BARBERO: String(
                  barbero.ID_BARBERO ||
                    barbero.id ||
                    ""
                ).trim(),
                activo: ![
                  "inactivo",
                  "desactivado",
                  "false",
                ].includes(
                  String(barbero.ESTADO || "")
                    .trim()
                    .toLowerCase()
                ),
              }));

            setBarberos(barberosNormalizados);
          } catch (error) {
            console.error(
              "Error leyendo barberos:",
              error
            );
            setBarberos([]);
          }
        } else {
          setBarberos([]);
        }

        /*
         * SERVICIOS
         *
         * Se cargan desde Google Sheets mediante la API.
         */
        const response = await fetch(
          `/servicios/api?barberiaId=${encodeURIComponent(
            barberiaId
          )}`
        );

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(
            data.error ||
              "No se pudieron cargar los servicios."
          );
        }

        const serviciosAPI: Servicio[] =
          (Array.isArray(data.servicios)
            ? data.servicios
            : []
          ).map((servicio: any) => ({
            id: String(
              servicio.ID_SERVICIO || ""
            ).trim(),
            nombre: String(
              servicio.NOMBRE || ""
            ).trim(),
            precio: Number(
              servicio.PRECIO || 0
            ),
            activo:
              !["inactivo", "desactivado", "false"].includes(
                String(
                  servicio.ESTADO || ""
                )
                  .trim()
                  .toLowerCase()
              ),
          }));

        setServicios(
          serviciosAPI.filter(
            (servicio) =>
              servicio.id &&
              servicio.nombre &&
              servicio.activo !== false
          )
        );
      } catch (error) {
        console.error(
          "Error cargando barberos o servicios:",
          error
        );

        setServicios([]);
      }
    };

    cargarDatos();
  }, [usuario]);

  /*
   * ============================================================
   * RESPONSABLE ACTUAL
   * ============================================================
   */

  const barberoActual =
    useMemo(() => {
      // Si la atención viene de una reserva, el barbero de la reserva
      // tiene prioridad sobre el usuario que inició sesión.
      if (barberoReserva) {
        return barberoReserva;
      }

      if (!usuario) return null;

      const rolUsuario = String(usuario.rol || "")
        .trim()
        .toLowerCase();

      // ADMINISTRADOR
      if (rolUsuario === "admin") {
        return {
          id: String(
            usuario.ID_BARBERO ||
              usuario.barberoId ||
              usuario.uid ||
              usuario.id ||
              "ADMIN"
          ).trim(),
          nombre: String(
            usuario.nombre ||
              "Administrador"
          ).trim(),
        };
      }

      // ============================================================
      // BARBERO AUTENTICADO
      // Primero buscamos por ID_BARBERO, luego por UID de Firebase
      // y finalmente por nombre.
      // ============================================================

      const firebaseUid = String(
        auth.currentUser?.uid ||
          usuario.uid ||
          usuario.AUTH_UID ||
          usuario.UID ||
          ""
      ).trim();

      const idBarberoUsuario = String(
        usuario.barberoId ||
          usuario.ID_BARBERO ||
          ""
      ).trim();

      if (idBarberoUsuario) {
        const encontradoPorId = barberos.find((barbero) =>
          String(
            barbero.id ||
              barbero.ID_BARBERO ||
              ""
          ).trim() === idBarberoUsuario
        );

        if (encontradoPorId) {
          return encontradoPorId;
        }
      }

      if (firebaseUid) {
        const encontradoPorUid = barberos.find((barbero) => {
          const uidBarbero = String(
            barbero.AUTH_UID ||
              barbero.UID ||
              ""
          ).trim();

          return uidBarbero !== "" && uidBarbero === firebaseUid;
        });

        if (encontradoPorUid) {
          return encontradoPorUid;
        }
      }

      if (usuario.nombre) {
        const nombreUsuario = String(usuario.nombre)
          .trim()
          .toLowerCase();

        const encontradoPorNombre = barberos.find((barbero) =>
          String(barbero.nombre || "")
            .trim()
            .toLowerCase() === nombreUsuario
        );

        if (encontradoPorNombre) {
          return encontradoPorNombre;
        }
      }

      // ============================================================
      // FALLBACK IMPORTANTE
      // Si el listado local de barberos todavía no cargó o no tiene
      // el registro del usuario, usamos al usuario autenticado.
      // Esto evita que un barbero quede bloqueado con barberoActual=null.
      // ============================================================
      if (rolUsuario === "barbero") {
        const idFallback = String(
          idBarberoUsuario ||
            firebaseUid ||
            usuario.id ||
            "BARBERO"
        ).trim();

        const nombreFallback = String(
          usuario.nombre ||
            "Barbero"
        ).trim();

        return {
          id: idFallback,
          nombre: nombreFallback,
        };
      }

      return null;
    }, [usuario, barberos, barberoReserva]);

  /*
   * ============================================================
   * CARGAR CONTEXTO DE RESERVA
   * ============================================================
   */

  useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    const reservaId = String(searchParams.get("reservaId") || "").trim();
    const idCliente = String(searchParams.get("idCliente") || "").trim();
    const idBarberia = String(searchParams.get("idBarberia") || "").trim();
    const idBarbero = String(searchParams.get("idBarbero") || "").trim();
    const barberoNombre = String(searchParams.get("barberoNombre") || "").trim();
    const nombreCliente = String(searchParams.get("nombreCliente") || "").trim();
    const telefonoReserva = limpiarTelefono(searchParams.get("telefono") || "");
    const rangoReserva = String(searchParams.get("rangoEdad") || "").trim() as RangoEdad | "";
    const fecha = String(searchParams.get("fecha") || "").trim();
    const horaInicio = String(searchParams.get("horaInicio") || "").trim();
    const duracion = Number(searchParams.get("duracion") || 45);

    if (!reservaId) {
      return;
    }

    const contexto = {
      id: reservaId,
      idCliente,
      idBarberia,
      idBarbero,
      barberoNombre,
      fecha,
      horaInicio,
      duracion: duracion === 60 ? 60 : 45,
    };

    setReservaContexto(contexto);
    setOrigen("Reserva");

    if (idBarbero || barberoNombre) {
      setBarberoReserva({
        id: idBarbero,
        nombre: barberoNombre || "Barbero de la reserva",
      });
    }

    if (telefonoReserva) {
      setTelefonoReservaContexto(telefonoReserva);
      setTelefono(telefonoReserva);
    }

    if (nombreCliente) {
      setNombre(nombreCliente);
    }

    if (rangoReserva && RANGOS_EDAD.includes(rangoReserva)) {
      setRangoEdad(rangoReserva);
    }

    // Primero intentamos usar la información que ya viene en la reserva.
    if (idCliente || telefonoReserva || nombreCliente) {
      setCargandoClienteReserva(true);

      const cargarCliente = async () => {
        try {
          const barberiaId = idBarberia || obtenerBarberiaId(usuario);
          if (!barberiaId) return;

          const response = await fetch(
            `/clientes/api?barberiaId=${encodeURIComponent(barberiaId)}`,
            { cache: "no-store" }
          );

          if (!response.ok) return;

          const data = await response.json();
          const filas = Array.isArray(data?.clientes) ? data.clientes : [];

          const encontrado = filas.find((item: any) => {
            const itemId = String(item?.ID_CLIENTE || item?.id || "").trim();
            const itemTelefono = normalizarTelefono(
              String(item?.TELEFONO || item?.telefono || "")
            );

            return (idCliente && itemId === idCliente) ||
              (telefonoReserva && itemTelefono === telefonoReserva);
          });

          if (encontrado) {
            const cliente: Cliente = {
              id: String(encontrado.ID_CLIENTE || encontrado.id || idCliente).trim(),
              telefono: limpiarTelefono(
                String(encontrado.TELEFONO || encontrado.telefono || telefonoReserva)
              ),
              nombre: String(
                encontrado.NOMBRE || encontrado.nombre || nombreCliente
              ).trim(),
              rangoEdad: (String(
                encontrado.RANGO_EDAD || encontrado.rangoEdad || rangoReserva
              ).trim() || "Joven") as RangoEdad,
              primeraAtencion: String(
                encontrado.PRIMERA_ATENCION || encontrado.primeraAtencion || ""
              ),
              ultimaAtencion: String(
                encontrado.ULTIMA_ATENCION || encontrado.ultimaAtencion || ""
              ),
              totalVisitas: Number(
                encontrado.TOTAL_VISITAS ?? encontrado.totalVisitas ?? 0
              ),
              totalGastado: Number(
                encontrado.TOTAL_GASTADO ?? encontrado.totalGastado ?? 0
              ),
              estadoCliente:
                Number(encontrado.TOTAL_VISITAS ?? encontrado.totalVisitas ?? 0) >= 2
                  ? "Frecuente"
                  : "Nuevo",
            };

            setClienteEncontrado(cliente);
            setTelefono(cliente.telefono);
            setNombre(cliente.nombre);

            if (cliente.rangoEdad) {
              setRangoEdad(cliente.rangoEdad);
            }
          } else if (nombreCliente || telefonoReserva) {
            // Si la reserva ya trae los datos, no dejamos el formulario vacío.
            const clienteReserva: Cliente = {
              id: idCliente,
              telefono: telefonoReserva,
              nombre: nombreCliente,
              rangoEdad: rangoReserva || "Joven",
              primeraAtencion: "",
              ultimaAtencion: "",
              totalVisitas: 0,
              totalGastado: 0,
              estadoCliente: "Nuevo",
            };

            setClienteEncontrado(clienteReserva);
            setTelefono(
              clienteReserva.telefono
            );
            setNombre(
              clienteReserva.nombre
            );

            if (clienteReserva.rangoEdad) {
              setRangoEdad(
                clienteReserva.rangoEdad
              );
            }
          }
        } catch (error) {
          console.error("Error cargando cliente de la reserva:", error);
        } finally {
          setCargandoClienteReserva(false);
        }
      };

      void cargarCliente();
    }
  }, [usuario]);

  /*
   * ============================================================
   * BUSCAR CLIENTE POR TELÉFONO
   * ============================================================
   */

  useEffect(() => {
    const telefonoNormalizado =
      normalizarTelefono(telefono);

    if (!telefonoNormalizado) {
      /*
       * Si todavía estamos cargando una reserva, no eliminamos
       * los datos que llegaron desde la reserva.
       */
      if (reservaContexto) {
        return;
      }

      setClienteEncontrado(null);
      return;
    }

    /*
     * ============================================================
     * RESERVA
     *
     * Cuando entramos desde "Atender Reserva", la reserva ya es
     * la fuente de verdad para este cliente. El efecto anterior
     * consultaba localStorage después y, si no encontraba allí
     * el teléfono, hacía setNombre("").
     *
     * Ese era el motivo por el que en Atención/Pagos aparecía
     * el teléfono pero desaparecía el nombre.
     *
     * Mientras el teléfono siga siendo el de la reserva, NO
     * consultamos localStorage ni sobrescribimos el nombre,
     * teléfono o rango que ya fueron cargados desde Sheets.
     * ============================================================
     */
    if (
      reservaContexto &&
      telefonoReservaContexto &&
      telefonoNormalizado ===
        normalizarTelefono(
          telefonoReservaContexto
        )
    ) {
      return;
    }

    const clientesGuardados =
      localStorage.getItem(
        "nexos_clientes"
      );

    if (!clientesGuardados) {
      setClienteEncontrado(null);
      return;
    }

    try {
      const clientes: Cliente[] =
        JSON.parse(
          clientesGuardados
        );

      const cliente =
        clientes.find(
          (item) =>
            normalizarTelefono(
              item.telefono
            ) ===
            telefonoNormalizado
        );

      if (cliente) {
        setClienteEncontrado(cliente);
        setNombre(cliente.nombre);
        setRangoEdad(cliente.rangoEdad);
      } else {
        /*
         * Si estamos escribiendo un teléfono distinto al de la
         * reserva, sí permitimos la búsqueda normal por teléfono.
         */
        setClienteEncontrado(null);
        setNombre("");
        setRangoEdad("");
      }
    } catch (error) {
      console.error(
        "Error buscando cliente:",
        error
      );
    }
  }, [
    telefono,
    reservaContexto,
    telefonoReservaContexto,
  ]);

  /*
   * ============================================================
   * GUARDAR ATENCIÓN
   * ============================================================
   */

  const registrarAtencion =
    async () => {
      setMensaje("");
      setTipoMensaje("");

      /*
       * ========================================================
       * VALIDAR TELÉFONO
       * ========================================================
       */

      const telefonoNormalizado =
        normalizarTelefono(
          telefono
        );

      if (!telefonoNormalizado) {
        setTipoMensaje("error");

        setMensaje(
          "Ingresa el número de teléfono."
        );

        return;
      }

      if (
        telefono !==
        telefonoNormalizado
      ) {
        setTipoMensaje("error");

        setMensaje(
          "El teléfono solo puede contener números."
        );

        return;
      }

      /*
       * ========================================================
       * VALIDAR NOMBRE
       * ========================================================
       */

      const nombreLimpio =
        nombre.trim();

      if (!nombreLimpio) {
        setTipoMensaje("error");

        setMensaje(
          "Ingresa el nombre completo del cliente."
        );

        return;
      }

      if (
        !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(
          nombreLimpio
        )
      ) {
        setTipoMensaje("error");

        setMensaje(
          "El nombre solo puede contener letras y espacios."
        );

        return;
      }

      /*
       * ========================================================
       * VALIDAR EDAD
       * ========================================================
       */

      if (!rangoEdad) {
        setTipoMensaje("error");

        setMensaje(
          "Selecciona el rango de edad."
        );

        return;
      }

      /*
       * ========================================================
       * VALIDAR SERVICIO
       * ========================================================
       */

      if (!servicioId) {
        setTipoMensaje("error");

        setMensaje(
          "Selecciona el servicio."
        );

        return;
      }

      /*
       * ========================================================
       * VALIDAR PAGO
       * ========================================================
       */

      if (!pago.trim()) {
        setTipoMensaje("error");

        setMensaje(
          "Ingresa el pago recibido."
        );

        return;
      }

      if (
        !/^\d+(\.\d+)?$/.test(
          pago
        )
      ) {
        setTipoMensaje("error");

        setMensaje(
          "El pago solo puede contener números."
        );

        return;
      }

      const pagoNumerico =
        Number(pago);

      if (
        !Number.isFinite(
          pagoNumerico
        ) ||
        pagoNumerico <= 0
      ) {
        setTipoMensaje("error");

        setMensaje(
          "El pago debe ser mayor a 0."
        );

        return;
      }

      /*
       * ========================================================
       * VALIDAR MÉTODO DE PAGO
       * ========================================================
       */

      if (!metodoPago) {
        setTipoMensaje("error");

        setMensaje(
          "Selecciona el método de pago."
        );

        return;
      }

      /*
       * ========================================================
       * VALIDAR BARBERO / ADMIN
       * ========================================================
       */

      if (!barberoActual) {
        setTipoMensaje("error");

        setMensaje(
          "No se pudo identificar al responsable que realiza la atención."
        );

        return;
      }

      /*
       * ========================================================
       * BUSCAR SERVICIO
       * ========================================================
       */

      const servicioActual =
        servicios.find(
          (servicio) =>
            servicio.id ===
            servicioId
        );

      if (!servicioActual) {
        setTipoMensaje("error");

        setMensaje(
          "No se encontró el servicio seleccionado."
        );

        return;
      }

      setGuardando(true);

    try {
      const fechaISO = obtenerFechaISO();
      const barberiaId = obtenerBarberiaId(usuario);

      if (!barberiaId) {
        throw new Error(
          "No se pudo identificar la barbería del usuario."
        );
      }

      const token = await getToken();

      /*
       * GOOGLE SHEETS
       *
       * La API se encarga de:
       * 1. Buscar/crear el cliente en CLIENTES.
       * 2. Actualizar visitas y total gastado.
       * 3. Registrar la atención en ATENCIONES.
       * 4. Devolver los IDs reales creados en Sheets.
       */
      const response = await fetch(
        "/atencion-pagos/api",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            barberiaId,
            clienteId:
              clienteEncontrado?.id || "",
            nombre: nombreLimpio,
            telefono: telefonoNormalizado,
            rangoEdad,
            barberoId: barberoActual.id,
            barberoNombre: barberoActual.nombre,
            servicioId: servicioActual.id,
            servicioNombre: servicioActual.nombre,
            monto: pagoNumerico,
            metodoPago,
            tipoAtencion: origen,
            reservaId: reservaContexto?.id || "",
            fecha: fechaISO,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            "No se pudo registrar la atención."
        );
      }

      /*
       * ========================================================
       * ELIMINAR RESERVA ATENDIDA
       * ========================================================
       *
       * Si la atención vino desde una reserva, la reserva se
       * elimina únicamente DESPUÉS de que la atención y el pago
       * hayan sido registrados correctamente.
       *
       * No tocamos el popup ni el resto del flujo.
       */
      if (reservaContexto?.id) {
        const eliminarReservaResponse = await fetch(
          "/reservas/api",
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: reservaContexto.id,
              idBarberia: reservaContexto.idBarberia || barberiaId,
            }),
          }
        );

        const eliminarReservaData =
          await eliminarReservaResponse.json();

        if (
          !eliminarReservaResponse.ok ||
          !eliminarReservaData.ok
        ) {
          throw new Error(
            eliminarReservaData.error ||
              "La atención se registró, pero no se pudo eliminar la reserva."
          );
        }
      }

      const clienteId = String(
        data.cliente?.ID_CLIENTE ||
          clienteEncontrado?.id ||
          ""
      ).trim();

      const atencionId = String(
        data.atencion?.ID_ATENCION ||
          crypto.randomUUID()
      ).trim();

      /*
       * ========================================================
       * ACTUALIZAR CACHÉ LOCAL
       * ========================================================
       *
       * Google Sheets es la fuente principal.
       * localStorage solamente permite que la interfaz
       * encuentre rápidamente clientes ya registrados.
       */
      const clientesGuardados =
        localStorage.getItem("nexos_clientes");

      const clientes: Cliente[] =
        clientesGuardados
          ? JSON.parse(clientesGuardados)
          : [];

      const indiceCliente = clientes.findIndex(
        (item) =>
          normalizarTelefono(item.telefono) ===
          telefonoNormalizado
      );

      if (indiceCliente >= 0) {
        clientes[indiceCliente] = {
          ...clientes[indiceCliente],
          id: clienteId ||
            clientes[indiceCliente].id,
          nombre: nombreLimpio,
          telefono: telefonoNormalizado,
          rangoEdad,
          ultimaAtencion: fechaISO,
          totalVisitas:
            clientes[indiceCliente].totalVisitas + 1,
          totalGastado:
            clientes[indiceCliente].totalGastado +
            pagoNumerico,
          estadoCliente:
            clientes[indiceCliente].totalVisitas + 1 >= 2
              ? "Frecuente"
              : "Nuevo",
        };
      } else {
        clientes.push({
          id: clienteId,
          telefono: telefonoNormalizado,
          nombre: nombreLimpio,
          rangoEdad,
          primeraAtencion: fechaISO,
          ultimaAtencion: fechaISO,
          totalVisitas: 1,
          totalGastado: pagoNumerico,
          estadoCliente: "Nuevo",
        });
      }

      localStorage.setItem(
        "nexos_clientes",
        JSON.stringify(clientes)
      );

      /*
       * ========================================================
       * ATENCIONES LOCALES
       * ========================================================
       */
      const atencionesGuardadas =
        localStorage.getItem(
          "nexos_atenciones"
        );

      const atenciones: Atencion[] =
        atencionesGuardadas
          ? JSON.parse(atencionesGuardadas)
          : [];

      const nuevaAtencion: Atencion = {
        id: atencionId,
        clienteId,
        telefono: telefonoNormalizado,
        clienteNombre: nombreLimpio,
        rangoEdad,
        barberoId: barberoActual.id,
        barberoNombre: barberoActual.nombre,
        servicioId: servicioActual.id,
        servicioNombre: servicioActual.nombre,
        pago: pagoNumerico,
        metodoPago: metodoPago as Exclude<
          MetodoPago,
          ""
        >,
        fecha: fechaISO,
        origen,
      };

      atenciones.push(nuevaAtencion);

      localStorage.setItem(
        "nexos_atenciones",
        JSON.stringify(atenciones)
      );

      /*
       * ========================================================
       * FACTURACIÓN LOCAL
       * ========================================================
       *
       * El dinero ya quedó registrado en ATENCIONES de
       * Google Sheets. Aquí solamente dejamos una copia
       * local para los módulos que todavía consumen
       * nexos_facturacion.
       */
      const facturacionGuardada =
        localStorage.getItem(
          "nexos_facturacion"
        );

      const facturacion =
        facturacionGuardada
          ? JSON.parse(facturacionGuardada)
          : [];

      facturacion.push({
        id: crypto.randomUUID(),
        atencionId,
        fecha: fechaISO,
        clienteId,
        clienteNombre: nombreLimpio,
        barberoId: barberoActual.id,
        barberoNombre: barberoActual.nombre,
        servicioId: servicioActual.id,
        servicioNombre: servicioActual.nombre,
        monto: pagoNumerico,
        metodoPago,
        origen,
      });

      localStorage.setItem(
        "nexos_facturacion",
        JSON.stringify(facturacion)
      );

      setTipoMensaje("success");
      setMensaje("");
      setMostrarExito(true);

      setTelefono("");
      setNombre("");
      setRangoEdad("");
      setServicioId("");
      setPago("");
      setMetodoPago("");
      setOrigen("Sin reserva");
      setClienteEncontrado(null);

      window.dispatchEvent(
        new CustomEvent("nexos-data-updated")
      );
    } catch (error: any) {
      console.error(
        "Error registrando atención:",
        error
      );

      setTipoMensaje("error");
      setMensaje(
        error?.message ||
          "Ocurrió un error al registrar la atención."
      );
    } finally {
      setGuardando(false);
    }
  };

  /*
   * ============================================================
   * LIMPIAR
   * ============================================================
   */

  const limpiarFormulario =
    () => {
      setTelefono("");

      setNombre("");

      setRangoEdad("");

      setServicioId("");

      setPago("");

      setMetodoPago("");

      setOrigen(
        "Sin reserva"
      );

      setClienteEncontrado(
        null
      );

      setMensaje("");

      setTipoMensaje("");
    };

  /*
   * ============================================================
   * INTERFAZ
   * ============================================================
   */

  return (
    <main className="atencion-page">

      {/* ======================================================
          ENCABEZADO
      ====================================================== */}

      <header className="atencion-header">

        <div>

          <span className="eyebrow">
            ATENCIÓN
          </span>

          <h1>
            Registrar atención
          </h1>

          <p>
            Registra cliente, servicio y pago desde un solo lugar.
          </p>

        </div>

        <div className="fecha-card">

          <span>
            FECHA DE ATENCIÓN
          </span>

          <strong>
            {obtenerFechaActual()}
          </strong>

        </div>

      </header>

      {/* ======================================================
          CONTENIDO
      ====================================================== */}

      <section className="atencion-grid">

        {/* ====================================================
            CLIENTE
        ==================================================== */}

        <div className="atencion-card">

          <div className="card-heading">

            <span>
              CLIENTE
            </span>

            <h2>
              Datos del cliente
            </h2>

            <p>
              Introduce el teléfono. Si ya existe, sus datos
              aparecerán automáticamente.
            </p>

          </div>

          {/* TELÉFONO */}

          <div className="form-group">

            <label>
              Teléfono
              <small>
                {" "}opcional
              </small>
            </label>

            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={telefono}
              onChange={(e) => {
                const valor =
                  limpiarTelefono(
                    e.target.value
                  );

                setTelefono(
                  valor
                );
              }}
              placeholder="Ej. 70000000"
            />

          </div>

          {/* CLIENTE ENCONTRADO */}

          {clienteEncontrado && (
            <div className="cliente-existente">

              <div className="cliente-check">
                ✓
              </div>

              <div>

                <strong>
                  Cliente encontrado
                </strong>

                <span>
                  Datos cargados automáticamente
                </span>

              </div>

            </div>
          )}

          {/* NOMBRE */}

          <div className="form-group">

            <label>
              Nombre completo
            </label>

            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                const valor =
                  limpiarNombre(
                    e.target.value
                  );

                setNombre(
                  valor
                );
              }}
              placeholder="Nombre y apellido"
            />

          </div>

          {/* RANGO DE EDAD */}

          <div className="form-group">

            <label>
              Rango de edad
            </label>

            <select
              value={rangoEdad}
              onChange={(e) =>
                setRangoEdad(
                  e.target.value as RangoEdad
                )
              }
            >

              <option value="">
                Seleccionar
              </option>

              {RANGOS_EDAD.map(
                (rango) => (
                  <option
                    key={rango}
                    value={rango}
                  >
                    {rango}
                  </option>
                )
              )}

            </select>

          </div>

          {/* INFORMACIÓN DEL CLIENTE */}

          {clienteEncontrado && (
            <div className="cliente-info-grid">

              <div>

                <span>
                  PRIMERA ATENCIÓN
                </span>

                <strong>
                  {new Date(
                    clienteEncontrado.primeraAtencion
                  ).toLocaleDateString(
                    "es-BO"
                  )}
                </strong>

              </div>

              <div>

                <span>
                  ÚLTIMA ATENCIÓN
                </span>

                <strong>
                  {new Date(
                    clienteEncontrado.ultimaAtencion
                  ).toLocaleDateString(
                    "es-BO"
                  )}
                </strong>

              </div>

              <div>

                <span>
                  VISITAS
                </span>

                <strong>
                  {
                    clienteEncontrado.totalVisitas
                  }
                </strong>

              </div>

              <div>

                <span>
                  CLIENTE
                </span>

                <strong
                  className={
                    clienteEncontrado.estadoCliente ===
                    "Frecuente"
                      ? "cliente-frecuente"
                      : "cliente-nuevo"
                  }
                >
                  {
                    clienteEncontrado.estadoCliente
                  }
                </strong>

              </div>

            </div>
          )}

        </div>

        {/* ====================================================
            ATENCIÓN / PAGO
        ==================================================== */}

        <div className="atencion-card">

          <div className="card-heading">

            <span>
              SERVICIO
            </span>

            <h2>
              Detalle de atención
            </h2>

            <p>
              El responsable se asigna automáticamente.
            </p>

          </div>

          {/* RESPONSABLE */}

          <div className="form-group">

            <label>
              Barbero
            </label>

            <div className="automatic-field">

              <div className="automatic-avatar">

                {barberoActual?.nombre
                  ?.charAt(0)
                  .toUpperCase() ||
                  "B"}

              </div>

              <div className="automatic-info">

                <strong>
                  {barberoActual?.nombre ||
                    usuario?.nombre ||
                    "Usuario actual"}
                </strong>

                <span>
                  Usuario actual
                </span>

              </div>

              <span className="automatic-badge">
                Automático
              </span>

            </div>

          </div>

          {/* SERVICIO */}

          <div className="form-group">

            <label>
              Servicio
            </label>

            <select
              value={servicioId}
              onChange={(e) =>
                setServicioId(
                  e.target.value
                )
              }
            >

              <option value="">
                Seleccionar servicio
              </option>

              {servicios
                .filter(
                  (servicio) =>
                    servicio.activo !==
                    false
                )
                .map(
                  (servicio) => (
                    <option
                      key={
                        servicio.id
                      }
                      value={
                        servicio.id
                      }
                    >
                      {
                        servicio.nombre
                      }
                    </option>
                  )
                )}

            </select>

          </div>

          {/* TIPO DE ATENCIÓN */}

          <div className="form-group">

            <label>
              Tipo de atención
            </label>

            <div className="segmented-control">

              <button
                type="button"
                className={
                  origen ===
                  "Sin reserva"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setOrigen(
                    "Sin reserva"
                  )
                }
              >
                Sin reserva
              </button>

              <button
                type="button"
                className={
                  origen ===
                  "Reserva"
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  setOrigen(
                    "Reserva"
                  )
                }
              >
                Reserva
              </button>

            </div>

          </div>

          {/* PAGO */}

          <div className="form-group">

            <label>
              Pago recibido
            </label>

            <div className="money-input">

              <span>
                Bs
              </span>

              <input
                type="text"
                inputMode="decimal"
                value={pago}
                onChange={(e) => {
                  const valor =
                    limpiarPago(
                      e.target.value
                    );

                  setPago(
                    valor
                  );
                }}
                placeholder="0"
              />

            </div>

          </div>

          {/* MÉTODO DE PAGO */}

          <div className="form-group">

            <label>
              Método de pago
            </label>

            <select
              value={metodoPago}
              onChange={(e) =>
                setMetodoPago(
                  e.target
                    .value as MetodoPago
                )
              }
            >

              <option value="">
                Seleccionar método de pago
              </option>

              {METODOS_PAGO.map(
                (metodo) => (
                  <option
                    key={metodo}
                    value={metodo}
                  >
                    {metodo}
                  </option>
                )
              )}

            </select>

          </div>

          {/* TOTAL */}

          <div className="total-line">

            <span>
              Total recibido
            </span>

            <strong>
              Bs{" "}
              {Number(
                pago || 0
              ).toFixed(2)}
            </strong>

          </div>

        </div>

      </section>

      {/* ======================================================
          MENSAJE
      ====================================================== */}

      {mensaje && tipoMensaje === "error" && (
        <div className="atencion-message error">
          {mensaje}
        </div>
      )}

      {/* ======================================================
          POPUP — PROCESO REALIZADO
      ====================================================== */}

      {mostrarExito && (
        <div
          className="proceso-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="proceso-realizado-titulo"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setMostrarExito(false);
            }
          }}
        >
          <div className="proceso-modal">
            <button
              type="button"
              className="proceso-modal-close"
              aria-label="Cerrar"
              onClick={() => setMostrarExito(false)}
            >
              ×
            </button>

            <div className="proceso-check" aria-hidden="true">
              ✓
            </div>

            <span className="proceso-eyebrow">
              PROCESO REALIZADO
            </span>

            <h2 id="proceso-realizado-titulo">
              Proceso Realizado
            </h2>

            <p>
              La atención y el pago se registraron correctamente.
            </p>

            <button
              type="button"
              className="proceso-modal-button"
              onClick={() => setMostrarExito(false)}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          ACCIONES
      ====================================================== */}

      <div className="atencion-actions">

        <button
          type="button"
          className="secondary-button"
          onClick={
            limpiarFormulario
          }
          disabled={guardando}
        >
          Limpiar
        </button>

        <button
          type="button"
          className="primary-button"
          onClick={
            registrarAtencion
          }
          disabled={guardando}
        >
          {guardando
            ? "Registrando..."
            : "Registrar atención"}
        </button>

      </div>

      <style jsx>{`
        .proceso-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(1, 8, 15, 0.78);
          backdrop-filter: blur(7px);
          -webkit-backdrop-filter: blur(7px);
        }

        .proceso-modal {
          position: relative;
          width: min(430px, 100%);
          padding: 38px 34px 32px;
          text-align: center;
          border: 1px solid rgba(0, 201, 232, 0.28);
          border-radius: 22px;
          background: linear-gradient(145deg, #0a202d 0%, #06151f 100%);
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45), 0 0 35px rgba(0, 198, 229, 0.08);
          animation: procesoModalEntrada 0.22s ease-out;
        }

        .proceso-modal-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 34px;
          height: 34px;
          border: 1px solid #173d50;
          border-radius: 10px;
          background: #081b27;
          color: #8ba6b5;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .proceso-modal-close:hover {
          color: #ffffff;
          border-color: #16c4e5;
        }

        .proceso-check {
          width: 82px;
          height: 82px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(41, 226, 172, 0.42);
          border-radius: 50%;
          background: rgba(22, 190, 143, 0.13);
          color: #36e0b0;
          font-size: 48px;
          line-height: 1;
          box-shadow: 0 0 0 8px rgba(22, 190, 143, 0.035), 0 0 35px rgba(22, 190, 143, 0.12);
        }

        .proceso-eyebrow {
          display: block;
          margin-bottom: 8px;
          color: #13c6e7;
          font-size: 12px;
          letter-spacing: 0.14em;
        }

        .proceso-modal h2 {
          margin: 0;
          color: #f5fbff;
          font-size: 26px;
          line-height: 1.2;
          font-weight: 600;
        }

        .proceso-modal p {
          margin: 12px auto 24px;
          max-width: 330px;
          color: #8da7b7;
          font-size: 14px;
          line-height: 1.6;
          font-weight: 400;
        }

        .proceso-modal-button {
          width: 100%;
          min-height: 48px;
          border: 1px solid #0ec3e4;
          border-radius: 12px;
          background: #0bb8d8;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .proceso-modal-button:hover {
          background: #10c7e8;
          transform: translateY(-1px);
          box-shadow: 0 10px 25px rgba(0, 194, 226, 0.16);
        }

        @keyframes procesoModalEntrada {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 560px) {
          .proceso-modal { padding: 34px 22px 24px; }
          .proceso-check { width: 72px; height: 72px; font-size: 42px; }
        }
      `}</style>

    </main>
  );
}