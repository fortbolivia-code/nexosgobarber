import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* =========================================================
   CONFIGURACIÓN GOOGLE SHEETS
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
   MISMA CONFIGURACIÓN QUE BARBEROS
========================================================= */

const serviceAccountPath = path.join(
  process.cwd(),
  "serviceAccountKey.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(
    "No se encontró serviceAccountKey.json en la raíz del proyecto."
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(
    serviceAccountPath,
    "utf8"
  )
);

if (!serviceAccount.client_email) {
  throw new Error(
    "serviceAccountKey.json no contiene client_email."
  );
}

if (!serviceAccount.private_key) {
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
  string | number | null
>;

type Periodo =
  | "hoy"
  | "semana"
  | "mes"
  | "3meses"
  | "6meses"
  | "anio";

/* =========================================================
   UTILIDADES
========================================================= */

function header(
  value: unknown
): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/\s+/g, "_");
}

function numero(
  value: unknown
): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  let texto = String(value)
    .trim()
    .replace(/[^\d,.-]/g, "");

  if (
    texto.includes(",") &&
    texto.includes(".")
  ) {
    const ultimaComa =
      texto.lastIndexOf(",");

    const ultimoPunto =
      texto.lastIndexOf(".");

    if (
      ultimaComa >
      ultimoPunto
    ) {
      texto = texto
        .replace(/\./g, "")
        .replace(",", ".");
    } else {
      texto = texto.replace(
        /,/g,
        ""
      );
    }
  } else if (
    texto.includes(",")
  ) {
    texto = texto.replace(
      ",",
      "."
    );
  }

  const resultado =
    Number(texto);

  return Number.isFinite(
    resultado
  )
    ? resultado
    : 0;
}

/* =========================================================
   FECHAS
========================================================= */

function fecha(
  value: unknown
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const texto =
    String(value).trim();

  if (!texto) {
    return null;
  }

  /* YYYY-MM-DD */

  let match =
    texto.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (match) {
    const result =
      new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
      );

    return Number.isNaN(
      result.getTime()
    )
      ? null
      : result;
  }

  /* DD/MM/YYYY */

  match =
    texto.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    );

  if (match) {
    const result =
      new Date(
        Number(match[3]),
        Number(match[2]) - 1,
        Number(match[1])
      );

    return Number.isNaN(
      result.getTime()
    )
      ? null
      : result;
  }

  /* ISO / timestamp */

  const result =
    new Date(texto);

  if (
    Number.isNaN(
      result.getTime()
    )
  ) {
    return null;
  }

  return result;
}

function inicioDia(
  value: Date
): Date {
  const result =
    new Date(value);

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

function finDia(
  value: Date
): Date {
  const result =
    new Date(value);

  result.setHours(
    23,
    59,
    59,
    999
  );

  return result;
}

function inicioSemana(
  value: Date
): Date {
  const result =
    inicioDia(value);

  const dia =
    result.getDay();

  const diferencia =
    dia === 0
      ? 6
      : dia - 1;

  result.setDate(
    result.getDate() -
      diferencia
  );

  return result;
}

function inicioMes(
  value: Date
): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    1,
    0,
    0,
    0,
    0
  );
}

function inicioAnio(
  value: Date
): Date {
  return new Date(
    value.getFullYear(),
    0,
    1,
    0,
    0,
    0,
    0
  );
}

/* =========================================================
   RANGOS
========================================================= */

function obtenerRango(
  periodo: Periodo
) {
  const ahora =
    new Date();

  let inicio: Date;

  switch (periodo) {
    case "hoy":
      inicio =
        inicioDia(ahora);
      break;

    case "semana":
      inicio =
        inicioSemana(ahora);
      break;

    case "mes":
      inicio =
        inicioMes(ahora);
      break;

    case "3meses":
      inicio =
        new Date(ahora);

      inicio.setMonth(
        inicio.getMonth() -
          3
      );

      inicio =
        inicioDia(inicio);
      break;

    case "6meses":
      inicio =
        new Date(ahora);

      inicio.setMonth(
        inicio.getMonth() -
          6
      );

      inicio =
        inicioDia(inicio);
      break;

    case "anio":
      inicio =
        inicioAnio(ahora);
      break;

    default:
      inicio =
        inicioMes(ahora);
  }

  return {
    inicio,
    fin: finDia(ahora),
  };
}

