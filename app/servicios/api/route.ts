import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* =====================================================
   GOOGLE SHEETS
===================================================== */

const SPREADSHEET_ID =
  "1hi5h1EDVKvPjY0gQwkXGIoLQuDlWwcIMXQnZjrT9PII";

/* =====================================================
   AUTENTICACIÓN GOOGLE
===================================================== */

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

const auth =
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
  auth,
});

/* =====================================================
   UTILIDADES
===================================================== */

function normalizarHeader(
  valor: unknown
) {
  return String(
    valor ?? ""
  )
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

/* =====================================================
   GET
   OBTENER SERVICIOS
===================================================== */

export async function GET(
  request: NextRequest
) {
  try {
    const barberiaId =
      request.nextUrl.searchParams.get(
        "barberiaId"
      ) ||
      request.nextUrl.searchParams.get(
        "ID_BARBERIA"
      );

    const response =
      await sheets.spreadsheets.values.get(
        {
          spreadsheetId:
            SPREADSHEET_ID,

          range:
            "SERVICIOS!A:E",
        }
      );

    const filas =
      response.data.values || [];

    /* =================================================
       HOJA VACÍA
    ================================================= */

    if (
      filas.length === 0
    ) {
      return NextResponse.json({
        ok: true,
        servicios: [],
      });
    }

    /* =================================================
       ENCABEZADOS
    ================================================= */

    const encabezados =
      filas[0].map(
        normalizarHeader
      );

    const indiceIDServicio =
      encabezados.indexOf(
        "ID_SERVICIO"
      );

    const indiceIDBarberia =
      encabezados.indexOf(
        "ID_BARBERIA"
      );

    const indiceNombre =
      encabezados.indexOf(
        "NOMBRE"
      );

    const indiceDescripcion =
      encabezados.indexOf(
        "DESCRIPCION"
      );

    const indiceEstado =
      encabezados.indexOf(
        "ESTADO"
      );

    /* =================================================
       VALIDAR ESTRUCTURA
    ================================================= */

    const faltantes: string[] = [];

    if (
      indiceIDServicio === -1
    ) {
      faltantes.push(
        "ID_SERVICIO"
      );
    }

    if (
      indiceIDBarberia === -1
    ) {
      faltantes.push(
        "ID_BARBERIA"
      );
    }

    if (
      indiceNombre === -1
    ) {
      faltantes.push(
        "NOMBRE"
      );
    }

    if (
      indiceDescripcion === -1
    ) {
      faltantes.push(
        "DESCRIPCION"
      );
    }

    if (
      indiceEstado === -1
    ) {
      faltantes.push(
        "ESTADO"
      );
    }

    if (
      faltantes.length > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Faltan columnas en SERVICIOS: " +
            faltantes.join(
              ", "
            ),
        },
        {
          status: 500,
        }
      );
    }

    /* =================================================
       CONSTRUIR SERVICIOS
    ================================================= */

    const servicios =
      filas
        .slice(1)
        .map((fila) => ({
          ID_SERVICIO:
            String(
              fila[
                indiceIDServicio
              ] ?? ""
            ).trim(),

          ID_BARBERIA:
            String(
              fila[
                indiceIDBarberia
              ] ?? ""
            ).trim(),

          NOMBRE:
            String(
              fila[
                indiceNombre
              ] ?? ""
            ).trim(),

          DESCRIPCION:
            String(
              fila[
                indiceDescripcion
              ] ?? ""
            ).trim(),

          ESTADO:
            String(
              fila[
                indiceEstado
              ] ?? ""
            ).trim(),
        }))
        .filter(
          (servicio) =>
            servicio.ID_SERVICIO !== ""
        );

    /* =================================================
       FILTRAR POR BARBERÍA
    ================================================= */

    const resultado =
      barberiaId
        ? servicios.filter(
            (servicio) =>
              servicio.ID_BARBERIA ===
              String(
                barberiaId
              ).trim()
          )
        : servicios;

    return NextResponse.json({
      ok: true,
      servicios:
        resultado,
    });
  } catch (error: any) {
    console.error(
      "GET /servicios/api:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "No se pudieron cargar los servicios.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =====================================================
   POST
   CREAR SERVICIO
===================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    /* =================================================
       DATOS
    ================================================= */

    const nombre =
      String(
        body.nombre ??
          body.NOMBRE ??
          ""
      ).trim();

    const descripcion =
      String(
        body.descripcion ??
          body.DESCRIPCION ??
          ""
      ).trim();

    const barberiaId =
      String(
        body.barberiaId ??
          body.ID_BARBERIA ??
          ""
      ).trim();

    /* =================================================
       VALIDACIONES
    ================================================= */

    if (!nombre) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El nombre del servicio es obligatorio.",
        },
        {
          status: 400,
        }
      );
    }

    if (!barberiaId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La barbería es obligatoria.",
        },
        {
          status: 400,
        }
      );
    }

    /* =================================================
       LEER SERVICIOS EXISTENTES
    ================================================= */

    const response =
      await sheets.spreadsheets.values.get(
        {
          spreadsheetId:
            SPREADSHEET_ID,

          range:
            "SERVICIOS!A:E",
        }
      );

    const filas =
      response.data.values || [];

    /* =================================================
       EVITAR DUPLICADOS
    ================================================= */

    if (
      filas.length > 1
    ) {
      const encabezados =
        filas[0].map(
          normalizarHeader
        );

      const indiceIDBarberia =
        encabezados.indexOf(
          "ID_BARBERIA"
        );

      const indiceNombre =
        encabezados.indexOf(
          "NOMBRE"
        );

      if (
        indiceIDBarberia !==
          -1 &&
        indiceNombre !==
          -1
      ) {
        const duplicado =
          filas
            .slice(1)
            .some(
              (fila) => {
                const idBarberia =
                  String(
                    fila[
                      indiceIDBarberia
                    ] ?? ""
                  ).trim();

                const nombreExistente =
                  String(
                    fila[
                      indiceNombre
                    ] ?? ""
                  )
                    .trim()
                    .toLowerCase();

                return (
                  idBarberia ===
                    barberiaId &&
                  nombreExistente ===
                    nombre.toLowerCase()
                );
              }
            );

        if (duplicado) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Ya existe un servicio con ese nombre en esta barbería.",
            },
            {
              status: 409,
            }
          );
        }
      }
    }

    /* =================================================
       GENERAR ID
    ================================================= */

    const idServicio =
      `SER-${Date.now()}`;

    /* =================================================
       GUARDAR
       
       A ID_SERVICIO
       B ID_BARBERIA
       C NOMBRE
       D DESCRIPCION
       E ESTADO
    ================================================= */

    await sheets.spreadsheets.values.append(
      {
        spreadsheetId:
          SPREADSHEET_ID,

        range:
          "SERVICIOS!A:E",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values: [
            [
              idServicio,
              barberiaId,
              nombre,
              descripcion,
              "ACTIVO",
            ],
          ],
        },
      }
    );

    /* =================================================
       RESPUESTA
    ================================================= */

    return NextResponse.json({
      ok: true,

      mensaje:
        "Servicio creado correctamente.",

      servicio: {
        ID_SERVICIO:
          idServicio,

        ID_BARBERIA:
          barberiaId,

        NOMBRE:
          nombre,

        DESCRIPCION:
          descripcion,

        ESTADO:
          "ACTIVO",
      },
    });
  } catch (error: any) {
    console.error(
      "POST /servicios/api:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "No se pudo crear el servicio.",
      },
      {
        status: 500,
      }
    );
  }
}