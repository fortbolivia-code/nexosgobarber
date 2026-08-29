"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* =========================================================
   TIPOS
========================================================= */

type UsuarioSesion = {
  uid: string;
  idBarberia: string;
  idUsuario: string;
  idBarbero: string;
  nombre: string;
  rol: string;
};

type Cliente = {
  id: string;
  nombre: string;
  telefono: string;
  rangoEdad: string;
};

type Barbero = {
  id: string;
  nombre: string;
};

type Reserva = {
  id: string;
  idBarberia: string;
  idCliente: string;
  idBarbero: string;
  fecha: string;
  horaInicio: string;
  duracion: number;
  horaFin: string;
  creadoPorUid: string;
  fechaCreacion: string;
  estado?: string;

  cliente: string;
  telefono: string;
  barbero: string;
};

type FormReserva = {
  idCliente: string;
  nombreCliente: string;
  telefono: string;
  fecha: string;
  horaInicio: string;
  duracion: 45 | 60;
  idBarbero: string;
};

/* =========================================================
   CONFIGURACIÓN DEL CALENDARIO
========================================================= */

/*
 * Estos horarios NO representan el horario comercial
 * de la barbería.
 *
 * Son únicamente la ventana visible del calendario.
 */

const CALENDARIO_DESDE = 8 * 60; // 08:00
const CALENDARIO_HASTA = 22 * 60; // 22:00

/*
 * Las casillas visuales serán de 30 minutos.
 *
 * Así podemos representar correctamente:
 *
 * 15:00 -> 15:45
 *
 * ocupando:
 *
 * 15:00
 * 15:30
 *
 * y liberando:
 *
 * 15:45
 */

const SLOT_MINUTOS = 30;

/* =========================================================
   UTILIDADES
========================================================= */

function pad(
  numero: number
) {
  return String(numero).padStart(
    2,
    "0"
  );
}

function fechaKey(
  fecha: Date
) {
  return `${fecha.getFullYear()}-${pad(
    fecha.getMonth() + 1
  )}-${pad(
    fecha.getDate()
  )}`;
}

function horaDesdeMinutos(
  minutos: number
) {
  const horas =
    Math.floor(
      minutos / 60
    );

  const mins =
    minutos % 60;

  return `${pad(horas)}:${pad(
    mins
  )}`;
}

function minutosDesdeHora(
  hora: string
) {
  const partes =
    String(hora)
      .split(":")
      .map(Number);

  return (
    Number(partes[0] || 0) *
      60 +
    Number(partes[1] || 0)
  );
}

function calcularHoraFin(
  horaInicio: string,
  duracion: number
) {
  return horaDesdeMinutos(
    minutosDesdeHora(
      horaInicio
    ) + duracion
  );
}

function agregarDias(
  fecha: Date,
  cantidad: number
) {
  const nueva =
    new Date(fecha);

  nueva.setDate(
    nueva.getDate() +
      cantidad
  );

  return nueva;
}

function inicioSemana(
  fecha: Date
) {
  const nueva =
    new Date(fecha);

  nueva.setHours(
    0,
    0,
    0,
    0
  );

  const dia =
    nueva.getDay();

  const diferencia =
    dia === 0
      ? 6
      : dia - 1;

  nueva.setDate(
    nueva.getDate() -
      diferencia
  );

  return nueva;
}

function esHoy(
  fecha: string
) {
  return (
    fechaKey(
      new Date()
    ) === fecha
  );
}

function nombreDia(
  fecha: Date
) {
  return fecha
    .toLocaleDateString(
      "es-BO",
      {
        weekday: "short",
      }
    )
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
}

function mesYAnio(
  fecha: Date
) {
  return fecha.toLocaleDateString(
    "es-BO",
    {
      month: "long",
      year: "numeric",
    }
  );
}

function fechaCorta(
  fecha: string
) {
  if (!fecha) {
    return "—";
  }

  const [anio, mes, dia] =
    fecha.split("-");

  return `${dia}/${mes}/${anio}`;
}

function normalizarTelefono(
  telefono: string
) {
  const limpio =
    String(
      telefono || ""
    ).replace(
      /\D/g,
      ""
    );

  if (!limpio) {
    return "";
  }

  if (
    limpio.startsWith("591")
  ) {
    return limpio;
  }

  return `591${limpio}`;
}

function enlaceWhatsApp(
  reserva: Reserva
) {
  const telefono =
    normalizarTelefono(
      reserva.telefono
    );

  if (!telefono) {
    return "";
  }

  const mensaje =
    encodeURIComponent(
      `Hola ${reserva.cliente} 👋

Te recordamos que tienes una cita en Nexos Barber el ${fechaCorta(
        reserva.fecha
      )} a las ${
        reserva.horaInicio
      } con ${
        reserva.barbero
      }.

¡Te esperamos!`
    );

  return `https://wa.me/${telefono}?text=${mensaje}`;
}

/* =========================================================
   RANGO DE UNA RESERVA
========================================================= */

function rangoReserva(
  reserva: Reserva
) {
  const inicio =
    minutosDesdeHora(
      reserva.horaInicio
    );

  const duracion =
    Number(
      reserva.duracion || 45
    );

  const fin =
    inicio + duracion;

  return {
    inicio,
    fin,
  };
}

/* =========================================================
   SOLAPAMIENTO
========================================================= */