function obtenerRangoAnterior(
  periodo: Periodo
) {
  const actual =
    obtenerRango(periodo);

  const duracion =
    actual.fin.getTime() -
    actual.inicio.getTime();

  const fin =
    new Date(
      actual.inicio.getTime() - 1
    );

  const inicio =
    new Date(
      fin.getTime() -
        duracion
    );

  return {
    inicio,
    fin,
  };
}

function estaDentro(
  valor: unknown,
  inicio: Date,
  fin: Date
) {
  const fechaValor =
    fecha(valor);

  if (!fechaValor) {
    return false;
  }

  return (
    fechaValor >= inicio &&
    fechaValor <= fin
  );
}

/* =========================================================
   IDENTIFICADORES
========================================================= */

function obtenerIdBarberia(
  row: Row
): string {
  return String(
    row.ID_BARBERIA ||
      row.BARBERIA_ID ||
      row.BARBERIAID ||
      ""
  ).trim();
}

function obtenerIdCliente(
  row: Row
): string {
  return String(
    row.ID_CLIENTE ||
      ""
  ).trim();
}

function obtenerIdBarbero(
  row: Row
): string {
  return String(
    row.ID_BARBERO ||
      row.ID ||
      ""
  ).trim();
}

function obtenerNombreBarbero(
  row: Row
): string {
  return String(
    row.NOMBRE ||
      row.NOMBRE_COMPLETO ||
      row.BARBERO ||
      "Sin nombre"
  ).trim();
}

function obtenerNombreCliente(
  row: Row
): string {
  return String(
    row.NOMBRE ||
      row.CLIENTE ||
      "Sin cliente"
  ).trim();
}

function obtenerComision(
  row: Row
): number {
  return numero(
    row.PORCENTAJE_COMISION ??
      row.COMISION ??
      row.COMISION_PORCENTAJE ??
      0
  );
}

function normalizarNombre(
  value: unknown
): string {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/\s+/g, " ");
}

/* =========================================================
   GOOGLE SHEETS
========================================================= */

async function leerHoja(
  nombreHoja: string
): Promise<Row[]> {
  const response =
    await sheets.spreadsheets.values.get(
      {
        spreadsheetId:
          SPREADSHEET_ID,
        range:
          `${nombreHoja}!A:Z`,
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
      const item: Row = {};

      headers.forEach(
        (
          nombre,
          index
        ) => {
          if (nombre) {
            item[nombre] =
              row[index] ?? "";
          }
        }
      );

      return item;
    });
}

