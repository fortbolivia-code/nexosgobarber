import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* =========================================================
   GOOGLE SHEETS
========================================================= */

const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID;

if (!SPREADSHEET_ID) {
  throw new Error(
    "Falta GOOGLE_SHEETS_ID en .env.local"
  );
}

/* =========================================================
   SERVICE ACCOUNT
========================================================= */

const serviceAccountPath =
  path.join(
    process.cwd(),
    "serviceAccountKey.json"
  );

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(
    "No se encontró serviceAccountKey.json en la raíz del proyecto."
  );
}

const serviceAccount =
  JSON.parse(
    fs.readFileSync(
      serviceAccountPath,
      "utf8"
    )
  );

if (
  !serviceAccount.client_email
) {
  throw new Error(
    "serviceAccountKey.json no contiene client_email."
  );
}

if (
  !serviceAccount.private_key
) {
  throw new Error(
    "serviceAccountKey.json no contiene private_key."
  );
}

const googleAuth =
  new google.auth.GoogleAuth({
    credentials: {
      client_email:
        serviceAccount.client_email,

      private_key:
        serviceAccount.private_key,
    },

    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });

const sheets = google.sheets({
  version: "v4",
  auth: googleAuth,
});

/* =========================================================
   TIPOS
========================================================= */

type Row = Record<
  string,
  string
>;

/* =========================================================
   BLOQUEO DE CREACIÓN DE RESERVAS

   Evita la condición de carrera en Google Sheets: dos solicitudes
   simultáneas podían leer la hoja antes de que cualquiera escribiera
   y ambas terminaban creando la misma reserva.

   El estado vive en globalThis para que sobreviva a recreaciones del
   módulo dentro del mismo proceso de Next.js.
========================================================= */

type ReservationLockState = {
  tail: Promise<void>;
};

const reservationLockState =
  (globalThis as typeof globalThis & {
    __nexosReservationLock?: ReservationLockState;
  }).__nexosReservationLock ??= {
    tail: Promise.resolve(),
  };

async function withReservationLock<T>(
  callback: () => Promise<T>
): Promise<T> {
  const previous =
    reservationLockState.tail;

  let release!: () => void;

  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  reservationLockState.tail = previous.then(
    () => current,
    () => current
  );

  await previous;

  try {
    return await callback();
  } finally {
    release();
  }
}

/* =========================================================
   UTILIDADES
========================================================= */

function header(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /\s+/g,
      "_"
    );
}

function numero(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const result =
    Number(
      String(value)
        .replace(
          /[^\d,.-]/g,
          ""
        )
        .replace(/\./g, "")
        .replace(
          ",",
          "."
        )
    );

  return Number.isFinite(
    result
  )
    ? result
    : 0;
}

function fechaValida(
  value: unknown
) {
  if (!value) {
    return null;
  }

  const texto =
    String(value).trim();

  if (!texto) {
    return null;
  }

  /*
   * YYYY-MM-DD
   */

  const iso =
    texto.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (iso) {
    const fecha =
      new Date(
        Number(iso[1]),
        Number(iso[2]) - 1,
        Number(iso[3])
      );

    return Number.isNaN(
      fecha.getTime()
    )
      ? null
      : fecha;
  }

  /*
   * DD/MM/YYYY
   */

  const latino =
    texto.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    );

  if (latino) {
    const fecha =
      new Date(
        Number(latino[3]),
        Number(latino[2]) - 1,
        Number(latino[1])
      );

    return Number.isNaN(
      fecha.getTime()
    )
      ? null
      : fecha;
  }

  const fecha =
    new Date(texto);

  return Number.isNaN(
    fecha.getTime()
  )
    ? null
    : fecha;
}

function fechaKey(
  value: string
) {
  const fecha =
    fechaValida(value);

  if (!fecha) {
    return "";
  }

  return `${fecha.getFullYear()}-${String(
    fecha.getMonth() + 1
  ).padStart(
    2,
    "0"
  )}-${String(
    fecha.getDate()
  ).padStart(
    2,
    "0"
  )}`;
}

function horaMinutos(
  hora: string
) {
  const [
    h,
    m,
  ] = String(hora)
    .split(":")
    .map(Number);

  return (
    Number(h || 0) * 60 +
    Number(m || 0)
  );
}

function horaFinal(
  horaInicio: string,
  duracion: number
) {
  const minutos =
    horaMinutos(
      horaInicio
    ) + duracion;

  const horas =
    Math.floor(
      minutos / 60
    );

  const mins =
    minutos % 60;

  return `${String(
    horas
  ).padStart(
    2,
    "0"
  )}:${String(
    mins
  ).padStart(
    2,
    "0"
  )}`;
}

/* =========================================================
   LEER SHEET
========================================================= */