function existeSolapamiento(
  inicioNuevo: number,
  finNuevo: number,
  reserva: Reserva,
  excluirId?: string
) {
  if (
    excluirId &&
    reserva.id === excluirId
  ) {
    return false;
  }

  /*
   * IMPORTANTE:
   *
   * Si:
   *
   * reserva termina 16:00
   * nueva empieza 16:00
   *
   * NO hay conflicto.
   */

  const {
    inicio,
    fin,
  } = rangoReserva(
    reserva
  );

  return (
    inicioNuevo < fin &&
    finNuevo > inicio
  );
}

/* =========================================================
   GENERAR HORARIOS VISUALES
========================================================= */

function generarSlots() {
  const slots: string[] = [];

  for (
    let minutos =
      CALENDARIO_DESDE;
    minutos <
      CALENDARIO_HASTA;
    minutos += SLOT_MINUTOS
  ) {
    slots.push(
      horaDesdeMinutos(
        minutos
      )
    );
  }

  return slots;
}

const SLOTS = generarSlots();

/* =========================================================
   CALENDARIO VISUAL
========================================================= */

// Cada fila visual representa 30 minutos.
// 45 min = 1.5 filas, 60 min = 2 filas.
const ALTURA_SLOT = 58;

/* =========================================================
   COMPONENTE
========================================================= */