async function agregarFila(
  hoja: string,
  valores: (
    | string
    | number
  )[]
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
   VARIACIÓN
========================================================= */

function variacion(
  actual: number,
  anterior: number
) {
  if (
    anterior === 0
  ) {
    return actual === 0
      ? 0
      : 100;
  }

  return (
    ((actual -
      anterior) /
      anterior) *
    100
  );
}

/* =========================================================
   GET FACTURACIÓN
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const params =
      request.nextUrl
        .searchParams;

    const periodo =
      (params.get(
        "periodo"
      ) ||
        "mes") as Periodo;

    const idBarberia =
      String(
        params.get(
          "idBarberia"
        ) || ""
      ).trim();

    const rol =
      String(
        params.get(
          "rol"
        ) ||
          "admin"
      )
        .trim()
        .toLowerCase();

    const idBarberoSolicitado =
      String(
        params.get(
          "idBarbero"
        ) || ""
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

    const {
      inicio,
      fin,
    } =
      obtenerRango(
        periodo
      );

    const rangoAnterior =
      obtenerRangoAnterior(
        periodo
      );

    /* =====================================================
       LEER TODAS LAS HOJAS
    ===================================================== */

    const [
      atencionesTodas,
      clientesTodas,
      barberosTodas,
      gastosTodas,
    ] =
      await Promise.all([
        leerHoja(
          "ATENCIONES"
        ),
        leerHoja(
          "CLIENTES"
        ),
        leerHoja(
          "BARBEROS"
        ),
        leerHoja(
          "GASTO"
        ),
      ]);

    /* =====================================================
       FILTRAR BARBERÍA
    ===================================================== */

    const atencionesBarberia =
      atencionesTodas.filter(
        (row) =>
          obtenerIdBarberia(
            row
          ) === idBarberia
      );

    const clientesBarberia =
      clientesTodas.filter(
        (row) =>
          obtenerIdBarberia(
            row
          ) === idBarberia
      );

    const barberosBarberia =
      barberosTodas.filter(
        (row) =>
          obtenerIdBarberia(
            row
          ) === idBarberia
      );

    const gastosBarberia =
      gastosTodas.filter(
        (row) =>
          obtenerIdBarberia(
            row
          ) === idBarberia
      );

    /* =====================================================
       MAPA CLIENTES
    ===================================================== */

    const clientesMap =
      new Map<
        string,
        string
      >();

    clientesBarberia.forEach(
      (cliente) => {
        const id =
          obtenerIdCliente(
            cliente
          );

        if (!id) {
          return;
        }

        clientesMap.set(
          id,
          obtenerNombreCliente(
            cliente
          )
        );
      }
    );

    /* =====================================================
       MAPA BARBEROS POR ID
    ===================================================== */

    const barberosPorId =
      new Map<
        string,
        Row
      >();

    /* =====================================================
       MAPA BARBEROS POR NOMBRE

       IMPORTANTE:
       ATENCIONES puede tener
       ID_BARBERO vacío pero
       BARBERO = "REFUGIO BARBER".
    ===================================================== */

    const barberosPorNombre =
      new Map<
        string,
        Row
      >();

    barberosBarberia.forEach(
      (barbero) => {
        const id =
          obtenerIdBarbero(
            barbero
          );

        const nombre =
          normalizarNombre(
            obtenerNombreBarbero(
              barbero
            )
          );

        if (id) {
          barberosPorId.set(
            id,
            barbero
          );
        }

        if (nombre) {
          barberosPorNombre.set(
            nombre,
            barbero
          );
        }
      }
    );

    /* =====================================================
       FUNCIÓN PARA ENCONTRAR BARBERO
    ===================================================== */

    function encontrarBarbero(
      atencion: Row
    ): Row | null {
      const idAtencion =
        String(
          atencion.ID_BARBERO ||
            ""
        ).trim();

      if (idAtencion) {
        const porId =
          barberosPorId.get(
            idAtencion
          );

        if (porId) {
          return porId;
        }
      }

      const nombreAtencion =
        normalizarNombre(
          atencion.BARBERO
        );

      if (
        nombreAtencion
      ) {
        const porNombre =
          barberosPorNombre.get(
            nombreAtencion
          );

        if (porNombre) {
          return porNombre;
        }
      }

      return null;
    }

    /* =====================================================
       ATENCIONES VISIBLES

       ADMIN:
       todos los barberos.

       BARBERO:
       solamente sus atenciones.
    ===================================================== */

    let atencionesVisibles =
      atencionesBarberia;

    if (
      rol === "barbero" &&
      idBarberoSolicitado
    ) {
      atencionesVisibles =
        atencionesBarberia.filter(
          (atencion) => {
            const idDirecto =
              String(
                atencion.ID_BARBERO ||
                  ""
              ).trim();

            if (
              idDirecto ===
              idBarberoSolicitado
            ) {
              return true;
            }

            const barbero =
              encontrarBarbero(
                atencion
              );

            return (
              obtenerIdBarbero(
                barbero || {}
              ) ===
              idBarberoSolicitado
            );
          }
        );
    }

    /* =====================================================
       ATENCIONES DEL PERIODO
    ===================================================== */

    const periodoRows =
      atencionesVisibles.filter(
        (atencion) =>
          estaDentro(
            atencion.FECHA,
            inicio,
            fin
          )
      );

    /* =====================================================
       ATENCIONES PERÍODO ANTERIOR
    ===================================================== */

    const anteriorRows =
      atencionesVisibles.filter(
        (atencion) =>
          estaDentro(
            atencion.FECHA,
            rangoAnterior.inicio,
            rangoAnterior.fin
          )
      );

    /* =====================================================
       INGRESOS
    ===================================================== */

    const ingresos =
      periodoRows.reduce(
        (
          total,
          atencion
        ) =>
          total +
          numero(
            atencion.MONTO
          ),
        0
      );

    const ingresosAnterior =
      anteriorRows.reduce(
        (
          total,
          atencion
        ) =>
          total +
          numero(
            atencion.MONTO
          ),
        0
      );

    /* =====================================================
       GASTOS

       SOLO SE ENTREGAN/CONTABILIZAN
       PARA ADMINISTRADOR
    ===================================================== */

    const gastosPeriodo =
      gastosBarberia.filter(
        (gasto) =>
          estaDentro(
            gasto.FECHA,
            inicio,
            fin
          )
      );

    const gastosAnteriorPeriodo =
      gastosBarberia.filter(
        (gasto) =>
          estaDentro(
            gasto.FECHA,
            rangoAnterior.inicio,
            rangoAnterior.fin
          )
      );

    const esAdmin =
      rol === "admin" ||
      rol === "super_admin";

    const totalGastos =
      esAdmin
        ? gastosPeriodo.reduce(
            (
              total,
              gasto
            ) =>
              total +
              numero(
                gasto.MONTO
              ),
            0
          )
        : 0;

    const totalGastosAnterior =
      esAdmin
        ? gastosAnteriorPeriodo.reduce(
            (
              total,
              gasto
            ) =>
              total +
              numero(
                gasto.MONTO
              ),
            0
          )
        : 0;

    /* =====================================================
       BARBEROS Y COMISIONES

       Se usa tanto ID_BARBERO
       como BARBERO por nombre.
    ===================================================== */

    const resumenBarberos =
      new Map<
        string,
        {
          id: string;
          nombre: string;
          ingresos: number;
          clientes: Set<string>;
          cortes: number;
          comisiones: number;
          fechaIngreso: string;
        }
      >();

    /* Primero agregamos todos
       los barberos de la barbería */

    barberosBarberia.forEach(
      (barbero) => {
        const id =
          obtenerIdBarbero(
            barbero
          );

        const nombre =
          obtenerNombreBarbero(
            barbero
          );

        if (!id) {
          return;
        }

        resumenBarberos.set(
          id,
          {
            id,
            nombre,
            ingresos: 0,
            clientes:
              new Set<string>(),
            cortes: 0,
            comisiones: 0,
            fechaIngreso:
              String(
                barbero.FECHA_INGRESO ||
                  barbero.FECHA_CREACION ||
                  ""
              ),
          }
        );
      }
    );

    /* Procesar atenciones */

    periodoRows.forEach(
      (atencion) => {
        const barbero =
          encontrarBarbero(
            atencion
          );

        const id =
          obtenerIdBarbero(
            barbero || {}
          );

        const nombreAtencion =
          String(
            atencion.BARBERO ||
              ""
          ).trim();

        const nombre =
          obtenerNombreBarbero(
            barbero || {
              NOMBRE:
                nombreAtencion ||
                "Sin registrar",
            }
          );

        const clave =
          id ||
          normalizarNombre(
            nombre
          ) ||
          "sin_barbero";

        if (
          !resumenBarberos.has(
            clave
          )
        ) {
          resumenBarberos.set(
            clave,
            {
              id,
              nombre,
              ingresos: 0,
              clientes:
                new Set<string>(),
              cortes: 0,
              comisiones: 0,
              fechaIngreso:
                String(
                  barbero?.FECHA_INGRESO ||
                    barbero?.FECHA_CREACION ||
                    ""
                ),
            }
          );
        }

        const resumen =
          resumenBarberos.get(
            clave
          )!;

        const monto =
          numero(
            atencion.MONTO
          );

        resumen.ingresos +=
          monto;

        resumen.cortes +=
          1;

        const idCliente =
          obtenerIdCliente(
            atencion
          );

        if (idCliente) {
          resumen.clientes.add(
            idCliente
          );
        }

        const porcentaje =
          obtenerComision(
            barbero || {}
          );

        if (
          porcentaje >
          0
        ) {
          const comisionMonto =
            porcentaje <= 1
              ? monto *
                porcentaje
              : monto *
                (porcentaje /
                  100);

          resumen.comisiones +=
            comisionMonto;
        }
      }
    );

    /* =====================================================
       TABLA BARBEROS

       ADMIN:
       todos.

       BARBERO:
       solamente él.
    ===================================================== */

    let tablaBarberos =
      Array.from(
        resumenBarberos.values()
      ).map(
        (barbero) => ({
          id:
            barbero.id,

          nombre:
            barbero.nombre,

          ingresos:
            barbero.ingresos,

          clientes:
            barbero.clientes.size,

          cortes:
            barbero.cortes,

          comisiones:
            barbero.comisiones,

          fechaIngreso:
            barbero.fechaIngreso,
        })
      );

    if (
      !esAdmin &&
      idBarberoSolicitado
    ) {
      tablaBarberos =
        tablaBarberos.filter(
          (barbero) =>
            barbero.id ===
            idBarberoSolicitado
        );
    }

    tablaBarberos.sort(
      (a, b) =>
        b.ingresos -
        a.ingresos
    );

    /* =====================================================
       COMISIONES
    ===================================================== */

    const totalComisiones =
      tablaBarberos.reduce(
        (
          total,
          barbero
        ) =>
          total +
          barbero.comisiones,
        0
      );

    /* =====================================================
       GANANCIA NETA

       SOLO ADMIN
    ===================================================== */

    const gananciaNeta =
      esAdmin
        ? ingresos -
          totalGastos -
          totalComisiones
        : 0;

    /* =====================================================
       CLIENTES NUEVOS / RECURRENTES

       NUEVO:
       nunca tuvo visita antes.

       RECURRENTE:
       ya tuvo al menos una visita
       antes de este período.
    ===================================================== */

    const visitasHistoricas =
      new Map<
        string,
        Date[]
      >();

    /*
     * IMPORTANTE:
     * aquí usamos TODAS las atenciones
     * históricas de la barbería,
     * no solamente el período.
     */

    atencionesBarberia.forEach(
      (atencion) => {
        const id =
          obtenerIdCliente(
            atencion
          );

        const fechaAtencion =
          fecha(
            atencion.FECHA
          );

        if (
          !id ||
          !fechaAtencion
        ) {
          return;
        }

        if (
          !visitasHistoricas.has(
            id
          )
        ) {
          visitasHistoricas.set(
            id,
            []
          );
        }

        visitasHistoricas
          .get(id)!
          .push(
            fechaAtencion
          );
      }
    );

    const clientesPeriodo =
      new Set<string>();

    periodoRows.forEach(
      (atencion) => {
        const id =
          obtenerIdCliente(
            atencion
          );

        if (id) {
          clientesPeriodo.add(
            id
          );
        }
      }
    );

    let clientesNuevos =
      0;

    let clientesRecurrentes =
      0;

    clientesPeriodo.forEach(
      (idCliente) => {
        const visitas =
          visitasHistoricas.get(
            idCliente
          ) || [];

        const tuvoAntes =
          visitas.some(
            (visita) =>
              visita < inicio
          );

        if (
          tuvoAntes
        ) {
          clientesRecurrentes++;
        } else {
          clientesNuevos++;
        }
      }
    );

    /* =====================================================
       TICKET PROMEDIO
    ===================================================== */

    const ticketPromedio =
      periodoRows.length >
      0
        ? ingresos /
          periodoRows.length
        : 0;

    /* =====================================================
       MÉTODOS DE PAGO
    ===================================================== */

    const pagos =
      new Map<
        string,
        {
          cantidad: number;
          monto: number;
        }
      >();

    periodoRows.forEach(
      (atencion) => {
        const metodo =
          String(
            atencion.METODO_PAGO ||
              "Sin registrar"
          ).trim();

        const actual =
          pagos.get(
            metodo
          ) || {
            cantidad: 0,
            monto: 0,
          };

        actual.cantidad +=
          1;

        actual.monto +=
          numero(
            atencion.MONTO
          );

        pagos.set(
          metodo,
          actual
        );
      }
    );

    const totalPagos =
      Array.from(
        pagos.values()
      ).reduce(
        (
          total,
          item
        ) =>
          total +
          item.cantidad,
        0
      );

    const metodosPago =
      Array.from(
        pagos.entries()
      )
        .map(
          ([
            nombre,
            datos,
          ]) => ({
            nombre,
            cantidad:
              datos.cantidad,
            monto:
              datos.monto,
            porcentaje:
              totalPagos >
              0
                ? (datos.cantidad /
                    totalPagos) *
                  100
                : 0,
          })
        )
        .sort(
          (a, b) =>
            b.cantidad -
            a.cantidad
        );

    /* =====================================================
       BARBEROS GRÁFICO
    ===================================================== */

    const cortesPorBarbero =
      new Map<
        string,
        number
      >();

    periodoRows.forEach(
      (atencion) => {
        const barbero =
          encontrarBarbero(
            atencion
          );

        const nombre =
          obtenerNombreBarbero(
            barbero || {
              NOMBRE:
                String(
                  atencion.BARBERO ||
                    "Sin registrar"
                ),
            }
          );

        cortesPorBarbero.set(
          nombre,
          (cortesPorBarbero.get(
            nombre
          ) || 0) + 1
        );
      }
    );

    const totalCortes =
      Array.from(
        cortesPorBarbero.values()
      ).reduce(
        (
          total,
          cantidad
        ) =>
          total + cantidad,
        0
      );

    const barberosGrafico =
      Array.from(
        cortesPorBarbero.entries()
      )
        .map(
          ([
            nombre,
            cantidad,
          ]) => ({
            nombre,
            cantidad,
            porcentaje:
              totalCortes >
              0
                ? (cantidad /
                    totalCortes) *
                  100
                : 0,
          })
        )
        .sort(
          (a, b) =>
            b.cantidad -
            a.cantidad
        );

    /* =====================================================
       TRANSACCIONES
       MÁXIMO 10
    ===================================================== */

    const transacciones =
      periodoRows
        .map(
          (
            atencion,
            index
          ) => {
            const clienteNombre =
              clientesMap.get(
                obtenerIdCliente(
                  atencion
                )
              );

            const barbero =
              encontrarBarbero(
                atencion
              );

            return {
              id:
                String(
                  atencion.ID_ATENCION ||
                    `TX-${index}-${String(
                      atencion.FECHA ||
                        ""
                    )}`
                ),

              cliente:
                String(
                  atencion.CLIENTE ||
                    clienteNombre ||
                    obtenerIdCliente(
                      atencion
                    ) ||
                    "Sin cliente"
                ),

              fecha:
                String(
                  atencion.FECHA ||
                    ""
                ),

              servicio:
                String(
                  atencion.SERVICIO ||
                    "Sin servicio"
                ),

              barbero:
                String(
                  atencion.BARBERO ||
                    obtenerNombreBarbero(
                      barbero || {}
                    ) ||
                    "Sin registrar"
                ),

              metodoPago:
                String(
                  atencion.METODO_PAGO ||
                    "Sin registrar"
                ),

              total:
                numero(
                  atencion.MONTO
                ),
            };
          }
        )
        .sort(
          (a, b) => {
            const fechaA =
              fecha(
                a.fecha
              )?.getTime() || 0;

            const fechaB =
              fecha(
                b.fecha
              )?.getTime() || 0;

            return (
              fechaB -
              fechaA
            );
          }
        )
        .slice(0, 10);

    /* =====================================================
       INGRESOS POR DÍA
    ===================================================== */

    const ingresosPorDia =
      new Map<
        string,
        {
          monto: number;
          atenciones: number;
        }
      >();

    periodoRows.forEach(
      (atencion) => {
        const fechaAtencion =
          fecha(
            atencion.FECHA
          );

        if (
          !fechaAtencion
        ) {
          return;
        }

        const clave =
          `${fechaAtencion.getFullYear()}-${String(
            fechaAtencion.getMonth() +
              1
          ).padStart(
            2,
            "0"
          )}-${String(
            fechaAtencion.getDate()
          ).padStart(
            2,
            "0"
          )}`;

        const actual =
          ingresosPorDia.get(
            clave
          ) || {
            monto: 0,
            atenciones: 0,
          };

        actual.monto +=
          numero(
            atencion.MONTO
          );

        actual.atenciones +=
          1;

        ingresosPorDia.set(
          clave,
          actual
        );
      }
    );

    const ingresosGrafico =
      Array.from(
        ingresosPorDia.entries()
      )
        .sort(
          ([a], [b]) =>
            a.localeCompare(
              b
            )
        )
        .map(
          ([
            fecha,
            valores,
          ]) => ({
            fecha,
            monto:
              valores.monto,
            atenciones:
              valores.atenciones,
            ticket:
              valores.atenciones >
              0
                ? valores.monto /
                  valores.atenciones
                : 0,
          })
        );

    /* =====================================================
       COMPARACIÓN
    ===================================================== */

    const crecimientoIngresos =
      variacion(
        ingresos,
        ingresosAnterior
      );

    const crecimientoAtenciones =
      variacion(
        periodoRows.length,
        anteriorRows.length
      );

    const crecimientoGastos =
      variacion(
        totalGastos,
        totalGastosAnterior
      );

    /* =====================================================
       GASTOS PARA RESPUESTA
    ===================================================== */

    const gastos =
      esAdmin
        ? gastosPeriodo
            .map((gasto) => ({
              id:
                String(
                  gasto.ID_GASTO ||
                    ""
                ),

              nombre:
                String(
                  gasto.NOMBRE ||
                    ""
                ),

              monto:
                numero(
                  gasto.MONTO
                ),

              moneda:
                String(
                  gasto.MONEDA ||
                    "BOB"
                ),

              fecha:
                String(
                  gasto.FECHA ||
                    ""
                ),

              descripcion:
                String(
                  gasto.DESCRIPCION ||
                    ""
                ),

              idUsuario:
                String(
                  gasto.ID_USUARIO ||
                    ""
                ),
            }))
            .sort(
              (a, b) => {
                const fechaA =
                  fecha(
                    a.fecha
                  )?.getTime() || 0;

                const fechaB =
                  fecha(
                    b.fecha
                  )?.getTime() || 0;

                return (
                  fechaB -
                  fechaA
                );
              }
            )
        : [];

    /* =====================================================
       RESPUESTA FINAL
    ===================================================== */

    return NextResponse.json({
      ok: true,

      periodo,

      resumen: {
        ingresos,

        gastos:
          totalGastos,

        comisiones:
          totalComisiones,

        gananciaNeta,

        ticketPromedio,

        clientesNuevos,

        clientesRecurrentes,

        atenciones:
          periodoRows.length,

        crecimientoIngresos,

        crecimientoAtenciones,
      },

      comparacion: {
        ingresosAnterior,

        gastosAnterior:
          totalGastosAnterior,

        crecimientoIngresos,

        crecimientoGastos,

        crecimientoAtenciones,
      },

      barberos:
        tablaBarberos,

      transacciones,

      metodosPago,

      barberosGrafico,

      ingresosGrafico,

      gastos,
    });
  } catch (error) {
    console.error(
      "GET /facturacion/api:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Error interno de facturación.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST - AGREGAR GASTO
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const accion =
      String(
        body.accion ||
          ""
      ).trim();

    if (
      accion !==
      "agregar_gasto"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Acción no válida.",
        },
        {
          status: 400,
        }
      );
    }

    const nombre =
      String(
        body.nombre ||
          ""
      ).trim();

    const monto =
      numero(
        body.monto
      );

    const idBarberia =
      String(
        body.idBarberia ||
          ""
      ).trim();

    const idUsuario =
      String(
        body.idUsuario ||
          ""
      ).trim();

    const descripcion =
      String(
        body.descripcion ||
          ""
      ).trim();

    const fechaRecibida =
      String(
        body.fecha ||
          ""
      ).trim();

    const rol =
      String(
        body.rol ||
          ""
      )
        .trim()
        .toLowerCase();

    /* =====================================================
       PERMISOS
    ===================================================== */

    if (
      rol !== "admin" &&
      rol !== "super_admin"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Solo el administrador puede registrar gastos.",
        },
        {
          status: 403,
        }
      );
    }

    /* =====================================================
       VALIDACIONES
    ===================================================== */

    if (!nombre) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El nombre del gasto es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      monto <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El monto debe ser mayor a 0.",
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

    /* =====================================================
       FECHA
    ===================================================== */

    let fechaFinal =
      new Date()
        .toISOString()
        .slice(0, 10);

    if (
      fechaRecibida
    ) {
      const fechaSeleccionada =
        fecha(
          fechaRecibida
        );

      if (
        fechaSeleccionada
      ) {
        fechaFinal =
          `${fechaSeleccionada.getFullYear()}-${String(
            fechaSeleccionada.getMonth() +
              1
          ).padStart(
            2,
            "0"
          )}-${String(
            fechaSeleccionada.getDate()
          ).padStart(
            2,
            "0"
          )}`;
      }
    }

    /* =====================================================
       ID GASTO
    ===================================================== */

    const idGasto =
      `GAS-${Date.now()}`;

    /* =====================================================
       MONEDA
       POR AHORA SIEMPRE BOB
    ===================================================== */

    const moneda =
      "BOB";

    /* =====================================================
       GASTO
       ORDEN EXACTO DE TU HOJA
       
       A ID_GASTO
       B ID_BARBERIA
       C NOMBRE
       D MONTO
       E MONEDA
       F FECHA
       G DESCRIPCION
       H ID_USUARIO
    ===================================================== */

    await agregarFila(
      "GASTO",
      [
        idGasto,
        idBarberia,
        nombre,
        monto,
        moneda,
        fechaFinal,
        descripcion,
        idUsuario,
      ]
    );

    return NextResponse.json({
      ok: true,

      mensaje:
        "Gasto registrado correctamente.",

      gasto: {
        id:
          idGasto,

        idBarberia:
          idBarberia,

        nombre,

        monto,

        moneda,

        fecha:
          fechaFinal,

        descripcion,

        idUsuario,
      },
    });
  } catch (error) {
    console.error(
      "POST /facturacion/api:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "No se pudo registrar el gasto.",
      },
      {
        status: 500,
      }
    );
  }
}