async function leerHoja(
  nombre: string
): Promise<Row[]> {
  const response =
    await sheets.spreadsheets.values.get(
      {
        spreadsheetId:
          SPREADSHEET_ID,
        range:
          `${nombre}!A:Z`,
      }
    );

  const values =
    response.data.values || [];

  if (
    values.length === 0
  ) {
    return [];
  }

  const headers =
    values[0].map(header);

  return values
    .slice(1)
    .map((row) => {
      const item: Row =
        {};

      headers.forEach(
        (
          h,
          index
        ) => {
          if (h) {
            item[h] =
              String(
                row[index] ??
                  ""
              );
          }
        }
      );

      return item;
    });
}

/* =========================================================
   AGREGAR FILA
========================================================= */

async function agregarFila(
  hoja: string,
  valores: string[]
) {
  await sheets.spreadsheets.values.append(
    {
      spreadsheetId:
        SPREADSHEET_ID,

      range:
        `${hoja}!A:Z`,

      valueInputOption:
        "USER_ENTERED",

      insertDataOption:
        "INSERT_ROWS",

      requestBody: {
        values: [
          valores,
        ],
      },
    }
  );
}

/* =========================================================
   UTILIDADES PARA CANCELACIÓN
========================================================= */

async function obtenerSheetId(
  titulo: string
): Promise<number | null> {
  const libro =
    await sheets.spreadsheets.get({
      spreadsheetId:
        SPREADSHEET_ID,
      fields:
        "sheets.properties",
    });

  const hoja =
    libro.data.sheets?.find(
      (sheet) =>
        sheet.properties?.title ===
        titulo
    );

  return hoja?.properties?.sheetId ??
    null;
}

async function asegurarHojaCanceladas() {
  let sheetId =
    await obtenerSheetId(
      "RESERVAS_CANCELADAS"
    );

  if (
    sheetId !== null
  ) {
    return sheetId;
  }

  const creada =
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId:
        SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title:
                  "RESERVAS_CANCELADAS",
              },
            },
          },
        ],
      },
    });

  sheetId =
    creada.data.replies?.[0]
      ?.addSheet?.properties
      ?.sheetId ?? null;

  if (
    sheetId === null
  ) {
    throw new Error(
      "No se pudo crear la hoja RESERVAS_CANCELADAS."
    );
  }

  /*
   * Encabezados para conservar
   * el historial de cancelaciones.
   */
  await sheets.spreadsheets.values.update({
    spreadsheetId:
      SPREADSHEET_ID,

    range:
      "RESERVAS_CANCELADAS!A1:L1",

    valueInputOption:
      "USER_ENTERED",

    requestBody: {
      values: [[
        "ID_RESERVA",
        "ID_BARBERIA",
        "ID_CLIENTE",
        "ID_BARBERO",
        "FECHA",
        "HORA_INICIO",
        "DURACION",
        "HORA_FIN",
        "ESTADO",
        "CREADO_POR",
        "FECHA_CREACION",
        "FECHA_CANCELACION",
      ]],
    },
  });

  return sheetId;
}

function columnaLetra(
  indiceZeroBased: number
) {
  let numero =
    indiceZeroBased + 1;

  let resultado = "";

  while (
    numero > 0
  ) {
    const resto =
      (numero - 1) % 26;

    resultado =
      String.fromCharCode(
        65 + resto
      ) + resultado;

    numero =
      Math.floor(
        (numero - 1) / 26
      );
  }

  return resultado;
}

/* =========================================================
   ENCONTRAR BARBERÍA
========================================================= */