export default function ReservasPage() {
  const [usuario, setUsuario] =
    useState<UsuarioSesion | null>(
      null
    );

  const [clientes, setClientes] =
    useState<Cliente[]>([]);

  const [barberos, setBarberos] =
    useState<Barbero[]>([]);

  const [reservas, setReservas] =
    useState<Reserva[]>([]);

  const [
    semanaActual,
    setSemanaActual,
  ] = useState(
    inicioSemana(
      new Date()
    )
  );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  // Bloqueo inmediato contra doble clic / doble envío.
  // useState no es suficiente porque React actualiza el estado
  // después del evento; useRef se bloquea de forma síncrona.
  const guardandoRef = useRef(false);

  const [
    modalReserva,
    setModalReserva,
  ] = useState(false);

  const [
    modalDetalle,
    setModalDetalle,
  ] = useState(false);

  const [
    modalCancelar,
    setModalCancelar,
  ] = useState(false);

  const [
    editando,
    setEditando,
  ] = useState(false);

  const [
    reservaSeleccionada,
    setReservaSeleccionada,
  ] = useState<Reserva | null>(
    null
  );

  const [
    busquedaCliente,
    setBusquedaCliente,
  ] = useState("");

  const [
    mostrarResultados,
    setMostrarResultados,
  ] = useState(false);

  const [
    clienteSeleccionado,
    setClienteSeleccionado,
  ] = useState<Cliente | null>(
    null
  );

  const router = useRouter();

  const [form, setForm] =
    useState<FormReserva>({
      idCliente: "",
      nombreCliente: "",
      telefono: "",
      fecha:
        fechaKey(new Date()),
      horaInicio: "08:00",
      duracion: 45,
      idBarbero: "",
    });

  /* =========================================================
     SESIÓN
  ========================================================= */

  useEffect(() => {
    try {
      const raw =
        sessionStorage.getItem(
          "nexos_usuario"
        );

      if (!raw) {
        setError(
          "No se encontró la sesión del usuario."
        );

        setLoading(false);

        return;
      }

      const data =
        JSON.parse(raw);

      setUsuario({
        uid: String(
          data?.uid ||
          data?.UID ||
          data?.AUTH_UID ||
          data?.authUid ||
          ""
        ),

        idBarberia: String(
          data?.ID_BARBERIA ||
            data?.id_barberia ||
            data?.BARBERIA_ID ||
            data?.barberiaId ||
            ""
        ),

        idUsuario: String(
          data?.ID_USUARIO ||
            data?.id_usuario ||
            data?.usuarioId ||
            ""
        ),

        idBarbero: String(
          data?.ID_BARBERO ||
            data?.id_barbero ||
            data?.barberoId ||
            ""
        ),

        nombre: String(
          data?.NOMBRE ||
            data?.nombre ||
            data?.USUARIO ||
            "Usuario"
        ),

        rol: String(
          data?.ROL ||
            data?.rol ||
            ""
        )
          .trim()
          .toLowerCase(),
      });
    } catch (err) {
      console.error(
        "ERROR SESIÓN:",
        err
      );

      setError(
        "No se pudo leer la sesión."
      );

      setLoading(false);
    }
  }, []);

  /* =========================================================
     CARGAR DATOS
  ========================================================= */

  const cargarDatos =
    async () => {
      if (
        !usuario?.idBarberia
      ) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const parametros =
          new URLSearchParams();

        parametros.set(
          "idBarberia",
          usuario.idBarberia
        );

        if (usuario.rol === "barbero") {
          // El usuario de USUARIOS tiene el AUTH_UID de Firebase.
          // El API lo convierte al ID_BARBERO real de la hoja BARBEROS.
          if (usuario.uid) {
            parametros.set("uid", usuario.uid);
          } else if (usuario.idBarbero) {
            parametros.set("idBarbero", usuario.idBarbero);
          }
        }

        const response =
          await fetch(
            `/reservas/api?${parametros.toString()}`,
            {
              method: "GET",
              cache: "no-store",
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
              "No se pudieron cargar las reservas."
          );
        }

        setClientes(
          Array.isArray(
            data.clientes
          )
            ? data.clientes
            : []
        );

        setBarberos(
          Array.isArray(
            data.barberos
          )
            ? data.barberos
            : []
        );

        setReservas(
          Array.isArray(
            data.reservas
          )
            ? data.reservas.filter(
                (reserva: Reserva) => {
                  const estado =
                    String(
                      reserva.estado ||
                        ""
                    )
                      .trim()
                      .toUpperCase();

                  return (
                    estado !==
                      "CANCELADA" &&
                    estado !==
                      "CANCELADO" &&
                    estado !==
                      "CANCELLED"
                  );
                }
              )
            : []
        );

        // El API devuelve el ID_BARBERO real (BARB-...)
        // aunque la sesión tenga guardado AUTH_UID.
        if (
          usuario.rol === "barbero" &&
          data.idBarberoActual
        ) {
          setUsuario((actual) =>
            actual
              ? {
                  ...actual,
                  idBarbero: String(
                    data.idBarberoActual
                  ),
                }
              : actual
          );
        }
      } catch (err) {
        console.error(
          "ERROR CARGANDO RESERVAS:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las reservas."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (!usuario) {
      return;
    }

    cargarDatos();
    // IMPORTANTE: no depender del objeto `usuario` completo.
    // `cargarDatos()` actualiza `idBarbero` cuando el API resuelve
    // AUTH_UID -> ID_BARBERO. Si dependemos de todo el objeto,
    // ese setUsuario vuelve a disparar este efecto indefinidamente.
    // Solo debemos recargar cuando cambia realmente la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.uid, usuario?.idBarberia, usuario?.rol]);

  /* =========================================================
     DÍAS
  ========================================================= */

  const diasSemana =
    useMemo(() => {
      return Array.from(
        {
          length: 7,
        },
        (_, index) => {
          const objeto =
            agregarDias(
              semanaActual,
              index
            );

          return {
            fecha:
              fechaKey(objeto),
            objeto,
          };
        }
      );
    }, [
      semanaActual,
    ]);

  /* =========================================================
     RESULTADOS CLIENTES
  ========================================================= */

  const resultadosClientes =
    useMemo(() => {
      const termino =
        busquedaCliente
          .trim()
          .toLowerCase();

      if (!termino) {
        return [];
      }

      return clientes
        .filter(
          (cliente) =>
            cliente.nombre
              .toLowerCase()
              .includes(
                termino
              ) ||
            cliente.telefono
              .toLowerCase()
              .includes(
                termino
              )
        )
        .slice(0, 8);
    }, [
      clientes,
      busquedaCliente,
    ]);

  /* =========================================================
     RESERVAS DEL DÍA
  ========================================================= */

  const obtenerReservasDia =
    (fecha: string) => {
      return reservas
        .filter(
          (reserva) =>
            reserva.fecha ===
              fecha &&
            String(
              (reserva as any).estado ||
                ""
            )
              .trim()
              .toUpperCase() !==
              "CANCELADA"
        )
        .sort(
          (a, b) =>
            minutosDesdeHora(
              a.horaInicio
            ) -
            minutosDesdeHora(
              b.horaInicio
            )
        );
    };

  /* =========================================================
     ENCONTRAR RESERVA PARA UN SLOT
     
     SOLAMENTE DEVUELVE LA RESERVA
     SI EL SLOT ES SU HORA DE INICIO.
     
     Esto evita duplicados.
  ========================================================= */

  const reservaQueEmpiezaEn =
    (
      fecha: string,
      hora: string
    ) => {
      return reservas.find(
        (reserva) =>
          reserva.fecha ===
            fecha &&
          reserva.horaInicio ===
            hora &&
          String(
            (reserva as any).estado ||
              ""
          )
            .trim()
            .toUpperCase() !==
            "CANCELADA"
      ) || null;
    };

  /* =========================================================
     DISPONIBILIDAD
  ========================================================= */

  const horarioDisponible =
    (
      fechaReserva: string,
      horaInicio: string,
      duracion: number,
      idBarbero: string,
      excluirId?: string
    ) => {
      if (!idBarbero) {
        return false;
      }

      const inicio =
        minutosDesdeHora(
          horaInicio
        );

      const fin =
        inicio + duracion;

      /*
       * No permitimos crear una reserva
       * después de las 22:00 porque esa
       * es la ventana visible del calendario.
       *
       * PERO:
       * 22:00 sí puede aparecer como
       * fin de una reserva.
       */

      if (
        inicio <
        CALENDARIO_DESDE
      ) {
        return false;
      }

      if (
        fin >
        CALENDARIO_HASTA
      ) {
        return false;
      }

      const nombreBarberoActual =
        barberos
          .find(
            (barbero) =>
              barbero.id ===
              idBarbero
          )
          ?.nombre
          ?.trim()
          .toLowerCase() || "";

      return !reservas.some(
        (reserva) => {
          if (
            String(
              (reserva as any).estado ||
                ""
            )
              .trim()
              .toUpperCase() ===
            "CANCELADA"
          ) {
            return false;
          }

          if (
            reserva.fecha !==
              fechaReserva
          ) {
            return false;
          }

          const mismoId =
            String(
              reserva.idBarbero ||
                ""
            ).trim() ===
            String(idBarbero).trim();

          const nombreBarberoReserva =
            reserva.barbero
              ?.trim()
              .toLowerCase() || "";

          const mismoNombre =
            !!nombreBarberoActual &&
            !!nombreBarberoReserva &&
            nombreBarberoActual ===
              nombreBarberoReserva;

          if (
            !mismoId &&
            !mismoNombre
          ) {
            return false;
          }

          return existeSolapamiento(
            inicio,
            fin,
            reserva,
            excluirId
          );
        }
      );
    };

  /* =========================================================
     ABRIR CREAR
  ========================================================= */

  const abrirCrearReserva =
    (
      fecha?: string,
      hora?: string,
      idBarbero?: string
    ) => {
      setEditando(false);

      setReservaSeleccionada(
        null
      );

      setClienteSeleccionado(
        null
      );

      setBusquedaCliente("");

      const barberoInicial =
        usuario?.rol === "barbero"
          ? usuario.idBarbero
          : idBarbero ||
            barberos[0]?.id ||
            "";

      setForm({
        idCliente: "",
        nombreCliente: "",
        telefono: "",
        fecha:
          fecha ||
          fechaKey(new Date()),
        horaInicio:
          hora ||
          "08:00",
        duracion: 45,
        idBarbero:
          barberoInicial,
      });

      setMostrarResultados(
        false
      );

      setModalReserva(true);
    };

  /* =========================================================
     SELECCIONAR CLIENTE
  ========================================================= */

  const seleccionarCliente =
    (cliente: Cliente) => {
      setClienteSeleccionado(
        cliente
      );

      setBusquedaCliente(
        cliente.nombre
      );

      setForm((actual) => ({
        ...actual,
        idCliente:
          cliente.id,
        nombreCliente:
          cliente.nombre,
        telefono:
          cliente.telefono,
      }));

      setMostrarResultados(
        false
      );
    };

  /* =========================================================
     GUARDAR
  ========================================================= */

  const guardarReserva =
    async () => {
      // Bloqueo síncrono: impide que un segundo clic entre
      // incluso antes de que React actualice el estado.
      if (guardandoRef.current) {
        return;
      }

      guardandoRef.current = true;
      setGuardando(true);

      try {
        if (!usuario) {
          return;
        }

      if (
        !form.nombreCliente.trim()
      ) {
        alert(
          "Ingresa el nombre del cliente."
        );
        return;
      }

      if (
        !form.telefono.trim()
      ) {
        alert(
          "Ingresa el teléfono del cliente."
        );
        return;
      }

      if (!form.idBarbero) {
        alert(
          "Selecciona un barbero."
        );
        return;
      }

      const disponible =
        horarioDisponible(
          form.fecha,
          form.horaInicio,
          form.duracion,
          form.idBarbero,
          editando
            ? reservaSeleccionada?.id
            : undefined
        );

      if (!disponible) {
        alert(
          "Ese horario ya está ocupado para ese barbero."
        );

        return;
      }

        const response =
          await fetch(
            "/reservas/api",
            {
              method:
                editando
                  ? "PUT"
                  : "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                accion:
                  editando
                    ? "editar"
                    : "crear",

                id:
                  reservaSeleccionada?.id ||
                  "",

                idBarberia:
                  usuario.idBarberia,

                idUsuario:
                  usuario.idUsuario,

                creadoPorUid:
                  usuario.idUsuario,

                idCliente:
                  form.idCliente,

                nombreCliente:
                  form.nombreCliente.trim(),

                telefono:
                  form.telefono.trim(),

                idBarbero:
                  form.idBarbero,

                barberoNombre:
                  barberos.find(
                    (barbero) =>
                      barbero.id ===
                      form.idBarbero
                  )?.nombre || "",

                fecha:
                  form.fecha,

                horaInicio:
                  form.horaInicio,

                duracion:
                  form.duracion,
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
              "No se pudo guardar la reserva."
          );
        }

        setModalReserva(
          false
        );

        setReservaSeleccionada(
          null
        );

        setClienteSeleccionado(
          null
        );

        await cargarDatos();
      } catch (err) {
        console.error(
          "ERROR GUARDANDO RESERVA:",
          err
        );

        if (
          err instanceof Error &&
          err.message.toLowerCase().includes("horario ocupado")
        ) {
          await cargarDatos();
        }

        alert(
          err instanceof Error
            ? err.message
            : "No se pudo guardar la reserva."
        );
      } finally {
        guardandoRef.current = false;
        setGuardando(false);
      }
    };

  /* =========================================================
     ATENDER RESERVA
     Lleva la reserva al módulo ATENCIÓN / PAGOS
  ========================================================= */

  const atenderReserva = (reserva: Reserva) => {
    /*
     * =========================================================
     * OBTENER DATOS REALES DEL CLIENTE
     *
     * No dependemos únicamente de reserva.cliente.
     * La fuente principal es la lista de clientes cargada
     * desde la barbería, usando ID_CLIENTE.
     *
     * Esto evita que Atención / Pagos reciba solamente
     * el teléfono cuando el nombre de la reserva venga vacío,
     * desactualizado o con otro formato.
     * =========================================================
     */

    const clienteRelacionado =
      clientes.find(
        (cliente) =>
          String(cliente.id || "").trim() ===
          String(reserva.idCliente || "").trim()
      ) || null;

    const nombreCliente =
      String(
        clienteRelacionado?.nombre ||
          reserva.cliente ||
          ""
      ).trim();

    const telefonoCliente =
      String(
        clienteRelacionado?.telefono ||
          reserva.telefono ||
          ""
      ).trim();

    const params = new URLSearchParams({
      reservaId: String(reserva.id || "").trim(),
      idCliente: String(reserva.idCliente || "").trim(),
      idBarberia: String(reserva.idBarberia || "").trim(),
      idBarbero: String(reserva.idBarbero || "").trim(),

      // BARBERO DE LA RESERVA
      barberoNombre: String(
        reserva.barbero || ""
      ).trim(),

      // CLIENTE: se envían explícitamente los datos completos
      nombreCliente,
      telefono: telefonoCliente,

      // Si el cliente existe, también enviamos su rango de edad.
      rangoEdad: String(
        clienteRelacionado?.rangoEdad || ""
      ).trim(),

      // DATOS DE LA RESERVA
      fecha: String(reserva.fecha || "").trim(),
      horaInicio: String(reserva.horaInicio || "").trim(),
      duracion: String(
        Number(reserva.duracion || 45)
      ),
    });

    router.push(
      `/atencion-pagos?${params.toString()}`
    );
  };

  /* =========================================================
     EDITAR
  ========================================================= */

  const abrirEditar =
    (reserva: Reserva) => {
      setReservaSeleccionada(
        reserva
      );

      const cliente =
        clientes.find(
          (item) =>
            item.id ===
            reserva.idCliente
        ) || null;

      setClienteSeleccionado(
        cliente
      );

      setBusquedaCliente(
        cliente?.nombre ||
          reserva.cliente
      );

      setForm({
        idCliente:
          reserva.idCliente,

        nombreCliente:
          reserva.cliente,

        telefono:
          reserva.telefono,

        fecha:
          reserva.fecha,

        horaInicio:
          reserva.horaInicio,

        duracion:
          Number(
            reserva.duracion
          ) === 60
            ? 60
            : 45,

        idBarbero:
          reserva.idBarbero,
      });

      setEditando(true);

      setModalDetalle(false);

      setModalReserva(true);
    };

  /* =========================================================
     CANCELAR
  ========================================================= */

  const cancelarReserva =
    async () => {
      if (
        !usuario ||
        !reservaSeleccionada
      ) {
        return;
      }

      try {
        setGuardando(true);

        const response =
          await fetch(
            "/reservas/api",
            {
              method: "DELETE",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                id:
                  reservaSeleccionada.id,

                idBarberia:
                  usuario.idBarberia,
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
              "No se pudo cancelar la reserva."
          );
        }

        setModalCancelar(
          false
        );

        setModalDetalle(
          false
        );

        setReservaSeleccionada(
          null
        );

        await cargarDatos();
      } catch (err) {
        console.error(
          "ERROR CANCELANDO RESERVA:",
          err
        );

        alert(
          err instanceof Error
            ? err.message
            : "No se pudo cancelar."
        );
      } finally {
        setGuardando(false);
      }
    };

  /* =========================================================
     TOTAL
  ========================================================= */

  const totalReservasSemana =
    useMemo(() => {
      const fechas =
        new Set(
          diasSemana.map(
            (dia) =>
              dia.fecha
          )
        );

      return reservas.filter(
        (reserva) =>
          fechas.has(
            reserva.fecha
          )
      ).length;
    }, [
      reservas,
      diasSemana,
    ]);

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <main className="reservas-page">

      {/* ===================================================
          HEADER
      ==================================================== */}

      <header className="reservas-header">

        <div>
          <span className="reservas-eyebrow">
            AGENDA
          </span>

          <h1>
            Reservas
          </h1>

          <p>
            Organiza las citas y
            controla los horarios
            disponibles.
          </p>
        </div>

        <button
          type="button"
          className="reservas-btn reservas-btn-primary"
          onClick={() =>
            abrirCrearReserva()
          }
        >
          + Crear reserva
        </button>

      </header>

      {/* ===================================================
          TOOLBAR
      ==================================================== */}

      <section className="reservas-toolbar">

        <div className="reservas-navigation">

          <button
            type="button"
            className="calendar-nav-btn"
            onClick={() =>
              setSemanaActual(
                agregarDias(
                  semanaActual,
                  -7
                )
              )
            }
          >
            ‹
          </button>

          <button
            type="button"
            className="today-btn"
            onClick={() =>
              setSemanaActual(
                inicioSemana(
                  new Date()
                )
              )
            }
          >
            Hoy
          </button>

          <button
            type="button"
            className="calendar-nav-btn"
            onClick={() =>
              setSemanaActual(
                agregarDias(
                  semanaActual,
                  7
                )
              )
            }
          >
            ›
          </button>

          <div className="week-title">
            {mesYAnio(
              semanaActual
            )}
          </div>

        </div>

        <div className="reservas-summary">

          <span className="summary-dot" />

          <strong>
            {
              totalReservasSemana
            }
          </strong>

          <span>
            reservas esta semana
          </span>

        </div>

      </section>

      {/* ===================================================
          ERROR
      ==================================================== */}

      {error && (
        <section className="reservas-error">

          <div>

            <strong>
              Error
            </strong>

            <p>
              {error}
            </p>

          </div>

          <button
            type="button"
            className="reservas-btn reservas-btn-secondary"
            onClick={
              cargarDatos
            }
          >
            Intentar nuevamente
          </button>

        </section>
      )}

      {/* ===================================================
          CALENDARIO
      ==================================================== */}

      {loading ? (

        <div className="reservas-loading">

          <div className="reservas-spinner" />

          <span>
            Cargando agenda...
          </span>

        </div>

      ) : (

        <section className="calendar-wrapper">

          <div className="calendar-grid">

            {diasSemana.map(
              ({
                fecha,
                objeto,
              }) => {

                const reservasDia =
                  obtenerReservasDia(
                    fecha
                  );

                return (

                  <div
                    className={`calendar-day ${
                      esHoy(fecha)
                        ? "today"
                        : ""
                    }`}
                    key={fecha}
                  >

                    {/* HEADER DEL DÍA */}

                    <div className="calendar-day-header">

                      <div>

                        <span className="calendar-day-name">
                          {nombreDia(
                            objeto
                          )}
                        </span>

                        <strong>
                          {
                            objeto.getDate()
                          }
                        </strong>

                      </div>

                      {reservasDia.length >
                        0 && (

                        <span className="day-count">
                          {
                            reservasDia.length
                          }
                        </span>

                      )}

                    </div>

                    {/* HORAS */}

                    <div
                      className="calendar-slots"
                      style={{
                        position: "relative",
                        height: `${SLOTS.length * ALTURA_SLOT}px`,
                      }}
                    >

                      {/* FILAS DE 30 MINUTOS */}
                      {SLOTS.map((hora) => {
                        const minutoSlot =
                          minutosDesdeHora(hora);

                        const reservaOcupando =
                          reservasDia.find((reserva) => {
                            const inicio =
                              minutosDesdeHora(
                                reserva.horaInicio
                              );

                            const fin =
                              inicio +
                              Number(
                                reserva.duracion ||
                                  45
                              );

                            return (
                              minutoSlot >= inicio &&
                              minutoSlot < fin
                            );
                          }) || null;

                        return (
                          <div
                            key={`${fecha}-${hora}`}
                            className="calendar-time-slot"
                            style={{
                              height: `${ALTURA_SLOT}px`,
                              position: "relative",
                            }}
                          >
                            {reservaOcupando ? (
                              <div
                                className="calendar-slot-occupied-bg"
                                aria-hidden="true"
                              />
                            ) : (
                              <button
                                type="button"
                                className="calendar-available"
                                onClick={() =>
                                  abrirCrearReserva(
                                    fecha,
                                    hora
                                  )
                                }
                              >
                                <span>{hora}</span>
                                <small>DISPONIBLE</small>
                                <i>+</i>
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* UNA SOLA TARJETA POR RESERVA */}
                      {reservasDia.map((reserva) => {
                        const inicio =
                          minutosDesdeHora(
                            reserva.horaInicio
                          );

                        const top =
                          ((inicio - CALENDARIO_DESDE) /
                            SLOT_MINUTOS) *
                          ALTURA_SLOT;

                        const height =
                          (Number(
                            reserva.duracion || 45
                          ) / SLOT_MINUTOS) *
                          ALTURA_SLOT;

                        return (
                          <button
                            type="button"
                            key={`reserva-${reserva.id}`}
                            className="calendar-reservation calendar-reservation-absolute"
                            style={{
                              position: "absolute",
                              top: `${top}px`,
                              left: "8px",
                              right: "8px",
                              height: `${height}px`,
                              minHeight: `${height}px`,
                              zIndex: 10,
                            }}
                            onClick={() => {
                              setReservaSeleccionada(reserva);
                              setModalDetalle(true);
                            }}
                          >
                            <span className="slot-time">
                              {reserva.horaInicio}
                            </span>

                            <span className="reservation-status">
                              RESERVA
                            </span>

                            <strong>
                              {reserva.cliente}
                            </strong>

                            <small>
                              {reserva.barbero}
                            </small>

                            <small>
                              {reserva.duracion} min · {reserva.horaFin}
                            </small>
                          </button>
                        );
                      })}

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </section>
      )}

      {/* ===================================================
          MODAL CREAR / EDITAR
      ==================================================== */}

      {modalReserva && (

        <div
          className="reservas-modal-overlay"
          onMouseDown={(event) => {

            if (
              event.target ===
              event.currentTarget
            ) {
              setModalReserva(
                false
              );
            }

          }}
        >

          <div className="reservas-modal">

            <div className="reservas-modal-header">

              <div>

                <span className="reservas-eyebrow">
                  {editando
                    ? "EDITAR RESERVA"
                    : "NUEVA RESERVA"}
                </span>

                <h2>
                  {editando
                    ? "Editar reserva"
                    : "Crear reserva"}
                </h2>

                <p>
                  Ingresa los datos
                  de la cita.
                </p>

              </div>

              <button
                type="button"
                className="modal-close-btn"
                onClick={() =>
                  setModalReserva(
                    false
                  )
                }
              >
                ×
              </button>

            </div>

            <div className="reservas-form">

              {/* CLIENTE */}

              <div className="form-group">

                <label>
                  CLIENTE
                </label>

                <div className="client-search-box">

                  <input
                    type="text"
                    value={
                      busquedaCliente
                    }
                    placeholder="Nombre o teléfono..."
                    onChange={(event) => {

                      setBusquedaCliente(
                        event.target
                          .value
                      );

                      setMostrarResultados(
                        true
                      );

                    }}
                    onFocus={() =>
                      setMostrarResultados(
                        true
                      )
                    }
                  />

                  <button
                    type="button"
                    className="search-client-btn"
                    onClick={() => {

                      const termino =
                        busquedaCliente
                          .trim()
                          .toLowerCase();

                      const numero =
                        busquedaCliente.replace(
                          /\D/g,
                          ""
                        );

                      const cliente =
                        clientes.find(
                          (item) =>
                            item.nombre
                              .toLowerCase()
                              .includes(
                                termino
                              ) ||
                            (
                              numero &&
                              item.telefono
                                .replace(
                                  /\D/g,
                                  ""
                                )
                                .endsWith(
                                  numero
                                )
                            )
                        );

                      if (
                        cliente
                      ) {
                        seleccionarCliente(
                          cliente
                        );
                      }

                    }}
                  >
                    Buscar
                  </button>

                </div>

                {mostrarResultados &&
                  resultadosClientes.length >
                    0 && (

                    <div className="client-results">

                      {resultadosClientes.map(
                        (
                          cliente
                        ) => (

                          <button
                            type="button"
                            className="client-result"
                            key={
                              cliente.id
                            }
                            onClick={() =>
                              seleccionarCliente(
                                cliente
                              )
                            }
                          >

                            <div className="client-result-avatar">
                              {cliente.nombre
                                .charAt(
                                  0
                                )
                                .toUpperCase()}
                            </div>

                            <div>

                              <strong>
                                {
                                  cliente.nombre
                                }
                              </strong>

                              <span>
                                {
                                  cliente.telefono
                                }
                              </span>

                            </div>

                          </button>

                        )
                      )}

                    </div>

                  )}

              </div>

              {/* CLIENTE */}

              <div className="form-client-status">

                {clienteSeleccionado ? (

                  <>
                    <span className="status-ok">
                      ✓ CLIENTE ENCONTRADO
                    </span>

                    <strong>
                      {
                        clienteSeleccionado.nombre
                      }
                    </strong>

                    <small>
                      {
                        clienteSeleccionado.telefono
                      }
                    </small>
                  </>

                ) : (

                  <span className="status-new">
                    Cliente nuevo
                  </span>

                )}

              </div>

              {/* NOMBRE */}

              <div className="form-group">

                <label>
                  NOMBRE DEL CLIENTE
                </label>

                <input
                  type="text"
                  value={
                    form.nombreCliente
                  }
                  placeholder="Juan Carlos"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      nombreCliente:
                        event.target
                          .value,
                    })
                  }
                />

              </div>

              {/* TELÉFONO */}

              <div className="form-group">

                <label>
                  TELÉFONO
                </label>

                <input
                  type="tel"
                  value={
                    form.telefono
                  }
                  placeholder="7XXXXXXX"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      telefono:
                        event.target
                          .value,
                    })
                  }
                />

              </div>

              {/* BARBERO */}

              <div className="form-group">

                <label>
                  BARBERO
                </label>

                <select
                  value={
                    form.idBarbero
                  }
                  disabled={
                    usuario?.rol === "barbero"
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      idBarbero:
                        event.target
                          .value,
                    })
                  }
                >

                  <option value="">
                    Seleccionar barbero
                  </option>

                  {barberos
                    .filter(
                      (barbero) =>
                        usuario?.rol !== "barbero" ||
                        barbero.id ===
                          usuario.idBarbero
                    )
                    .map(
                      (barbero) => (
                        <option
                          key={
                            barbero.id
                          }
                          value={
                            barbero.id
                          }
                        >
                          {
                            barbero.nombre
                          }
                        </option>
                      )
                    )}

                </select>

              </div>

              {/* FECHA */}

              <div className="form-group">

                <label>
                  FECHA
                </label>

                <input
                  type="date"
                  value={
                    form.fecha
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      fecha:
                        event.target
                          .value,
                    })
                  }
                />

              </div>

              {/* HORA */}

              <div className="form-group">

                <label>
                  HORA
                </label>

                <select
                  value={
                    form.horaInicio
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      horaInicio:
                        event.target
                          .value,
                    })
                  }
                >

                  {SLOTS.map(
                    (hora) => (
                      <option
                        key={hora}
                        value={hora}
                      >
                        {hora}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* DURACIÓN */}

              <div className="form-group">

                <label>
                  DURACIÓN
                </label>

                <div className="duration-options">

                  <button
                    type="button"
                    className={
                      form.duracion ===
                      45
                        ? "duration-option active"
                        : "duration-option"
                    }
                    onClick={() =>
                      setForm({
                        ...form,
                        duracion: 45,
                      })
                    }
                  >

                    <strong>
                      45 minutos
                    </strong>

                    <span>
                      Tiempo estándar
                    </span>

                  </button>

                  <button
                    type="button"
                    className={
                      form.duracion ===
                      60
                        ? "duration-option active"
                        : "duration-option"
                    }
                    onClick={() =>
                      setForm({
                        ...form,
                        duracion: 60,
                      })
                    }
                  >

                    <strong>
                      1 hora
                    </strong>

                    <span>
                      Mayor margen
                    </span>

                  </button>

                </div>

              </div>

              {/* DISPONIBILIDAD */}

              <div
                className={
                  horarioDisponible(
                    form.fecha,
                    form.horaInicio,
                    form.duracion,
                    form.idBarbero,
                    editando
                      ? reservaSeleccionada?.id
                      : undefined
                  )
                    ? "availability-box available"
                    : "availability-box occupied"
                }
              >

                <span>
                  {horarioDisponible(
                    form.fecha,
                    form.horaInicio,
                    form.duracion,
                    form.idBarbero,
                    editando
                      ? reservaSeleccionada?.id
                      : undefined
                  )
                    ? "🟢"
                    : "🔴"}
                </span>

                <div>

                  <strong>
                    {horarioDisponible(
                      form.fecha,
                      form.horaInicio,
                      form.duracion,
                      form.idBarbero,
                      editando
                        ? reservaSeleccionada?.id
                        : undefined
                    )
                      ? "Horario disponible"
                      : "Horario ocupado"}
                  </strong>

                  <small>
                    {form.horaInicio}
                    {" — "}
                    {
                      calcularHoraFin(
                        form.horaInicio,
                        form.duracion
                      )
                    }
                  </small>

                </div>

              </div>

            </div>

            {/* ACTIONS */}

            <div className="reservas-modal-actions">

              <button
                type="button"
                className="reservas-btn reservas-btn-secondary"
                onClick={() =>
                  setModalReserva(
                    false
                  )
                }
                disabled={
                  guardando
                }
              >
                Volver
              </button>

              <button
                type="button"
                className="reservas-btn reservas-btn-primary"
                onClick={
                  guardarReserva
                }
                disabled={
                  guardando ||
                  !form.nombreCliente.trim() ||
                  !form.telefono.trim() ||
                  !form.idBarbero
                }
              >
                {guardando
                  ? "Guardando..."
                  : editando
                  ? "Guardar cambios"
                  : "Confirmar reserva"}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================
          DETALLE
      ==================================================== */}

      {modalDetalle &&
        reservaSeleccionada && (

          <div
            className="reservas-modal-overlay"
            onMouseDown={(event) => {

              if (
                event.target ===
                event.currentTarget
              ) {
                setModalDetalle(
                  false
                );
              }

            }}
          >

            <div className="reservation-detail-modal">

              <div className="detail-header">

                <div className="detail-date">

                  <span>
                    {
                      fechaCorta(
                        reservaSeleccionada.fecha
                      )
                    }
                  </span>

                  <strong>
                    {
                      reservaSeleccionada.horaInicio
                    }
                  </strong>

                </div>

                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() =>
                    setModalDetalle(
                      false
                    )
                  }
                >
                  ×
                </button>

              </div>

              <div className="detail-status">

                <span className="status-confirmed">
                  ● RESERVA
                </span>

              </div>

              <div className="detail-client">

                <div className="detail-avatar">
                  {
                    reservaSeleccionada.cliente
                      .charAt(0)
                      .toUpperCase()
                  }
                </div>

                <div>

                  <span>
                    CLIENTE
                  </span>

                  <strong>
                    {
                      reservaSeleccionada.cliente
                    }
                  </strong>

                  <small>
                    📞{" "}
                    {
                      reservaSeleccionada.telefono
                    }
                  </small>

                </div>

              </div>

              <div className="detail-grid">

                <div>

                  <span>
                    BARBERO
                  </span>

                  <strong>
                    {
                      reservaSeleccionada.barbero
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    DURACIÓN
                  </span>

                  <strong>
                    {
                      reservaSeleccionada.duracion
                    }{" "}
                    min
                  </strong>

                </div>

                <div>

                  <span>
                    HORARIO
                  </span>

                  <strong>
                    {
                      reservaSeleccionada.horaInicio
                    }{" "}
                    —{" "}
                    {
                      reservaSeleccionada.horaFin ||
                      calcularHoraFin(
                        reservaSeleccionada.horaInicio,
                        reservaSeleccionada.duracion
                      )
                    }
                  </strong>

                </div>

                <div>

                  <span>
                    CREADO POR
                  </span>

                  <strong>
                    {
                      reservaSeleccionada.creadoPorUid ||
                      "Usuario"
                    }
                  </strong>

                </div>

              </div>

              <div className="detail-actions">

                <button
                  type="button"
                  className="detail-attend-btn"
                  onClick={() =>
                    atenderReserva(
                      reservaSeleccionada
                    )
                  }
                >
                  ✓ Atender Reserva
                </button>

                <button
                  type="button"
                  className="detail-cancel-btn"
                  onClick={() =>
                    setModalCancelar(
                      true
                    )
                  }
                >
                  Cancelar reserva
                </button>

                <button
                  type="button"
                  className="detail-edit-btn"
                  onClick={() =>
                    abrirEditar(
                      reservaSeleccionada
                    )
                  }
                >
                  Editar reserva
                </button>

                <a
                  className="whatsapp-btn whatsapp-reminder-btn"
                  href={enlaceWhatsApp(
                    reservaSeleccionada
                  )}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Enviar recordatorio por WhatsApp"
                  onClick={(event) => {
                    if (
                      !enlaceWhatsApp(
                        reservaSeleccionada
                      )
                    ) {
                      event.preventDefault();

                      alert(
                        "El cliente no tiene un número válido."
                      );
                    }
                  }}
                >
                  <span className="whatsapp-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20.52 3.48A11.87 11.87 0 0 0 12.08 0C5.53 0 .2 5.32.2 11.87c0 2.09.55 4.13 1.59 5.93L.1 24l6.34-1.66a11.86 11.86 0 0 0 5.64 1.43h.01c6.55 0 11.87-5.32 11.87-11.87 0-3.17-1.23-6.15-3.44-8.42ZM12.09 21.8a9.82 9.82 0 0 1-5.01-1.37l-.36-.21-3.76.99 1-3.66-.23-.38a9.81 9.81 0 0 1-1.5-5.3c0-5.42 4.42-9.84 9.85-9.84 2.63 0 5.1 1.02 6.96 2.88a9.82 9.82 0 0 1 2.88 6.97c0 5.43-4.42 9.85-9.83 9.85Zm5.4-7.38c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.46-.89-.79-1.49-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.1 4.49.71.31 1.26.49 1.69.63.71.23 1.35.2 1.86.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" fill="currentColor"/>
                    </svg>
                  </span>
                  WhatsApp
                </a>

              </div>

            </div>

          </div>
        )}

      {/* ===================================================
          CANCELAR
      ==================================================== */}

      {modalCancelar &&
        reservaSeleccionada && (

          <div className="reservas-modal-overlay">

            <div className="cancel-modal">

              <div className="cancel-icon">
                !
              </div>

              <h3>
                ¿Cancelar reserva?
              </h3>

              <p>
                La reserva de{" "}
                <strong>
                  {
                    reservaSeleccionada.cliente
                  }
                </strong>{" "}
                será eliminada de
                la agenda.
              </p>

              <div className="cancel-actions">

                <button
                  type="button"
                  className="reservas-btn reservas-btn-secondary"
                  onClick={() =>
                    setModalCancelar(
                      false
                    )
                  }
                  disabled={
                    guardando
                  }
                >
                  Volver
                </button>

                <button
                  type="button"
                  className="detail-cancel-btn"
                  onClick={
                    cancelarReserva
                  }
                  disabled={
                    guardando
                  }
                >
                  {guardando
                    ? "Cancelando..."
                    : "Sí, cancelar"}
                </button>

              </div>

            </div>

          </div>
        )}

    </main>
  );
}