function normalizarComparacion(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function perteneceBarberia(
  row: Row,
  idBarberia: string
) {
  const id =
    String(
      row.ID_BARBERIA ||
        row.BARBERIA_ID ||
        row.BARBERIAID ||
        ""
    ).trim();

  return id === idBarberia;
}

/* =========================================================
   OBTENER ID BARBERO
========================================================= */

function obtenerIdBarbero(
  row: Row
) {
  return String(
    row.ID_BARBERO ||
      row.ID ||
      row.BARBERO_UID ||
      ""
  ).trim();
}

/* =========================================================
   OBTENER NOMBRE BARBERO
========================================================= */

function obtenerNombreBarbero(
  row: Row
) {
  return String(
    row.NOMBRE ||
      row.NOMBRE_COMPLETO ||
      row.BARBERO ||
      "Sin nombre"
  ).trim();
}

/* =========================================================
   BUSCAR CLIENTE
========================================================= */

function obtenerIdCliente(
  row: Row
) {
  return String(
    row.ID_CLIENTE ||
      ""
  ).trim();
}

function obtenerNombreCliente(
  row: Row
) {
  return String(
    row.NOMBRE ||
      row.CLIENTE ||
      "Sin nombre"
  ).trim();
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const params =
      request.nextUrl
        .searchParams;

    const idBarberia =
      String(
        params.get(
          "idBarberia"
        ) || ""
      ).trim();

    const idBarberoSolicitado =
      String(
        params.get(
          "idBarbero"
        ) || ""
      ).trim();

    const uidSolicitado =
      String(
        params.get("uid") || ""
      ).trim();

    if (!idBarberia) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta ID_BARBERIA.",
        },
        {
          status: 400,
        }
      );
    }

    const [
      reservasTodas,
      clientesTodas,
      barberosTodas,
    ] = await Promise.all([
      leerHoja(
        "RESERVAS"
      ),
      leerHoja(
        "CLIENTES"
      ),
      leerHoja(
        "BARBEROS"
      ),
    ]);

    /*
     * =====================================================
     * RESOLVER BARBERO
     *
     * La sesión puede guardar AUTH_UID/UID mientras
     * RESERVAS utiliza el ID_BARBERO (BARB-...).
     * Convertimos ambos formatos al ID real del barbero.
     * =====================================================
     */

    const identificadorBarbero =
      idBarberoSolicitado ||
      uidSolicitado;

    const barberoSesion =
      identificadorBarbero
        ? barberosTodas.find((row) => {
            if (
              !perteneceBarberia(
                row,
                idBarberia
              )
            ) {
              return false;
            }

            const idReal = String(
              row.ID_BARBERO ||
                row.ID ||
                ""
            ).trim();

            const authUid = String(
              row.AUTH_UID ||
                row.UID ||
                row.BARBERO_UID ||
                ""
            ).trim();

            return (
              idReal === identificadorBarbero ||
              authUid === identificadorBarbero
            );
          })
        : null;

    const idBarberoFiltro =
      barberoSesion
        ? String(
            barberoSesion.ID_BARBERO ||
              barberoSesion.ID ||
              ""
          ).trim()
        : idBarberoSolicitado;

    // Si se solicitó un UID/ID de barbero pero no existe en esta barbería,
    // NO devolvemos todas las reservas por accidente.
    if (
      identificadorBarbero &&
      !barberoSesion
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se encontró el barbero asociado a esta sesión en esta barbería.",
        },
        { status: 403 }
      );
    }

    /*
     * =====================================================
     * CLIENTES
     * =====================================================
     */

    const clientes =
      clientesTodas
        .filter(
          (row) =>
            perteneceBarberia(
              row,
              idBarberia
            )
        )
        .map(
          (row) => ({
            id:
              obtenerIdCliente(
                row
              ),

            nombre:
              obtenerNombreCliente(
                row
              ),

            telefono:
              String(
                row.TELEFONO ||
                  ""
              ).trim(),

            rangoEdad:
              String(
                row.RANGO_EDAD ||
                  ""
              ).trim(),
          })
        )
        .filter(
          (cliente) =>
            cliente.id
        );

    /*
     * =====================================================
     * BARBEROS
     * =====================================================
     */

    const barberos =
      barberosTodas
        .filter(
          (row) =>
            perteneceBarberia(
              row,
              idBarberia
            )
        )
        .map(
          (row) => ({
            id:
              obtenerIdBarbero(
                row
              ),

            nombre:
              obtenerNombreBarbero(
                row
              ),
          })
        )
        .filter(
          (barbero) =>
            barbero.id
        );

    /*
     * =====================================================
     * MAPAS
     * =====================================================
     */

    const clienteMap =
      new Map<
        string,
        {
          nombre: string;
          telefono: string;
        }
      >();

    clientes.forEach(
      (cliente) => {
        clienteMap.set(
          cliente.id,
          {
            nombre:
              cliente.nombre,

            telefono:
              cliente.telefono,
          }
        );
      }
    );

    const barberoMap =
      new Map<
        string,
        string
      >();

    barberos.forEach(
      (barbero) => {
        barberoMap.set(
          barbero.id,
          barbero.nombre
        );
      }
    );

    /*
     * =====================================================
     * RESERVAS
     * =====================================================
     */

    const reservas =
      reservasTodas
        .filter(
          (row) => {
            if (
              !perteneceBarberia(
                row,
                idBarberia
              )
            ) {
              return false;
            }

            // Si se recibe ID_BARBERO,
            // devolver solamente sus reservas.
            // Si no se recibe, se mantienen
            // todas las reservas de la barbería
            // para ADMIN y SUPERADMIN.
            if (idBarberoFiltro) {
              const idBarberoRow =
                String(
                  row.ID_BARBERO ||
                    row.BARBERO_UID ||
                    ""
                ).trim();

              return (
                idBarberoRow ===
                idBarberoFiltro
              );
            }

            return true;
          }
        )
        .map(
          (row) => {
            const idCliente =
              String(
                row.ID_CLIENTE ||
                  ""
              ).trim();

            const idBarbero =
              String(
                row.ID_BARBERO ||
                  row.BARBERO_UID ||
                  ""
              ).trim();

            const cliente =
              clienteMap.get(
                idCliente
              );

            return {
              id:
                String(
                  row.ID_RESERVA ||
                    ""
                ).trim(),

              idCliente,

              cliente:
                cliente?.nombre ||
                String(
                  row.CLIENTE ||
                    "Cliente"
                ),

              telefono:
                cliente?.telefono ||
                String(
                  row.TELEFONO ||
                    ""
                ),

              idBarbero,

              barbero:
                barberoMap.get(
                  idBarbero
                ) ||
                String(
                  row.BARBERO ||
                    "Sin asignar"
                ),

              fecha:
                fechaKey(
                  String(
                    row.FECHA ||
                      ""
                  )
                ),

              horaInicio:
                String(
                  row.HORA_INICIO ||
                    ""
                ).trim(),

              duracion:
                Number(
                  row.DURACION ||
                    45
                ),

              horaFin:
                String(
                  row.HORA_FIN ||
                    ""
                ).trim() ||
                horaFinal(
                  String(
                    row.HORA_INICIO ||
                      ""
                  ),
                  Number(
                    row.DURACION ||
                      45
                  )
                ),

              estado:
                String(
                  row.ESTADO ||
                    "RESERVA CONFIRMADA"
                ).trim(),

              creadoPor:
                String(
                  row.CREADO_POR ||
                    ""
                ).trim(),

              fechaCreacion:
                String(
                  row.FECHA_CREACION ||
                    ""
                ).trim(),
            };
          }
        )
        .filter(
          (reserva) =>
            reserva.id &&
            reserva.fecha &&
            reserva.horaInicio
        )
        .sort(
          (a, b) => {
            const fechaA =
              `${a.fecha} ${a.horaInicio}`;

            const fechaB =
              `${b.fecha} ${b.horaInicio}`;

            return fechaA.localeCompare(
              fechaB
            );
          }
        );

    const reservasActivas =
      reservas.filter(
        (reserva) =>
          String(
            reserva.estado ||
              ""
          )
            .trim()
            .toUpperCase() !==
          "CANCELADA"
      );

    const reservasCanceladas =
      reservas.filter(
        (reserva) =>
          String(
            reserva.estado ||
              ""
          )
            .trim()
            .toUpperCase() ===
          "CANCELADA"
      );

    return NextResponse.json({
      ok: true,
      clientes,
      barberos,
      reservas: reservasActivas,
      reservasCanceladas:
        reservasCanceladas.length,
      idBarberoActual:
        idBarberoFiltro || "",
    });
  } catch (error) {
    console.error(
      "GET /reservas/api:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Error cargando reservas.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST / CREAR RESERVA
========================================================= */

export async function POST(
  request: NextRequest
) {
  return withReservationLock(async () => {
    try {
    const body =
      await request.json();

    const {
      idBarberia,
      idUsuario,
      creadoPor,
      idCliente,
      nombreCliente,
      telefono,
      idBarbero,
      barberoNombre,
      fecha,
      horaInicio,
      duracion,
      estado,
    } = body;

    if (!idBarberia) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta ID_BARBERIA.",
        },
        {
          status: 400,
        }
      );
    }

    if (!nombreCliente?.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta el nombre del cliente.",
        },
        {
          status: 400,
        }
      );
    }

    if (!telefono?.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta el teléfono del cliente.",
        },
        {
          status: 400,
        }
      );
    }

    if (!idBarbero) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta seleccionar barbero.",
        },
        {
          status: 400,
        }
      );
    }

    if (!fecha) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta la fecha.",
        },
        {
          status: 400,
        }
      );
    }

    if (!horaInicio) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta la hora.",
        },
        {
          status: 400,
        }
      );
    }

    const duracionNumerica =
      Number(duracion) ===
      60
        ? 60
        : 45;

    /*
     * =====================================================
     * LEER RESERVAS ACTUALES
     * PARA EVITAR SOLAPAMIENTOS
     * =====================================================
     */

    const [
      reservas,
      barberosTodas,
    ] = await Promise.all([
      leerHoja(
        "RESERVAS"
      ),
      leerHoja(
        "BARBEROS"
      ),
    ]);

    /*
     * =====================================================
     * NORMALIZAR ID DEL BARBERO
     *
     * Si el frontend envía AUTH_UID, lo convertimos
     * al ID_BARBERO real usado por RESERVAS.
     * =====================================================
     */

    const barberoSeleccionado =
      barberosTodas.find((row) => {
        if (
          !perteneceBarberia(
            row,
            String(idBarberia)
          )
        ) {
          return false;
        }

        const idReal = String(
          row.ID_BARBERO ||
            row.ID ||
            ""
        ).trim();

        const authUid = String(
          row.AUTH_UID ||
            row.UID ||
            row.BARBERO_UID ||
            ""
        ).trim();

        return (
          idReal === String(idBarbero).trim() ||
          authUid === String(idBarbero).trim()
        );
      });

    const idBarberoFinal =
      String(
        barberoSeleccionado?.ID_BARBERO ||
          barberoSeleccionado?.ID ||
          idBarbero ||
          ""
      ).trim();

    const nombreBarberoFinal =
      String(
        barberoSeleccionado?.NOMBRE ||
          barberoSeleccionado?.NOMBRE_COMPLETO ||
          barberoSeleccionado?.BARBERO ||
          barberoNombre ||
          ""
      ).trim();

    if (!barberoSeleccionado || !idBarberoFinal) {
      return NextResponse.json(
        {
          ok: false,
          error: "El barbero seleccionado no pertenece a esta barbería.",
        },
        { status: 400 }
      );
    }

    const nombreBarberoPorId =
      new Map<string, string>();

    barberosTodas
      .filter((row) =>
        perteneceBarberia(
          row,
          String(idBarberia)
        )
      )
      .forEach((row) => {
        const id =
          normalizarComparacion(
            row.ID_BARBERO ||
              row.ID ||
              row.BARBERO_UID ||
              ""
          );

        const nombre =
          normalizarComparacion(
            row.NOMBRE ||
              row.NOMBRE_COMPLETO ||
              row.BARBERO ||
              ""
          );

        if (id && nombre) {
          nombreBarberoPorId.set(
            id,
            nombre
          );
        }
      });

    const existentes =
      reservas.filter(
        (row) =>
          perteneceBarberia(
            row,
            String(
              idBarberia
            )
          )
      );

    const nuevoInicio =
      horaMinutos(
        horaInicio
      );

    const nuevoFin =
      nuevoInicio +
      duracionNumerica;

    if (
      nuevoInicio < 8 * 60 ||
      nuevoFin > 22 * 60
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La reserva debe estar dentro del horario de 08:00 a 22:00.",
        },
        {
          status: 400,
        }
      );
    }

    const idBarberoNuevo =
      normalizarComparacion(idBarberoFinal);

    const nombreBarberoNuevo =
      normalizarComparacion(nombreBarberoFinal);

    const conflictosEncontrados =
      existentes.filter(
        (row) => {
          const estadoRow =
            normalizarComparacion(
              row.ESTADO
            );

          if (
            estadoRow === "CANCELADA"
          ) {
            return false;
          }

          const fechaRow =
            fechaKey(
              String(
                row.FECHA ||
                  ""
              )
            );

          if (
            fechaRow !==
            String(fecha).trim()
          ) {
            return false;
          }

          const idBarberoRow =
            normalizarComparacion(
              row.ID_BARBERO ||
                row.BARBERO_UID ||
                ""
            );

          const nombreBarberoRow =
            normalizarComparacion(
              row.BARBERO ||
                nombreBarberoPorId.get(
                  idBarberoRow
                ) ||
                ""
            );

          /*
           * Comparamos por ID y, como respaldo, por
           * el nombre real obtenido desde BARBEROS.
           * Esto cubre registros antiguos con IDs
           * inconsistentes pero pertenecientes al
           * mismo barbero.
           */
          const mismoBarbero =
            Boolean(
              idBarberoRow &&
              idBarberoNuevo &&
              idBarberoRow ===
                idBarberoNuevo
            ) ||
            Boolean(
              nombreBarberoNuevo &&
              nombreBarberoRow &&
              nombreBarberoRow ===
                nombreBarberoNuevo
            );

          if (!mismoBarbero) {
            return false;
          }

          const horaRow =
            String(
              row.HORA_INICIO ||
                ""
            ).trim();

          if (!horaRow) {
            return false;
          }

          const inicioRow =
            horaMinutos(
              horaRow
            );

          const duracionRow =
            Number(
              row.DURACION
            ) === 60
              ? 60
              : 45;

          const finRow =
            horaMinutos(
              String(
                row.HORA_FIN ||
                  ""
              ).trim()
            ) ||
            inicioRow +
              duracionRow;

          return (
            nuevoInicio <
              finRow &&
            nuevoFin >
              inicioRow
          );
        }
      );

    const conflicto =
      conflictosEncontrados[0] ||
      null;

    if (conflicto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Horario ocupado. ${String(
              conflicto.HORA_INICIO || ""
            )} — ${String(
              conflicto.HORA_FIN ||
                horaFinal(
                  String(
                    conflicto.HORA_INICIO ||
                      ""
                  ),
                  Number(
                    conflicto.DURACION ||
                      45
                  )
                )
            )} ya está reservado para ese barbero.`,
          conflicto: {
            id:
              String(
                conflicto.ID_RESERVA ||
                  ""
              ).trim(),
            horaInicio:
              String(
                conflicto.HORA_INICIO ||
                  ""
              ).trim(),
            horaFin:
              String(
                conflicto.HORA_FIN ||
                  ""
              ).trim() ||
              horaFinal(
                String(
                  conflicto.HORA_INICIO ||
                    ""
                ),
                Number(
                  conflicto.DURACION ||
                    45
                )
              ),
          },
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * CLIENTE
     *
     * Si existe usamos su ID.
     * Si no existe creamos uno.
     * La reserva NO cuenta como visita.
     * =====================================================
     */

    const clientes =
      await leerHoja(
        "CLIENTES"
      );

    let clienteIdFinal =
      String(
        idCliente || ""
      ).trim();

    const telefonoLimpio =
      String(
        telefono
      )
        .replace(
          /\D/g,
          ""
        );

    if (
      !clienteIdFinal
    ) {
      const clienteExistente =
        clientes.find(
          (cliente) => {
            if (
              !perteneceBarberia(
                cliente,
                String(
                  idBarberia
                )
              )
            ) {
              return false;
            }

            const telefonoCliente =
              String(
                cliente.TELEFONO ||
                  ""
              )
                .replace(
                  /\D/g,
                  ""
                );

            return (
              telefonoCliente ===
              telefonoLimpio
            );
          }
        );

      if (
        clienteExistente
      ) {
        clienteIdFinal =
          String(
            clienteExistente.ID_CLIENTE ||
              ""
          );
      }
    }

    if (
      !clienteIdFinal
    ) {
      clienteIdFinal =
        `CLI-${Date.now()}`;

      await agregarFila(
        "CLIENTES",
        [
          clienteIdFinal,
          String(
            idBarberia
          ),
          String(
            nombreCliente
          ).trim(),
          String(
            telefono
          ).trim(),
          "No especificado",
          "",
          "",
          "0",
          "0",
        ]
      );
    }

    /*
     * =====================================================
     * RESERVA
     * =====================================================
     */

    const idReserva =
      `RES-${Date.now()}-${crypto.randomUUID()}`;

    const horaFin =
      horaFinal(
        horaInicio,
        duracionNumerica
      );

    const fechaCreacion =
      new Date()
        .toISOString();

    /*
     * ORDEN:
     *
     * A ID_RESERVA
     * B ID_BARBERIA
     * C ID_CLIENTE
     * D ID_BARBERO
     * E FECHA
     * F HORA_INICIO
     * G DURACION
     * H HORA_FIN
     * I ESTADO
     * J CREADO_POR
     * K FECHA_CREACION
     */

    await agregarFila(
      "RESERVAS",
      [
        idReserva,
        String(
          idBarberia
        ),
        clienteIdFinal,
        idBarberoFinal,
        String(fecha),
        String(
          horaInicio
        ),
        String(
          duracionNumerica
        ),
        horaFin,
        String(
          estado ||
            "RESERVA CONFIRMADA"
        ),
        String(
          creadoPor ||
            idUsuario ||
            "Usuario"
        ),
        fechaCreacion,
      ]
    );

    return NextResponse.json({
      ok: true,

      mensaje:
        "Reserva creada correctamente.",

      reserva: {
        id:
          idReserva,

        idCliente:
          clienteIdFinal,

        fecha,

        horaInicio,

        duracion:
          duracionNumerica,

        horaFin,
      },
    });
  } catch (error) {
    console.error(
      "POST /reservas/api:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear la reserva.",
      },
      {
        status: 500,
      }
    );
      }
  });
}
/* =========================================================
   PUT / EDITAR RESERVA
========================================================= */

export async function PUT(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const {
      id,
      idBarberia,
      idCliente,
      nombreCliente,
      telefono,
      idBarbero,
      fecha,
      horaInicio,
      duracion,
    } = body;

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta ID_RESERVA.",
        },
        {
          status: 400,
        }
      );
    }

    if (!idBarberia) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Falta ID_BARBERIA.",
        },
        {
          status: 400,
        }
      );
    }

    const [
      reservas,
      barberosTodas,
    ] = await Promise.all([
      leerHoja(
        "RESERVAS"
      ),
      leerHoja(
        "BARBEROS"
      ),
    ]);

    const nombreBarberoPorId =
      new Map<string, string>();

    barberosTodas
      .filter((row) =>
        perteneceBarberia(
          row,
          String(idBarberia)
        )
      )
      .forEach((row) => {
        const idBarberoMap =
          normalizarComparacion(
            row.ID_BARBERO ||
              row.ID ||
              row.BARBERO_UID ||
              ""
          );

        const nombre =
          normalizarComparacion(
            row.NOMBRE ||
              row.NOMBRE_COMPLETO ||
              row.BARBERO ||
              ""
          );

        if (
          idBarberoMap &&
          nombre
        ) {
          nombreBarberoPorId.set(
            idBarberoMap,
            nombre
          );
        }
      });

    const indice =
      reservas.findIndex(
        (row) =>
          String(
            row.ID_RESERVA ||
              ""
          ).trim() ===
            String(id).trim() &&
          perteneceBarberia(
            row,
            String(
              idBarberia
            )
          )
      );

    if (indice < 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se encontró la reserva.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * comprobar conflicto
     */

    const nuevoInicio =
      horaMinutos(
        horaInicio
      );

    const nuevoFin =
      nuevoInicio +
      (Number(duracion) ===
      60
        ? 60
        : 45);

    const conflicto =
      reservas.some(
        (row) => {
          const idRow =
            String(
              row.ID_RESERVA ||
                ""
            ).trim();

          if (
            idRow ===
            String(id).trim()
          ) {
            return false;
          }

          if (
            !perteneceBarberia(
              row,
              String(
                idBarberia
              )
            )
          ) {
            return false;
          }

          const estado =
            String(
              row.ESTADO ||
                ""
            )
              .trim()
              .toUpperCase();

          if (
            estado ===
            "CANCELADA"
          ) {
            return false;
          }

          const fechaRow =
            fechaKey(
              String(
                row.FECHA ||
                  ""
              )
            );

          if (
            fechaRow !==
            String(fecha)
          ) {
            return false;
          }

          const idBarberoRow =
            normalizarComparacion(
              row.ID_BARBERO ||
                row.BARBERO_UID ||
                ""
            );

          const idBarberoNuevoPUT =
            normalizarComparacion(
              idBarbero
            );

          const nombreBarberoRow =
            normalizarComparacion(
              row.BARBERO ||
                nombreBarberoPorId.get(
                  idBarberoRow
                ) ||
                ""
            );

          if (
            idBarberoRow !==
              idBarberoNuevoPUT &&
            nombreBarberoRow !==
              nombreBarberoPorId.get(
                idBarberoNuevoPUT
              )
          ) {
            return false;
          }

          const inicioRow =
            horaMinutos(
              String(
                row.HORA_INICIO ||
                  ""
              )
            );

          const finRow =
            horaMinutos(
              String(
                row.HORA_FIN ||
                  ""
              )
            ) ||
            inicioRow +
              Number(
                row.DURACION ||
                  45
              );

          return (
            nuevoInicio <
              finRow &&
            nuevoFin >
              inicioRow
          );
        }
      );

    if (conflicto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El nuevo horario ya está ocupado.",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * =====================================================
     * ACTUALIZAR FILA
     *
     * Para poder editar una fila existente
     * usamos update sobre A:K.
     * =====================================================
     */

    const filaSheets =
      indice + 2;

    const horaFin =
      horaFinal(
        horaInicio,
        Number(duracion) ===
          60
          ? 60
          : 45
      );

    await sheets.spreadsheets.values.update(
      {
        spreadsheetId:
          SPREADSHEET_ID,

        range:
          `RESERVAS!A${filaSheets}:K${filaSheets}`,

        valueInputOption:
          "USER_ENTERED",

        requestBody: {
          values: [
            [
              id,
              String(
                idBarberia
              ),
              String(
                idCliente || ""
              ),
              String(
                idBarbero
              ),
              String(
                fecha
              ),
              String(
                horaInicio
              ),
              String(
                Number(
                  duracion
                ) === 60
                  ? 60
                  : 45
              ),
              horaFin,
              "RESERVA CONFIRMADA",
              reservas[
                indice
              ].CREADO_POR ||
                "",
              reservas[
                indice
              ].FECHA_CREACION ||
                new Date()
                  .toISOString(),
            ],
          ],
        },
      }
    );

    return NextResponse.json({
      ok: true,

      mensaje:
        "Reserva actualizada correctamente.",
    });
  } catch (error) {
    console.error(
      "PUT /reservas/api:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo editar la reserva.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   DELETE / CANCELAR
========================================================= */

export async function DELETE(
  request: NextRequest
) {
  return withReservationLock(async () => {
    try {
      const body =
        await request.json();

      const id =
        String(
          body?.id || ""
        ).trim();

      const accion =
        String(
          body?.accion || "cancelar"
        )
          .trim()
          .toLowerCase();

      const idBarberia =
        String(
          body?.idBarberia || ""
        ).trim();

      if (!id) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Falta ID_RESERVA.",
          },
          { status: 400 }
        );
      }

      if (!idBarberia) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Falta ID_BARBERIA.",
          },
          { status: 400 }
        );
      }

      /*
       * Leer directamente la hoja para identificar
       * la fila exacta y conservar todos los datos.
       */
      const response =
        await sheets.spreadsheets.values.get({
          spreadsheetId:
            SPREADSHEET_ID,
          range:
            "RESERVAS!A:Z",
        });

      const values =
        response.data.values || [];

      if (
        values.length < 2
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "No hay reservas para cancelar.",
          },
          { status: 404 }
        );
      }

      const headers =
        values[0].map(header);

      const indiceId =
        headers.indexOf(
          "ID_RESERVA"
        );

      const indiceBarberia =
        headers.indexOf(
          "ID_BARBERIA"
        );

      if (
        indiceId === -1 ||
        indiceBarberia === -1
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "La hoja RESERVAS debe contener ID_RESERVA e ID_BARBERIA.",
          },
          { status: 500 }
        );
      }

      let indiceFila =
        -1;

      let filaOriginal:
        string[] = [];

      for (
        let i = 1;
        i < values.length;
        i++
      ) {
        const fila =
          values[i] || [];

        const idFila =
          String(
            fila[indiceId] || ""
          ).trim();

        const barberiaFila =
          String(
            fila[indiceBarberia] || ""
          ).trim();

        if (
          idFila === id &&
          barberiaFila ===
            idBarberia
        ) {
          indiceFila = i;
          filaOriginal = [
            ...fila,
          ];
          break;
        }
      }

      if (
        indiceFila === -1
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "No se encontró la reserva.",
          },
          { status: 404 }
        );
      }

      const estadoIndex =
        headers.indexOf(
          "ESTADO"
        );

      const estadoActual =
        estadoIndex >= 0
          ? String(
              filaOriginal[
                estadoIndex
              ] || ""
            )
              .trim()
              .toUpperCase()
          : "";

      /*
       * =====================================================
       * ATENDER RESERVA
       *
       * Cuando el usuario pulsa "Atender Reserva", la cita
       * deja de formar parte de la agenda activa.
       *
       * IMPORTANTE:
       * - NO la marcamos como CANCELADA.
       * - NO la copiamos a RESERVAS_CANCELADAS.
       * - Solamente eliminamos la fila de RESERVAS.
       *
       * Los datos completos de la reserva ya fueron enviados
       * por la página a /atencion-pagos antes de navegar.
       * =====================================================
       */
      if (accion === "atender") {
        const sheetId =
          await obtenerSheetId(
            "RESERVAS"
          );

        if (sheetId === null) {
          throw new Error(
            "No se encontró la hoja RESERVAS."
          );
        }

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId:
            SPREADSHEET_ID,

          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: "ROWS",
                    startIndex: indiceFila,
                    endIndex: indiceFila + 1,
                  },
                },
              },
            ],
          },
        });

        const verificacionAtendida =
          await sheets.spreadsheets.values.get({
            spreadsheetId:
              SPREADSHEET_ID,
            range:
              "RESERVAS!A:Z",
          });

        const sigueExistiendoAtendida =
          (
            verificacionAtendida.data.values ||
            []
          )
            .slice(1)
            .some(
              (fila) =>
                String(
                  fila[indiceId] ||
                    ""
                ).trim() === id
            );

        if (sigueExistiendoAtendida) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "La reserva no pudo desaparecer de la agenda.",
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          atendida: true,
          eliminada: true,
          mensaje:
            "Reserva enviada a atención y eliminada de la agenda.",
          idReserva: id,
        });
      }

      if (
        estadoActual ===
        "CANCELADA"
      ) {
        return NextResponse.json({
          ok: true,
          cancelada: true,
          mensaje:
            "La reserva ya estaba cancelada.",
          idReserva: id,
        });
      }

      /*
       * =====================================================
       * 1. GUARDAR HISTORIAL
       *
       * La reserva sale de RESERVAS para liberar inmediatamente
       * el horario, pero no perdemos el dato:
       * se copia completa a RESERVAS_CANCELADAS.
       * =====================================================
       */
      await asegurarHojaCanceladas();

      const filaCancelada = [
        ...filaOriginal,
      ];

      /*
       * Asegurar ESTADO = CANCELADA
       */
      if (
        estadoIndex >= 0
      ) {
        while (
          filaCancelada.length <=
          estadoIndex
        ) {
          filaCancelada.push("");
        }

        filaCancelada[
          estadoIndex
        ] = "CANCELADA";
      }

      /*
       * Siempre dejamos FECHA_CANCELACION
       * como columna L.
       */
      while (
        filaCancelada.length <
        11
      ) {
        filaCancelada.push("");
      }

      filaCancelada.push(
        new Date().toISOString()
      );

      await sheets.spreadsheets.values.append({
        spreadsheetId:
          SPREADSHEET_ID,

        range:
          "RESERVAS_CANCELADAS!A:L",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values: [
            filaCancelada.slice(
              0,
              12
            ),
          ],
        },
      });

      /*
       * =====================================================
       * 2. ELIMINAR DE RESERVAS
       *
       * Esto hace que la reserva desaparezca realmente
       * de la agenda y libere el horario inmediatamente.
       * =====================================================
       */

      const sheetId =
        await obtenerSheetId(
          "RESERVAS"
        );

      if (
        sheetId === null
      ) {
        throw new Error(
          "No se encontró la hoja RESERVAS."
        );
      }

      /*
       * indiceFila:
       * 0 = encabezados
       * 1 = fila 2
       *
       * deleteDimension usa índices cero-based
       * donde startIndex es inclusivo.
       */
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId:
          SPREADSHEET_ID,

        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension:
                    "ROWS",
                  startIndex:
                    indiceFila,
                  endIndex:
                    indiceFila + 1,
                },
              },
            },
          ],
        },
      });

      /*
       * Verificación: confirmar que el ID ya no exista
       * en RESERVAS.
       */
      const verificacion =
        await sheets.spreadsheets.values.get({
          spreadsheetId:
            SPREADSHEET_ID,
          range:
            "RESERVAS!A:Z",
        });

      const sigueExistiendo =
        (
          verificacion.data.values ||
          []
        )
          .slice(1)
          .some(
            (fila) =>
              String(
                fila[indiceId] ||
                  ""
              ).trim() === id
          );

      if (
        sigueExistiendo
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "La reserva fue marcada pero no pudo eliminarse de RESERVAS.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        cancelada: true,
        eliminada: true,
        mensaje:
          "Reserva cancelada y eliminada de la agenda.",
        idReserva: id,
      });
    } catch (error) {
      console.error(
        "DELETE /reservas/api:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo cancelar la reserva.",
        },
        { status: 500 }
      );
    }
  });
}
